import crypto from 'node:crypto';
import { ethers } from 'ethers';

export const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
export const CHAIN_ID = Number.parseInt(process.env.CHAIN_ID || '8453', 10);
export const TOKEN_GATE_CONTRACT = (process.env.TOKEN_GATE_CONTRACT || '').trim();
export const TOKEN_GATE_STANDARD = (process.env.TOKEN_GATE_STANDARD || 'erc721').trim().toLowerCase();
export const TOKEN_GATE_TOKEN_ID = Number.parseInt(process.env.TOKEN_GATE_TOKEN_ID || '0', 10);
export const TOKEN_GATE_TOKEN_IDS = (process.env.TOKEN_GATE_TOKEN_IDS || '').trim();
export const GATE_MESSAGE_TTL_SECONDS = Number.parseInt(process.env.GATE_MESSAGE_TTL_SECONDS || '300', 10);
export const CLAIM_MESSAGE_TTL_SECONDS = Number.parseInt(process.env.CLAIM_MESSAGE_TTL_SECONDS || '300', 10);
export const GATE_PASS_TTL_SECONDS = Number.parseInt(process.env.GATE_PASS_TTL_SECONDS || '900', 10);
export const CLAIM_SIGNING_SECRET = (process.env.CLAIM_SIGNING_SECRET || '').trim();

const ERC721_GATE_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const ERC1155_GATE_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];
const ERC1155_TRANSFER_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)'
];

async function safeBalanceOf(contract, address, tokenId) {
  try {
    return await contract.balanceOf(address, tokenId);
  } catch {
    return null;
  }
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function hmac(payload) {
  return crypto.createHmac('sha256', CLAIM_SIGNING_SECRET).update(payload).digest('base64url');
}

export function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'object') return req.body;
  return {};
}

export function normalizeAddress(address) {
  return ethers.getAddress(String(address || '').trim());
}

export function assertConfiguredForGate() {
  if (!TOKEN_GATE_CONTRACT) {
    throw new Error('Missing TOKEN_GATE_CONTRACT env variable.');
  }
  if (!CLAIM_SIGNING_SECRET) {
    throw new Error('Missing CLAIM_SIGNING_SECRET env variable.');
  }
}

export function buildGateMessage({ address, chainId, issuedAt }) {
  return [
    'Burn to Redeem Token Gate',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`
  ].join('\n');
}

export function buildClaimMessage({ address, chainId, issuedAt, gatePass }) {
  return [
    'Burn to Redeem Claim',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`
  ].join('\n');
}

export function isFreshIssuedAt(issuedAt, ttlSeconds) {
  const numericIssuedAt = Number(issuedAt);
  if (!Number.isFinite(numericIssuedAt) || numericIssuedAt <= 0) return false;
  const ageMs = Date.now() - numericIssuedAt;
  return ageMs >= 0 && ageMs <= ttlSeconds * 1000;
}

export function createGatePass(address) {
  const payload = {
    sub: address.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + GATE_PASS_TTL_SECONDS,
    nonce: crypto.randomBytes(8).toString('hex')
  };

  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = hmac(payloadPart);
  return `${payloadPart}.${signaturePart}`;
}

export function verifyGatePass(gatePass, expectedAddress) {
  const value = String(gatePass || '');
  const parts = value.split('.');
  if (parts.length !== 2) return false;

  const [payloadPart, signaturePart] = parts;
  const expectedSignature = hmac(payloadPart);

  const signatureBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadPart));
  } catch {
    return false;
  }

  if (!payload || typeof payload !== 'object') return false;
  if (String(payload.sub || '').toLowerCase() !== expectedAddress.toLowerCase()) return false;
  if (!Number.isFinite(payload.exp)) return false;
  if (Math.floor(Date.now() / 1000) > payload.exp) return false;

  return true;
}

export async function hasTokenGateAccess(provider, walletAddress) {
  const gateContract = new ethers.Contract(
    TOKEN_GATE_CONTRACT,
    TOKEN_GATE_STANDARD === 'erc1155' ? ERC1155_GATE_ABI : ERC721_GATE_ABI,
    provider
  );

  if (TOKEN_GATE_STANDARD === 'erc1155') {
    const configuredIds = TOKEN_GATE_TOKEN_IDS
      ? TOKEN_GATE_TOKEN_IDS.split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => BigInt(value))
      : [BigInt(TOKEN_GATE_TOKEN_ID)];

    for (const tokenId of configuredIds) {
      const balance = await safeBalanceOf(gateContract, walletAddress, tokenId);
      if (balance === null) continue;
      if (balance > 0n) return true;
    }
    return false;
  }

  const balance = await gateContract.balanceOf(walletAddress);
  return balance > 0n;
}

export function parseRewardTokenIds(rawIds) {
  return String(rawIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => BigInt(value));
}

export async function pickRandomRewardTokenId({ provider, rewardContractAddress, treasuryAddress, tokenIds }) {
  const rewardContract = new ethers.Contract(rewardContractAddress, ERC1155_TRANSFER_ABI, provider);

  const available = [];
  let revertedIds = 0;
  for (const tokenId of tokenIds) {
    const balance = await safeBalanceOf(rewardContract, treasuryAddress, tokenId);
    if (balance === null) {
      revertedIds += 1;
      continue;
    }
    if (balance > 0n) {
      available.push({ tokenId, balance });
    }
  }

  if (available.length === 0) {
    if (revertedIds === tokenIds.length) {
      throw new Error('All configured reward token IDs reverted on balanceOf. Verify ERC-1155 contract and token IDs.');
    }
    throw new Error('Treasury wallet has zero balance for configured reward token IDs.');
  }

  const randomBytes = crypto.randomBytes(4);
  const randomIndex = randomBytes.readUInt32BE(0) % available.length;
  return available[randomIndex].tokenId;
}

export function getErc1155TransferAbi() {
  return ERC1155_TRANSFER_ABI;
}
