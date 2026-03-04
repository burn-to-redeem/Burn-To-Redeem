import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { ethers } from 'ethers';
import { normalizeAddress, parseJsonBody } from './_lib/claimUtils.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

const BURN_REWARD_STATE_PATH = '/tmp/burn-to-redeem-burn-reward-state.json';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const TRANSFER_SINGLE_TOPIC = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
const TRANSFER_BATCH_TOPIC = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');
const TRANSFER_IFACE = new ethers.Interface([
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]);

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
  return raw;
}

function collectRewardCids(runtime) {
  return [
    normalizeCid(runtime.burnRewardCid1),
    normalizeCid(runtime.burnRewardCid2),
    normalizeCid(runtime.burnRewardCid3),
    normalizeCid(runtime.burnRewardCid4),
    normalizeCid(runtime.burnRewardCid5)
  ].filter(Boolean);
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

async function readState() {
  try {
    const raw = await fs.readFile(BURN_REWARD_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const txHashes = Array.isArray(parsed?.processedTxHashes) ? parsed.processedTxHashes : [];
    return new Set(txHashes.map((value) => String(value).toLowerCase()));
  } catch {
    return new Set();
  }
}

async function writeState(processedTxHashes) {
  await fs.writeFile(
    BURN_REWARD_STATE_PATH,
    JSON.stringify({ processedTxHashes: Array.from(processedTxHashes) }, null, 2),
    'utf8'
  );
}

function buildBurnToTopics() {
  return new Set([
    ethers.zeroPadValue(ethers.ZeroAddress, 32).toLowerCase(),
    ethers.zeroPadValue(DEAD_ADDRESS, 32).toLowerCase()
  ]);
}

function randomCid(cids) {
  const index = crypto.randomInt(cids.length);
  return cids[index];
}

function isValidTxHash(value) {
  return /^0x[0-9a-f]{64}$/i.test(String(value || '').trim());
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

    const processedTxHashes = await readState();
    if (processedTxHashes.has(burnTxHash)) {
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

    const configuredRewardContract = String(runtime.rewardErc1155Contract || '').trim();
    if (configuredRewardContract && txTo.toLowerCase() !== configuredRewardContract.toLowerCase()) {
      return res.status(400).json({ ok: false, error: 'Burn must target the configured CC0 collection contract.' });
    }

    const fromTopic = ethers.zeroPadValue(address, 32).toLowerCase();
    const burnToTopics = buildBurnToTopics();
    const burnedTokenIds = [];
    let burnedUnits = 0;

    for (const log of receipt.logs || []) {
      if (!log?.topics?.length) continue;
      const topic0 = String(log.topics[0] || '').toLowerCase();
      const topicFrom = String(log.topics[2] || '').toLowerCase();
      const topicTo = String(log.topics[3] || '').toLowerCase();

      if (topicFrom !== fromTopic || !burnToTopics.has(topicTo)) {
        continue;
      }

      try {
        const parsed = TRANSFER_IFACE.parseLog(log);
        if (!parsed) continue;

        if (topic0 === TRANSFER_SINGLE_TOPIC.toLowerCase() && parsed.name === 'TransferSingle') {
          const value = Number(parsed.args.value.toString());
          if (Number.isFinite(value) && value > 0) {
            burnedUnits += value;
            burnedTokenIds.push(parsed.args.id.toString());
          }
        } else if (topic0 === TRANSFER_BATCH_TOPIC.toLowerCase() && parsed.name === 'TransferBatch') {
          const ids = parsed.args.ids || [];
          const values = parsed.args.values || [];
          for (let index = 0; index < values.length; index += 1) {
            const value = Number(values[index].toString());
            if (!Number.isFinite(value) || value <= 0) continue;
            burnedUnits += value;
            burnedTokenIds.push(ids[index]?.toString?.() || '');
          }
        }
      } catch {
        // Ignore logs that fail to decode.
      }
    }

    if (burnedUnits <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'No valid burn events found in this transaction (must send NFTs to dead or zero address).'
      });
    }

    const maxUnitsForRoll = Math.min(burnedUnits, 500);
    const wins = [];
    for (let i = 0; i < maxUnitsForRoll; i += 1) {
      if (crypto.randomInt(5) !== 0) continue;
      const cid = randomCid(rewardCids);
      wins.push({
        cid,
        tokenUri: `ipfs://${cid}`,
        imageUrl: `https://ipfs.io/ipfs/${cid}`
      });
    }

    processedTxHashes.add(burnTxHash);
    await writeState(processedTxHashes);

    return res.status(200).json({
      ok: true,
      burnTxHash,
      burnedUnits,
      burnedTokenIds: burnedTokenIds.filter(Boolean),
      creditsAwarded: burnedUnits * 20,
      rewardChance: '1 in 5 per burned NFT',
      configuredCidCount: rewardCids.length,
      wins
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
