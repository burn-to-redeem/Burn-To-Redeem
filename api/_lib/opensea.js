import { ethers } from 'ethers';

const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';

function cleanString(value) {
  return String(value || '').trim();
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function inferOpenSeaChainFromChainId(chainId) {
  const numeric = Number(chainId);
  if (numeric === 8453) return 'base';
  if (numeric === 1) return 'ethereum';
  if (numeric === 11155111) return 'sepolia';
  return 'base';
}

function buildWalletNftsUrl({ chain, walletAddress, limit, next, collection }) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cleanString(next)) params.set('next', cleanString(next));
  if (cleanString(collection)) params.set('collection', cleanString(collection));
  return `${OPENSEA_API_BASE}/chain/${encodeURIComponent(chain)}/account/${walletAddress}/nfts?${params.toString()}`;
}

function normalizeTokenId(value) {
  const raw = cleanString(value);
  if (!raw) return '';
  try {
    if (/^0x[0-9a-f]+$/i.test(raw)) return BigInt(raw).toString(10);
    if (/^\d+$/.test(raw)) return BigInt(raw).toString(10);
  } catch {
    return '';
  }
  return '';
}

function normalizeNft(nft, chainHint) {
  const source = nft && typeof nft === 'object' ? nft : {};
  const contractRaw = source.contract && typeof source.contract === 'object' ? source.contract : {};
  const contractAddress = cleanString(contractRaw.address || source.contract);
  const tokenId = normalizeTokenId(source.identifier || source.token_id || source.tokenId);
  const collectionRaw = source.collection && typeof source.collection === 'object' ? source.collection : {};
  const collectionSlug = cleanString(
    typeof source.collection === 'string' ? source.collection : collectionRaw.slug || collectionRaw.collection
  );
  const collectionName = cleanString(
    collectionRaw.name || (typeof source.collection === 'string' ? source.collection : '')
  );

  return {
    tokenId,
    name: cleanString(source.name) || (tokenId ? `#${tokenId}` : 'Untitled'),
    description: cleanString(source.description),
    imageUrl: cleanString(source.image_url || source.image || source.image_original_url),
    displayImageUrl: cleanString(source.display_image_url || source.image_preview_url || source.image_url),
    openseaUrl:
      cleanString(source.opensea_url || source.permalink) ||
      (contractAddress && tokenId
        ? `https://opensea.io/assets/${encodeURIComponent(chainHint)}/${encodeURIComponent(contractAddress)}/${encodeURIComponent(tokenId)}`
        : ''),
    contractAddress,
    contractName: cleanString(contractRaw.name),
    collection: collectionSlug,
    collectionName,
    chain: cleanString(source.chain) || chainHint
  };
}

async function fetchOpenSeaJson(url, { apiKey, mcpToken, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    accept: 'application/json',
    'user-agent': 'burn-to-redeem/1.0'
  };

  const cleanedApiKey = cleanString(apiKey);
  const cleanedMcpToken = cleanString(mcpToken);
  if (cleanedApiKey) headers['x-api-key'] = cleanedApiKey;
  if (cleanedMcpToken) headers.authorization = `Bearer ${cleanedMcpToken}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal
    });

    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }

    if (!response.ok) {
      const message =
        cleanString(json?.errors?.[0] || json?.error || json?.detail || json?.message) ||
        `OpenSea request failed (${response.status}).`;
      const error = new Error(message);
      error.statusCode = response.status;
      throw error;
    }

    return json;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      const timeoutError = new Error(`OpenSea request timed out after ${timeoutMs}ms.`);
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchOpenSeaWalletContractNfts({
  walletAddress,
  contractAddress,
  chainId,
  apiKey,
  mcpToken,
  perPage = 50,
  maxItems = 250,
  timeoutMs = 12000
}) {
  const chain = inferOpenSeaChainFromChainId(chainId);
  const normalizedWallet = ethers.getAddress(walletAddress);
  const normalizedContract = ethers.getAddress(contractAddress).toLowerCase();
  const pageSize = clampInt(perPage, 50, 1, 200);
  const itemCap = clampInt(maxItems, 250, 1, 20000);
  const collected = [];
  const seen = new Set();

  async function collect(strategy, queryContractFilter, localFilterContract) {
    let next = '';

    while (true) {
      const url = buildWalletNftsUrl({
        chain,
        walletAddress: normalizedWallet,
        limit: pageSize,
        next,
        collection: queryContractFilter || ''
      });
      const payload = await fetchOpenSeaJson(url, { apiKey, mcpToken, timeoutMs });
      const nfts = Array.isArray(payload?.nfts) ? payload.nfts : [];

      for (const raw of nfts) {
        const item = normalizeNft(raw, chain);
        if (!item.tokenId) continue;
        if (localFilterContract && item.contractAddress.toLowerCase() !== normalizedContract) continue;

        const key = `${item.contractAddress.toLowerCase()}:${item.tokenId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(item);
        if (collected.length >= itemCap) {
          return { strategy, next: cleanString(payload?.next) };
        }
      }

      next = cleanString(payload?.next);
      if (!next) {
        return { strategy, next: '' };
      }
    }
  }

  let strategyUsed = 'collection-contract';
  try {
    const result = await collect('collection-contract', normalizedContract, false);
    strategyUsed = result.strategy;
  } catch {
    const result = await collect('wallet-local-contract-filter', '', true);
    strategyUsed = result.strategy;
  }

  return {
    chain,
    walletAddress: normalizedWallet,
    contractAddress: normalizedContract,
    strategy: strategyUsed,
    nfts: collected
  };
}

