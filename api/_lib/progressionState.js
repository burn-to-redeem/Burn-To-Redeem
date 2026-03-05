import fs from 'node:fs/promises';
import pg from 'pg';
import { list, put } from '@vercel/blob';
import { ethers } from 'ethers';

const { Pool } = pg;

const PROGRESSION_STATE_PATH = '/tmp/burn-to-redeem-progression-state.json';
const PROGRESSION_STATE_BLOB_PATH = String(
  process.env.PROGRESSION_BLOB_STATE_PATH || 'state/progression-v1.json'
).trim();
const PROGRESSION_STATE_BACKEND = String(process.env.PROGRESSION_STATE_BACKEND || '')
  .trim()
  .toLowerCase();
const PROGRESSION_STATE_BLOB_TOKEN = String(
  process.env.PROGRESSION_BLOB_RW_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || ''
).trim();
const PROGRESSION_POSTGRES_URL = String(
  process.env.PROGRESSION_POSTGRES_URL || process.env.POSTGRES_URL || ''
).trim();

const MAX_HISTORY_PER_WALLET = 300;
const MAX_PROCESSED_BURNS = 20000;
const MAX_PROCESSED_TIPS = 20000;

let cachedBlobStateUrl = null;
let pgPool = null;
let pgSchemaReady = false;
let pgSchemaPromise = null;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shouldUsePostgresBackend() {
  if (!PROGRESSION_POSTGRES_URL) return false;
  if (!PROGRESSION_STATE_BACKEND) return false;
  return (
    PROGRESSION_STATE_BACKEND === 'postgres' ||
    PROGRESSION_STATE_BACKEND === 'vercel_postgres' ||
    PROGRESSION_STATE_BACKEND === 'pg'
  );
}

function shouldUseBlobBackend() {
  if (shouldUsePostgresBackend()) return false;
  if (!PROGRESSION_STATE_BLOB_TOKEN || !PROGRESSION_STATE_BLOB_PATH) {
    return false;
  }
  return PROGRESSION_STATE_BACKEND === 'blob' || PROGRESSION_STATE_BACKEND === 'vercel_blob';
}

function getPgPool() {
  if (!PROGRESSION_POSTGRES_URL) {
    throw new Error('PROGRESSION_POSTGRES_URL or POSTGRES_URL is required for postgres progression backend.');
  }

  if (!pgPool) {
    pgPool = new Pool({
      connectionString: PROGRESSION_POSTGRES_URL,
      max: parsePositiveInt(process.env.PROGRESSION_POSTGRES_POOL_MAX, 5)
    });
  }

  return pgPool;
}

