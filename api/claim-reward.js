import { ethers } from 'ethers';
import {
  buildClaimMessage,
  getErc1155TransferAbi,
  getTokenGateUnits,
  hasTokenGateAccess,
  isFreshIssuedAt,
  normalizeAddress,
  parseJsonBody,
  parseRewardTokenIds,
  pickRandomRewardAllocations
} from './_lib/claimUtils.js';
import {
  extractUniqueTokenIds,
  fetchOpenSeaWalletCollectionNfts,
  fetchOpenSeaWalletContractNfts
} from './_lib/opensea.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name} env variable.`);
  }
  return value;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function parseNonNegativeInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  return fallback;
}

function parseRewardRandomStrategy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'unit_weighted') return 'unit_weighted';
  return 'token_uniform';
}

function parseGweiToWei(value, fallbackGwei) {
  const raw = String(value || fallbackGwei).trim();
  return ethers.parseUnits(raw, 'gwei');
}

function parseCsvBigIntIds(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => BigInt(entry));
}

function randomIndex(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer.');
  }

  const bytes = 4;
  const max = 2 ** (bytes * 8);
  while (true) {
    const value = Number(`0x${Buffer.from(ethers.randomBytes(bytes)).toString('hex')}`);
    const normalized = Math.floor((value / max) * maxExclusive);
    if (normalized >= 0 && normalized < maxExclusive) return normalized;
  }
}

function parseRpcUrls(value) {
  const parts = String(value || '')
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const seen = new Set();
  const urls = [];
  for (const entry of parts) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    urls.push(entry);
  }

  return urls;
}

function buildRpcProviderPool(runtime) {
  const urls = [];
  const primary = String(runtime.baseRpcUrl || '').trim() || 'https://mainnet.base.org';
  urls.push(primary);

  for (const fallback of parseRpcUrls(runtime.baseRpcFallbackUrls)) {
    if (!urls.includes(fallback)) {
      urls.push(fallback);
    }
  }

  return urls.map((url) => ({ url, provider: new ethers.JsonRpcProvider(url) }));
}

