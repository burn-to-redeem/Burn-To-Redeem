import { ethers } from 'ethers';
import {
  hasTokenGateAccess,
  isFreshIssuedAt,
  normalizeAddress,
  parseJsonBody,
  verifyGatePass
} from './_lib/claimUtils.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

const REWARD_MINTED_TOPIC = ethers.id('RewardMinted(address,uint256,string)');
const MUTABLE_REWARD_IFACE = new ethers.Interface([
  'event RewardMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI)'
]);
const MUTABLE_REWARD_ABI = ['function mintTo(address recipient, string tokenURI_) returns (uint256 tokenId)'];

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
  return raw.split(/[?#]/)[0];
}

function collectRewardCids(runtime) {
  const values = [
    normalizeCid(runtime.burnRewardCid1),
    normalizeCid(runtime.burnRewardCid2),
    normalizeCid(runtime.burnRewardCid3),
    normalizeCid(runtime.burnRewardCid4),
    normalizeCid(runtime.burnRewardCid5)
  ].filter(Boolean);

  const seen = new Set();
  const unique = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique.slice(0, 5);
}

function toIpfsHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${raw.slice('ipfs://'.length)}`;
  if (raw.startsWith('/ipfs/')) return `https://ipfs.io${raw}`;
  if (raw.includes('/ipfs/')) {
    const idx = raw.indexOf('/ipfs/');
    return `https://ipfs.io/ipfs/${raw.slice(idx + '/ipfs/'.length).split(/[?#]/)[0]}`;
  }
  return `https://ipfs.io/ipfs/${normalizeCid(raw)}`;
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function hydrateCidItem(cid, index) {
  const metadataUrl = toIpfsHttpUrl(cid);
  const metadata = await fetchJson(metadataUrl);
  const imageRaw = metadata?.image || metadata?.image_url || '';
  const imageUrl = imageRaw ? toIpfsHttpUrl(imageRaw) : metadataUrl;
  const name = String(metadata?.name || `CID #${String(index + 1).padStart(2, '0')}`);
  const description = String(metadata?.description || '');

  return {
    index: index + 1,
    label: `CID #${String(index + 1).padStart(2, '0')}`,
    cid,
    name,
    description,
    tokenUri: `ipfs://${cid}`,
    metadataUrl,
    imageUrl
  };
}

function buildCidMintMessage({ address, chainId, issuedAt, gatePass, cid }) {
  return [
    'Burn to Redeem CID Mint',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`,
    `CID: ${cid}`
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

async function handleGallery(req, res) {
  const runtime = await getRuntimeConfigForRequest(req);
  const rewardMutableNftContract = String(runtime.rewardMutableNftContract || '').trim();
  const rewardMintEnabled = parseBoolean(runtime.rewardMintEnabled, true);
  const cids = collectRewardCids(runtime);

  return res.status(200).json({
    ok: true,
    total: cids.length,
    rewardMintEnabled,
    rewardMutableNftContract: rewardMutableNftContract || '',
    items: await Promise.all(cids.map((cid, index) => hydrateCidItem(cid, index)))
  });
}

async function handleMint(req, res) {
  const runtime = await getRuntimeConfigForRequest(req);
  const body = parseJsonBody(req);

  const address = normalizeAddress(body.address);
  const chainId = Number.parseInt(String(body.chainId || ''), 10);
  const issuedAt = Number(body.issuedAt || 0);
  const gatePass = String(body.gatePass || '').trim();
  const signature = String(body.signature || '').trim();
  const cid = normalizeCid(body.cid);

  if (!gatePass) {
    return res.status(400).json({ ok: false, error: 'Missing gate pass.' });
  }
  if (!signature) {
    return res.status(400).json({ ok: false, error: 'Missing signature.' });
  }
  if (!cid) {
    return res.status(400).json({ ok: false, error: 'Missing CID.' });
  }
  if (chainId !== runtime.chainId) {
    return res.status(400).json({ ok: false, error: `Wrong chain. Expected ${runtime.chainId}.` });
  }
  if (!isFreshIssuedAt(issuedAt, runtime.claimMessageTtlSeconds)) {
    return res.status(400).json({ ok: false, error: 'Mint signature expired. Please sign again.' });
  }
  if (!verifyGatePass(gatePass, address, runtime)) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired gate pass.' });
  }

  const rewardCids = collectRewardCids(runtime);
  if (rewardCids.length === 0) {
    return res.status(400).json({ ok: false, error: 'No reward CIDs configured.' });
  }
  if (!rewardCids.includes(cid)) {
    return res.status(400).json({ ok: false, error: 'Selected CID is not configured for rewards.' });
  }

  const shouldMint = parseBoolean(runtime.rewardMintEnabled, true);
  if (!shouldMint) {
    return res.status(400).json({ ok: false, error: 'Reward minting is disabled.' });
  }

  const rewardMutableNftContractRaw = String(runtime.rewardMutableNftContract || '').trim();
  if (!rewardMutableNftContractRaw) {
    return res.status(500).json({ ok: false, error: 'REWARD_MUTABLE_NFT_CONTRACT is not configured.' });
  }
  const rewardMutableNftContract = normalizeAddress(rewardMutableNftContractRaw);

  const treasuryPrivateKey = String(runtime.treasuryPrivateKey || '').trim();
  if (!treasuryPrivateKey) {
    return res.status(500).json({ ok: false, error: 'TREASURY_PRIVATE_KEY is required for minting.' });
  }

  const message = buildCidMintMessage({
    address,
    chainId,
    issuedAt,
    gatePass,
    cid
  });
  const recovered = ethers.verifyMessage(message, signature);
  if (String(recovered || '').toLowerCase() !== address.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Signature verification failed.' });
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

  const signer = new ethers.Wallet(treasuryPrivateKey, provider);
  const rewardContract = new ethers.Contract(rewardMutableNftContract, MUTABLE_REWARD_ABI, signer);
  const tokenUri = `ipfs://${cid}`;
  const txOverrides = await buildLowGasOverrides(provider, runtime);
  const tx = await rewardContract.mintTo(address, tokenUri, txOverrides);
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error('CID mint transaction failed.');
  }

  let mintedTokenId = '';
  for (const log of receipt.logs || []) {
    if (!log?.topics?.length) continue;
    if (String(log.address || '').toLowerCase() !== rewardMutableNftContract.toLowerCase()) continue;
    if (String(log.topics[0] || '').toLowerCase() !== REWARD_MINTED_TOPIC.toLowerCase()) continue;
    try {
      const parsed = MUTABLE_REWARD_IFACE.parseLog(log);
      if (!parsed || parsed.name !== 'RewardMinted') continue;
      if (String(parsed.args.recipient || '').toLowerCase() !== address.toLowerCase()) continue;
      mintedTokenId = parsed.args.tokenId.toString();
    } catch {
      // Ignore malformed logs.
    }
  }

  return res.status(200).json({
    ok: true,
    cid,
    tokenUri,
    imageUrl: `https://ipfs.io/ipfs/${cid}`,
    tokenId: mintedTokenId || null,
    mintTxHash: tx.hash,
    rewardMutableNftContract
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return await handleGallery(req, res);
    }
    if (req.method === 'POST') {
      return await handleMint(req, res);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
