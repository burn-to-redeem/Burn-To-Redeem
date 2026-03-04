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
  pickRandomRewardAllocations,
  verifyGatePass
} from './_lib/claimUtils.js';

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name} env variable.`);
  }
  return value;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
}

function parseGweiToWei(value, fallbackGwei) {
  const raw = String(value || fallbackGwei).trim();
  return ethers.parseUnits(raw, 'gwei');
}

async function buildLowGasOverrides(provider) {
  const mode = String(process.env.REWARD_GAS_MODE || 'lowest').trim().toLowerCase();
  if (mode !== 'lowest') return {};

  const feeData = await provider.getFeeData();
  const minPriorityFeePerGas = parseGweiToWei(process.env.REWARD_MIN_PRIORITY_GWEI, '0.000001');
  const baseFeeMultiplierBps = parsePositiveInt(process.env.REWARD_BASE_FEE_MULTIPLIER_BPS, 10000);
  const gasPriceMultiplierBps = parsePositiveInt(process.env.REWARD_GAS_PRICE_MULTIPLIER_BPS, 10000);
  const overrides = {};

  if (feeData.lastBaseFeePerGas !== null && feeData.lastBaseFeePerGas !== undefined) {
    const scaledBaseFee = (feeData.lastBaseFeePerGas * BigInt(baseFeeMultiplierBps)) / 10000n;
    overrides.maxPriorityFeePerGas = minPriorityFeePerGas;
    overrides.maxFeePerGas = scaledBaseFee + minPriorityFeePerGas;
  } else if (feeData.gasPrice !== null && feeData.gasPrice !== undefined) {
    overrides.gasPrice = (feeData.gasPrice * BigInt(gasPriceMultiplierBps)) / 10000n;
  }

  const configuredGasLimit = Number.parseInt(String(process.env.REWARD_GAS_LIMIT || ''), 10);
  if (Number.isInteger(configuredGasLimit) && configuredGasLimit > 0) {
    overrides.gasLimit = configuredGasLimit;
  }

  return overrides;
}

function bumpByBps(value, bps) {
  return (value * BigInt(bps)) / 10000n;
}

function applyFeeBump(overrides, bumpBps) {
  const bumped = { ...overrides };

  if (overrides.maxFeePerGas !== undefined && overrides.maxPriorityFeePerGas !== undefined) {
    bumped.maxPriorityFeePerGas = bumpByBps(overrides.maxPriorityFeePerGas, bumpBps) + 1n;
    bumped.maxFeePerGas = bumpByBps(overrides.maxFeePerGas, bumpBps) + 1n;
  } else if (overrides.gasPrice !== undefined) {
    bumped.gasPrice = bumpByBps(overrides.gasPrice, bumpBps) + 1n;
  }

  return bumped;
}

async function sendWithRetryEscalation({
  provider,
  signer,
  txRequest,
  initialGasOverrides
}) {
  const retryAttempts = parsePositiveInt(process.env.REWARD_TX_RETRY_ATTEMPTS, 3);
  const waitMs = parsePositiveInt(process.env.REWARD_TX_RETRY_WAIT_MS, 30000);
  const bumpBps = parsePositiveInt(process.env.REWARD_RETRY_FEE_BUMP_BPS, 12500);
  const sentHashes = [];

  let feeOverrides = { ...initialGasOverrides };
  let lastTxHash = null;

  for (let attempt = 0; attempt < retryAttempts; attempt += 1) {
    if (attempt > 0) {
      feeOverrides = applyFeeBump(feeOverrides, bumpBps);
    }

    let tx;
    try {
      tx = await signer.sendTransaction({ ...txRequest, ...feeOverrides });
      sentHashes.push(tx.hash);
      lastTxHash = tx.hash;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const nonceConflict =
        message.includes('nonce has already been used') ||
        message.includes('nonce too low') ||
        message.includes('already known');

      if (!nonceConflict) {
        throw error;
      }

      for (const hash of sentHashes) {
        const receipt = await provider.getTransactionReceipt(hash);
        if (receipt) {
          return { txHash: hash, receipt, sentHashes, attemptsUsed: attempt + 1 };
        }
      }

      continue;
    }

    const receipt = await provider.waitForTransaction(tx.hash, 1, waitMs);
    if (receipt) {
      return { txHash: tx.hash, receipt, sentHashes, attemptsUsed: attempt + 1 };
    }
  }

  if (!lastTxHash) {
    throw new Error('Failed to submit treasury transfer transaction.');
  }

  const fallbackReceipt = await provider.waitForTransaction(lastTxHash, 1, 120000);
  if (fallbackReceipt) {
    return { txHash: lastTxHash, receipt: fallbackReceipt, sentHashes, attemptsUsed: retryAttempts };
  }

  throw new Error(`Reward transfer still pending after ${retryAttempts} attempts.`);
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
    const rewardNftsPerClaim = Number.parseInt(process.env.REWARD_NFTS_PER_CLAIM || '20', 10);

    if (!Number.isInteger(rewardNftsPerClaim) || rewardNftsPerClaim <= 0) {
      return res.status(400).json({ ok: false, error: 'REWARD_NFTS_PER_CLAIM must be a positive integer.' });
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

    const allocations = await pickRandomRewardAllocations({
      provider,
      rewardContractAddress,
      treasuryAddress,
      tokenIds: rewardTokenIds,
      rewardCount: rewardNftsPerClaim
    });

    const transferIds = allocations.map((entry) => entry.tokenId);
    const transferAmounts = allocations.map((entry) => entry.amount);

    const rewardContract = new ethers.Contract(
      rewardContractAddress,
      getErc1155TransferAbi(),
      treasurySigner
    );
    const txOverrides = await buildLowGasOverrides(provider);

    const transferData = rewardContract.interface.encodeFunctionData('safeBatchTransferFrom', [
      treasuryAddress,
      address,
      transferIds,
      transferAmounts,
      '0x'
    ]);

    const nonce = await provider.getTransactionCount(treasuryAddress, 'pending');
    const estimateFrom = String(process.env.REWARD_ESTIMATE_FROM || treasuryAddress).trim();
    const estimatedGas = await provider.estimateGas({
      from: estimateFrom,
      to: rewardContractAddress,
      data: transferData
    });
    const gasLimitMultiplierBps = parsePositiveInt(process.env.REWARD_GAS_LIMIT_MULTIPLIER_BPS, 12000);
    const gasLimit = bumpByBps(estimatedGas, gasLimitMultiplierBps);

    const txRequest = {
      to: rewardContractAddress,
      data: transferData,
      nonce,
      gasLimit
    };

    const { txHash, receipt, sentHashes, attemptsUsed } = await sendWithRetryEscalation({
      provider,
      signer: treasurySigner,
      txRequest,
      initialGasOverrides: txOverrides
    });

    return res.status(200).json({
      ok: true,
      txHash,
      blockNumber: receipt?.blockNumber ?? null,
      rewardContract: rewardContractAddress,
      rewardNftsPerClaim,
      allocations: allocations.map((entry) => ({
        tokenId: entry.tokenId.toString(),
        amount: entry.amount.toString()
      })),
      txAttemptsUsed: attemptsUsed,
      replacementTxHashes: sentHashes,
      from: treasuryAddress,
      to: address
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
