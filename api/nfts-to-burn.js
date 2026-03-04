import { ethers } from 'ethers';
import { fetchOpenSeaWalletCollectionNfts, fetchOpenSeaWalletContractNfts } from './_lib/opensea.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

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
    if (allCollectionsMode && allowedContracts.length > 0) {
      const results = await Promise.all(
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

      const merged = aggregateNfts(results.flatMap((result) => result.nfts || []));
      return res.status(200).json({
        ok: true,
        chain: results[0]?.chain || 'base',
        walletAddress: address,
        contractAddress: '',
        collection: '',
        strategy: 'allowed-contracts',
        total: merged.length,
        nfts: merged
      });
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

    return res.status(200).json({
      ok: true,
      chain: result.chain,
      walletAddress: result.walletAddress,
      contractAddress: result.contractAddress,
      collection: hasCollection ? collectionSlug : '',
      strategy: result.strategy,
      total: result.nfts.length,
      nfts: result.nfts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return res.status(500).json({ ok: false, error: message });
  }
}
