import fs from 'node:fs/promises';
import { list, put } from '@vercel/blob';

const OVERRIDE_PATH = '/tmp/burn-to-redeem-runtime-overrides.json';
const OVERRIDE_BLOB_PATH = String(process.env.RUNTIME_CONFIG_BLOB_PATH || 'state/runtime-overrides-v1.json').trim();
const OVERRIDE_BACKEND = String(process.env.RUNTIME_CONFIG_BACKEND || '')
  .trim()
  .toLowerCase();
const OVERRIDE_BLOB_TOKEN = String(
  process.env.RUNTIME_CONFIG_BLOB_RW_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || ''
).trim();
let cachedBlobOverridesUrl = null;

export const EDITABLE_OVERRIDE_KEYS = [
  'BASE_RPC_URL',
  'BASE_RPC_FALLBACK_URLS',
  'RPC_LOG_RETRY_ATTEMPTS',
  'RPC_LOG_RETRY_DELAY_MS',
  'CHAIN_ID',
  'TOKEN_GATE_CONTRACT',
  'TOKEN_GATE_STANDARD',
  'TOKEN_GATE_TOKEN_ID',
  'TOKEN_GATE_TOKEN_IDS',
  'GATE_MESSAGE_TTL_SECONDS',
  'CLAIM_MESSAGE_TTL_SECONDS',
  'GATE_PASS_TTL_SECONDS',
  'TREASURY_WALLET_ADDRESS',
  'TIP_RECEIVER_ADDRESS',
  'TIP_POINTS_PER_ETH',
  'TIP_MIN_WEI',
  'REWARD_ERC1155_CONTRACT',
  'REWARD_COLLECTION_SLUG',
  'REWARD_ERC1155_TOKEN_IDS',
  'REWARD_NFTS_PER_CLAIM',
  'REWARD_RANDOM_STRATEGY',
  'CLAIMS_PER_GATE_TOKEN',
  'REWARD_CLAIM_START_BLOCK',
  'REWARD_LOG_SCAN_STEP',
  'REWARD_TOKEN_DISCOVERY_START_BLOCK',
  'REWARD_TOKEN_DISCOVERY_LOG_SCAN_STEP',
  'REWARD_TOKEN_DISCOVERY_MAX_ITEMS',
  'REWARD_GAS_MODE',
  'REWARD_MIN_PRIORITY_GWEI',
  'REWARD_BASE_FEE_MULTIPLIER_BPS',
  'REWARD_GAS_PRICE_MULTIPLIER_BPS',
  'REWARD_GAS_LIMIT',
  'REWARD_GAS_LIMIT_MULTIPLIER_BPS',
  'REWARD_TX_RETRY_ATTEMPTS',
  'REWARD_TX_RETRY_WAIT_MS',
  'REWARD_RETRY_FEE_BUMP_BPS',
  'REWARD_ESTIMATE_FROM',
  'BURN_ROUTER_CONTRACT',
  'BURN_ALLOWED_COLLECTIONS',
  'REWARD_MUTABLE_NFT_CONTRACT',
  'REWARD_MINT_ENABLED',
  'REWARD_AUTO_MINT_ON_BURN',
  'REWARD_UNLOCK_CLAIM_MAX_BATCH',
  'BURN_REWARD_CID_1',
  'BURN_REWARD_CID_2',
  'BURN_REWARD_CID_3',
  'BURN_REWARD_CID_4',
  'BURN_REWARD_CID_5',
  'WEBSITE_BRAND_NAME',
  'WEBSITE_ACCESS_TITLE',
  'WEBSITE_ACCESS_SUBTITLE',
  'WEBSITE_STEP1_TITLE',
  'WEBSITE_STEP1_SUBTITLE',
  'WEBSITE_STEP2_TITLE',
  'WEBSITE_STEP2_SUBTITLE',
  'WEBSITE_BURN_HERO_SUBTITLE',
  'WEBSITE_NFTS_TAB_LABEL',
  'WEBSITE_REWARDS_TAB_LABEL',
  'WEBSITE_NFTS_SECTION_TITLE',
  'WEBSITE_REWARDS_SECTION_TITLE',
  'WEBSITE_SHOW_HERO_PANEL',
  'WEBSITE_SHOW_ENTRY_BANNER',
  'WEBSITE_SHOW_FOOTER',
  'WEBSITE_SHOW_TAB_NFTS',
  'WEBSITE_SHOW_TAB_REWARDS',
  'WEBSITE_SHOW_TAB_B2R',
  'WEBSITE_SHOW_TAB_BONFIRE',
  'WEBSITE_SHOW_TAB_FORGE',
  'WEBSITE_SHOW_TAB_BURNCHAMBER',
  'WEBSITE_SHOW_TAB_NEWWORLD',
  'WEBSITE_SHOW_TAB_TIPSTARTER',
  'WEBSITE_SHOW_TAB_MONOCHROME',
  'WEBSITE_SHOW_TAB_DESTINY',
  'WEBSITE_SHOW_TAB_KEK',
  'WEBSITE_SHOW_TAB_LEADERBOARD'
];

