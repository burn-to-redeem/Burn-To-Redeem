import { ethers } from 'ethers';
import {
  assertConfiguredForGate,
  buildGateMessage,
  createGatePass,
  hasTokenGateAccess,
  isFreshIssuedAt,
  normalizeAddress,
  parseJsonBody
} from './_lib/claimUtils.js';
import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const runtime = await getRuntimeConfigForRequest(req);
    assertConfiguredForGate(runtime);

    const body = parseJsonBody(req);
    const address = normalizeAddress(body.address);
    const signature = String(body.signature || '');
    const chainId = Number.parseInt(String(body.chainId || ''), 10);
    const issuedAt = Number(body.issuedAt || 0);

    if (!signature) {
      return res.status(400).json({ ok: false, error: 'Missing signature' });
    }

    if (chainId !== runtime.chainId) {
      return res.status(400).json({ ok: false, error: `Wrong chain. Expected ${runtime.chainId}.` });
    }

    if (!isFreshIssuedAt(issuedAt, runtime.gateMessageTtlSeconds)) {
      return res.status(400).json({ ok: false, error: 'Gate signature expired. Please sign again.' });
    }

    const message = buildGateMessage({ address, chainId, issuedAt });
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ ok: false, error: 'Signature verification failed.' });
    }

    const provider = new ethers.JsonRpcProvider(runtime.baseRpcUrl);
    const hasAccess = await hasTokenGateAccess(provider, address, runtime);

    if (!hasAccess) {
      return res.status(403).json({ ok: false, error: 'Wallet does not hold the token-gated NFT.' });
    }

    const gatePass = createGatePass(address, runtime);

    return res.status(200).json({
      ok: true,
      gatePass,
      expiresInSeconds: runtime.gatePassTtlSeconds
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
