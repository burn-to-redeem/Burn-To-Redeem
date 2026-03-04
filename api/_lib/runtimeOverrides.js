import fs from 'node:fs/promises';

const OVERRIDE_PATH = '/tmp/burn-to-redeem-runtime-overrides.json';

export const EDITABLE_OVERRIDE_KEYS = [
  'BASE_RPC_URL',
  'CHAIN_ID',
  'TOKEN_GATE_CONTRACT',
  'TOKEN_GATE_STANDARD',
  'TOKEN_GATE_TOKEN_ID',
  'TOKEN_GATE_TOKEN_IDS',
  'GATE_MESSAGE_TTL_SECONDS',
  'CLAIM_MESSAGE_TTL_SECONDS',
  'GATE_PASS_TTL_SECONDS',
  'TREASURY_WALLET_ADDRESS',
  'REWARD_ERC1155_CONTRACT',
  'REWARD_ERC1155_TOKEN_IDS',
  'REWARD_NFTS_PER_CLAIM',
  'REWARD_GAS_MODE',
  'REWARD_MIN_PRIORITY_GWEI',
  'REWARD_BASE_FEE_MULTIPLIER_BPS',
  'REWARD_GAS_PRICE_MULTIPLIER_BPS',
  'REWARD_GAS_LIMIT',
  'REWARD_GAS_LIMIT_MULTIPLIER_BPS',
  'REWARD_TX_RETRY_ATTEMPTS',
  'REWARD_TX_RETRY_WAIT_MS',
  'REWARD_RETRY_FEE_BUMP_BPS',
  'REWARD_ESTIMATE_FROM'
];

const DEFAULT_EDITABLE_CONFIG = {
  BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  CHAIN_ID: process.env.CHAIN_ID || '8453',
  TOKEN_GATE_CONTRACT: process.env.TOKEN_GATE_CONTRACT || '',
  TOKEN_GATE_STANDARD: process.env.TOKEN_GATE_STANDARD || 'erc721',
  TOKEN_GATE_TOKEN_ID: process.env.TOKEN_GATE_TOKEN_ID || '0',
  TOKEN_GATE_TOKEN_IDS: process.env.TOKEN_GATE_TOKEN_IDS || '',
  GATE_MESSAGE_TTL_SECONDS: process.env.GATE_MESSAGE_TTL_SECONDS || '300',
  CLAIM_MESSAGE_TTL_SECONDS: process.env.CLAIM_MESSAGE_TTL_SECONDS || '300',
  GATE_PASS_TTL_SECONDS: process.env.GATE_PASS_TTL_SECONDS || '900',
  TREASURY_WALLET_ADDRESS: process.env.TREASURY_WALLET_ADDRESS || '',
  REWARD_ERC1155_CONTRACT: process.env.REWARD_ERC1155_CONTRACT || '',
  REWARD_ERC1155_TOKEN_IDS: process.env.REWARD_ERC1155_TOKEN_IDS || '',
  REWARD_NFTS_PER_CLAIM: process.env.REWARD_NFTS_PER_CLAIM || '20',
  REWARD_GAS_MODE: process.env.REWARD_GAS_MODE || 'lowest',
  REWARD_MIN_PRIORITY_GWEI: process.env.REWARD_MIN_PRIORITY_GWEI || '0.000001',
  REWARD_BASE_FEE_MULTIPLIER_BPS: process.env.REWARD_BASE_FEE_MULTIPLIER_BPS || '10000',
  REWARD_GAS_PRICE_MULTIPLIER_BPS: process.env.REWARD_GAS_PRICE_MULTIPLIER_BPS || '10000',
  REWARD_GAS_LIMIT: process.env.REWARD_GAS_LIMIT || '',
  REWARD_GAS_LIMIT_MULTIPLIER_BPS: process.env.REWARD_GAS_LIMIT_MULTIPLIER_BPS || '12000',
  REWARD_TX_RETRY_ATTEMPTS: process.env.REWARD_TX_RETRY_ATTEMPTS || '3',
  REWARD_TX_RETRY_WAIT_MS: process.env.REWARD_TX_RETRY_WAIT_MS || '30000',
  REWARD_RETRY_FEE_BUMP_BPS: process.env.REWARD_RETRY_FEE_BUMP_BPS || '12500',
  REWARD_ESTIMATE_FROM: process.env.REWARD_ESTIMATE_FROM || ''
};

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readStore() {
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
  return {
    baseRpcUrl: config.BASE_RPC_URL,
    chainId: parsePositiveInt(config.CHAIN_ID, 8453),
    tokenGateContract: config.TOKEN_GATE_CONTRACT,
    tokenGateStandard: config.TOKEN_GATE_STANDARD,
    tokenGateTokenId: parsePositiveInt(config.TOKEN_GATE_TOKEN_ID, 0),
    tokenGateTokenIds: config.TOKEN_GATE_TOKEN_IDS,
    gateMessageTtlSeconds: parsePositiveInt(config.GATE_MESSAGE_TTL_SECONDS, 300),
    claimMessageTtlSeconds: parsePositiveInt(config.CLAIM_MESSAGE_TTL_SECONDS, 300),
    gatePassTtlSeconds: parsePositiveInt(config.GATE_PASS_TTL_SECONDS, 900),
    treasuryWalletAddress: config.TREASURY_WALLET_ADDRESS,
    rewardErc1155Contract: config.REWARD_ERC1155_CONTRACT,
    rewardErc1155TokenIds: config.REWARD_ERC1155_TOKEN_IDS,
    rewardNftsPerClaim: parsePositiveInt(config.REWARD_NFTS_PER_CLAIM, 20),
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
  await fs.writeFile(OVERRIDE_PATH, JSON.stringify(payload, null, 2), 'utf8');
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