const DEFAULT_EDITABLE_CONFIG = {
  BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  BASE_RPC_FALLBACK_URLS: process.env.BASE_RPC_FALLBACK_URLS || '',
  RPC_LOG_RETRY_ATTEMPTS: process.env.RPC_LOG_RETRY_ATTEMPTS || '4',
  RPC_LOG_RETRY_DELAY_MS: process.env.RPC_LOG_RETRY_DELAY_MS || '350',
  CHAIN_ID: process.env.CHAIN_ID || '8453',
  TOKEN_GATE_CONTRACT: process.env.TOKEN_GATE_CONTRACT || '',
  TOKEN_GATE_STANDARD: process.env.TOKEN_GATE_STANDARD || 'erc721',
  TOKEN_GATE_TOKEN_ID: process.env.TOKEN_GATE_TOKEN_ID || '0',
  TOKEN_GATE_TOKEN_IDS: process.env.TOKEN_GATE_TOKEN_IDS || '',
  GATE_MESSAGE_TTL_SECONDS: process.env.GATE_MESSAGE_TTL_SECONDS || '300',
  CLAIM_MESSAGE_TTL_SECONDS: process.env.CLAIM_MESSAGE_TTL_SECONDS || '300',
  GATE_PASS_TTL_SECONDS: process.env.GATE_PASS_TTL_SECONDS || '900',
  TREASURY_WALLET_ADDRESS: process.env.TREASURY_WALLET_ADDRESS || '',
  TIP_RECEIVER_ADDRESS: process.env.TIP_RECEIVER_ADDRESS || process.env.TREASURY_WALLET_ADDRESS || '',
  TIP_POINTS_PER_ETH: process.env.TIP_POINTS_PER_ETH || '20000',
  TIP_MIN_WEI: process.env.TIP_MIN_WEI || '1000000000000000',
  REWARD_ERC1155_CONTRACT: process.env.REWARD_ERC1155_CONTRACT || '',
  REWARD_COLLECTION_SLUG: process.env.REWARD_COLLECTION_SLUG || 'cc0-by-pierre',
  REWARD_ERC1155_TOKEN_IDS: process.env.REWARD_ERC1155_TOKEN_IDS || '',
  REWARD_NFTS_PER_CLAIM: process.env.REWARD_NFTS_PER_CLAIM || '20',
  REWARD_RANDOM_STRATEGY: process.env.REWARD_RANDOM_STRATEGY || 'token_uniform',
  CLAIMS_PER_GATE_TOKEN: process.env.CLAIMS_PER_GATE_TOKEN || '1',
  REWARD_CLAIM_START_BLOCK: process.env.REWARD_CLAIM_START_BLOCK || '',
  REWARD_LOG_SCAN_STEP: process.env.REWARD_LOG_SCAN_STEP || '9000',
  REWARD_TOKEN_DISCOVERY_START_BLOCK: process.env.REWARD_TOKEN_DISCOVERY_START_BLOCK || '',
  REWARD_TOKEN_DISCOVERY_LOG_SCAN_STEP: process.env.REWARD_TOKEN_DISCOVERY_LOG_SCAN_STEP || '9000',
  REWARD_TOKEN_DISCOVERY_MAX_ITEMS: process.env.REWARD_TOKEN_DISCOVERY_MAX_ITEMS || '20000',
  REWARD_GAS_MODE: process.env.REWARD_GAS_MODE || 'lowest',
  REWARD_MIN_PRIORITY_GWEI: process.env.REWARD_MIN_PRIORITY_GWEI || '0.000001',
  REWARD_BASE_FEE_MULTIPLIER_BPS: process.env.REWARD_BASE_FEE_MULTIPLIER_BPS || '10000',
  REWARD_GAS_PRICE_MULTIPLIER_BPS: process.env.REWARD_GAS_PRICE_MULTIPLIER_BPS || '10000',
  REWARD_GAS_LIMIT: process.env.REWARD_GAS_LIMIT || '',
  REWARD_GAS_LIMIT_MULTIPLIER_BPS: process.env.REWARD_GAS_LIMIT_MULTIPLIER_BPS || '12000',
  REWARD_TX_RETRY_ATTEMPTS: process.env.REWARD_TX_RETRY_ATTEMPTS || '3',
  REWARD_TX_RETRY_WAIT_MS: process.env.REWARD_TX_RETRY_WAIT_MS || '30000',
  REWARD_RETRY_FEE_BUMP_BPS: process.env.REWARD_RETRY_FEE_BUMP_BPS || '12500',
  REWARD_ESTIMATE_FROM: process.env.REWARD_ESTIMATE_FROM || '',
  BURN_ROUTER_CONTRACT: process.env.BURN_ROUTER_CONTRACT || '',
  BURN_ALLOWED_COLLECTIONS: process.env.BURN_ALLOWED_COLLECTIONS || '',
  REWARD_MUTABLE_NFT_CONTRACT: process.env.REWARD_MUTABLE_NFT_CONTRACT || '',
  REWARD_MINT_ENABLED: process.env.REWARD_MINT_ENABLED || '1',
  REWARD_AUTO_MINT_ON_BURN: process.env.REWARD_AUTO_MINT_ON_BURN || '0',
  REWARD_UNLOCK_CLAIM_MAX_BATCH: process.env.REWARD_UNLOCK_CLAIM_MAX_BATCH || '20',
  BURN_REWARD_CID_1: process.env.BURN_REWARD_CID_1 || 'QmNyJSVK6ciyxLq25Eurj79oMKfKRfUYzCg8DLyctUm7Tr',
  BURN_REWARD_CID_2: process.env.BURN_REWARD_CID_2 || 'QmXbeKSz5NSPKikU98MhAGQoLgboEwqdtGiNoCBpJvTkni',
  BURN_REWARD_CID_3: process.env.BURN_REWARD_CID_3 || 'Qmbd2iuUvASpBrmcaz8ZzTaSkFf6VAgQYwaQnV9mDK4gQt',
  BURN_REWARD_CID_4: process.env.BURN_REWARD_CID_4 || 'QmcR1oxNYpXt3oUpfMqMn4VkLDjnUxDERdqeqVRixvnm2u',
  BURN_REWARD_CID_5: process.env.BURN_REWARD_CID_5 || 'QmdG9Qc53xy1iNc2iqoBMGTnHkfFGdAtgsxGud9Zngj4Sj',
  WEBSITE_BRAND_NAME: process.env.WEBSITE_BRAND_NAME || 'Burn to Redeem',
  WEBSITE_ACCESS_TITLE: process.env.WEBSITE_ACCESS_TITLE || 'Burn to Redeem Access',
  WEBSITE_ACCESS_SUBTITLE:
    process.env.WEBSITE_ACCESS_SUBTITLE ||
    'Sign once for token-gate access. Claim rewards later from the Redeemable Rewards tab inside the website.',
  WEBSITE_STEP1_TITLE: process.env.WEBSITE_STEP1_TITLE || 'Step 1: Token-Gated Signature',
  WEBSITE_STEP1_SUBTITLE:
    process.env.WEBSITE_STEP1_SUBTITLE || 'Connect on Base and sign to prove ownership of the gate NFT.',
  WEBSITE_STEP2_TITLE: process.env.WEBSITE_STEP2_TITLE || 'Step 2: Claim Rewards In Redeemable Rewards Tab',
  WEBSITE_STEP2_SUBTITLE:
    process.env.WEBSITE_STEP2_SUBTITLE ||
    'After entry, open Redeemable Rewards and sign to claim your random NFT allocation.',
  WEBSITE_BURN_HERO_SUBTITLE:
    process.env.WEBSITE_BURN_HERO_SUBTITLE ||
    'Burn your claimed rewards to stack game credits and redeem new digital art.',
  WEBSITE_NFTS_TAB_LABEL: process.env.WEBSITE_NFTS_TAB_LABEL || 'NFTS TO BURN',
  WEBSITE_REWARDS_TAB_LABEL: process.env.WEBSITE_REWARDS_TAB_LABEL || 'REDEEMABLE REWARDS',
  WEBSITE_NFTS_SECTION_TITLE: process.env.WEBSITE_NFTS_SECTION_TITLE || 'NFTS TO BURN',
  WEBSITE_REWARDS_SECTION_TITLE: process.env.WEBSITE_REWARDS_SECTION_TITLE || 'Redeemable Rewards',
  WEBSITE_SHOW_HERO_PANEL: process.env.WEBSITE_SHOW_HERO_PANEL || '1',
  WEBSITE_SHOW_ENTRY_BANNER: process.env.WEBSITE_SHOW_ENTRY_BANNER || '1',
  WEBSITE_SHOW_FOOTER: process.env.WEBSITE_SHOW_FOOTER || '1',
  WEBSITE_SHOW_TAB_NFTS: process.env.WEBSITE_SHOW_TAB_NFTS || '1',
  WEBSITE_SHOW_TAB_REWARDS: process.env.WEBSITE_SHOW_TAB_REWARDS || '1',
  WEBSITE_SHOW_TAB_B2R: process.env.WEBSITE_SHOW_TAB_B2R || '1',
  WEBSITE_SHOW_TAB_BONFIRE: process.env.WEBSITE_SHOW_TAB_BONFIRE || '1',
  WEBSITE_SHOW_TAB_FORGE: process.env.WEBSITE_SHOW_TAB_FORGE || '1',
  WEBSITE_SHOW_TAB_BURNCHAMBER: process.env.WEBSITE_SHOW_TAB_BURNCHAMBER || '1',
  WEBSITE_SHOW_TAB_NEWWORLD: process.env.WEBSITE_SHOW_TAB_NEWWORLD || '1',
  WEBSITE_SHOW_TAB_TIPSTARTER: process.env.WEBSITE_SHOW_TAB_TIPSTARTER || '1',
  WEBSITE_SHOW_TAB_MONOCHROME: process.env.WEBSITE_SHOW_TAB_MONOCHROME || '1',
  WEBSITE_SHOW_TAB_DESTINY: process.env.WEBSITE_SHOW_TAB_DESTINY || '1',
  WEBSITE_SHOW_TAB_KEK: process.env.WEBSITE_SHOW_TAB_KEK || '1',
  WEBSITE_SHOW_TAB_LEADERBOARD: process.env.WEBSITE_SHOW_TAB_LEADERBOARD || '1'
};

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shouldUseBlobBackend() {
  if (!OVERRIDE_BLOB_TOKEN || !OVERRIDE_BLOB_PATH) {
    return false;
  }
  if (!OVERRIDE_BACKEND) {
    return true;
  }
  return OVERRIDE_BACKEND === 'blob' || OVERRIDE_BACKEND === 'vercel_blob' || OVERRIDE_BACKEND === 'auto';
}