async function ensurePgSchema() {
  if (!shouldUsePostgresBackend()) return false;
  if (pgSchemaReady) return true;
  if (pgSchemaPromise) return pgSchemaPromise;

  pgSchemaPromise = (async () => {
    const client = await getPgPool().connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS progression_wallets (
          address TEXT PRIMARY KEY,
          burn_units INTEGER NOT NULL DEFAULT 0,
          points INTEGER NOT NULL DEFAULT 0,
          unlocked_rewards INTEGER NOT NULL DEFAULT 0,
          claimed_rewards INTEGER NOT NULL DEFAULT 0,
          tip_count INTEGER NOT NULL DEFAULT 0,
          tipped_wei TEXT NOT NULL DEFAULT '0',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS progression_burn_events (
          id BIGSERIAL PRIMARY KEY,
          address TEXT NOT NULL,
          burn_tx_hash TEXT NOT NULL UNIQUE,
          burned_units INTEGER NOT NULL,
          credits_awarded INTEGER NOT NULL,
          burn_mode TEXT NOT NULL,
          burned_token_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          burned_collections JSONB NOT NULL DEFAULT '[]'::jsonb,
          contract_address TEXT NOT NULL DEFAULT '',
          block_number INTEGER NOT NULL DEFAULT 0,
          event_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS progression_tip_events (
          id BIGSERIAL PRIMARY KEY,
          address TEXT NOT NULL,
          tip_tx_hash TEXT NOT NULL UNIQUE,
          value_wei TEXT NOT NULL,
          points_awarded INTEGER NOT NULL,
          tip_receiver TEXT NOT NULL DEFAULT '',
          block_number INTEGER NOT NULL DEFAULT 0,
          event_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS progression_claim_events (
          id BIGSERIAL PRIMARY KEY,
          address TEXT NOT NULL,
          claim_tx_hash TEXT NOT NULL DEFAULT '',
          claim_units INTEGER NOT NULL,
          minted_token_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
          minted_cids JSONB NOT NULL DEFAULT '[]'::jsonb,
          event_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(
        'CREATE INDEX IF NOT EXISTS progression_wallets_points_idx ON progression_wallets (points DESC, burn_units DESC, updated_at DESC)'
      );
      await client.query(
        'CREATE INDEX IF NOT EXISTS progression_burn_events_address_time_idx ON progression_burn_events (address, event_time DESC, id DESC)'
      );
      await client.query(
        'CREATE INDEX IF NOT EXISTS progression_tip_events_address_time_idx ON progression_tip_events (address, event_time DESC, id DESC)'
      );
      await client.query(
        'CREATE INDEX IF NOT EXISTS progression_claim_events_address_time_idx ON progression_claim_events (address, event_time DESC, id DESC)'
      );

      pgSchemaReady = true;
      return true;
    } finally {
      client.release();
    }
  })();

  try {
    return await pgSchemaPromise;
  } finally {
    pgSchemaPromise = null;
  }
}

async function readProgressionStateFromBlob() {
  if (!shouldUseBlobBackend()) return null;

  try {
    if (!cachedBlobStateUrl) {
      const listed = await list({
        token: PROGRESSION_STATE_BLOB_TOKEN,
        prefix: PROGRESSION_STATE_BLOB_PATH,
        limit: 8
      });
      const blobs = Array.isArray(listed?.blobs) ? listed.blobs : [];
      const exact = blobs.find((entry) => entry?.pathname === PROGRESSION_STATE_BLOB_PATH) || blobs[0];
      if (!exact?.url) {
        return null;
      }
      cachedBlobStateUrl = exact.url;
    }

    const response = await fetch(cachedBlobStateUrl, { cache: 'no-store' });
    if (response.status === 404) {
      cachedBlobStateUrl = null;
      return null;
    }
    if (!response.ok) {
      throw new Error(`Blob state fetch failed with status ${response.status}`);
    }

    const text = await response.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    cachedBlobStateUrl = null;
    return null;
  }
}

async function writeProgressionStateToBlob(payload) {
  if (!shouldUseBlobBackend()) return false;

  try {
    const blob = await put(PROGRESSION_STATE_BLOB_PATH, JSON.stringify(payload), {
      token: PROGRESSION_STATE_BLOB_TOKEN,
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8'
    });
    cachedBlobStateUrl = blob?.url || cachedBlobStateUrl;
    return true;
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function toAddress(value) {
  try {
    return ethers.getAddress(String(value || '').trim()).toLowerCase();
  } catch {
    return null;
  }
}

function toTxHash(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(raw)) return null;
  return raw;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  return fallback;
}

function toWeiString(value, fallback = '0') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    if (parsed < 0n) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const cleaned = String(value || '').trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

function defaultWalletState() {
  return {
    burnUnits: 0,
    points: 0,
    unlockedRewards: 0,
    claimedRewards: 0,
    tipCount: 0,
    tippedWei: '0',
    burnEvents: [],
    tipEvents: [],
    claimEvents: [],
    updatedAt: nowIso()
  };
}

function normalizeBurnEvent(event) {
  const txHash = toTxHash(event?.burnTxHash);
  if (!txHash) return null;

  const timestamp = String(event?.timestamp || nowIso());
  const burnedUnits = Math.max(0, toInt(event?.burnedUnits, 0));
  const creditsAwarded = Math.max(0, toInt(event?.creditsAwarded, burnedUnits * 20));

  return {
    burnTxHash: txHash,
    burnedUnits,
    creditsAwarded,
    burnMode: String(event?.burnMode || 'direct_transfer'),
    burnedTokenIds: uniqueStrings(event?.burnedTokenIds),
    burnedCollections: uniqueStrings(event?.burnedCollections),
    contractAddress: String(event?.contractAddress || '').trim().toLowerCase(),
    blockNumber: Math.max(0, toInt(event?.blockNumber, 0)),
    timestamp
  };
}

function normalizeClaimEvent(event) {
  const txHash = toTxHash(event?.claimTxHash);
  const claimUnits = Math.max(0, toInt(event?.claimUnits, 0));

  if (!txHash && claimUnits <= 0) return null;

  return {
    claimTxHash: txHash || '',
    claimUnits,
    mintedTokenIds: uniqueStrings(event?.mintedTokenIds),
    mintedCids: uniqueStrings(event?.mintedCids),
    timestamp: String(event?.timestamp || nowIso())
  };
}

function normalizeTipEvent(event) {
  const txHash = toTxHash(event?.tipTxHash);
  const pointsAwarded = Math.max(0, toInt(event?.pointsAwarded, 0));
  const valueWei = toWeiString(event?.valueWei, '0');

  if (!txHash || pointsAwarded <= 0 || valueWei === '0') return null;

  return {
    tipTxHash: txHash,
    valueWei,
    pointsAwarded,
    tipReceiver: String(event?.tipReceiver || '').trim().toLowerCase(),
    blockNumber: Math.max(0, toInt(event?.blockNumber, 0)),
    timestamp: String(event?.timestamp || nowIso())
  };
}

function normalizeWalletState(value) {
  const next = defaultWalletState();

  next.burnUnits = Math.max(0, toInt(value?.burnUnits, 0));
  next.points = Math.max(0, toInt(value?.points, next.burnUnits * 20));
  next.unlockedRewards = Math.max(0, toInt(value?.unlockedRewards, next.burnUnits));
  next.claimedRewards = Math.max(0, toInt(value?.claimedRewards, 0));
  next.tipCount = Math.max(0, toInt(value?.tipCount, 0));
  next.tippedWei = toWeiString(value?.tippedWei, '0');

  const burnEvents = Array.isArray(value?.burnEvents)
    ? value.burnEvents.map(normalizeBurnEvent).filter(Boolean)
    : [];
  const tipEvents = Array.isArray(value?.tipEvents)
    ? value.tipEvents.map(normalizeTipEvent).filter(Boolean)
    : [];
  const claimEvents = Array.isArray(value?.claimEvents)
    ? value.claimEvents.map(normalizeClaimEvent).filter(Boolean)
    : [];

  next.burnEvents = burnEvents.slice(0, MAX_HISTORY_PER_WALLET);
  next.tipEvents = tipEvents.slice(0, MAX_HISTORY_PER_WALLET);
  next.claimEvents = claimEvents.slice(0, MAX_HISTORY_PER_WALLET);
  next.updatedAt = String(value?.updatedAt || nowIso());

  if (next.claimedRewards > next.unlockedRewards) {
    next.claimedRewards = next.unlockedRewards;
  }

  return next;
}

function normalizeState(input) {
  const state = {
    version: 1,
    updatedAt: String(input?.updatedAt || nowIso()),
    processedBurnTxHashes: [],
    processedTipTxHashes: [],
    wallets: {}
  };

  const seenHashes = new Set();
  const hashes = Array.isArray(input?.processedBurnTxHashes) ? input.processedBurnTxHashes : [];
  for (const hash of hashes) {
    const cleaned = toTxHash(hash);
    if (!cleaned || seenHashes.has(cleaned)) continue;
    seenHashes.add(cleaned);
    state.processedBurnTxHashes.push(cleaned);
    if (state.processedBurnTxHashes.length >= MAX_PROCESSED_BURNS) break;
  }

  const seenTipHashes = new Set();
  const tipHashes = Array.isArray(input?.processedTipTxHashes) ? input.processedTipTxHashes : [];
  for (const hash of tipHashes) {
    const cleaned = toTxHash(hash);
    if (!cleaned || seenTipHashes.has(cleaned)) continue;
    seenTipHashes.add(cleaned);
    state.processedTipTxHashes.push(cleaned);
    if (state.processedTipTxHashes.length >= MAX_PROCESSED_TIPS) break;
  }

  if (input?.wallets && typeof input.wallets === 'object') {
    for (const [walletAddress, rawWalletState] of Object.entries(input.wallets)) {
      const address = toAddress(walletAddress);
      if (!address) continue;
      state.wallets[address] = normalizeWalletState(rawWalletState);
    }
  }

  return state;
}

function ensureWallet(state, walletAddress) {
  const address = toAddress(walletAddress);
  if (!address) {
    throw new Error('Invalid wallet address for progression state.');
  }

  if (!state.wallets[address]) {
    state.wallets[address] = defaultWalletState();
  }

  return { address, wallet: state.wallets[address] };
}

function hasProcessedBurnTxInMemory(state, burnTxHash) {
  const txHash = toTxHash(burnTxHash);
  if (!txHash) return false;
  return (state?.processedBurnTxHashes || []).includes(txHash);
}

function hasProcessedTipTxInMemory(state, tipTxHash) {
  const txHash = toTxHash(tipTxHash);
  if (!txHash) return false;
  return (state?.processedTipTxHashes || []).includes(txHash);
}

function getWalletProgressInMemory(state, walletAddress) {
  const address = toAddress(walletAddress);
  if (!address) return null;

  const wallet = state?.wallets?.[address];
  if (!wallet) {
    return {
      address,
      burnUnits: 0,
      points: 0,
      unlockedRewards: 0,
      claimedRewards: 0,
      claimableRewards: 0,
      tipCount: 0,
      tippedWei: '0',
      burnEvents: [],
      tipEvents: [],
      claimEvents: [],
      updatedAt: null
    };
  }

  const unlockedRewards = Math.max(0, toInt(wallet.unlockedRewards, 0));
  const claimedRewards = Math.min(unlockedRewards, Math.max(0, toInt(wallet.claimedRewards, 0)));

  return {
    address,
    burnUnits: Math.max(0, toInt(wallet.burnUnits, 0)),
    points: Math.max(0, toInt(wallet.points, 0)),
    unlockedRewards,
    claimedRewards,
    claimableRewards: Math.max(0, unlockedRewards - claimedRewards),
    tipCount: Math.max(0, toInt(wallet.tipCount, 0)),
    tippedWei: toWeiString(wallet.tippedWei, '0'),
    burnEvents: (wallet.burnEvents || []).slice(0, MAX_HISTORY_PER_WALLET),
    tipEvents: (wallet.tipEvents || []).slice(0, MAX_HISTORY_PER_WALLET),
    claimEvents: (wallet.claimEvents || []).slice(0, MAX_HISTORY_PER_WALLET),
    updatedAt: wallet.updatedAt || null
  };
}

function recordBurnProgressInMemory(state, burn) {
  const txHash = toTxHash(burn?.burnTxHash);
  if (!txHash) {
    throw new Error('Invalid burn transaction hash for progression update.');
  }

  if (hasProcessedBurnTxInMemory(state, txHash)) {
    return {
      alreadyProcessed: true,
      wallet: getWalletProgressInMemory(state, burn?.address)
    };
  }

  const { address, wallet } = ensureWallet(state, burn?.address);

  const burnedUnits = Math.max(0, toInt(burn?.burnedUnits, 0));
  const creditsAwarded = Math.max(0, toInt(burn?.creditsAwarded, burnedUnits * 20));

  wallet.burnUnits += burnedUnits;
  wallet.points += creditsAwarded;
  wallet.unlockedRewards += burnedUnits;
  wallet.updatedAt = nowIso();

  wallet.burnEvents.unshift(
    normalizeBurnEvent({
      ...burn,
      burnTxHash: txHash,
      burnedUnits,
      creditsAwarded,
      timestamp: burn?.timestamp || nowIso()
    })
  );
  wallet.burnEvents = wallet.burnEvents.filter(Boolean).slice(0, MAX_HISTORY_PER_WALLET);

  state.processedBurnTxHashes.unshift(txHash);
  state.processedBurnTxHashes = uniqueStrings(state.processedBurnTxHashes).slice(0, MAX_PROCESSED_BURNS);
  state.updatedAt = nowIso();

  return {
    alreadyProcessed: false,
    wallet: getWalletProgressInMemory(state, address)
  };
}

function recordClaimProgressInMemory(state, claim) {
  const { address, wallet } = ensureWallet(state, claim?.address);

  const claimUnits = Math.max(0, toInt(claim?.claimUnits, 0));
  if (claimUnits <= 0) {
    return getWalletProgressInMemory(state, address);
  }

  wallet.claimedRewards = Math.min(wallet.unlockedRewards, wallet.claimedRewards + claimUnits);
  wallet.updatedAt = nowIso();

  wallet.claimEvents.unshift(
    normalizeClaimEvent({
      claimTxHash: claim?.claimTxHash,
      claimUnits,
      mintedTokenIds: claim?.mintedTokenIds,
      mintedCids: claim?.mintedCids,
      timestamp: claim?.timestamp || nowIso()
    })
  );
  wallet.claimEvents = wallet.claimEvents.filter(Boolean).slice(0, MAX_HISTORY_PER_WALLET);

  state.updatedAt = nowIso();
  return getWalletProgressInMemory(state, address);
}

function recordTipProgressInMemory(state, tip) {
  const txHash = toTxHash(tip?.tipTxHash);
  if (!txHash) {
    throw new Error('Invalid tip transaction hash for progression update.');
  }

  if (hasProcessedTipTxInMemory(state, txHash)) {
    return {
      alreadyProcessed: true,
      wallet: getWalletProgressInMemory(state, tip?.address)
    };
  }

  const { address, wallet } = ensureWallet(state, tip?.address);
  const valueWei = toWeiString(tip?.valueWei, '0');
  const pointsAwarded = Math.max(0, toInt(tip?.pointsAwarded, 0));

  if (valueWei === '0' || pointsAwarded <= 0) {
    throw new Error('Tip value and points must be greater than zero.');
  }

  wallet.points += pointsAwarded;
  wallet.tipCount += 1;
  wallet.tippedWei = (BigInt(toWeiString(wallet.tippedWei, '0')) + BigInt(valueWei)).toString();
  wallet.updatedAt = nowIso();

  wallet.tipEvents.unshift(
    normalizeTipEvent({
      ...tip,
      tipTxHash: txHash,
      valueWei,
      pointsAwarded,
      timestamp: tip?.timestamp || nowIso()
    })
  );
  wallet.tipEvents = wallet.tipEvents.filter(Boolean).slice(0, MAX_HISTORY_PER_WALLET);

  state.processedTipTxHashes.unshift(txHash);
  state.processedTipTxHashes = uniqueStrings(state.processedTipTxHashes).slice(0, MAX_PROCESSED_TIPS);
  state.updatedAt = nowIso();

  return {
    alreadyProcessed: false,
    wallet: getWalletProgressInMemory(state, address)
  };
}

function buildLeaderboardInMemory(state, limit = 50) {
  const rows = [];

  for (const [address, wallet] of Object.entries(state?.wallets || {})) {
    const stats = getWalletProgressInMemory(state, address);
    rows.push({
      address,
      points: stats.points,
      burnUnits: stats.burnUnits,
      unlockedRewards: stats.unlockedRewards,
      claimedRewards: stats.claimedRewards,
      claimableRewards: stats.claimableRewards,
      updatedAt: stats.updatedAt || wallet?.updatedAt || null
    });
  }

  rows.sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.burnUnits !== left.burnUnits) return right.burnUnits - left.burnUnits;
    return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
  });

  return rows.slice(0, Math.max(1, toInt(limit, 50))).map((entry, index) => ({
    rank: index + 1,
    ...entry
  }));
}

function collectRecentBurnsInMemory(state, limit = 30) {
  const events = [];

  for (const [address, wallet] of Object.entries(state?.wallets || {})) {
    for (const event of wallet?.burnEvents || []) {
      if (!event) continue;
      events.push({
        address,
        ...event
      });
    }
  }

  events.sort((left, right) => {
    const leftTime = new Date(left.timestamp || 0).getTime();
    const rightTime = new Date(right.timestamp || 0).getTime();
    return rightTime - leftTime;
  });

  return events.slice(0, Math.max(1, toInt(limit, 30)));
}

function parseRowJsonArray(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? uniqueStrings(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function pgHasProcessedBurnTx(burnTxHash) {
  const txHash = toTxHash(burnTxHash);
  if (!txHash) return false;
  await ensurePgSchema();
  const result = await getPgPool().query(
    'SELECT 1 FROM progression_burn_events WHERE burn_tx_hash = $1 LIMIT 1',
    [txHash]
  );
  return result.rowCount > 0;
}

async function pgHasProcessedTipTx(tipTxHash) {
  const txHash = toTxHash(tipTxHash);
  if (!txHash) return false;
  await ensurePgSchema();
  const result = await getPgPool().query(
    'SELECT 1 FROM progression_tip_events WHERE tip_tx_hash = $1 LIMIT 1',
    [txHash]
  );
  return result.rowCount > 0;
}

async function pgGetWalletProgress(walletAddress) {
  const address = toAddress(walletAddress);
  if (!address) return null;

  await ensurePgSchema();

  const [walletResult, burnResult, tipResult, claimResult] = await Promise.all([
    getPgPool().query(
      `SELECT burn_units, points, unlocked_rewards, claimed_rewards, tip_count, tipped_wei, updated_at
       FROM progression_wallets
       WHERE address = $1`,
      [address]
    ),
    getPgPool().query(
      `SELECT burn_tx_hash, burned_units, credits_awarded, burn_mode, burned_token_ids,
              burned_collections, contract_address, block_number, event_time
       FROM progression_burn_events
       WHERE address = $1
       ORDER BY event_time DESC, id DESC
       LIMIT $2`,
      [address, MAX_HISTORY_PER_WALLET]
    ),
    getPgPool().query(
      `SELECT tip_tx_hash, value_wei, points_awarded, tip_receiver, block_number, event_time
       FROM progression_tip_events
       WHERE address = $1
       ORDER BY event_time DESC, id DESC
       LIMIT $2`,
      [address, MAX_HISTORY_PER_WALLET]
    ),
    getPgPool().query(
      `SELECT claim_tx_hash, claim_units, minted_token_ids, minted_cids, event_time
       FROM progression_claim_events
       WHERE address = $1
       ORDER BY event_time DESC, id DESC
       LIMIT $2`,
      [address, MAX_HISTORY_PER_WALLET]
    )
  ]);

  const walletRow = walletResult.rows[0] || null;
  if (!walletRow) {
    return {
      address,
      burnUnits: 0,
      points: 0,
      unlockedRewards: 0,
      claimedRewards: 0,
      claimableRewards: 0,
      tipCount: 0,
      tippedWei: '0',
      burnEvents: [],
      tipEvents: [],
      claimEvents: [],
      updatedAt: null
    };
  }

  const unlockedRewards = Math.max(0, toInt(walletRow.unlocked_rewards, 0));
  const claimedRewards = Math.min(unlockedRewards, Math.max(0, toInt(walletRow.claimed_rewards, 0)));

  return {
    address,
    burnUnits: Math.max(0, toInt(walletRow.burn_units, 0)),
    points: Math.max(0, toInt(walletRow.points, 0)),
    unlockedRewards,
    claimedRewards,
    claimableRewards: Math.max(0, unlockedRewards - claimedRewards),
    tipCount: Math.max(0, toInt(walletRow.tip_count, 0)),
    tippedWei: toWeiString(walletRow.tipped_wei, '0'),
    burnEvents: burnResult.rows.map((row) => ({
      burnTxHash: String(row.burn_tx_hash || '').toLowerCase(),
      burnedUnits: Math.max(0, toInt(row.burned_units, 0)),
      creditsAwarded: Math.max(0, toInt(row.credits_awarded, 0)),
      burnMode: String(row.burn_mode || 'direct_transfer'),
      burnedTokenIds: parseRowJsonArray(row.burned_token_ids),
      burnedCollections: parseRowJsonArray(row.burned_collections),
      contractAddress: String(row.contract_address || '').toLowerCase(),
      blockNumber: Math.max(0, toInt(row.block_number, 0)),
      timestamp: row.event_time ? new Date(row.event_time).toISOString() : nowIso()
    })),
    tipEvents: tipResult.rows.map((row) => ({
      tipTxHash: String(row.tip_tx_hash || '').toLowerCase(),
      valueWei: toWeiString(row.value_wei, '0'),
      pointsAwarded: Math.max(0, toInt(row.points_awarded, 0)),
      tipReceiver: String(row.tip_receiver || '').toLowerCase(),
      blockNumber: Math.max(0, toInt(row.block_number, 0)),
      timestamp: row.event_time ? new Date(row.event_time).toISOString() : nowIso()
    })),
    claimEvents: claimResult.rows.map((row) => ({
      claimTxHash: toTxHash(row.claim_tx_hash) || '',
      claimUnits: Math.max(0, toInt(row.claim_units, 0)),
      mintedTokenIds: parseRowJsonArray(row.minted_token_ids),
      mintedCids: parseRowJsonArray(row.minted_cids),
      timestamp: row.event_time ? new Date(row.event_time).toISOString() : nowIso()
    })),
    updatedAt: walletRow.updated_at ? new Date(walletRow.updated_at).toISOString() : null
  };
}

async function pgRecordBurnProgress(burn) {
  const normalized = normalizeBurnEvent(burn);
  if (!normalized?.burnTxHash) {
    throw new Error('Invalid burn transaction hash for progression update.');
  }

  const address = toAddress(burn?.address);
  if (!address) {
    throw new Error('Invalid wallet address for progression update.');
  }

  await ensurePgSchema();

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO progression_burn_events (
         address, burn_tx_hash, burned_units, credits_awarded, burn_mode,
         burned_token_ids, burned_collections, contract_address, block_number, event_time
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10::timestamptz)
       ON CONFLICT (burn_tx_hash) DO NOTHING
       RETURNING burn_tx_hash`,
      [
        address,
        normalized.burnTxHash,
        normalized.burnedUnits,
        normalized.creditsAwarded,
        normalized.burnMode,
        JSON.stringify(normalized.burnedTokenIds || []),
        JSON.stringify(normalized.burnedCollections || []),
        normalized.contractAddress || '',
        normalized.blockNumber || 0,
        normalized.timestamp
      ]
    );

    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      return {
        alreadyProcessed: true,
        wallet: await pgGetWalletProgress(address)
      };
    }

    await client.query(
      `INSERT INTO progression_wallets (
         address, burn_units, points, unlocked_rewards, claimed_rewards, tip_count, tipped_wei, updated_at
       ) VALUES ($1,$2,$3,$4,0,0,'0',NOW())
       ON CONFLICT (address) DO UPDATE SET
         burn_units = progression_wallets.burn_units + EXCLUDED.burn_units,
         points = progression_wallets.points + EXCLUDED.points,
         unlocked_rewards = progression_wallets.unlocked_rewards + EXCLUDED.unlocked_rewards,
         updated_at = NOW()`,
      [address, normalized.burnedUnits, normalized.creditsAwarded, normalized.burnedUnits]
    );

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    client.release();
  }

  return {
    alreadyProcessed: false,
    wallet: await pgGetWalletProgress(address)
  };
}

async function pgRecordTipProgress(tip) {
  const normalized = normalizeTipEvent(tip);
  if (!normalized?.tipTxHash) {
    throw new Error('Invalid tip transaction hash for progression update.');
  }

  const address = toAddress(tip?.address);
  if (!address) {
    throw new Error('Invalid wallet address for progression update.');
  }

  await ensurePgSchema();

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO progression_tip_events (
         address, tip_tx_hash, value_wei, points_awarded, tip_receiver, block_number, event_time
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)
       ON CONFLICT (tip_tx_hash) DO NOTHING
       RETURNING tip_tx_hash`,
      [
        address,
        normalized.tipTxHash,
        normalized.valueWei,
        normalized.pointsAwarded,
        normalized.tipReceiver || '',
        normalized.blockNumber || 0,
        normalized.timestamp
      ]
    );

    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      return {
        alreadyProcessed: true,
        wallet: await pgGetWalletProgress(address)
      };
    }

    await client.query(
      `INSERT INTO progression_wallets (
         address, burn_units, points, unlocked_rewards, claimed_rewards, tip_count, tipped_wei, updated_at
       ) VALUES ($1,0,$2,0,0,1,$3,NOW())
       ON CONFLICT (address) DO UPDATE SET
         points = progression_wallets.points + EXCLUDED.points,
         tip_count = progression_wallets.tip_count + 1,
         tipped_wei = ((progression_wallets.tipped_wei)::numeric + (EXCLUDED.tipped_wei)::numeric)::text,
         updated_at = NOW()`,
      [address, normalized.pointsAwarded, normalized.valueWei]
    );

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    client.release();
  }

  return {
    alreadyProcessed: false,
    wallet: await pgGetWalletProgress(address)
  };
}

