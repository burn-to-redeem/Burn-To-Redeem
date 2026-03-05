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
  buildLeaderboard,
  collectRecentBurns,
  getLatestWalletBurnBlock,
  getProgressionStorageInfo,
  getWalletProgress,
  hasProcessedBurnTx,
  hasProcessedTipTx,
  listProgressionWalletAddresses,
  readProgressionState,
  recordBurnProgress,
  recordTipProgress,
  writeProgressionState
} from './_lib/progressionState.js';

const ONE_ETH_WEI = 10n ** 18n;
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const ERC721_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const TRANSFER_SINGLE_TOPIC = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
const TRANSFER_BATCH_TOPIC = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');
const BURN_RECORDED_TOPIC = ethers.id(
  'BurnRecorded(address,uint256,uint256,address[],uint256[],uint256[])'
);
const TRANSFER_IFACE = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]);
const BURN_ROUTER_IFACE = new ethers.Interface([
  'event BurnRecorded(address indexed operator, uint256 indexed burnId, uint256 totalUnits, address[] collections, uint256[] tokenIds, uint256[] amounts)'
]);
const MAX_SYNC_BURN_TXS_PER_REQUEST = 80;

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

function isLogRangeTooLargeError(error) {
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

  return (
    text.includes('range is too large') ||
    text.includes('max is 1k blocks') ||
    text.includes('max range') ||
    text.includes('query returned more than')
  );
}

async function getLogsAdaptiveRange({ providers, runtime, filter }) {
  try {
    return await withProviders(providers, (provider) => provider.getLogs(filter));
  } catch (error) {
    if (!isLogRangeTooLargeError(error)) throw error;

    const fromBlock = parseNonNegativeInt(filter?.fromBlock, 0);
    const toBlock = parseNonNegativeInt(filter?.toBlock, fromBlock);
    if (fromBlock >= toBlock) throw error;

    const maxChunkRange = Math.max(1, parsePositiveInt(runtime?.rpcLogMaxRange, 1000));
    const totalRange = toBlock - fromBlock + 1;
    const chunkRange = Math.max(1, Math.min(maxChunkRange, Math.floor(totalRange / 2)));

    const allLogs = [];
    for (let chunkFrom = fromBlock; chunkFrom <= toBlock; chunkFrom += chunkRange) {
      const chunkTo = Math.min(chunkFrom + chunkRange - 1, toBlock);
      const chunkLogs = await getLogsAdaptiveRange({
        providers,
        runtime,
        filter: {
          ...filter,
          fromBlock: chunkFrom,
          toBlock: chunkTo
        }
      });
      allLogs.push(...(chunkLogs || []));
    }

    return allLogs;
  }
}

function parseWalletCsv(value) {
  const out = [];
  const seen = new Set();
  const items = String(value || '')
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const item of items) {
    try {
      const normalized = normalizeAddress(item).toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    } catch {
      // Ignore invalid wallet addresses in optional indexer input.
    }
  }

  return out;
}

function isIndexerAuthorized(req, url) {
  const sharedSecret = String(process.env.PROGRESSION_INDEXER_SECRET || '').trim();
  const querySecret = String(url.searchParams.get('indexerSecret') || '').trim();
  const headerSecret = String(req.headers?.['x-progression-indexer-secret'] || '').trim();
  const isVercelCron = String(req.headers?.['x-vercel-cron'] || '').trim() === '1';

  if (isVercelCron) return true;
  if (sharedSecret && (querySecret === sharedSecret || headerSecret === sharedSecret)) return true;
  return process.env.NODE_ENV !== 'production';
}

