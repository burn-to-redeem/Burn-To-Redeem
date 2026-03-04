import { useMemo, useState } from 'react';
import { ethers } from 'ethers';

type ClaimResponse = {
  ok: boolean;
  txHash?: string;
  rewardTokenId?: string;
  rewardAmount?: string;
  rewardContract?: string;
  error?: string;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const TARGET_CHAIN_ID = Number(import.meta.env.VITE_BASE_CHAIN_ID || 8453);
const TOKEN_GATE_CONTRACT = String(import.meta.env.VITE_TOKEN_GATE_CONTRACT || '');
const REWARD_CONTRACT = String(import.meta.env.VITE_REWARD_ERC1155_CONTRACT || '');

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function buildGateMessage(address: string, chainId: number, issuedAt: number) {
  return [
    'Burn to Redeem Token Gate',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`
  ].join('\n');
}

function buildClaimMessage(address: string, chainId: number, issuedAt: number, gatePass: string) {
  return [
    'Burn to Redeem Claim',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`
  ].join('\n');
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  const [gatePass, setGatePass] = useState('');
  const [claimResponse, setClaimResponse] = useState<ClaimResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGateSigning, setIsGateSigning] = useState(false);
  const [isClaimSigning, setIsClaimSigning] = useState(false);
  const [error, setError] = useState('');

  const explorerUrl = useMemo(() => {
    if (!claimResponse?.txHash) return '';
    return `https://basescan.org/tx/${claimResponse.txHash}`;
  }, [claimResponse?.txHash]);

  async function getProvider() {
    if (!window.ethereum) {
      throw new Error('No wallet detected. Install MetaMask or another injected wallet.');
    }
    return new ethers.BrowserProvider(window.ethereum);
  }

  async function syncWallet() {
    const provider = await getProvider();
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();
    const address = await signer.getAddress();

    setWalletAddress(address);
    setChainId(Number(network.chainId));

    return { provider, signer, address, chainId: Number(network.chainId) };
  }

  async function connectWallet() {
    setError('');
    setClaimResponse(null);
    setIsConnecting(true);

    try {
      await window.ethereum?.request({ method: 'eth_requestAccounts' });
      await syncWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }

  async function switchToBase() {
    setError('');
    try {
      if (!window.ethereum) throw new Error('No wallet detected.');
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${TARGET_CHAIN_ID.toString(16)}` }]
      });
      await syncWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch network';
      setError(message);
    }
  }

  async function handleGateSignature() {
    setError('');
    setClaimResponse(null);
    setIsGateSigning(true);

    try {
      const { signer, address, chainId: currentChainId } = await syncWallet();
      if (currentChainId !== TARGET_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to Base (chain ${TARGET_CHAIN_ID}) first.`);
      }

      const issuedAt = Date.now();
      const message = buildGateMessage(address, currentChainId, issuedAt);
      const signature = await signer.signMessage(message);

      const response = await fetch('/api/auth-gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address,
          chainId: currentChainId,
          issuedAt,
          signature
        })
      });

      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Token gate verification failed.');
      }

      setGatePass(body.gatePass);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token gate signing failed';
      setError(message);
    } finally {
      setIsGateSigning(false);
    }
  }

  async function handleClaimSignature() {
    setError('');
    setClaimResponse(null);
    setIsClaimSigning(true);

    try {
      if (!gatePass) {
        throw new Error('Missing gate pass. Complete token gate signature first.');
      }

      const { signer, address, chainId: currentChainId } = await syncWallet();
      if (currentChainId !== TARGET_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to Base (chain ${TARGET_CHAIN_ID}) first.`);
      }

      const issuedAt = Date.now();
      const message = buildClaimMessage(address, currentChainId, issuedAt, gatePass);
      const signature = await signer.signMessage(message);

      const response = await fetch('/api/claim-reward', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address,
          chainId: currentChainId,
          issuedAt,
          gatePass,
          signature
        })
      });

      const body = (await response.json()) as ClaimResponse;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Claim failed.');
      }

      setClaimResponse(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Claim signature failed';
      setError(message);
    } finally {
      setIsClaimSigning(false);
    }
  }

  const isConnected = Boolean(walletAddress);
  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Burn to Redeem Reward Claims</h1>
        <p className="mt-2 text-sm text-neutral-400">
          2-step signature flow: token gate auth first, then reward claim signature for random ERC-1155 delivery.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
          <h2 className="text-lg font-semibold">Step 1: Token-Gated Signature</h2>
          <p className="text-sm text-neutral-400">Connect on Base and sign to prove ownership of the gate NFT.</p>

          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-neutral-700 px-3 py-2">
                Connected: <span className="font-mono">{shortAddress(walletAddress)}</span>
              </div>

              <div className="rounded-md border border-neutral-700 px-3 py-2">
                Network: <span className="font-mono">{chainId}</span>
              </div>

              {isWrongNetwork ? (
                <button
                  onClick={switchToBase}
                  className="rounded-lg bg-amber-300 px-4 py-2 font-semibold text-black"
                >
                  Switch to Base
                </button>
              ) : (
                <button
                  onClick={handleGateSignature}
                  disabled={isGateSigning}
                  className="rounded-lg bg-emerald-300 px-4 py-2 font-semibold text-black disabled:opacity-50"
                >
                  {isGateSigning ? 'Waiting for signature...' : 'Sign Token-Gate Message'}
                </button>
              )}
            </div>
          )}
        </div>

        {gatePass ? (
          <div className="mt-4 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
            <h2 className="text-lg font-semibold">Step 2: Claim Your Reward NFTs</h2>
            <p className="text-sm text-neutral-400">
              Sign once more to authorize random reward transfer from treasury wallet.
            </p>

            <button
              onClick={handleClaimSignature}
              disabled={isClaimSigning || isWrongNetwork}
              className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-black disabled:opacity-50"
            >
              {isClaimSigning ? 'Claiming...' : 'Sign & Claim Reward'}
            </button>
          </div>
        ) : null}

        {claimResponse?.ok ? (
          <div className="mt-4 rounded-xl border border-emerald-600/40 bg-emerald-900/20 p-5 text-sm">
            <div className="font-semibold text-emerald-200">Reward sent successfully.</div>
            <div className="mt-2 space-y-1 text-emerald-100/90">
              <div>Token ID: <span className="font-mono">{claimResponse.rewardTokenId}</span></div>
              <div>Amount: <span className="font-mono">{claimResponse.rewardAmount}</span></div>
              <div>Contract: <span className="font-mono break-all">{claimResponse.rewardContract || REWARD_CONTRACT}</span></div>
              {explorerUrl ? (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-block underline">
                  View transaction on BaseScan
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-600/40 bg-red-900/20 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 text-xs text-neutral-400">
          <div>Token gate contract: <span className="font-mono break-all">{TOKEN_GATE_CONTRACT || 'Not configured'}</span></div>
          <div className="mt-1">Reward ERC-1155 contract: <span className="font-mono break-all">{REWARD_CONTRACT || 'Not configured'}</span></div>
        </div>
      </div>
    </div>
  );
}
