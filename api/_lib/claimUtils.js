import crypto from 'node:crypto';
import { ethers } from 'ethers';

const ERC721_GATE_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const ERC1155_GATE_ABI = ['function balanceOf(address account, uint256 id) view returns (uint256)'];
const ERC1155_TRANSFER_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
  'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] values, bytes data)'
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

function hmac(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
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

export function assertConfiguredForGate(config) {
  if (!config?.tokenGateContract) {
    throw new Error('Missing TOKEN_GATE_CONTRACT env variable.');
  }
  if (!config?.claimSigningSecret) {
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

export function createGatePass(address, config) {
  const gatePassTtlSeconds = Number(config?.gatePassTtlSeconds || 900);
  const payload = {
    sub: address.toLowerCase(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + gatePassTtlSeconds,
    nonce: crypto.randomBytes(8).toString('hex')
  };

  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signaturePart = hmac(payloadPart, String(config?.claimSigningSecret || ''));
  return `${payloadPart}.${signaturePart}`;
}

export function verifyGatePass(gatePass, expectedAddress, config) {
  const value = String(gatePass || '');
  const parts = value.split('.');
  if (parts.length !== 2) return false;

  const [payloadPart, signaturePart] = parts;
  const expectedSignature = hmac(payloadPart, String(config?.claimSigningSecret || ''));

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

export async function hasTokenGateAccess(provider, walletAddress, config) {
  const tokenGateContract = String(config?.tokenGateContract || '').trim();
  const tokenGateStandard = String(config?.tokenGateStandard || 'erc721').trim().toLowerCase();
  const tokenGateTokenId = Number.parseInt(String(config?.tokenGateTokenId || '0'), 10);
  const tokenGateTokenIds = String(config?.tokenGateTokenIds || '').trim();

  const gateContract = new ethers.Contract(
    tokenGateContract,
    tokenGateStandard === 'erc1155' ? ERC1155_GATE_ABI : ERC721_GATE_ABI,
    provider
  );

  if (tokenGateStandard === 'erc1155') {
    const configuredIds = tokenGateTokenIds
      ? tokenGateTokenIds.split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => BigInt(value))
      : [BigInt(tokenGateTokenId)];

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

function randomBigIntBelow(maxExclusive) {
  if (maxExclusive <= 0n) {
    throw new Error('maxExclusive must be greater than 0.');
  }

  const bits = maxExclusive.toString(2).length;
  const bytes = Math.ceil(bits / 8);

  while (true) {
    const randomHex = crypto.randomBytes(bytes).toString('hex') || '0';
    const candidate = BigInt(`0x${randomHex}`);
    if (candidate < maxExclusive) return candidate;
  }
}

export async function pickRandomRewardAllocations({
  provider,
  rewardContractAddress,
  treasuryAddress,
  tokenIds,
  rewardCount
}) {
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

  if (available.length === 0 || rewardCount <= 0) {
    if (revertedIds === tokenIds.length) {
      throw new Error('All configured reward token IDs reverted on balanceOf. Verify ERC-1155 contract and token IDs.');
    }
    throw new Error('Treasury wallet has zero balance for configured reward token IDs.');
  }

  let totalUnits = 0n;
  for (const entry of available) {
    totalUnits += entry.balance;
  }

  const requiredUnits = BigInt(rewardCount);
  if (totalUnits < requiredUnits) {
    throw new Error(`Not enough treasury rewards. Requested ${rewardCount}, available ${totalUnits.toString()}.`);
  }

  const selected = new Map();
  let remainingUnits = totalUnits;

  for (let i = 0; i < rewardCount; i += 1) {
    const target = randomBigIntBelow(remainingUnits);
    let cursor = 0n;
    let chosenIndex = -1;

    for (let idx = 0; idx < available.length; idx += 1) {
      cursor += available[idx].balance;
      if (target < cursor) {
        chosenIndex = idx;
        break;
      }
    }

    if (chosenIndex === -1) {
      throw new Error('Failed to select random reward token.');
    }

    const chosen = available[chosenIndex];
    const key = chosen.tokenId.toString();
    selected.set(key, (selected.get(key) || 0n) + 1n);

    chosen.balance -= 1n;
    if (chosen.balance <= 0n) {
      available.splice(chosenIndex, 1);
    }
    remainingUnits -= 1n;
  }

  return Array.from(selected.entries()).map(([tokenId, amount]) => ({
    tokenId: BigInt(tokenId),
    amount
  }));
}

export function getErc1155TransferAbi() {
  return ERC1155_TRANSFER_ABI;
}
