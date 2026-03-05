import crypto from 'node:crypto';
import { ethers } from 'ethers';
import {
  hasTokenGateAccess,
  isFreshIssuedAt,
  normalizeAddress,
  parseJsonBody,
  verifyGatePass
} from './_lib/claimUtils.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';
import {
  getWalletProgress,
  readProgressionState,
  recordClaimProgress,
  writeProgressionState
} from './_lib/progressionState.js';

const REWARD_MINTED_TOPIC = ethers.id('RewardMinted(address,uint256,string)');
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

function parseBoolean(value, fallback = false) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function parseGweiToWei(value, fallbackGwei) {
  const raw = String(value || fallbackGwei).trim();
  return ethers.parseUnits(raw, 'gwei');
}

function parseRpcUrls(value) {
  return String(value || '')
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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

function buildClaimUnlockMessage({ address, chainId, issuedAt, gatePass, claimUnits }) {
  return [
    'Burn to Redeem Unlock Claim',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`,
    `Claim Units: ${claimUnits}`
  ].join('\n');
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

async function triggerBurnSync(req, address) {
  const protocol = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.host || '';
  if (!host) return;

  const query = new URLSearchParams();
  query.set('address', address);
  query.set('sync', '1');
  query.set('limit', '1');
  query.set('recent', '1');

  try {
    await fetch(`${protocol}://${host}/api/progression-stats?${query.toString()}`, {
      method: 'GET',
      headers: {
        'x-b2r-internal-sync': '1'
      }
    });
  } catch {
    // Soft-fail; claim flow can continue with current progression state.
  }
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

async function collectWalletMintedCidStats({
  provider,
  runtime,
  rewardContractAddress,
  walletAddress
}) {
  const latestBlock = await provider.getBlockNumber();
  const scanStep = parsePositiveInt(runtime.rewardLogScanStep, 9000);
  const configuredStart = parsePositiveInt(runtime.rewardClaimStartBlock, 0);
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

async function mintCidRewards({ provider, runtime, recipient, wins }) {
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
    const chainId = Number.parseInt(String(body.chainId || ''), 10);
    const issuedAt = Number(body.issuedAt || 0);
    const gatePass = String(body.gatePass || '').trim();
    const signature = String(body.signature || '').trim();
    const requestedUnits = parsePositiveInt(body.claimUnits, 0);

    if (!gatePass) {
      return res.status(400).json({ ok: false, error: 'Missing gate pass.' });
    }
    if (!signature) {
      return res.status(400).json({ ok: false, error: 'Missing signature.' });
    }
    if (chainId !== runtime.chainId) {
      return res.status(400).json({ ok: false, error: `Wrong chain. Expected ${runtime.chainId}.` });
    }
    if (!isFreshIssuedAt(issuedAt, runtime.claimMessageTtlSeconds)) {
      return res.status(400).json({ ok: false, error: 'Claim signature expired. Please sign again.' });
    }
    if (!verifyGatePass(gatePass, address, runtime)) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired gate pass.' });
    }

    await triggerBurnSync(req, address);

    const progressionState = await readProgressionState();
    const walletBefore = await getWalletProgress(progressionState, address);
    const claimableRewards = Math.max(0, Number(walletBefore?.claimableRewards || 0));
    if (claimableRewards <= 0) {
      return res.status(403).json({
        ok: false,
        error: 'No unlocked rewards available. Burn NFTs first to unlock claimable rewards.'
      });
    }

    const maxBatch = Math.max(1, Math.min(parsePositiveInt(runtime.rewardUnlockClaimMaxBatch, 20), 100));
    const unitsToClaim = requestedUnits > 0
      ? Math.min(requestedUnits, claimableRewards, maxBatch)
      : Math.min(claimableRewards, maxBatch);

    const message = buildClaimUnlockMessage({
      address,
      chainId,
      issuedAt,
      gatePass,
      claimUnits: unitsToClaim
    });
    const recovered = ethers.verifyMessage(message, signature);
    if (String(recovered || '').toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ ok: false, error: 'Signature verification failed.' });
    }

    const rewardCids = collectRewardCids(runtime);
    if (rewardCids.length === 0) {
      return res.status(400).json({ ok: false, error: 'No burn reward CIDs configured in backend.' });
    }

    const rewardMutableNftContractRaw = String(runtime.rewardMutableNftContract || '').trim();
    if (!rewardMutableNftContractRaw) {
      return res.status(500).json({ ok: false, error: 'REWARD_MUTABLE_NFT_CONTRACT is not configured.' });
    }
    if (!parseBoolean(runtime.rewardMintEnabled, true)) {
      return res.status(400).json({ ok: false, error: 'Reward minting is disabled in runtime config.' });
    }

    const providers = buildProviders(runtime);
    const provider = await withProviders(providers, async (entry) => {
      await entry.getBlockNumber();
      return entry;
    });

    const hasAccess = await withProviders(providers, (entry) => hasTokenGateAccess(entry, address, runtime));
    if (!hasAccess) {
      return res.status(403).json({ ok: false, error: 'Wallet does not currently hold the token-gated NFT.' });
    }

    const rewardMutableNftContract = normalizeAddress(rewardMutableNftContractRaw);
    const { cidCounts, lastMintedCid } = await collectWalletMintedCidStats({
      provider,
      runtime,
      rewardContractAddress: rewardMutableNftContract,
      walletAddress: address
    });

    const selectedCids = pickGuaranteedRewardCids({
      rewardCids,
      cidCounts,
      lastMintedCid,
      desiredCount: unitsToClaim
    });
    const wins = selectedCids.map((cid) => ({
      cid,
      tokenUri: `ipfs://${cid}`,
      imageUrl: `https://ipfs.io/ipfs/${cid}`
    }));

    const mintResult = await mintCidRewards({
      provider,
      runtime,
      recipient: address,
      wins
    });

    const mintedRewards = Array.isArray(mintResult.mintedRewards) ? mintResult.mintedRewards : [];
    const claimedUnits = mintedRewards.length;
    if (claimedUnits <= 0 || !mintResult.mintTxHash) {
      throw new Error('Claim mint transaction did not emit reward mints.');
    }

    const walletAfter = await recordClaimProgress(progressionState, {
      address,
      claimUnits: claimedUnits,
      claimTxHash: mintResult.mintTxHash,
      mintedTokenIds: mintedRewards.map((entry) => entry.tokenId),
      mintedCids: wins.map((entry) => entry.cid),
      timestamp: new Date().toISOString()
    });
    const savedProgression = await writeProgressionState(progressionState);

    return res.status(200).json({
      ok: true,
      claimedUnits,
      claimableBefore: claimableRewards,
      claimableAfter: Math.max(0, Number(walletAfter?.claimableRewards || 0)),
      walletProgress: walletAfter,
      progressionUpdatedAt: savedProgression.updatedAt,
      rewardMutableNftContract: mintResult.rewardMutableNftContract,
      mintTxHash: mintResult.mintTxHash,
      wins,
      mintedRewards
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