async function pgRecordClaimProgress(claim) {
  const address = toAddress(claim?.address);
  if (!address) {
    throw new Error('Invalid wallet address for progression update.');
  }

  const normalized = normalizeClaimEvent(claim);
  const claimUnits = Math.max(0, toInt(normalized?.claimUnits, 0));
  if (claimUnits <= 0) {
    return pgGetWalletProgress(address);
  }

  await ensurePgSchema();

  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO progression_claim_events (
         address, claim_tx_hash, claim_units, minted_token_ids, minted_cids, event_time
       ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::timestamptz)`,
      [
        address,
        normalized?.claimTxHash || '',
        claimUnits,
        JSON.stringify(normalized?.mintedTokenIds || []),
        JSON.stringify(normalized?.mintedCids || []),
        normalized?.timestamp || nowIso()
      ]
    );

    await client.query(
      `INSERT INTO progression_wallets (
         address, burn_units, points, unlocked_rewards, claimed_rewards, tip_count, tipped_wei, updated_at
       ) VALUES ($1,0,0,0,0,0,'0',NOW())
       ON CONFLICT (address) DO NOTHING`,
      [address]
    );

    await client.query(
      `UPDATE progression_wallets
       SET claimed_rewards = LEAST(unlocked_rewards, claimed_rewards + $2),
           updated_at = NOW()
       WHERE address = $1`,
      [address, claimUnits]
    );

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    client.release();
  }

  return pgGetWalletProgress(address);
}

async function pgBuildLeaderboard(limit = 50) {
  await ensurePgSchema();
  const maxRows = Math.max(1, toInt(limit, 50));
  const result = await getPgPool().query(
    `SELECT address, points, burn_units, unlocked_rewards, claimed_rewards, updated_at
     FROM progression_wallets
     ORDER BY points DESC, burn_units DESC, updated_at DESC
     LIMIT $1`,
    [maxRows]
  );

  return result.rows.map((row, index) => {
    const unlockedRewards = Math.max(0, toInt(row.unlocked_rewards, 0));
    const claimedRewards = Math.min(unlockedRewards, Math.max(0, toInt(row.claimed_rewards, 0)));
    return {
      rank: index + 1,
      address: String(row.address || '').toLowerCase(),
      points: Math.max(0, toInt(row.points, 0)),
      burnUnits: Math.max(0, toInt(row.burn_units, 0)),
      unlockedRewards,
      claimedRewards,
      claimableRewards: Math.max(0, unlockedRewards - claimedRewards),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
    };
  });
}

async function pgCollectRecentBurns(limit = 30) {
  await ensurePgSchema();
  const maxRows = Math.max(1, toInt(limit, 30));
  const result = await getPgPool().query(
    `SELECT address, burn_tx_hash, burned_units, credits_awarded, burn_mode,
            burned_token_ids, burned_collections, contract_address, block_number, event_time
     FROM progression_burn_events
     ORDER BY event_time DESC, id DESC
     LIMIT $1`,
    [maxRows]
  );

  return result.rows.map((row) => ({
    address: String(row.address || '').toLowerCase(),
    burnTxHash: String(row.burn_tx_hash || '').toLowerCase(),
    burnedUnits: Math.max(0, toInt(row.burned_units, 0)),
    creditsAwarded: Math.max(0, toInt(row.credits_awarded, 0)),
    burnMode: String(row.burn_mode || 'direct_transfer'),
    burnedTokenIds: parseRowJsonArray(row.burned_token_ids),
    burnedCollections: parseRowJsonArray(row.burned_collections),
    contractAddress: String(row.contract_address || '').toLowerCase(),
    blockNumber: Math.max(0, toInt(row.block_number, 0)),
    timestamp: row.event_time ? new Date(row.event_time).toISOString() : nowIso()
  }));
}

async function pgListWalletAddresses(limit = 200) {
  await ensurePgSchema();
  const maxRows = Math.max(1, toInt(limit, 200));
  const result = await getPgPool().query(
    `SELECT address
     FROM progression_wallets
     ORDER BY updated_at DESC
     LIMIT $1`,
    [maxRows]
  );

  return result.rows
    .map((row) => toAddress(row.address))
    .filter(Boolean);
}

async function pgGetLatestWalletBurnBlock(walletAddress) {
  const address = toAddress(walletAddress);
  if (!address) return 0;

  await ensurePgSchema();
  const result = await getPgPool().query(
    'SELECT COALESCE(MAX(block_number), 0) AS max_block FROM progression_burn_events WHERE address = $1',
    [address]
  );
  return Math.max(0, toInt(result.rows?.[0]?.max_block, 0));
}

export async function readProgressionState() {
  if (shouldUsePostgresBackend()) {
    await ensurePgSchema();
    const updated = await getPgPool().query(
      'SELECT COALESCE(MAX(updated_at), NOW()) AS updated_at FROM progression_wallets'
    );

    return {
      version: 2,
      backend: 'postgres',
      updatedAt: updated.rows?.[0]?.updated_at ? new Date(updated.rows[0].updated_at).toISOString() : nowIso(),
      processedBurnTxHashes: [],
      processedTipTxHashes: [],
      wallets: {}
    };
  }

  const fromBlob = await readProgressionStateFromBlob();
  if (fromBlob !== null) {
    return normalizeState(fromBlob);
  }

  try {
    const raw = await fs.readFile(PROGRESSION_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return normalizeState({});
  }
}

export async function writeProgressionState(state) {
  if (shouldUsePostgresBackend()) {
    return {
      version: 2,
      backend: 'postgres',
      updatedAt: nowIso(),
      processedBurnTxHashes: [],
      processedTipTxHashes: [],
      wallets: {}
    };
  }

  const normalized = normalizeState(state || {});
  normalized.updatedAt = nowIso();

  const wroteBlob = await writeProgressionStateToBlob(normalized);
  if (!wroteBlob) {
    await fs.writeFile(PROGRESSION_STATE_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  }

  return normalized;
}

export async function hasProcessedBurnTx(state, burnTxHash) {
  if (shouldUsePostgresBackend()) {
    return pgHasProcessedBurnTx(burnTxHash);
  }
  return hasProcessedBurnTxInMemory(state, burnTxHash);
}

export async function hasProcessedTipTx(state, tipTxHash) {
  if (shouldUsePostgresBackend()) {
    return pgHasProcessedTipTx(tipTxHash);
  }
  return hasProcessedTipTxInMemory(state, tipTxHash);
}

export async function getWalletProgress(state, walletAddress) {
  if (shouldUsePostgresBackend()) {
    return pgGetWalletProgress(walletAddress);
  }
  return getWalletProgressInMemory(state, walletAddress);
}

export async function recordBurnProgress(state, burn) {
  if (shouldUsePostgresBackend()) {
    return pgRecordBurnProgress(burn);
  }
  return recordBurnProgressInMemory(state, burn);
}

export async function recordClaimProgress(state, claim) {
  if (shouldUsePostgresBackend()) {
    return pgRecordClaimProgress(claim);
  }
  return recordClaimProgressInMemory(state, claim);
}

export async function recordTipProgress(state, tip) {
  if (shouldUsePostgresBackend()) {
    return pgRecordTipProgress(tip);
  }
  return recordTipProgressInMemory(state, tip);
}

export async function buildLeaderboard(state, limit = 50) {
  if (shouldUsePostgresBackend()) {
    return pgBuildLeaderboard(limit);
  }
  return buildLeaderboardInMemory(state, limit);
}

export async function collectRecentBurns(state, limit = 30) {
  if (shouldUsePostgresBackend()) {
    return pgCollectRecentBurns(limit);
  }
  return collectRecentBurnsInMemory(state, limit);
}

export async function listProgressionWalletAddresses(limit = 200) {
  if (shouldUsePostgresBackend()) {
    return pgListWalletAddresses(limit);
  }

  const state = await readProgressionState();
  const rows = Object.entries(state?.wallets || {}).map(([address, wallet]) => ({
    address,
    updatedAt: String(wallet?.updatedAt || '')
  }));

  rows.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  return rows
    .slice(0, Math.max(1, toInt(limit, 200)))
    .map((row) => toAddress(row.address))
    .filter(Boolean);
}

export async function getLatestWalletBurnBlock(state, walletAddress) {
  if (shouldUsePostgresBackend()) {
    return pgGetLatestWalletBurnBlock(walletAddress);
  }

  const address = toAddress(walletAddress);
  if (!address) return 0;

  const previousBurns = state?.wallets?.[address]?.burnEvents || [];
  let lastKnownBlock = 0;
  for (const event of previousBurns) {
    const block = toInt(event?.blockNumber, 0);
    if (block > lastKnownBlock) lastKnownBlock = block;
  }
  return lastKnownBlock;
}

export function getProgressionStorageInfo() {
  if (shouldUsePostgresBackend()) {
    return {
      backend: 'postgres',
      durable: true,
      tablePrefix: 'progression_'
    };
  }

  if (shouldUseBlobBackend()) {
    return {
      backend: 'vercel_blob',
      durable: true,
      path: PROGRESSION_STATE_BLOB_PATH
    };
  }

  return {
    backend: 'tmp',
    durable: false,
    path: PROGRESSION_STATE_PATH
  };
}
