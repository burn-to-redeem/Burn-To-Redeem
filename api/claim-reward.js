import { ethers } from 'ethers';
import {
  BASE_RPC_URL,
  CHAIN_ID,
  CLAIM_MESSAGE_TTL_SECONDS,
  buildClaimMessage,
  getErc1155TransferAbi,
  hasTokenGateAccess,
  isFreshIssuedAt,
  normalizeAddress,
  parseJsonBody,
  parseRewardTokenIds,
  pickRandomRewardTokenId,
  verifyGatePass
} from './_lib/claimUtils.js';

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name} env variable.`);
  }
  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = parseJsonBody(req);
    const address = normalizeAddress(body.address);
    const signature = String(body.signature || '');
    const gatePass = String(body.gatePass || '');
    const chainId = Number.parseInt(String(body.chainId || ''), 10);
    const issuedAt = Number(body.issuedAt || 0);

    if (!signature || !gatePass) {
      return res.status(400).json({ ok: false, error: 'Missing signature or gate pass.' });
    }

    if (chainId !== CHAIN_ID) {
      return res.status(400).json({ ok: false, error: `Wrong chain. Expected ${CHAIN_ID}.` });
    }

    if (!isFreshIssuedAt(issuedAt, CLAIM_MESSAGE_TTL_SECONDS)) {
      return res.status(400).json({ ok: false, error: 'Claim signature expired. Please sign again.' });
    }

    if (!verifyGatePass(gatePass, address)) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired gate pass.' });
    }

    const message = buildClaimMessage({ address, chainId, issuedAt, gatePass });
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ ok: false, error: 'Signature verification failed.' });
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const hasAccess = await hasTokenGateAccess(provider, address);
    if (!hasAccess) {
      return res.status(403).json({ ok: false, error: 'Wallet no longer holds the token-gated NFT.' });
    }

    const treasuryPrivateKey = requireEnv('TREASURY_PRIVATE_KEY');
    const rewardContractAddress = normalizeAddress(requireEnv('REWARD_ERC1155_CONTRACT'));
    const rewardTokenIds = parseRewardTokenIds(requireEnv('REWARD_ERC1155_TOKEN_IDS'));
    const rewardAmount = BigInt(Number.parseInt(process.env.REWARD_AMOUNT_PER_CLAIM || '1', 10));

    if (rewardAmount <= 0n) {
      return res.status(400).json({ ok: false, error: 'REWARD_AMOUNT_PER_CLAIM must be > 0' });
    }

    if (rewardTokenIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid REWARD_ERC1155_TOKEN_IDS configured.' });
    }

    const treasurySigner = new ethers.Wallet(treasuryPrivateKey, provider);
    const treasuryAddress =
      (process.env.TREASURY_WALLET_ADDRESS || '').trim() || treasurySigner.address;

    if (treasuryAddress.toLowerCase() !== treasurySigner.address.toLowerCase()) {
      return res.status(500).json({ ok: false, error: 'TREASURY_WALLET_ADDRESS does not match TREASURY_PRIVATE_KEY.' });
    }

    const tokenId = await pickRandomRewardTokenId({
      provider,
      rewardContractAddress,
      treasuryAddress,
      tokenIds: rewardTokenIds
    });

    const rewardContract = new ethers.Contract(
      rewardContractAddress,
      getErc1155TransferAbi(),
      treasurySigner
    );

    const tx = await rewardContract.safeTransferFrom(
      treasuryAddress,
      address,
      tokenId,
      rewardAmount,
      '0x'
    );
    const receipt = await tx.wait();

    return res.status(200).json({
      ok: true,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      rewardContract: rewardContractAddress,
      rewardTokenId: tokenId.toString(),
      rewardAmount: rewardAmount.toString(),
      from: treasuryAddress,
      to: address
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