export async function fetchOpenSeaWalletCollectionNfts({
  walletAddress,
  collectionSlug,
  contractAddress = '',
  chainId,
  apiKey,
  mcpToken,
  perPage = 50,
  maxItems = 250,
  timeoutMs = 12000
}) {
  const chain = inferOpenSeaChainFromChainId(chainId);
  const normalizedWallet = ethers.getAddress(walletAddress);
  const cleanedCollectionSlug = cleanString(collectionSlug);
  if (!cleanedCollectionSlug) {
    throw new Error('Missing collection slug.');
  }

  const normalizedContract = cleanString(contractAddress)
    ? ethers.getAddress(contractAddress).toLowerCase()
    : '';
  const pageSize = clampInt(perPage, 50, 1, 200);
  const itemCap = clampInt(maxItems, 250, 1, 20000);
  const collected = [];
  const seen = new Set();

  function matchesLocalFilter(item) {
    if (item.collection !== cleanedCollectionSlug) return false;
    if (normalizedContract && item.contractAddress.toLowerCase() !== normalizedContract) return false;
    return true;
  }

  async function collect(strategy, queryCollection, localFilter) {
    let next = '';

    while (true) {
      const url = buildWalletNftsUrl({
        chain,
        walletAddress: normalizedWallet,
        limit: pageSize,
        next,
        collection: queryCollection || ''
      });
      const payload = await fetchOpenSeaJson(url, { apiKey, mcpToken, timeoutMs });
      const nfts = Array.isArray(payload?.nfts) ? payload.nfts : [];

      for (const raw of nfts) {
        const item = normalizeNft(raw, chain);
        if (!item.tokenId) continue;
        if (localFilter && !matchesLocalFilter(item)) continue;

        const key = `${item.contractAddress.toLowerCase()}:${item.tokenId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(item);
        if (collected.length >= itemCap) {
          return { strategy, next: cleanString(payload?.next) };
        }
      }

      next = cleanString(payload?.next);
      if (!next) {
        return { strategy, next: '' };
      }
    }
  }

  let strategyUsed = 'collection-slug';
  try {
    const result = await collect('collection-slug', cleanedCollectionSlug, false);
    strategyUsed = result.strategy;
  } catch {
    const result = await collect('wallet-local-collection-filter', '', true);
    strategyUsed = result.strategy;
  }

  return {
    chain,
    walletAddress: normalizedWallet,
    collection: cleanedCollectionSlug,
    contractAddress: normalizedContract,
    strategy: strategyUsed,
    nfts: collected
  };
}

export function extractUniqueTokenIds(items) {
  const set = new Set();
  for (const item of items || []) {
    const tokenId = normalizeTokenId(item?.tokenId || item?.token_id || item?.identifier);
    if (!tokenId) continue;
    set.add(tokenId);
  }
  return Array.from(set).sort((a, b) => {
    const left = BigInt(a);
    const right = BigInt(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
}