function isRpcLogRetryable(error) {
  const code = String(error?.code || '').toUpperCase();
  const nestedCode = Number(error?.error?.code ?? error?.info?.error?.code ?? NaN);
  const text = [
    error?.message,
    error?.shortMessage,
    error?.reason,
    error?.error?.message,
    error?.info?.error?.message
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (nestedCode === -32011) return true;
  if (
    code === 'UNKNOWN_ERROR' ||
    code === 'SERVER_ERROR' ||
    code === 'NETWORK_ERROR' ||
    code === 'TIMEOUT'
  ) {
    return true;
  }

  return (
    text.includes('no backend is currently healthy') ||
    text.includes('could not coalesce error') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('temporarily unavailable') ||
    text.includes('service unavailable') ||
    text.includes('gateway timeout') ||
    text.includes('too many requests') ||
    text.includes('rate limit') ||
    text.includes('econnreset') ||
    text.includes('etimedout') ||
    text.includes('socket hang up')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRpcLogFailover({ rpcProviders, runtime, operation, run }) {
  const providers =
    Array.isArray(rpcProviders) && rpcProviders.length > 0
      ? rpcProviders
      : buildRpcProviderPool(runtime || {});
  const retriesPerProvider = parsePositiveInt(runtime?.rpcLogRetryAttempts, 4);
  const delayMs = parsePositiveInt(runtime?.rpcLogRetryDelayMs, 350);
  const totalAttempts = Math.max(1, retriesPerProvider) * providers.length;
  let lastError = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const providerEntry = providers[(attempt - 1) % providers.length];
    try {
      return await run(providerEntry.provider);
    } catch (error) {
      lastError = error;
      const retryable = isRpcLogRetryable(error);
      if (!retryable || attempt >= totalAttempts) {
        break;
      }
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : String(lastError || 'Unknown RPC error');
  throw new Error(
    `${operation} failed after ${totalAttempts} attempts across ${providers.length} RPC endpoint(s): ${reason}`
  );
}

async function buildLowGasOverrides(provider, runtime) {
  const mode = String(runtime.rewardGasMode || 'lowest').trim().toLowerCase();
  if (mode !== 'lowest') return {};

  const feeData = await provider.getFeeData();
  const minPriorityFeePerGas = parseGweiToWei(runtime.rewardMinPriorityGwei, '0.000001');
  const baseFeeMultiplierBps = parsePositiveInt(runtime.rewardBaseFeeMultiplierBps, 10000);
  const gasPriceMultiplierBps = parsePositiveInt(runtime.rewardGasPriceMultiplierBps, 10000);
  const overrides = {};

  if (feeData.lastBaseFeePerGas !== null && feeData.lastBaseFeePerGas !== undefined) {
    const scaledBaseFee = (feeData.lastBaseFeePerGas * BigInt(baseFeeMultiplierBps)) / 10000n;
    overrides.maxPriorityFeePerGas = minPriorityFeePerGas;
    overrides.maxFeePerGas = scaledBaseFee + minPriorityFeePerGas;
  } else if (feeData.gasPrice !== null && feeData.gasPrice !== undefined) {
    overrides.gasPrice = (feeData.gasPrice * BigInt(gasPriceMultiplierBps)) / 10000n;
  }

  const configuredGasLimit = Number.parseInt(String(runtime.rewardGasLimit || ''), 10);
  if (Number.isInteger(configuredGasLimit) && configuredGasLimit > 0) {
    overrides.gasLimit = configuredGasLimit;
  }

  return overrides;
}

function bumpByBps(value, bps) {
  return (value * BigInt(bps)) / 10000n;
}

function applyFeeBump(overrides, bumpBps) {
  const bumped = { ...overrides };

  if (overrides.maxFeePerGas !== undefined && overrides.maxPriorityFeePerGas !== undefined) {
    bumped.maxPriorityFeePerGas = bumpByBps(overrides.maxPriorityFeePerGas, bumpBps) + 1n;
    bumped.maxFeePerGas = bumpByBps(overrides.maxFeePerGas, bumpBps) + 1n;
  } else if (overrides.gasPrice !== undefined) {
    bumped.gasPrice = bumpByBps(overrides.gasPrice, bumpBps) + 1n;
  }

  return bumped;
}

const ERC1155_LOG_INTERFACE = new ethers.Interface([
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]);
const ERC1155_BALANCE_OF_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];
const ERC721_GATE_TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
];
const ERC1155_TRANSFER_INTERFACE = new ethers.Interface(getErc1155TransferAbi());
const CLAIM_CONTEXT_TAG = 'BURN_TO_REDEEM_GATE_TOKEN_V1';
const CLAIM_CONTEXT_ABI = ethers.AbiCoder.defaultAbiCoder();

function dedupeBigIntValues(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = value.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function sortBigIntValues(values) {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function encodeClaimContextData({ gateTokenId }) {
  if (gateTokenId === null || gateTokenId === undefined) return '0x';
  return CLAIM_CONTEXT_ABI.encode(['string', 'uint256'], [CLAIM_CONTEXT_TAG, gateTokenId]);
}

function decodeClaimContextGateTokenId(data) {
  if (!data || data === '0x') return null;
  try {
    const [tag, gateTokenId] = CLAIM_CONTEXT_ABI.decode(['string', 'uint256'], data);
    if (String(tag || '') !== CLAIM_CONTEXT_TAG) return null;
    return BigInt(gateTokenId.toString());
  } catch {
    return null;
  }
}

function parseGateTokenConfigIds(runtime) {
  const configuredIds = parseCsvBigIntIds(runtime.tokenGateTokenIds);
  if (configuredIds.length > 0) return configuredIds;

  const singleId = Number.parseInt(String(runtime.tokenGateTokenId || '0'), 10);
  if (Number.isInteger(singleId) && singleId > 0) {
    return [BigInt(singleId)];
  }

  return [];
}

async function getOwnedErc721GateTokenIds({ provider, walletAddress, runtime }) {
  const gateContract = new ethers.Contract(runtime.tokenGateContract, ERC721_GATE_TOKEN_ABI, provider);
  const configuredIds = parseGateTokenConfigIds(runtime);
  const owned = [];

  if (configuredIds.length > 0) {
    for (const tokenId of configuredIds) {
      try {
        const owner = await gateContract.ownerOf(tokenId);
        if (owner.toLowerCase() === walletAddress.toLowerCase()) {
          owned.push(tokenId);
        }
      } catch {
        // Ignore token IDs that revert on ownerOf.
      }
    }
    return sortBigIntValues(owned);
  }

  let balance = 0n;
  try {
    balance = await gateContract.balanceOf(walletAddress);
  } catch {
    return [];
  }

  const cappedBalance = balance > 500n ? 500n : balance;
  for (let i = 0n; i < cappedBalance; i += 1n) {
    try {
      const tokenId = await gateContract.tokenOfOwnerByIndex(walletAddress, i);
      owned.push(BigInt(tokenId.toString()));
    } catch {
      // Contract likely does not support ERC721Enumerable.
      return [];
    }
  }

  return sortBigIntValues(dedupeBigIntValues(owned));
}

async function discoverRewardTokenIdsFromTreasuryLogs({
  rpcProviders,
  runtime,
  rewardContractAddress,
  treasuryAddress,
  startBlock,
  step,
  maxCandidateIds
}) {
  const latestBlock = await withRpcLogFailover({
    rpcProviders,
    runtime,
    operation: 'Reward token discovery latest block fetch',
    run: (provider) => provider.getBlockNumber()
  });
  if (startBlock <= 0 || startBlock > latestBlock) {
    return [];
  }

  const transferSingleTopic = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
  const transferBatchTopic = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');
  const treasuryTopic = ethers.zeroPadValue(treasuryAddress, 32);
  const candidateIds = new Set();
  let reachedCap = false;

  for (let from = startBlock; from <= latestBlock && !reachedCap; from += step) {
    const to = Math.min(from + step - 1, latestBlock);

    const logGroups = await Promise.all([
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Reward token discovery TransferSingle out logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferSingleTopic, null, treasuryTopic]
          })
      }),
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Reward token discovery TransferSingle in logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferSingleTopic, null, null, treasuryTopic]
          })
      }),
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Reward token discovery TransferBatch out logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferBatchTopic, null, treasuryTopic]
          })
      }),
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Reward token discovery TransferBatch in logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferBatchTopic, null, null, treasuryTopic]
          })
      })
    ]);

    const allLogs = logGroups.flat();
    for (const log of allLogs) {
      try {
        const parsed = ERC1155_LOG_INTERFACE.parseLog(log);
        if (!parsed) continue;

        if (parsed.name === 'TransferSingle') {
          candidateIds.add(parsed.args.id.toString());
        } else if (parsed.name === 'TransferBatch') {
          for (const tokenId of parsed.args.ids) {
            candidateIds.add(tokenId.toString());
          }
        }
      } catch {
        // Ignore logs that fail to decode.
      }

      if (candidateIds.size >= maxCandidateIds) {
        reachedCap = true;
        break;
      }
    }
  }

  if (candidateIds.size === 0) {
    return [];
  }

  const sortedCandidates = sortBigIntValues(Array.from(candidateIds, (value) => BigInt(value)));
  const positiveBalanceIds = [];
  for (const tokenId of sortedCandidates) {
    const balance = await withRpcLogFailover({
      rpcProviders,
      runtime,
      operation: `Reward token discovery treasury balance check for token ${tokenId.toString()}`,
      run: (provider) => {
        const rewardContract = new ethers.Contract(
          rewardContractAddress,
          ERC1155_BALANCE_OF_ABI,
          provider
        );
        return rewardContract.balanceOf(treasuryAddress, tokenId);
      }
    });
    if (balance > 0n) {
      positiveBalanceIds.push(tokenId);
    }
  }

  return positiveBalanceIds;
}

