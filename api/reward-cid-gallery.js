import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

function parseBoolean(value, fallback = false) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
