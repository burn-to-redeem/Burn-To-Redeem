import crypto from 'node:crypto';
import { ethers } from 'ethers';
import { normalizeAddress, parseJsonBody } from './_lib/claimUtils.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';
import {
  hasProcessedBurnTx,
  readProgressionState,
  recordBurnProgress,
  recordClaimProgress,
  writeProgressionState
} from './_lib/progressionState.js';

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const ERC721_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const TRANSFER_SINGLE_TOPIC = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
const TRANSFER_BATCH_TOPIC = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');
const BURN_RECORDED_TOPIC = ethers.id(
  'BurnRecorded(address,uint256,uint256,address[],uint256[],uint256[])'
);
const REWARD_MINTED_TOPIC = ethers.id('RewardMinted(address,uint256,string)');
const TRANSFER_IFACE = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]);
const BURN_ROUTER_IFACE = new ethers.Interface([
  'event BurnRecorded(address indexed operator, uint256 indexed burnId, uint256 totalUnits, address[] collections, uint256[] tokenIds, uint256[] amounts)'
]);
const MUTABLE_REWARD_IFACE = new ethers.Interface([
  'event RewardMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI)'
]);
const MUTABLE_REWARD_ABI = [
  'function mintTo(address recipient, string tokenURI_) returns (uint256 tokenId)',
  'function mintBatchTo(address recipient, string[] tokenURIs) returns (uint256[] tokenIds)'
];

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

function parseGweiToWei(value, fallbackGwei) {
  const raw = String(value || fallbackGwei).trim();
  return ethers.parseUnits(raw, 'gwei');
}