async function countWalletClaimsFromLogs({
  rpcProviders,
  runtime,
  rewardContractAddress,
  treasuryAddress,
  walletAddress,
  startBlock,
  step
}) {
  const latestBlock = await withRpcLogFailover({
    rpcProviders,
    runtime,
    operation: 'Claim count latest block fetch',
    run: (provider) => provider.getBlockNumber()
  });
  if (startBlock <= 0 || startBlock > latestBlock) {
    return 0;
  }

  const transferSingleTopic = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
  const transferBatchTopic = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');
  const fromTopic = ethers.zeroPadValue(treasuryAddress, 32);
  const toTopic = ethers.zeroPadValue(walletAddress, 32);

  let count = 0;
  for (let from = startBlock; from <= latestBlock; from += step) {
    const to = Math.min(from + step - 1, latestBlock);
    const [batchLogs, singleLogs] = await Promise.all([
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Claim count TransferBatch logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferBatchTopic, null, fromTopic, toTopic]
          })
      }),
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Claim count TransferSingle logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferSingleTopic, null, fromTopic, toTopic]
          })
      })
    ]);
    count += batchLogs.length + singleLogs.length;
  }

  return count;
}

function parseClaimContextGateTokenIdFromTxData(data) {
  if (!data || data === '0x') return null;

  try {
    const decoded = ERC1155_TRANSFER_INTERFACE.decodeFunctionData('safeBatchTransferFrom', data);
    return decodeClaimContextGateTokenId(decoded[4]);
  } catch {
    // Not a safeBatchTransferFrom call.
  }

  try {
    const decoded = ERC1155_TRANSFER_INTERFACE.decodeFunctionData('safeTransferFrom', data);
    return decodeClaimContextGateTokenId(decoded[4]);
  } catch {
    return null;
  }
}

