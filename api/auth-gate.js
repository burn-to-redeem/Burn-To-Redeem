import { ethers } from 'ethers';
import {
  assertConfiguredForGate,
  BASE_RPC_URL,
  CHAIN_ID,
  GATE_MESSAGE_TTL_SECONDS,
  buildGateMessage,
  createGatePass,
  hasTokenGateAccess,
  isFreshIssuedAt,
  normalizeAddress,
  parseJsonBody
} from './_lib/claimUtils.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    assertConfiguredForGate();

    const body = parseJsonBody(req);
    const address = normalizeAddress(body.address);
    const signature = String(body.signature || '');
    const chainId = Number.parseInt(String(body.chainId || ''), 10);
    const issuedAt = Number(body.issuedAt || 0);

    if (!signature) {
      return res.status(400).json({ ok: false, error: 'Missing signature' });
    }

    if (chainId !== CHAIN_ID) {
      return res.status(400).json({ ok: false, error: `Wrong chain. Expected ${CHAIN_ID}.` });
    }

    if (!isFreshIssuedAt(issuedAt, GATE_MESSAGE_TTL_SECONDS)) {
      return res.status(400).json({ ok: false, error: 'Gate signature expired. Please sign again.' });
    }

    const message = buildGateMessage({ address, chainId, issuedAt });
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ ok: false, error: 'Signature verification failed.' });
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const hasAccess = await hasTokenGateAccess(provider, address);

    if (!hasAccess) {
      return res.status(403).json({ ok: false, error: 'Wallet does not hold the token-gated NFT.' });
    }

    const gatePass = createGatePass(address);

    return res.status(200).json({
      ok: true,
      gatePass,
      expiresInSeconds: Number.parseInt(process.env.GATE_PASS_TTL_SECONDS || '900', 10)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