function buildBurnToTopics() {
  return new Set([
    ethers.zeroPadValue(ethers.ZeroAddress, 32).toLowerCase(),
    ethers.zeroPadValue(DEAD_ADDRESS, 32).toLowerCase()
  ]);
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
      if (!Number.isFinite(totalUnits) || totalUnits <= 0) continue;

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

  return {
    burnMode: 'router',
    burnedUnits: 0,
    burnedTokenIds: [],
    burnedCollections: []
  };
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
    if (
      topic0 !== ERC721_TRANSFER_TOPIC.toLowerCase() &&
      topic0 !== TRANSFER_SINGLE_TOPIC.toLowerCase() &&
      topic0 !== TRANSFER_BATCH_TOPIC.toLowerCase()
    ) {
      continue;
    }

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

async function syncWalletBurns({
  runtime,
  providers,
  state,
  walletAddress
}) {
  const burnRouterAddress = String(runtime.burnRouterContract || '').trim().toLowerCase();
  const allowedCollections = parseAddressList(runtime.burnAllowedCollections || '');
  const allowedCollectionSet = new Set(allowedCollections.map((entry) => entry.toLowerCase()));
  const configuredRewardContract = String(runtime.rewardErc1155Contract || '').trim().toLowerCase();
  const strictLegacyContract = configuredRewardContract && allowedCollectionSet.size === 0 ? configuredRewardContract : '';

  const queryableContracts = [];
  if (allowedCollectionSet.size > 0) {
    queryableContracts.push(...Array.from(allowedCollectionSet));
  } else if (strictLegacyContract) {
    queryableContracts.push(strictLegacyContract);
  }

  const latestBlock = await withProviders(providers, (provider) => provider.getBlockNumber());
  const scanStep = parsePositiveInt(runtime.rewardLogScanStep, 9000);
  const configuredStart = parseNonNegativeInt(runtime.rewardClaimStartBlock, 0);
  const defaultStart = Math.max(0, latestBlock - 180000);
  let startBlock = configuredStart > 0 ? configuredStart : defaultStart;

  const lastKnownBlock = await getLatestWalletBurnBlock(state, walletAddress);
  if (lastKnownBlock > 0) {
    startBlock = Math.max(startBlock, lastKnownBlock + 1);
  }

  if (startBlock > latestBlock) {
    return { scanned: 0, discovered: 0, recorded: 0, skipped: 0, updated: false };
  }

  const fromTopic = ethers.zeroPadValue(walletAddress, 32);
  const burnToTopics = [
    ethers.zeroPadValue(ethers.ZeroAddress, 32),
    ethers.zeroPadValue(DEAD_ADDRESS, 32)
  ];

  const candidateTx = new Map();
  let scannedRanges = 0;

  for (let from = startBlock; from <= latestBlock; from += scanStep) {
    const to = Math.min(from + scanStep - 1, latestBlock);
    scannedRanges += 1;

    if (burnRouterAddress) {
      const routerLogs = await getLogsAdaptiveRange({
        providers,
        runtime,
        filter: {
          address: burnRouterAddress,
          fromBlock: from,
          toBlock: to,
          topics: [BURN_RECORDED_TOPIC, fromTopic]
        }
      });
      for (const log of routerLogs || []) {
        const hash = String(log.transactionHash || '').toLowerCase();
        if (!hash) continue;
        const prev = candidateTx.get(hash);
        const block = Number(log.blockNumber || 0);
        if (!prev || block < prev) {
          candidateTx.set(hash, block);
        }
      }
    }

    if (queryableContracts.length === 0) continue;

    for (const contractAddress of queryableContracts) {
      for (const burnToTopic of burnToTopics) {
        const erc721Logs = await getLogsAdaptiveRange({
          providers,
          runtime,
          filter: {
            address: contractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [ERC721_TRANSFER_TOPIC, fromTopic, burnToTopic]
          }
        });
        for (const log of erc721Logs || []) {
          const hash = String(log.transactionHash || '').toLowerCase();
          if (!hash) continue;
          const prev = candidateTx.get(hash);
          const block = Number(log.blockNumber || 0);
          if (!prev || block < prev) {
            candidateTx.set(hash, block);
          }
        }

        const transferSingleLogs = await getLogsAdaptiveRange({
          providers,
          runtime,
          filter: {
            address: contractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [TRANSFER_SINGLE_TOPIC, null, fromTopic, burnToTopic]
          }
        });
        for (const log of transferSingleLogs || []) {
          const hash = String(log.transactionHash || '').toLowerCase();
          if (!hash) continue;
          const prev = candidateTx.get(hash);
          const block = Number(log.blockNumber || 0);
          if (!prev || block < prev) {
            candidateTx.set(hash, block);
          }
        }

        const transferBatchLogs = await getLogsAdaptiveRange({
          providers,
          runtime,
          filter: {
            address: contractAddress,
            fromBlock: from,
            toBlock: to,
            topics: [TRANSFER_BATCH_TOPIC, null, fromTopic, burnToTopic]
          }
        });
        for (const log of transferBatchLogs || []) {
          const hash = String(log.transactionHash || '').toLowerCase();
          if (!hash) continue;
          const prev = candidateTx.get(hash);
          const block = Number(log.blockNumber || 0);
          if (!prev || block < prev) {
            candidateTx.set(hash, block);
          }
        }
      }
    }
  }

  const sortedTxs = Array.from(candidateTx.entries())
    .sort((left, right) => left[1] - right[1])
    .map(([txHash]) => txHash);

  let discovered = 0;
  let recorded = 0;
  let skipped = 0;

  for (const burnTxHash of sortedTxs) {
    discovered += 1;
    if (recorded >= MAX_SYNC_BURN_TXS_PER_REQUEST) break;
    if (await hasProcessedBurnTx(state, burnTxHash)) {
      skipped += 1;
      continue;
    }

    let tx = null;
    let receipt = null;
    try {
      [tx, receipt] = await Promise.all([
        withProviders(providers, (provider) => provider.getTransaction(burnTxHash)),
        withProviders(providers, (provider) => provider.getTransactionReceipt(burnTxHash))
      ]);
    } catch {
      skipped += 1;
      continue;
    }

    if (!tx || !receipt || receipt.status !== 1) {
      skipped += 1;
      continue;
    }

    if (String(tx.from || '').toLowerCase() !== walletAddress.toLowerCase()) {
      skipped += 1;
      continue;
    }

    const txTo = String(tx.to || '').trim().toLowerCase();
    if (!txTo) {
      skipped += 1;
      continue;
    }

    let burnResult = null;
    if (burnRouterAddress && txTo === burnRouterAddress) {
      burnResult = decodeBurnFromRouter({
        receipt,
        address: walletAddress,
        burnRouterAddress
      });
    } else {
      if (strictLegacyContract && txTo !== strictLegacyContract) {
        skipped += 1;
        continue;
      }
      if (allowedCollectionSet.size > 0 && !allowedCollectionSet.has(txTo)) {
        skipped += 1;
        continue;
      }
      burnResult = decodeBurnFromTransferLogs({
        receipt,
        address: walletAddress,
        allowedCollectionSet
      });
    }

    if (!burnResult || burnResult.burnedUnits <= 0) {
      skipped += 1;
      continue;
    }

    await recordBurnProgress(state, {
      address: walletAddress,
      burnTxHash,
      burnedUnits: burnResult.burnedUnits,
      creditsAwarded: burnResult.burnedUnits * 20,
      burnMode: burnResult.burnMode,
      burnedTokenIds: burnResult.burnedTokenIds,
      burnedCollections: burnResult.burnedCollections,
      contractAddress: txTo,
      blockNumber: Number(receipt.blockNumber || 0),
      timestamp: new Date().toISOString()
    });
    recorded += 1;
  }

  if (recorded > 0) {
    await writeProgressionState(state);
  }

  return {
    scanned: scannedRanges,
    discovered,
    recorded,
    skipped,
    updated: recorded > 0
  };
}

function parseWei(value, fallback) {
  try {
    const parsed = BigInt(String(value || '').trim());
    if (parsed > 0n) return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

function buildTipMessage({ address, chainId, issuedAt, gatePass, tipTxHash }) {
  return [
    'Burn to Redeem Tip Points',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`,
    `Tip Tx: ${tipTxHash.toLowerCase()}`
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

function buildTipConfig(runtime) {
  return {
    tipReceiverAddress: String(runtime.tipReceiverAddress || runtime.treasuryWalletAddress || '').trim(),
    tipPointsPerEth: parsePositiveInt(runtime.tipPointsPerEth, 20000),
    tipMinWei: parseWei(runtime.tipMinWei, 1000000000000000n).toString()
  };
}

async function handleIndexerGet(req, res, { runtime, url }) {
  if (!isIndexerAuthorized(req, url)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized indexer request.' });
  }

  const explicitWallets = parseWalletCsv(
    `${url.searchParams.get('addresses') || ''},${url.searchParams.get('address') || ''}`
  );
  const walletLimit = Math.min(
    parsePositiveInt(
      url.searchParams.get('walletLimit') || process.env.PROGRESSION_INDEXER_MAX_WALLETS,
      40
    ),
    250
  );
  const knownWallets = await listProgressionWalletAddresses(walletLimit);
  const wallets = Array.from(new Set([...explicitWallets, ...knownWallets.map((entry) => entry.toLowerCase())]));
  const includeDetails = String(url.searchParams.get('details') || '0').trim() === '1';

  if (wallets.length === 0) {
    return res.status(200).json({
      ok: true,
      mode: 'indexer',
      walletCount: 0,
      scannedRanges: 0,
      discovered: 0,
      recorded: 0,
      skipped: 0,
      updatedWallets: 0,
      failedWallets: 0,
      storage: getProgressionStorageInfo()
    });
  }

  const providers = buildProviders(runtime);
  const state = await readProgressionState();
  const details = [];
  let scannedRanges = 0;
  let discovered = 0;
  let recorded = 0;
  let skipped = 0;
  let updatedWallets = 0;
  let failedWallets = 0;

  for (const walletAddress of wallets) {
    try {
      const synced = await syncWalletBurns({
        runtime,
        providers,
        state,
        walletAddress
      });
      scannedRanges += Number(synced.scanned || 0);
      discovered += Number(synced.discovered || 0);
      recorded += Number(synced.recorded || 0);
      skipped += Number(synced.skipped || 0);
      if (synced.updated) updatedWallets += 1;
      details.push({ address: walletAddress, ...synced });
    } catch (error) {
      failedWallets += 1;
      details.push({
        address: walletAddress,
        scanned: 0,
        discovered: 0,
        recorded: 0,
        skipped: 0,
        updated: false,
        error: error instanceof Error ? error.message : 'Wallet sync failed.'
      });
    }
  }

  const latest = await readProgressionState();
  return res.status(200).json({
    ok: true,
    mode: 'indexer',
    walletCount: wallets.length,
    scannedRanges,
    discovered,
    recorded,
    skipped,
    updatedWallets,
    failedWallets,
    updatedAt: latest.updatedAt || null,
    storage: getProgressionStorageInfo(),
    wallets: includeDetails ? details : undefined
  });
}

async function handleGet(req, res) {
  const runtime = await getRuntimeConfigForRequest(req);
  const protocol = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.host || 'localhost';
  const url = new URL(req.url || '/api/progression-stats', `${protocol}://${host}`);
  const isIndexerMode = String(url.searchParams.get('indexer') || '0').trim() === '1';

  if (isIndexerMode) {
    return handleIndexerGet(req, res, { runtime, url });
  }

  const rawWalletAddress = String(url.searchParams.get('address') || '').trim();
  const shouldSyncBurns = String(url.searchParams.get('sync') || '1').trim() !== '0';
  const leaderboardLimit = Math.min(parsePositiveInt(url.searchParams.get('limit'), 20), 100);
  const recentLimit = Math.min(parsePositiveInt(url.searchParams.get('recent'), 20), 120);

  let walletAddress = '';
  if (rawWalletAddress) {
    try {
      walletAddress = normalizeAddress(rawWalletAddress);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid wallet address.' });
    }
  }

  let state = await readProgressionState();
  let burnSync = null;
  if (walletAddress && shouldSyncBurns) {
    try {
      const providers = buildProviders(runtime);
      burnSync = await syncWalletBurns({
        runtime,
        providers,
        state,
        walletAddress
      });
      if (burnSync?.updated) {
        state = await readProgressionState();
      }
    } catch (error) {
      burnSync = {
        scanned: 0,
        discovered: 0,
        recorded: 0,
        skipped: 0,
        updated: false,
        error: error instanceof Error ? error.message : 'Burn sync failed.'
      };
    }
  }

  const wallet = walletAddress ? await getWalletProgress(state, walletAddress) : null;
  const leaderboard = await buildLeaderboard(state, leaderboardLimit);
  const recentBurns = await collectRecentBurns(state, recentLimit);

  return res.status(200).json({
    ok: true,
    wallet,
    leaderboard,
    recentBurns,
    updatedAt: state.updatedAt || null,
    tipConfig: buildTipConfig(runtime),
    burnSync
  });
}

async function handlePost(req, res) {
  const runtime = await getRuntimeConfigForRequest(req);
  const body = parseJsonBody(req);

  let address;
  try {
    address = normalizeAddress(body.address);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid wallet address.' });
  }
  const chainId = Number.parseInt(String(body.chainId || ''), 10);
  const issuedAt = Number(body.issuedAt || 0);
  const gatePass = String(body.gatePass || '').trim();
  const signature = String(body.signature || '').trim();
  const tipTxHash = String(body.tipTxHash || '').trim();
  const tipConfig = buildTipConfig(runtime);

  if (!gatePass) {
    return res.status(400).json({ ok: false, error: 'Missing gate pass.' });
  }
  if (!signature) {
    return res.status(400).json({ ok: false, error: 'Missing signature.' });
  }
  if (!tipTxHash) {
    return res.status(400).json({ ok: false, error: 'Missing tip transaction hash.' });
  }
  if (chainId !== runtime.chainId) {
    return res.status(400).json({ ok: false, error: `Wrong chain. Expected ${runtime.chainId}.` });
  }
  if (!isFreshIssuedAt(issuedAt, runtime.claimMessageTtlSeconds)) {
    return res.status(400).json({ ok: false, error: 'Tip signature expired. Please sign again.' });
  }
  if (!verifyGatePass(gatePass, address, runtime)) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired gate pass.' });
  }

  const message = buildTipMessage({
    address,
    chainId,
    issuedAt,
    gatePass,
    tipTxHash
  });
  const recovered = ethers.verifyMessage(message, signature);
  if (String(recovered || '').toLowerCase() !== address.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Signature verification failed.' });
  }

  let tipReceiver;
  try {
    tipReceiver = normalizeAddress(tipConfig.tipReceiverAddress);
  } catch {
    return res.status(500).json({ ok: false, error: 'TIP_RECEIVER_ADDRESS is not configured correctly.' });
  }
  const minTipWei = parseWei(tipConfig.tipMinWei, 1000000000000000n);
  const pointsPerEth = parsePositiveInt(tipConfig.tipPointsPerEth, 20000);
  const providers = buildProviders(runtime);

  const hasAccess = await withProviders(providers, (provider) => hasTokenGateAccess(provider, address, runtime));
  if (!hasAccess) {
    return res.status(403).json({ ok: false, error: 'Wallet does not currently hold the token-gated NFT.' });
  }

  const state = await readProgressionState();
  if (await hasProcessedTipTx(state, tipTxHash)) {
    return res.status(200).json({
      ok: true,
      alreadyProcessed: true,
      tipTxHash: tipTxHash.toLowerCase(),
      walletProgress: await getWalletProgress(state, address),
      progressionUpdatedAt: state.updatedAt || null,
      tipConfig
    });
  }

  const tx = await withProviders(providers, (provider) => provider.getTransaction(tipTxHash));
  if (!tx) {
    return res.status(404).json({ ok: false, error: 'Tip transaction not found on Base RPC.' });
  }

  if (String(tx.from || '').toLowerCase() !== address.toLowerCase()) {
    return res.status(400).json({ ok: false, error: 'Tip transaction sender does not match connected wallet.' });
  }
  if (String(tx.to || '').toLowerCase() !== tipReceiver.toLowerCase()) {
    return res.status(400).json({ ok: false, error: 'Tip transaction recipient does not match tip receiver wallet.' });
  }

  const valueWei = BigInt(tx.value || 0n);
  if (valueWei < minTipWei) {
    return res.status(400).json({
      ok: false,
      error: `Tip is below minimum threshold (${ethers.formatEther(minTipWei)} ETH).`
    });
  }

  const receipt = await withProviders(providers, (provider) => provider.getTransactionReceipt(tipTxHash));
  if (!receipt || receipt.status !== 1) {
    return res.status(400).json({ ok: false, error: 'Tip transaction is not confirmed successfully yet.' });
  }

  const pointsAwarded = Number((valueWei * BigInt(pointsPerEth)) / ONE_ETH_WEI);
  if (!Number.isFinite(pointsAwarded) || pointsAwarded <= 0) {
    return res.status(400).json({ ok: false, error: 'Tip amount too small to award points.' });
  }

  const tipRecorded = await recordTipProgress(state, {
    address,
    tipTxHash,
    valueWei: valueWei.toString(),
    pointsAwarded,
    tipReceiver,
    blockNumber: Number(receipt.blockNumber || 0)
  });
  const saved = await writeProgressionState(state);

  return res.status(200).json({
    ok: true,
    alreadyProcessed: false,
    tipTxHash: tipTxHash.toLowerCase(),
    tipWei: valueWei.toString(),
    tipEth: ethers.formatEther(valueWei),
    pointsAwarded,
    walletProgress: tipRecorded.wallet,
    progressionUpdatedAt: saved.updatedAt || null,
    tipConfig
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    }
    if (req.method === 'POST') {
      return await handlePost(req, res);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