async function collectClaimedGateTokenIdsFromRewardLogs({
  rpcProviders,
  runtime,
  rewardContractAddress,
  treasuryAddress,
  startBlock,
  step
}) {
  const claimedTokenIds = new Set();
  const txHashes = new Set();
  const latestBlock = await withRpcLogFailover({
    rpcProviders,
    runtime,
    operation: 'Gate-token claim history latest block fetch',
    run: (provider) => provider.getBlockNumber()
  });

  if (startBlock <= 0 || startBlock > latestBlock) {
    return claimedTokenIds;
  }

  const transferSingleTopic = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
  const transferBatchTopic = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');
  const fromTopic = ethers.zeroPadValue(treasuryAddress, 32);

  for (let from = startBlock; from <= latestBlock; from += step) {
    const to = Math.min(from + step - 1, latestBlock);
    const [batchLogs, singleLogs] = await Promise.all([
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Gate-token claim history TransferBatch logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferBatchTopic, null, fromTopic]
          })
      }),
      withRpcLogFailover({
        rpcProviders,
        runtime,
        operation: `Gate-token claim history TransferSingle logs (${from}-${to})`,
        run: (provider) =>
          provider.getLogs({
            address: rewardContractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [transferSingleTopic, null, fromTopic]
          })
      })
    ]);

    for (const log of [...batchLogs, ...singleLogs]) {
      if (log?.transactionHash) {
        txHashes.add(log.transactionHash.toLowerCase());
      }
    }
  }

  for (const txHash of txHashes) {
    const tx = await withRpcLogFailover({
      rpcProviders,
      runtime,
      operation: `Gate-token claim transaction decode (${txHash})`,
      run: (provider) => provider.getTransaction(txHash)
    });
    if (!tx?.data) continue;

    const gateTokenId = parseClaimContextGateTokenIdFromTxData(tx.data);
    if (gateTokenId === null) continue;
    claimedTokenIds.add(gateTokenId.toString());
  }

  return claimedTokenIds;
}