async function readStoreFromBlob() {
  if (!shouldUseBlobBackend()) return null;

  try {
    if (!cachedBlobOverridesUrl) {
      const listed = await list({
        token: OVERRIDE_BLOB_TOKEN,
        prefix: OVERRIDE_BLOB_PATH,
        limit: 8
      });
      const blobs = Array.isArray(listed?.blobs) ? listed.blobs : [];
      const exact = blobs.find((entry) => entry?.pathname === OVERRIDE_BLOB_PATH) || blobs[0];
      if (!exact?.url) {
        return null;
      }
      cachedBlobOverridesUrl = exact.url;
    }

    const response = await fetch(cachedBlobOverridesUrl, { cache: 'no-store' });
    if (response.status === 404) {
      cachedBlobOverridesUrl = null;
      return null;
    }
    if (!response.ok) {
      throw new Error(`Runtime override blob read failed with status ${response.status}`);
    }

    const text = await response.text();
    if (!text.trim()) {
      return { overrides: {}, updatedAt: null };
    }
    const parsed = JSON.parse(text);
    const overrides = parsed?.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {};
    const updatedAt = typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null;
    return { overrides, updatedAt };
  } catch {
    cachedBlobOverridesUrl = null;
    return null;
  }
}

async function writeStoreToBlob(payload) {
  if (!shouldUseBlobBackend()) return false;

  try {
    const blob = await put(OVERRIDE_BLOB_PATH, JSON.stringify(payload), {
      token: OVERRIDE_BLOB_TOKEN,
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8'
    });
    cachedBlobOverridesUrl = blob?.url || cachedBlobOverridesUrl;
    return true;
  } catch {
    return false;
  }
}

