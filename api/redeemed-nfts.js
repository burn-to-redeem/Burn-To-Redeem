import { ethers } from 'ethers';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

const REWARD_MINTED_TOPIC = ethers.id('RewardMinted(address,uint256,string)');
const REWARD_MINTED_IFACE = new ethers.Interface([
  'event RewardMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI)'
]);

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function parseRpcUrls(value) {
  return String(value || '')
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toIpfsHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${raw.slice('ipfs://'.length)}`;
  if (raw.startsWith('/ipfs/')) return `https://ipfs.io${raw}`;
  return raw;
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
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

function sortByMintDesc(items) {
  return [...items].sort((left, right) => {
    if (left.blockNumber !== right.blockNumber) {
      return right.blockNumber - left.blockNumber;
    }
    return right.logIndex - left.logIndex;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const runtime = await getRuntimeConfigForRequest(req);
    const protocol = req.headers?.['x-forwarded-proto'] || 'https';
    const host = req.headers?.host || 'localhost';
    const url = new URL(req.url || '/api/redeemed-nfts', `${protocol}://${host}`);

    const walletAddress = ethers.getAddress(String(url.searchParams.get('address') || '').trim());
    const rewardContract = String(
      runtime.rewardMutableNftContract || process.env.REWARD_MUTABLE_NFT_CONTRACT || ''
    ).trim();
    if (!rewardContract) {
      return res.status(200).json({
        ok: true,
        contractAddress: '',
        total: 0,
        nfts: []
      });
    }

    const rewardContractAddress = ethers.getAddress(rewardContract);
    const maxItems = Math.min(parsePositiveInt(url.searchParams.get('max'), 20), 100);
    const scanStep = parsePositiveInt(runtime.rewardLogScanStep, 9000);
    const providers = buildProviders(runtime);
    const latestBlock = await withProviders(providers, (provider) => provider.getBlockNumber());

    const configuredStart = parsePositiveInt(runtime.rewardClaimStartBlock, 0);
    const startBlock = configuredStart > 0 ? configuredStart : Math.max(0, latestBlock - 300000);
    const recipientTopic = ethers.zeroPadValue(walletAddress, 32);

    const minted = [];
    for (let from = startBlock; from <= latestBlock; from += scanStep) {
      const to = Math.min(from + scanStep - 1, latestBlock);
      const logs = await withProviders(providers, (provider) =>
        provider.getLogs({
          address: rewardContractAddress,
          fromBlock: from,
          toBlock: to,
          topics: [REWARD_MINTED_TOPIC, recipientTopic]
        })
      );

      for (const log of logs) {
        try {
          const parsed = REWARD_MINTED_IFACE.parseLog(log);
          if (!parsed || parsed.name !== 'RewardMinted') continue;
          minted.push({
            tokenId: parsed.args.tokenId.toString(),
            tokenUri: String(parsed.args.tokenURI || ''),
            blockNumber: Number(log.blockNumber || 0),
            logIndex: Number(log.index ?? 0),
            txHash: String(log.transactionHash || '')
          });
        } catch {
          // Ignore malformed logs.
        }
      }
    }

    const newest = sortByMintDesc(minted).slice(0, maxItems);
    const unique = [];
    const seen = new Set();
    for (const item of newest) {
      const key = item.tokenId;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    const enriched = await Promise.all(
      unique.map(async (item) => {
        const metadataUrl = toIpfsHttpUrl(item.tokenUri);
        const metadata = metadataUrl ? await fetchJson(metadataUrl) : null;
        const imageRaw = metadata?.image || metadata?.image_url || '';
        const imageUrl = toIpfsHttpUrl(imageRaw);
        const name = String(metadata?.name || `REDEEMED #${item.tokenId}`);
        const description = String(metadata?.description || '');

        return {
          tokenId: item.tokenId,
          name,
          description,
          tokenUri: item.tokenUri,
          metadataUrl,
          imageUrl,
          txHash: item.txHash,
          basescanUrl: item.txHash ? `https://basescan.org/tx/${item.txHash}` : ''
        };
      })
    );

    return res.status(200).json({
      ok: true,
      contractAddress: rewardContractAddress,
      walletAddress,
      total: enriched.length,
      nfts: enriched
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