function parseBoolean(value, fallback = false) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parseRpcUrls(value) {
  return String(value || '')
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseAddressList(value) {
  const items = String(value || '')
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return items.map((entry) => normalizeAddress(entry).toLowerCase());
}

function normalizeCid(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return raw.slice('ipfs://'.length);
  if (raw.startsWith('/ipfs/')) return raw.slice('/ipfs/'.length);
  if (raw.includes('/ipfs/')) {
    const idx = raw.indexOf('/ipfs/');
    return raw.slice(idx + '/ipfs/'.length).split(/[?#]/)[0];
  }
  return raw;
}

function collectRewardCids(runtime) {
  const values = [
    normalizeCid(runtime.burnRewardCid1),
    normalizeCid(runtime.burnRewardCid2),
    normalizeCid(runtime.burnRewardCid3),
    normalizeCid(runtime.burnRewardCid4),
    normalizeCid(runtime.burnRewardCid5)
  ].filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function buildProviders(runtime) {
  const urls = [];
  const primary = String(runtime.baseRpcUrl || '').trim() || 'https://mainnet.base.org';
  urls.push(primary);
  for (const url of parseRpcUrls(runtime.baseRpcFallbackUrls)) {
    if (!urls.includes(url)) urls.push(url);
  }
  return urls.map((url) => new ethers.JsonRpcProvider(url));
}

async function withProviders(providers, run) {
  let lastError = null;
  for (const provider of providers) {
    try {
      return await run(provider);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('RPC request failed.');
}

function buildBurnToTopics() {
  return new Set([
    ethers.zeroPadValue(ethers.ZeroAddress, 32).toLowerCase(),
    ethers.zeroPadValue(DEAD_ADDRESS, 32).toLowerCase()
  ]);
}

function isValidTxHash(value) {
  return /^0x[0-9a-f]{64}$/i.test(String(value || '').trim());
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

function decodeBurnFromRouter({ receipt, address, burnRouterAddress }) {
  for (const log of receipt.logs || []) {
    if (!log?.topics?.length) continue;
    if (String(log.address || '').toLowerCase() !== burnRouterAddress.toLowerCase()) continue;
    if (String(log.topics[0] || '').toLowerCase() !== BURN_RECORDED_TOPIC.toLowerCase()) continue;

    try {
      const parsed = BURN_ROUTER_IFACE.parseLog(log);
      if (!parsed || parsed.name !== 'BurnRecorded') continue;
      if (String(parsed.args.operator || '').toLowerCase() !== address.toLowerCase()) continue;

      const totalUnits = Number(parsed.args.totalUnits.toString());
      if (!Number.isFinite(totalUnits) || totalUnits <= 0) {
        throw new Error('Burn router event totalUnits is invalid.');
      }

      return {
        burnMode: 'router',
        burnedUnits: totalUnits,
        burnedTokenIds: Array.from(parsed.args.tokenIds || [], (tokenId) => tokenId.toString()),
        burnedCollections: Array.from(parsed.args.collections || [], (collection) =>
          String(collection || '').toLowerCase()
        )
      };
    } catch {
      // Ignore malformed router logs.
    }
  }

  throw new Error('No valid BurnRecorded event found in this router transaction.');
}

function decodeBurnFromTransferLogs({
  receipt,
  address,
  allowedCollectionSet
}) {
  const fromTopic = ethers.zeroPadValue(address, 32).toLowerCase();
  const burnToTopics = buildBurnToTopics();
  const burnedTokenIds = [];
  const burnedCollections = [];
  let burnedUnits = 0;

  for (const log of receipt.logs || []) {
    if (!log?.topics?.length) continue;
    const topic0 = String(log.topics[0] || '').toLowerCase();
    const isErc721Transfer = topic0 === ERC721_TRANSFER_TOPIC.toLowerCase();
    const topicFrom = String(log.topics[isErc721Transfer ? 1 : 2] || '').toLowerCase();
    const topicTo = String(log.topics[isErc721Transfer ? 2 : 3] || '').toLowerCase();
    const logAddress = String(log.address || '').toLowerCase();

    if (allowedCollectionSet.size > 0 && !allowedCollectionSet.has(logAddress)) {
      continue;
    }

    if (topicFrom !== fromTopic || !burnToTopics.has(topicTo)) {
      continue;
    }

    try {
      const parsed = TRANSFER_IFACE.parseLog(log);
      if (!parsed) continue;

      if (topic0 === ERC721_TRANSFER_TOPIC.toLowerCase() && parsed.name === 'Transfer') {
        burnedUnits += 1;
        burnedTokenIds.push(parsed.args.tokenId.toString());
        burnedCollections.push(logAddress);
      } else if (topic0 === TRANSFER_SINGLE_TOPIC.toLowerCase() && parsed.name === 'TransferSingle') {
        const value = Number(parsed.args.value.toString());
        if (Number.isFinite(value) && value > 0) {
          burnedUnits += value;
          burnedTokenIds.push(parsed.args.id.toString());
          burnedCollections.push(logAddress);
        }
      } else if (topic0 === TRANSFER_BATCH_TOPIC.toLowerCase() && parsed.name === 'TransferBatch') {
        const ids = parsed.args.ids || [];
        const values = parsed.args.values || [];
        for (let index = 0; index < values.length; index += 1) {
          const value = Number(values[index].toString());
          if (!Number.isFinite(value) || value <= 0) continue;
          burnedUnits += value;
          burnedTokenIds.push(ids[index]?.toString?.() || '');
          burnedCollections.push(logAddress);
        }
      }
    } catch {
      // Ignore logs that fail to decode.
    }
  }

  return {
    burnMode: 'direct_transfer',
    burnedUnits,
    burnedTokenIds: burnedTokenIds.filter(Boolean),
    burnedCollections: burnedCollections.filter(Boolean)
  };
}

async function collectWalletMintedCidStats({
  provider,
  runtime,
  rewardContractAddress,
  walletAddress
}) {
  const latestBlock = await provider.getBlockNumber();
  const scanStep = parsePositiveInt(runtime.rewardLogScanStep, 9000);
  const configuredStart = parseNonNegativeInt(runtime.rewardClaimStartBlock, 0);
  const startBlock = configuredStart > 0 ? configuredStart : Math.max(0, latestBlock - 500000);
  const recipientTopic = ethers.zeroPadValue(walletAddress, 32);
  const cidCounts = new Map();
  let lastMintedCid = '';
  let lastBlock = -1;
  let lastLogIndex = -1;

  for (let from = startBlock; from <= latestBlock; from += scanStep) {
    const to = Math.min(from + scanStep - 1, latestBlock);
    const logs = await provider.getLogs({
      address: rewardContractAddress,
      fromBlock: from,
      toBlock: to,
      topics: [REWARD_MINTED_TOPIC, recipientTopic]
    });

    for (const log of logs || []) {
      try {
        const parsed = MUTABLE_REWARD_IFACE.parseLog(log);
        if (!parsed || parsed.name !== 'RewardMinted') continue;
        const cid = normalizeCid(parsed.args.tokenURI);
        if (!cid) continue;

        cidCounts.set(cid, (cidCounts.get(cid) || 0) + 1);

        const blockNumber = Number(log.blockNumber || 0);
        const logIndex = Number(log.index ?? 0);
        if (blockNumber > lastBlock || (blockNumber === lastBlock && logIndex > lastLogIndex)) {
          lastBlock = blockNumber;
          lastLogIndex = logIndex;
          lastMintedCid = cid;
        }
      } catch {
        // Ignore malformed logs.
      }
    }
  }

  return { cidCounts, lastMintedCid };
}

function pickGuaranteedRewardCids({
  rewardCids,
  cidCounts,
  lastMintedCid,
  desiredCount
}) {
  const safeDesiredCount = Math.max(1, Math.floor(desiredCount));
  const counts = new Map(cidCounts);
  const selected = [];

  for (let i = 0; i < safeDesiredCount; i += 1) {
    let minCount = Infinity;
    for (const cid of rewardCids) {
      const count = counts.get(cid) || 0;
      if (count < minCount) minCount = count;
    }

    let candidates = rewardCids.filter((cid) => (counts.get(cid) || 0) === minCount);
    if (selected.length === 0 && lastMintedCid) {
      const noImmediateRepeat = candidates.filter((cid) => cid !== lastMintedCid);
      if (noImmediateRepeat.length > 0) {
        candidates = noImmediateRepeat;
      }
    }

    const notSelectedThisTx = candidates.filter((cid) => !selected.includes(cid));
    if (notSelectedThisTx.length > 0) {
      candidates = notSelectedThisTx;
    }

    const picked = candidates[crypto.randomInt(candidates.length)];
    selected.push(picked);
    counts.set(picked, (counts.get(picked) || 0) + 1);
  }

  return selected;
}

async function mintCidRewards({
  provider,
  runtime,
  recipient,
  wins
}) {
  const shouldMint = parseBoolean(runtime.rewardMintEnabled, true);
  const rewardContractAddressRaw = String(runtime.rewardMutableNftContract || '').trim();
  if (!shouldMint || !rewardContractAddressRaw || wins.length === 0) {
    return {
      rewardMintEnabled: shouldMint,
      rewardMutableNftContract: rewardContractAddressRaw || null,
      mintTxHash: null,
      mintedRewards: []
    };
  }

  const treasuryPrivateKey = String(runtime.treasuryPrivateKey || '').trim();
  if (!treasuryPrivateKey) {
    throw new Error('TREASURY_PRIVATE_KEY is required to mint mutable CID rewards.');
  }

  const rewardContractAddress = normalizeAddress(rewardContractAddressRaw);
  const signer = new ethers.Wallet(treasuryPrivateKey, provider);
  const rewardContract = new ethers.Contract(rewardContractAddress, MUTABLE_REWARD_ABI, signer);
  const tokenUris = wins.map((win) => win.tokenUri);
  const txOverrides = await buildLowGasOverrides(provider, runtime);

  let tx;
  if (tokenUris.length === 1) {
    tx = await rewardContract.mintTo(recipient, tokenUris[0], txOverrides);
  } else {
    tx = await rewardContract.mintBatchTo(recipient, tokenUris, txOverrides);
  }

  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error('Mutable reward mint transaction failed.');
  }

  const mintedRewards = [];
  for (const log of receipt.logs || []) {
    if (!log?.topics?.length) continue;
    if (String(log.address || '').toLowerCase() !== rewardContractAddress.toLowerCase()) continue;
    if (String(log.topics[0] || '').toLowerCase() !== REWARD_MINTED_TOPIC.toLowerCase()) continue;

    try {
      const parsed = MUTABLE_REWARD_IFACE.parseLog(log);
      if (!parsed || parsed.name !== 'RewardMinted') continue;
      if (String(parsed.args.recipient || '').toLowerCase() !== recipient.toLowerCase()) continue;
      mintedRewards.push({
        tokenId: parsed.args.tokenId.toString(),
        tokenUri: String(parsed.args.tokenURI || '')
      });
    } catch {
      // Ignore malformed logs.
    }
  }

  return {
    rewardMintEnabled: shouldMint,
    rewardMutableNftContract: rewardContractAddress,
    mintTxHash: tx.hash,
    mintedRewards
  };
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
    const burnTxHash = String(body.burnTxHash || '').trim().toLowerCase();
    const expectedContractAddress = String(body.contractAddress || '').trim();

    if (!isValidTxHash(burnTxHash)) {
      return res.status(400).json({ ok: false, error: 'Invalid burn transaction hash.' });
    }

    const rewardCids = collectRewardCids(runtime);
    if (rewardCids.length === 0) {
      return res.status(400).json({ ok: false, error: 'No burn reward CIDs configured in backend.' });
    }

    const progressionState = await readProgressionState();
    if (await hasProcessedBurnTx(progressionState, burnTxHash)) {
      return res.status(409).json({ ok: false, error: 'This burn transaction was already processed.' });
    }

    const providers = buildProviders(runtime);
    const [tx, receipt] = await Promise.all([
      withProviders(providers, (provider) => provider.getTransaction(burnTxHash)),
      withProviders(providers, (provider) => provider.getTransactionReceipt(burnTxHash))
    ]);

    if (!tx || !receipt) {
      return res.status(404).json({ ok: false, error: 'Burn transaction not found yet. Wait for confirmation.' });
    }
    if (receipt.status !== 1) {
      return res.status(400).json({ ok: false, error: 'Burn transaction failed.' });
    }
    if (String(tx.from || '').toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({ ok: false, error: 'Burn transaction sender does not match connected wallet.' });
    }

    const txTo = String(tx.to || '').trim();
    if (!txTo) {
      return res.status(400).json({ ok: false, error: 'Burn transaction target contract is missing.' });
    }
    if (expectedContractAddress && txTo.toLowerCase() !== expectedContractAddress.toLowerCase()) {
      return res.status(400).json({ ok: false, error: 'Burn transaction contract mismatch.' });
    }

    const burnRouterAddress = String(runtime.burnRouterContract || '').trim();
    const allowedCollections = parseAddressList(runtime.burnAllowedCollections || '');
    const allowedCollectionSet = new Set(allowedCollections.map((entry) => entry.toLowerCase()));

    const configuredRewardContract = String(runtime.rewardErc1155Contract || '').trim().toLowerCase();
    const strictLegacyContract = configuredRewardContract && allowedCollectionSet.size === 0 ? configuredRewardContract : '';
    if (
      strictLegacyContract &&
      (!burnRouterAddress || txTo.toLowerCase() !== burnRouterAddress.toLowerCase()) &&
      txTo.toLowerCase() !== strictLegacyContract
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Burn must target the configured burn contract (or configured burn router).'
      });
    }

    let burnResult = null;
    if (burnRouterAddress && txTo.toLowerCase() === burnRouterAddress.toLowerCase()) {
      burnResult = decodeBurnFromRouter({
        receipt,
        address,
        burnRouterAddress: normalizeAddress(burnRouterAddress)
      });
    } else {
      if (allowedCollectionSet.size > 0 && !allowedCollectionSet.has(txTo.toLowerCase())) {
        return res.status(400).json({
          ok: false,
          error: 'Burn transaction does not target an allowed collection contract.'
        });
      }
      burnResult = decodeBurnFromTransferLogs({
        receipt,
        address,
        allowedCollectionSet
      });
    }

    const { burnedUnits, burnedTokenIds, burnedCollections, burnMode } = burnResult;

    if (burnedUnits <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'No valid burn events found in this transaction (must send NFTs to dead or zero address).'
      });
    }

    const creditsAwarded = burnedUnits * 20;
    const burnRecorded = await recordBurnProgress(progressionState, {
      address,
      burnTxHash,
      burnedUnits,
      creditsAwarded,
      burnMode,
      burnedTokenIds: burnedTokenIds.filter(Boolean),
      burnedCollections: burnedCollections.filter(Boolean),
      contractAddress: txTo.toLowerCase(),
      blockNumber: Number(receipt.blockNumber || 0),
      timestamp: new Date().toISOString()
    });

    if (burnRecorded.alreadyProcessed) {
      return res.status(409).json({ ok: false, error: 'This burn transaction was already processed.' });
    }

    let savedProgression = await writeProgressionState(progressionState);

    const shouldAutoMintOnBurn = parseBoolean(runtime.rewardAutoMintOnBurn, false);
    const rewardMutableNftContractRaw = String(runtime.rewardMutableNftContract || '').trim();
    const rewardMutableNftContract = rewardMutableNftContractRaw
      ? normalizeAddress(rewardMutableNftContractRaw)
      : null;
    const mintCount = Math.max(1, Math.min(burnedUnits, 20));
    let wins = [];
    let mintResult = {
      rewardMintEnabled: false,
      rewardMutableNftContract: rewardMutableNftContract || null,
      mintTxHash: null,
      mintedRewards: []
    };

    if (shouldAutoMintOnBurn) {
      if (!rewardMutableNftContract) {
        return res.status(500).json({
          ok: false,
          error: 'REWARD_MUTABLE_NFT_CONTRACT is not configured.'
        });
      }

      const mintProvider = await withProviders(providers, async (provider) => {
        await provider.getBlockNumber();
        return provider;
      });
      const { cidCounts, lastMintedCid } = await collectWalletMintedCidStats({
        provider: mintProvider,
        runtime,
        rewardContractAddress: rewardMutableNftContract,
        walletAddress: address
      });

      const selectedCids = pickGuaranteedRewardCids({
        rewardCids,
        cidCounts,
        lastMintedCid,
        desiredCount: mintCount
      });
      wins = selectedCids.map((cid) => ({
        cid,
        tokenUri: `ipfs://${cid}`,
        imageUrl: `https://ipfs.io/ipfs/${cid}`
      }));

      mintResult = await mintCidRewards({
        provider: mintProvider,
        runtime,
        recipient: address,
        wins
      });

      const claimedUnits = Array.isArray(mintResult.mintedRewards)
        ? mintResult.mintedRewards.length
        : 0;
      if (claimedUnits > 0) {
        await recordClaimProgress(progressionState, {
          address,
          claimUnits: claimedUnits,
          claimTxHash: mintResult.mintTxHash,
          mintedTokenIds: mintResult.mintedRewards.map((entry) => entry.tokenId),
          mintedCids: wins.map((entry) => entry.cid),
          timestamp: new Date().toISOString()
        });
        savedProgression = await writeProgressionState(progressionState);
      }
    }
    const walletProgress = burnRecorded.wallet || null;
    const claimableRewards = walletProgress
      ? Math.max(0, Number(walletProgress.claimableRewards || 0))
      : 0;

    return res.status(200).json({
      ok: true,
      burnTxHash,
      burnMode,
      burnedUnits,
      burnedTokenIds: burnedTokenIds.filter(Boolean),
      burnedCollections: burnedCollections.filter(Boolean),
      creditsAwarded,
      rewardPolicy: shouldAutoMintOnBurn
        ? 'Guaranteed mint on burn; anti-duplicate balancing per wallet.'
        : 'Burn unlocks claimable reward mints; claim from Redeemable Rewards tab.',
      configuredCidCount: rewardCids.length,
      mintedCountRequested: mintCount,
      wins,
      rewardMintEnabled: mintResult.rewardMintEnabled,
      rewardMutableNftContract: mintResult.rewardMutableNftContract,
      mintTxHash: mintResult.mintTxHash,
      mintedRewards: mintResult.mintedRewards,
      autoMintOnBurn: shouldAutoMintOnBurn,
      progressionUpdatedAt: savedProgression.updatedAt,
      walletProgress,
      unlockedRewards: walletProgress?.unlockedRewards || 0,
      claimableRewards
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