async function readStore() {
  const fromBlob = await readStoreFromBlob();
  if (fromBlob !== null) {
    return fromBlob;
  }

  try {
    const raw = await fs.readFile(OVERRIDE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const overrides = parsed?.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {};
    const updatedAt = typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null;
    return { overrides, updatedAt };
  } catch {
    return { overrides: {}, updatedAt: null };
  }
}

function buildRuntimeFromConfig(config, overrides, updatedAt) {
  const trimmedBaseRpcUrl = String(config.BASE_RPC_URL || '').trim();

  return {
    baseRpcUrl: trimmedBaseRpcUrl || 'https://mainnet.base.org',
    baseRpcFallbackUrls: config.BASE_RPC_FALLBACK_URLS,
    rpcLogRetryAttempts: parsePositiveInt(config.RPC_LOG_RETRY_ATTEMPTS, 4),
    rpcLogRetryDelayMs: parsePositiveInt(config.RPC_LOG_RETRY_DELAY_MS, 350),
    chainId: parsePositiveInt(config.CHAIN_ID, 8453),
    tokenGateContract: config.TOKEN_GATE_CONTRACT,
    tokenGateStandard: config.TOKEN_GATE_STANDARD,
    tokenGateTokenId: parsePositiveInt(config.TOKEN_GATE_TOKEN_ID, 0),
    tokenGateTokenIds: config.TOKEN_GATE_TOKEN_IDS,
    gateMessageTtlSeconds: parsePositiveInt(config.GATE_MESSAGE_TTL_SECONDS, 300),
    claimMessageTtlSeconds: parsePositiveInt(config.CLAIM_MESSAGE_TTL_SECONDS, 300),
    gatePassTtlSeconds: parsePositiveInt(config.GATE_PASS_TTL_SECONDS, 900),
    treasuryWalletAddress: config.TREASURY_WALLET_ADDRESS,
    tipReceiverAddress: config.TIP_RECEIVER_ADDRESS || config.TREASURY_WALLET_ADDRESS || '',
    tipPointsPerEth: parsePositiveInt(config.TIP_POINTS_PER_ETH, 20000),
    tipMinWei: String(config.TIP_MIN_WEI || '1000000000000000').trim(),
    rewardErc1155Contract: config.REWARD_ERC1155_CONTRACT,
    rewardCollectionSlug: config.REWARD_COLLECTION_SLUG || 'cc0-by-pierre',
    rewardErc1155TokenIds: config.REWARD_ERC1155_TOKEN_IDS,
    rewardNftsPerClaim: parsePositiveInt(config.REWARD_NFTS_PER_CLAIM, 20),
    rewardRandomStrategy: config.REWARD_RANDOM_STRATEGY || 'token_uniform',
    claimsPerGateToken: parsePositiveInt(config.CLAIMS_PER_GATE_TOKEN, 1),
    rewardClaimStartBlock: parsePositiveInt(config.REWARD_CLAIM_START_BLOCK, 0),
    rewardLogScanStep: parsePositiveInt(config.REWARD_LOG_SCAN_STEP, 9000),
    rewardTokenDiscoveryStartBlock: parsePositiveInt(config.REWARD_TOKEN_DISCOVERY_START_BLOCK, 0),
    rewardTokenDiscoveryLogScanStep: parsePositiveInt(config.REWARD_TOKEN_DISCOVERY_LOG_SCAN_STEP, 9000),
    rewardTokenDiscoveryMaxItems: parsePositiveInt(config.REWARD_TOKEN_DISCOVERY_MAX_ITEMS, 20000),
    rewardGasMode: config.REWARD_GAS_MODE || 'lowest',
    rewardMinPriorityGwei: config.REWARD_MIN_PRIORITY_GWEI || '0.000001',
    rewardBaseFeeMultiplierBps: parsePositiveInt(config.REWARD_BASE_FEE_MULTIPLIER_BPS, 10000),
    rewardGasPriceMultiplierBps: parsePositiveInt(config.REWARD_GAS_PRICE_MULTIPLIER_BPS, 10000),
    rewardGasLimit: parsePositiveInt(config.REWARD_GAS_LIMIT, 0),
    rewardGasLimitMultiplierBps: parsePositiveInt(config.REWARD_GAS_LIMIT_MULTIPLIER_BPS, 12000),
    rewardTxRetryAttempts: parsePositiveInt(config.REWARD_TX_RETRY_ATTEMPTS, 3),
    rewardTxRetryWaitMs: parsePositiveInt(config.REWARD_TX_RETRY_WAIT_MS, 30000),
    rewardRetryFeeBumpBps: parsePositiveInt(config.REWARD_RETRY_FEE_BUMP_BPS, 12500),
    rewardEstimateFrom: config.REWARD_ESTIMATE_FROM,
    burnRouterContract: config.BURN_ROUTER_CONTRACT,
    burnAllowedCollections: config.BURN_ALLOWED_COLLECTIONS,
    rewardMutableNftContract: config.REWARD_MUTABLE_NFT_CONTRACT,
    rewardMintEnabled: config.REWARD_MINT_ENABLED,
    rewardAutoMintOnBurn: config.REWARD_AUTO_MINT_ON_BURN,
    rewardUnlockClaimMaxBatch: parsePositiveInt(config.REWARD_UNLOCK_CLAIM_MAX_BATCH, 20),
    burnRewardCid1: config.BURN_REWARD_CID_1 || '',
    burnRewardCid2: config.BURN_REWARD_CID_2 || '',
    burnRewardCid3: config.BURN_REWARD_CID_3 || '',
    burnRewardCid4: config.BURN_REWARD_CID_4 || '',
    burnRewardCid5: config.BURN_REWARD_CID_5 || '',
    websiteBrandName: config.WEBSITE_BRAND_NAME,
    websiteAccessTitle: config.WEBSITE_ACCESS_TITLE,
    websiteAccessSubtitle: config.WEBSITE_ACCESS_SUBTITLE,
    websiteStep1Title: config.WEBSITE_STEP1_TITLE,
    websiteStep1Subtitle: config.WEBSITE_STEP1_SUBTITLE,
    websiteStep2Title: config.WEBSITE_STEP2_TITLE,
    websiteStep2Subtitle: config.WEBSITE_STEP2_SUBTITLE,
    websiteBurnHeroSubtitle: config.WEBSITE_BURN_HERO_SUBTITLE,
    websiteNftsTabLabel: config.WEBSITE_NFTS_TAB_LABEL,
    websiteRewardsTabLabel: config.WEBSITE_REWARDS_TAB_LABEL,
    websiteNftsSectionTitle: config.WEBSITE_NFTS_SECTION_TITLE,
    websiteRewardsSectionTitle: config.WEBSITE_REWARDS_SECTION_TITLE,
    websiteShowHeroPanel: config.WEBSITE_SHOW_HERO_PANEL,
    websiteShowEntryBanner: config.WEBSITE_SHOW_ENTRY_BANNER,
    websiteShowFooter: config.WEBSITE_SHOW_FOOTER,
    websiteShowTabNfts: config.WEBSITE_SHOW_TAB_NFTS,
    websiteShowTabRewards: config.WEBSITE_SHOW_TAB_REWARDS,
    websiteShowTabB2R: config.WEBSITE_SHOW_TAB_B2R,
    websiteShowTabBonfire: config.WEBSITE_SHOW_TAB_BONFIRE,
    websiteShowTabForge: config.WEBSITE_SHOW_TAB_FORGE,
    websiteShowTabBurnchamber: config.WEBSITE_SHOW_TAB_BURNCHAMBER,
    websiteShowTabNewworld: config.WEBSITE_SHOW_TAB_NEWWORLD,
    websiteShowTabTipstarter: config.WEBSITE_SHOW_TAB_TIPSTARTER,
    websiteShowTabMonochrome: config.WEBSITE_SHOW_TAB_MONOCHROME,
    websiteShowTabDestiny: config.WEBSITE_SHOW_TAB_DESTINY,
    websiteShowTabKek: config.WEBSITE_SHOW_TAB_KEK,
    websiteShowTabLeaderboard: config.WEBSITE_SHOW_TAB_LEADERBOARD,
    claimSigningSecret: (process.env.CLAIM_SIGNING_SECRET || '').trim(),
    treasuryPrivateKey: (process.env.TREASURY_PRIVATE_KEY || '').trim(),
    overrides,
    updatedAt
  };
}

async function writeStore(overrides) {
  const payload = {
    updatedAt: new Date().toISOString(),
    overrides
  };

  const wroteBlob = await writeStoreToBlob(payload);
  if (!wroteBlob) {
    await fs.writeFile(OVERRIDE_PATH, JSON.stringify(payload, null, 2), 'utf8');
  }

  return payload;
}

function sanitizeOverrides(input) {
  const clean = {};
  for (const key of EDITABLE_OVERRIDE_KEYS) {
    if (!(key in input)) continue;
    const value = input[key];

    if (value === null || value === undefined || String(value).trim() === '') {
      continue;
    }

    if (key === 'TOKEN_GATE_STANDARD') {
      const standard = String(value).trim().toLowerCase();
      if (standard === 'erc721' || standard === 'erc1155') {
        clean[key] = standard;
      }
      continue;
    }

    if (key === 'REWARD_RANDOM_STRATEGY') {
      const strategy = String(value).trim().toLowerCase();
      if (strategy === 'token_uniform' || strategy === 'unit_weighted') {
        clean[key] = strategy;
      }
      continue;
    }

    clean[key] = String(value).trim();
  }
  return clean;
}

export async function getEditableConfig() {
  const { overrides, updatedAt } = await readStore();
  const config = { ...DEFAULT_EDITABLE_CONFIG, ...overrides };
  return { config, overrides, updatedAt };
}

export async function updateEditableConfig(patch) {
  const { overrides: currentOverrides } = await readStore();
  const cleanPatch = sanitizeOverrides(patch || {});

  const nextOverrides = { ...currentOverrides };

  for (const key of EDITABLE_OVERRIDE_KEYS) {
    if (!(key in (patch || {}))) continue;

    const incoming = patch[key];
    if (incoming === null || incoming === undefined || String(incoming).trim() === '') {
      delete nextOverrides[key];
      continue;
    }

    if (key in cleanPatch) {
      nextOverrides[key] = cleanPatch[key];
    }
  }

  await writeStore(nextOverrides);
  return getEditableConfig();
}

export async function clearEditableConfig() {
  await writeStore({});
  return getEditableConfig();
}

export function getRuntimeOverridePersistenceInfo() {
  const usingBlob = shouldUseBlobBackend();
  return {
    backend: usingBlob ? 'vercel_blob' : 'tmp',
    durable: usingBlob,
    path: usingBlob ? OVERRIDE_BLOB_PATH : OVERRIDE_PATH
  };
}

export async function getRuntimeConfig() {
  const { config, overrides, updatedAt } = await getEditableConfig();
  return buildRuntimeFromConfig(config, overrides, updatedAt);
}

export async function getRuntimeConfigForRequest(req) {
  const internalSecret = (process.env.RUNTIME_CONFIG_INTERNAL_SECRET || '').trim();
  const host = req.headers?.host || '';
  const protocol = req.headers?.['x-forwarded-proto'] || 'https';

  if (!internalSecret || !host) {
    return getRuntimeConfig();
  }

  try {
    const response = await fetch(`${protocol}://${host}/api/admin/config?internal=1`, {
      method: 'GET',
      headers: {
        'x-runtime-config-secret': internalSecret
      }
    });

    if (response.ok) {
      const payload = await response.json();
      const config = payload?.config && typeof payload.config === 'object' ? payload.config : DEFAULT_EDITABLE_CONFIG;
      const overrides = payload?.overrides && typeof payload.overrides === 'object' ? payload.overrides : {};
      const updatedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt : null;
      return buildRuntimeFromConfig(config, overrides, updatedAt);
    }
  } catch {
    // Fallback to local runtime config below.
  }

  return getRuntimeConfig();
}