async function sendWithRetryEscalation({
  provider,
  signer,
  txRequest,
  initialGasOverrides,
  runtime
}) {
  const retryAttempts = parsePositiveInt(runtime.rewardTxRetryAttempts, 3);
  const waitMs = parsePositiveInt(runtime.rewardTxRetryWaitMs, 30000);
  const bumpBps = parsePositiveInt(runtime.rewardRetryFeeBumpBps, 12500);
  const sentHashes = [];

  let feeOverrides = { ...initialGasOverrides };
  let lastTxHash = null;

  for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
    if (attempt > 0) {
      feeOverrides = applyFeeBump(feeOverrides, bumpBps);
    }

    let tx;
    try {
      tx = await signer.sendTransaction({ ...txRequest, ...feeOverrides });
      sentHashes.push(tx.hash);
      lastTxHash = tx.hash;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const nonceConflict =
        message.includes('nonce has already been used') ||
        message.includes('nonce too low') ||
        message.includes('already known');

      if (!nonceConflict) {
        throw error;
      }

      for (const hash of sentHashes) {
        const receipt = await provider.getTransactionReceipt(hash);
        if (receipt) {
          return { txHash: hash, receipt, sentHashes, attemptsUsed: attempt + 1 };
        }
      }

      continue;
    }

    const receipt = await provider.waitForTransaction(tx.hash, 1, waitMs);
    if (receipt) {
      return { txHash: tx.hash, receipt, sentHashes, attemptsUsed: attempt + 1 };
    }
  }

  if (!lastTxHash) {
    throw new Error('Failed to submit treasury transfer transaction.');
  }

  const fallbackReceipt = await provider.waitForTransaction(lastTxHash, 1, 120000);
  if (fallbackReceipt) {
    return { txHash: lastTxHash, receipt: fallbackReceipt, sentHashes, attemptsUsed: retryAttempts };
  }

  throw new Error(`Reward transfer still pending after ${retryAttempts} attempts.`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const runtime = await getRuntimeConfigForRequest(req);
    const body = parseJsonBody(req);
    const address = normalizeAddress(body.address);
    const signature = String(body.signature || '');
    const gatePass = String(body.gatePass || '');
    const chainId = Number.parseInt(String(body.chainId || ''), 10);
    const issuedAt = Number(body.issuedAt || 0);

    if (!signature) {
      return res.status(400).json({ ok: false, error: 'Missing signature.' });
    }

    if (chainId !== runtime.chainId) {
      return res.status(400).json({ ok: false, error: `Wrong chain. Expected ${runtime.chainId}.` });
    }

    if (!isFreshIssuedAt(issuedAt, runtime.claimMessageTtlSeconds)) {
      return res.status(400).json({ ok: false, error: 'Claim signature expired. Please sign again.' });
    }

    const message = buildClaimMessage({ address, chainId, issuedAt, gatePass });
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ ok: false, error: 'Signature verification failed.' });
    }

    const rpcProviders = buildRpcProviderPool(runtime);
    const provider = rpcProviders[0].provider;
    const hasAccess = await hasTokenGateAccess(provider, address, runtime);
    if (!hasAccess) {
      return res.status(403).json({ ok: false, error: 'Wallet no longer holds the token-gated NFT.' });
    }

    const treasuryPrivateKey = runtime.treasuryPrivateKey || requireEnv('TREASURY_PRIVATE_KEY');
    const rewardContractAddress = normalizeAddress(runtime.rewardErc1155Contract || requireEnv('REWARD_ERC1155_CONTRACT'));
    const configuredRewardTokenIdsRaw = String(
      runtime.rewardErc1155TokenIds || process.env.REWARD_ERC1155_TOKEN_IDS || ''
    ).trim();
    const rewardNftsPerClaim = Number.parseInt(String(runtime.rewardNftsPerClaim || '20'), 10);
    const rewardRandomStrategy = parseRewardRandomStrategy(runtime.rewardRandomStrategy);
    const claimsPerGateToken = parsePositiveInt(runtime.claimsPerGateToken, 1);
    const rewardClaimStartBlock = parseNonNegativeInt(runtime.rewardClaimStartBlock, 0);
    const rewardLogScanStep = parsePositiveInt(runtime.rewardLogScanStep, 9000);
    const rewardTokenDiscoveryStartBlock = parseNonNegativeInt(
      runtime.rewardTokenDiscoveryStartBlock,
      rewardClaimStartBlock
    );
    const rewardTokenDiscoveryLogScanStep = parsePositiveInt(
      runtime.rewardTokenDiscoveryLogScanStep,
      rewardLogScanStep
    );
    const rewardTokenDiscoveryMaxItems = parsePositiveInt(runtime.rewardTokenDiscoveryMaxItems, 20000);
    const rewardCollectionSlug = String(
      runtime.rewardCollectionSlug || process.env.REWARD_COLLECTION_SLUG || 'cc0-by-pierre'
    ).trim();

    if (!Number.isInteger(rewardNftsPerClaim) || rewardNftsPerClaim <= 0) {
      return res.status(400).json({ ok: false, error: 'REWARD_NFTS_PER_CLAIM must be a positive integer.' });
    }

    if (rewardClaimStartBlock <= 0) {
      return res.status(500).json({ ok: false, error: 'REWARD_CLAIM_START_BLOCK must be configured for claim limit enforcement.' });
    }

    const treasurySigner = new ethers.Wallet(treasuryPrivateKey, provider);
    const treasuryAddress =
      String(runtime.treasuryWalletAddress || '').trim() || treasurySigner.address;

    if (treasuryAddress.toLowerCase() !== treasurySigner.address.toLowerCase()) {
      return res.status(500).json({ ok: false, error: 'TREASURY_WALLET_ADDRESS does not match TREASURY_PRIVATE_KEY.' });
    }

    let rewardTokenIds = parseRewardTokenIds(configuredRewardTokenIdsRaw);
    let rewardTokenIdsSource = configuredRewardTokenIdsRaw ? 'config' : 'opensea';
    let discoveredTokenIdsOpenSea = [];
    let discoveredTokenIdsOnchain = [];
    let openSeaDiscoveryError = '';

    if (rewardTokenIds.length === 0) {
      try {
        const openseaItems = rewardCollectionSlug
          ? await fetchOpenSeaWalletCollectionNfts({
              walletAddress: treasuryAddress,
              collectionSlug: rewardCollectionSlug,
              contractAddress: rewardContractAddress,
              chainId: runtime.chainId,
              apiKey: process.env.OPENSEA_API_KEY,
              mcpToken: process.env.OPENSEA_MCP_TOKEN,
              perPage: 80,
              maxItems: rewardTokenDiscoveryMaxItems,
              timeoutMs: 12000
            })
          : await fetchOpenSeaWalletContractNfts({
              walletAddress: treasuryAddress,
              contractAddress: rewardContractAddress,
              chainId: runtime.chainId,
              apiKey: process.env.OPENSEA_API_KEY,
              mcpToken: process.env.OPENSEA_MCP_TOKEN,
              perPage: 80,
              maxItems: rewardTokenDiscoveryMaxItems,
              timeoutMs: 12000
            });
        discoveredTokenIdsOpenSea = extractUniqueTokenIds(openseaItems.nfts).map((tokenId) => BigInt(tokenId));
      } catch (error) {
        openSeaDiscoveryError =
          error instanceof Error ? error.message : 'OpenSea discovery failed.';
      }

      if (rewardTokenDiscoveryStartBlock > 0) {
        discoveredTokenIdsOnchain = await discoverRewardTokenIdsFromTreasuryLogs({
          rpcProviders,
          runtime,
          rewardContractAddress,
          treasuryAddress,
          startBlock: rewardTokenDiscoveryStartBlock,
          step: rewardTokenDiscoveryLogScanStep,
          maxCandidateIds: rewardTokenDiscoveryMaxItems
        });
      }

      rewardTokenIds = sortBigIntValues(
        dedupeBigIntValues([...discoveredTokenIdsOpenSea, ...discoveredTokenIdsOnchain])
      );

      if (discoveredTokenIdsOpenSea.length > 0 && discoveredTokenIdsOnchain.length > 0) {
        rewardTokenIdsSource = 'opensea+onchain_logs';
      } else if (discoveredTokenIdsOnchain.length > 0) {
        rewardTokenIdsSource = 'onchain_logs';
      } else if (discoveredTokenIdsOpenSea.length > 0) {
        rewardTokenIdsSource = 'opensea';
      }
    }

    if (rewardTokenIds.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No reward token IDs found. Set REWARD_ERC1155_TOKEN_IDS or configure reward token discovery scan.',
        rewardTokenIdsSource,
        openSeaDiscoveryError
      });
    }

    const gateTokenUnits = await getTokenGateUnits(provider, address, runtime);
    const gateStandard = String(runtime.tokenGateStandard || 'erc721').trim().toLowerCase();
    let maxClaimsAllowed = gateTokenUnits * BigInt(claimsPerGateToken);
    let walletClaimCount = 0;
    let selectedGateTokenId = null;
    let gateTokenClaimMode = 'wallet_balance';
    let unclaimedGateTokenIdsOwned = [];

    if (gateStandard === 'erc721') {
      const ownedGateTokenIds = await getOwnedErc721GateTokenIds({
        provider,
        walletAddress: address,
        runtime
      });
      if (ownedGateTokenIds.length === 0) {
        return res.status(400).json({
          ok: false,
          error:
            'Unable to resolve owned gate token IDs for ERC-721 claim locking. Configure TOKEN_GATE_TOKEN_IDS or use an enumerable gate contract.'
        });
      }

      const claimedGateTokenIds = await collectClaimedGateTokenIdsFromRewardLogs({
        rpcProviders,
        runtime,
        rewardContractAddress,
        treasuryAddress,
        startBlock: rewardClaimStartBlock,
        step: rewardLogScanStep
      });
      unclaimedGateTokenIdsOwned = ownedGateTokenIds.filter(
        (tokenId) => !claimedGateTokenIds.has(tokenId.toString())
      );

      maxClaimsAllowed = BigInt(ownedGateTokenIds.length);
      walletClaimCount = ownedGateTokenIds.length - unclaimedGateTokenIdsOwned.length;
      gateTokenClaimMode = 'erc721_token_id_once';

      if (unclaimedGateTokenIdsOwned.length === 0) {
        return res.status(403).json({
          ok: false,
          error: 'All currently held gate token IDs have already been used to claim rewards.',
          gateTokenUnits: gateTokenUnits.toString(),
          claimsPerGateToken: '1',
          maxClaimsAllowed: maxClaimsAllowed.toString(),
          walletClaimCount: String(walletClaimCount)
        });
      }

      selectedGateTokenId = unclaimedGateTokenIdsOwned[randomIndex(unclaimedGateTokenIdsOwned.length)];
    } else {
      walletClaimCount = await countWalletClaimsFromLogs({
        rpcProviders,
        runtime,
        rewardContractAddress,
        treasuryAddress,
        walletAddress: address,
        startBlock: rewardClaimStartBlock,
        step: rewardLogScanStep
      });

      if (BigInt(walletClaimCount) >= maxClaimsAllowed) {
        return res.status(403).json({
          ok: false,
          error: 'Claim limit reached for this wallet. Acquire more gated tokens to claim again.',
          gateTokenUnits: gateTokenUnits.toString(),
          claimsPerGateToken: String(claimsPerGateToken),
          maxClaimsAllowed: maxClaimsAllowed.toString(),
          walletClaimCount: String(walletClaimCount)
        });
      }
    }

    const allocations = await pickRandomRewardAllocations({
      provider,
      rewardContractAddress,
      treasuryAddress,
      tokenIds: rewardTokenIds,
      rewardCount: rewardNftsPerClaim,
      selectionStrategy: rewardRandomStrategy
    });

    const transferIds = allocations.map((entry) => entry.tokenId);
    const transferAmounts = allocations.map((entry) => entry.amount);

    const rewardContract = new ethers.Contract(
      rewardContractAddress,
      getErc1155TransferAbi(),
      treasurySigner
    );
    const txOverrides = await buildLowGasOverrides(provider, runtime);

    const transferData = rewardContract.interface.encodeFunctionData('safeBatchTransferFrom', [
      treasuryAddress,
      address,
      transferIds,
      transferAmounts,
      encodeClaimContextData({ gateTokenId: selectedGateTokenId })
    ]);

    const nonce = await provider.getTransactionCount(treasuryAddress, 'pending');
    const estimateFrom = String(runtime.rewardEstimateFrom || treasuryAddress).trim();
    const estimatedGas = await provider.estimateGas({
      from: estimateFrom,
      to: rewardContractAddress,
      data: transferData
    });
    const gasLimitMultiplierBps = parsePositiveInt(runtime.rewardGasLimitMultiplierBps, 12000);
    const gasLimit = bumpByBps(estimatedGas, gasLimitMultiplierBps);

    const txRequest = {
      to: rewardContractAddress,
      data: transferData,
      nonce,
      gasLimit
    };

    const { txHash, receipt, sentHashes, attemptsUsed } = await sendWithRetryEscalation({
      provider,
      signer: treasurySigner,
      txRequest,
      initialGasOverrides: txOverrides,
      runtime
    });

    const walletClaimCountAfter = walletClaimCount + 1;
    const claimsRemainingAfter =
      maxClaimsAllowed > BigInt(walletClaimCountAfter)
        ? maxClaimsAllowed - BigInt(walletClaimCountAfter)
        : 0n;
    const unclaimedGateTokenIdsAfter =
      gateTokenClaimMode === 'erc721_token_id_once'
        ? unclaimedGateTokenIdsOwned
            .filter((tokenId) => selectedGateTokenId === null || tokenId !== selectedGateTokenId)
            .map((value) => value.toString())
        : [];

    return res.status(200).json({
      ok: true,
      txHash,
      blockNumber: receipt?.blockNumber ?? null,
      rewardContract: rewardContractAddress,
      rewardNftsPerClaim,
      rewardRandomStrategy,
      rewardTokenIdsSource,
      rewardTokenIdsUsed: rewardTokenIds.map((value) => value.toString()),
      discoveredTokenIdsOpenSeaCount: discoveredTokenIdsOpenSea.length,
      discoveredTokenIdsOnchainCount: discoveredTokenIdsOnchain.length,
      allocations: allocations.map((entry) => ({
        tokenId: entry.tokenId.toString(),
        amount: entry.amount.toString()
      })),
      txAttemptsUsed: attemptsUsed,
      replacementTxHashes: sentHashes,
      gateTokenUnits: gateTokenUnits.toString(),
      claimsPerGateToken: String(claimsPerGateToken),
      maxClaimsAllowed: maxClaimsAllowed.toString(),
      walletClaimCountBefore: String(walletClaimCount),
      walletClaimCountAfter: String(walletClaimCountAfter),
      claimsRemainingAfter: claimsRemainingAfter.toString(),
      gateTokenClaimMode,
      claimedWithGateTokenId: selectedGateTokenId !== null ? selectedGateTokenId.toString() : null,
      unclaimedGateTokenIdsOwned:
        gateTokenClaimMode === 'erc721_token_id_once'
          ? unclaimedGateTokenIdsAfter
          : [],
      from: treasuryAddress,
      to: address
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
