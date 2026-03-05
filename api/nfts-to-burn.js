import { ethers } from 'ethers';
import { fetchOpenSeaWalletCollectionNfts, fetchOpenSeaWalletContractNfts } from './_lib/opensea.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

const INVENTORY_CACHE = new Map();

function normalizeAddress(value, fieldName) {
  try {
    return ethers.getAddress(String(value || '').trim());
  } catch {
    throw new Error(`Invalid ${fieldName}.`);
  }
}

function parseAddressList(value) {
  const items = String(value || '')
    .split(/[\n,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  for (const item of items) {
    const normalized = normalizeAddress(item, 'allowed collection contract');
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function aggregateNfts(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = `${String(item.contractAddress || '').toLowerCase()}:${String(item.tokenId || '')}`;
    if (!key || key.endsWith(':')) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
      continue;
    }

    const existingQty = BigInt(String(existing.quantity || '1'));
    const incomingQty = BigInt(String(item.quantity || '1'));
    existing.quantity = (existingQty + incomingQty).toString();
  }

  return Array.from(byKey.values());
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function buildCacheKey({
  address,
  allCollectionsMode,
  collectionSlug,
  contractAddress,
  allowedContracts,
  chainId,
  maxItems
}) {
  return JSON.stringify({
    address: String(address || '').toLowerCase(),
    allCollectionsMode: allCollectionsMode ? 1 : 0,
    collectionSlug: String(collectionSlug || '').toLowerCase(),
    contractAddress: String(contractAddress || '').toLowerCase(),
    allowedContracts: (allowedContracts || []).map((entry) => String(entry || '').toLowerCase()).sort(),
    chainId: Number(chainId || 0),
    maxItems: Number(maxItems || 0)
  });
}

function getCachedInventory(cacheKey, maxAgeMs) {
  if (!cacheKey) return null;
  const cached = INVENTORY_CACHE.get(cacheKey);
  if (!cached || !cached.body || !cached.cachedAt) return null;
  const ageMs = Date.now() - cached.cachedAt;
  if (ageMs > maxAgeMs) return null;
  return { body: cached.body, ageMs };
}

function getStaleCachedInventory(cacheKey, maxStaleMs) {
  if (!cacheKey) return null;
  const cached = INVENTORY_CACHE.get(cacheKey);
  if (!cached || !cached.body || !cached.cachedAt) return null;
  const ageMs = Date.now() - cached.cachedAt;
  if (ageMs > maxStaleMs) return null;
  return { body: cached.body, ageMs };
}

function setCachedInventory(cacheKey, body) {
  if (!cacheKey || !body) return;
  INVENTORY_CACHE.set(cacheKey, {
    body,
    cachedAt: Date.now()
  });
}

function isRateLimitedError(error) {
  const statusCode = Number(error?.statusCode || 0);
  if (statusCode === 429) return true;
  return /rate limit|too many requests/i.test(String(error?.message || ''));
}

function isOpenSeaTransientError(error) {
  const statusCode = Number(error?.statusCode || 0);
  return statusCode === 408 || statusCode === 429 || statusCode === 504 || statusCode >= 500;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const requestContext = {
    cacheKey: '',
    staleCacheTtlMs: parsePositiveInt(process.env.NFTS_TO_BURN_CACHE_STALE_SECONDS, 1800) * 1000
  };

  try {
    const runtime = await getRuntimeConfigForRequest(req);
    const protocol = req.headers?.['x-forwarded-proto'] || 'https';
    const host = req.headers?.host || 'localhost';
    const url = new URL(req.url || '/api/nfts-to-burn', `${protocol}://${host}`);

    const address = normalizeAddress(url.searchParams.get('address'), 'wallet address');
    const allCollectionsMode = String(url.searchParams.get('all') || '').trim() === '1';
    const collectionSlug = String(url.searchParams.get('collection') || process.env.BURN_COLLECTION_SLUG || 'cc0-by-pierre').trim();
    const configuredRewardContract =
      String(runtime.rewardErc1155Contract || process.env.REWARD_ERC1155_CONTRACT || '').trim();
    const allowedContracts = parseAddressList(
      runtime.burnAllowedCollections || process.env.BURN_ALLOWED_COLLECTIONS || ''
    );
    const hasCollection = Boolean(collectionSlug);
    const contractParam = String(
      url.searchParams.get('contract') || (hasCollection ? '' : configuredRewardContract)
    ).trim();
    const contractAddress = contractParam ? normalizeAddress(contractParam, 'reward contract') : '';
    const max = Number.parseInt(String(url.searchParams.get('max') || '80'), 10);

    const apiKey = (process.env.OPENSEA_API_KEY || '').trim();
    const mcpToken = (process.env.OPENSEA_MCP_TOKEN || '').trim();
    if (!apiKey && !mcpToken) {
      return res.status(500).json({ ok: false, error: 'Missing OPENSEA_API_KEY or OPENSEA_MCP_TOKEN.' });
    }

    const maxItems = Number.isInteger(max) && max > 0 ? Math.min(max, 20000) : 80;
    const cacheTtlMs = parsePositiveInt(process.env.NFTS_TO_BURN_CACHE_TTL_SECONDS, 90) * 1000;
    const staleCacheTtlMs = parsePositiveInt(process.env.NFTS_TO_BURN_CACHE_STALE_SECONDS, 1800) * 1000;
    const cacheKey = buildCacheKey({
      address,
      allCollectionsMode,
      collectionSlug,
      contractAddress,
      allowedContracts,
      chainId: runtime.chainId,
      maxItems
    });
    requestContext.cacheKey = cacheKey;
    requestContext.staleCacheTtlMs = staleCacheTtlMs;

    const freshCached = getCachedInventory(cacheKey, cacheTtlMs);
    if (freshCached) {
      return res.status(200).json({
        ...freshCached.body,
        cached: true,
        cacheAgeSeconds: Math.round(freshCached.ageMs / 1000)
      });
    }

    if (allCollectionsMode && allowedContracts.length > 0) {
      const strategyParts = ['allowed-contracts'];
      const sourceNfts = [];
      let chainHint = 'base';

      const settledContracts = await Promise.allSettled(
        allowedContracts.map((allowedContractAddress) =>
          fetchOpenSeaWalletContractNfts({
            walletAddress: address,
            contractAddress: allowedContractAddress,
            chainId: runtime.chainId,
            apiKey,
            mcpToken,
            perPage: 80,
            maxItems,
            timeoutMs: 12000
          })
        )
      );

      const contractResults = settledContracts
        .filter((entry) => entry.status === 'fulfilled')
        .map((entry) => entry.value);
      const contractFailures = settledContracts
        .filter((entry) => entry.status === 'rejected')
        .map((entry) => entry.reason);

      for (const result of contractResults) {
        if (result?.chain) chainHint = result.chain;
        sourceNfts.push(...(result.nfts || []));
      }

      if (hasCollection) {
        try {
          const collectionResult = await fetchOpenSeaWalletCollectionNfts({
            walletAddress: address,
            collectionSlug,
            contractAddress,
            chainId: runtime.chainId,
            apiKey,
            mcpToken,
            perPage: 80,
            maxItems,
            timeoutMs: 12000
          });
          if (collectionResult?.chain) chainHint = collectionResult.chain;
          sourceNfts.push(...(collectionResult.nfts || []));
          strategyParts.push(collectionResult.strategy || 'collection-slug');
        } catch (collectionError) {
          contractFailures.push(collectionError);
        }
      }

      if (sourceNfts.length === 0 && contractFailures.length > 0) {
        throw contractFailures[0];
      }

      const merged = aggregateNfts(sourceNfts);
      const body = {
        ok: true,
        chain: chainHint,
        walletAddress: address,
        contractAddress: '',
        collection: hasCollection ? collectionSlug : '',
        strategy: strategyParts.join('+'),
        total: merged.length,
        nfts: merged
      };
      setCachedInventory(cacheKey, body);
      return res.status(200).json(body);
    }

    const result = hasCollection
      ? await fetchOpenSeaWalletCollectionNfts({
          walletAddress: address,
          collectionSlug,
          contractAddress,
          chainId: runtime.chainId,
          apiKey,
          mcpToken,
          perPage: 80,
          maxItems,
          timeoutMs: 12000
        })
      : await fetchOpenSeaWalletContractNfts({
          walletAddress: address,
          contractAddress,
          chainId: runtime.chainId,
          apiKey,
          mcpToken,
          perPage: 80,
          maxItems,
          timeoutMs: 12000
        });

    const body = {
      ok: true,
      chain: result.chain,
      walletAddress: result.walletAddress,
      contractAddress: result.contractAddress,
      collection: hasCollection ? collectionSlug : '',
      strategy: result.strategy,
      total: result.nfts.length,
      nfts: result.nfts
    };
    setCachedInventory(cacheKey, body);
    return res.status(200).json(body);
  } catch (error) {
    const staleCached = getStaleCachedInventory(requestContext.cacheKey, requestContext.staleCacheTtlMs);
    if (staleCached && isOpenSeaTransientError(error)) {
      return res.status(200).json({
        ...staleCached.body,
        cached: true,
        stale: true,
        cacheAgeSeconds: Math.round(staleCached.ageMs / 1000),
        warning: isRateLimitedError(error)
          ? 'OpenSea is rate-limiting right now. Showing cached inventory.'
          : 'OpenSea is temporarily unavailable. Showing cached inventory.'
      });
    }

    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const statusCode = Number(error?.statusCode || 0);
    if (statusCode === 429 || isRateLimitedError(error)) {
      return res
        .status(429)
        .json({ ok: false, error: 'OpenSea rate limit reached. Please retry in 20-60 seconds.' });
    }
    return res.status(500).json({ ok: false, error: message });
  }
}
