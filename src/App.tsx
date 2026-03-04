import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, Flame, Info, LockKeyhole, Shield, Wallet, X, Zap } from 'lucide-react';
import { ethers } from 'ethers';
import { NFT, Reward } from './types';

type ClaimAllocation = {
  tokenId: string;
  amount: string;
};

type ClaimResponse = {
  ok: boolean;
  txHash?: string;
  rewardContract?: string;
  rewardNftsPerClaim?: number;
  rewardTokenIdsSource?: string;
  rewardTokenIdsUsed?: string[];
  gateTokenClaimMode?: string;
  claimedWithGateTokenId?: string | null;
  allocations?: ClaimAllocation[];
  error?: string;
};

type BurnInventoryNft = {
  tokenId: string;
  name: string;
  imageUrl: string;
  displayImageUrl: string;
  collection: string;
  collectionName: string;
  contractAddress: string;
  openseaUrl: string;
};

type BurnInventoryResponse = {
  ok: boolean;
  total?: number;
  nfts?: BurnInventoryNft[];
  error?: string;
};

type WebsiteCopy = {
  brandName: string;
  accessTitle: string;
  accessSubtitle: string;
  step1Title: string;
  step1Subtitle: string;
  step2Title: string;
  step2Subtitle: string;
  burnHeroSubtitle: string;
  nftsTabLabel: string;
  rewardsTabLabel: string;
  nftsSectionTitle: string;
  rewardsSectionTitle: string;
};

type WebsiteConfigResponse = {
  ok: boolean;
  website?: Partial<WebsiteCopy>;
  error?: string;
};

type BurnWebsiteProps = {
  walletAddress: string;
  gatePass: string;
  claimResponse: ClaimResponse | null;
  claimedNfts: NFT[];
  websiteCopy: WebsiteCopy;
  entryMode: 'claim' | 'gate-only';
  isClaimSigning: boolean;
  claimError: string;
  onClaimRewards: () => Promise<void>;
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
const REWARD_CONTRACT = String(import.meta.env.VITE_REWARD_ERC1155_CONTRACT || '');
const BURN_COLLECTION_SLUG = String(import.meta.env.VITE_BURN_COLLECTION_SLUG || 'cc0-by-pierre').trim();

const MOCK_REWARDS: Reward[] = [
  {
    id: 'r1',
    name: 'PHYSICAL_PRINT_V1',
    description: 'High-quality metallic print of your burned asset.',
    image: 'https://picsum.photos/seed/print1/400/400',
    cost: 1000,
    stock: 50
  },
  {
    id: 'r2',
    name: 'GENESIS_PASS',
    description: 'Access to future exclusive drops and events.',
    image: 'https://picsum.photos/seed/pass1/400/400',
    cost: 2500,
    stock: 10
  },
  {
    id: 'r3',
    name: 'CUSTOM_AVATAR',
    description: 'A 1/1 custom avatar designed by our studio.',
    image: 'https://picsum.photos/seed/avatar1/400/400',
    cost: 5000,
    stock: 5
  }
];

const DEFAULT_WEBSITE_COPY: WebsiteCopy = {
  brandName: 'Burn to Redeem',
  accessTitle: 'Burn to Redeem Access',
  accessSubtitle:
    'Sign once for token-gate access. Claim rewards later from the Redeemable Rewards tab inside the website.',
  step1Title: 'Step 1: Token-Gated Signature',
  step1Subtitle: 'Connect on Base and sign to prove ownership of the gate NFT.',
  step2Title: 'Step 2: Claim Rewards In Redeemable Rewards Tab',
  step2Subtitle: 'After entry, open Redeemable Rewards and sign to claim your random NFT allocation.',
  burnHeroSubtitle: 'Burn your claimed rewards to stack credits and redeem premium drops.',
  nftsTabLabel: 'NFTS TO BURN',
  rewardsTabLabel: 'REDEEMABLE REWARDS',
  nftsSectionTitle: 'NFTS TO BURN',
  rewardsSectionTitle: 'Redeemable Rewards'
};

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

function rarityFromToken(tokenId: number): NFT['rarity'] {
  const mod = tokenId % 4;
  if (mod === 0) return 'Mythic';
  if (mod === 1) return 'Legendary';
  if (mod === 2) return 'Rare';
  return 'Common';
}

function burnValueFromToken(tokenId: number) {
  return 80 + (tokenId % 20) * 15;
}

function expandClaimAllocationsToNfts(allocations?: ClaimAllocation[]): NFT[] {
  if (!allocations || allocations.length === 0) return [];

  const items: NFT[] = [];

  allocations.forEach((allocation) => {
    const tokenId = Number.parseInt(allocation.tokenId, 10);
    const amount = Number.parseInt(allocation.amount, 10);
    if (!Number.isInteger(tokenId) || !Number.isInteger(amount) || amount <= 0) return;

    for (let index = 0; index < amount; index += 1) {
      items.push({
        id: `reward-${tokenId}-${index}`,
        name: `TREASURE #${tokenId}`,
        collection: 'TREASURY_DROP',
        image: `https://picsum.photos/seed/reward-${tokenId}-${index}/400/400`,
        rarity: rarityFromToken(tokenId),
        burnValue: burnValueFromToken(tokenId)
      });
    }
  });

  return items;
}

function mapBurnInventoryToNfts(items: BurnInventoryNft[]): NFT[] {
  return items
    .map((item, index) => {
      const tokenIdNum = Number.parseInt(String(item.tokenId || ''), 10);
      if (!Number.isInteger(tokenIdNum) || tokenIdNum < 0) return null;

      return {
        id: `${item.contractAddress.toLowerCase()}-${item.tokenId}-${index}`,
        name: item.name || `TREASURE #${item.tokenId}`,
        collection: item.collectionName || item.collection || 'TREASURY_DROP',
        image: item.displayImageUrl || item.imageUrl || '',
        rarity: rarityFromToken(tokenIdNum),
        burnValue: burnValueFromToken(tokenIdNum)
      } as NFT;
    })
    .filter((item): item is NFT => item !== null);
}

function BurnWebsite({
  walletAddress,
  gatePass,
  claimResponse,
  claimedNfts,
  websiteCopy,
  entryMode,
  isClaimSigning,
  claimError,
  onClaimRewards
}: BurnWebsiteProps) {
  const [userNfts, setUserNfts] = useState<NFT[]>([]);
  const [balance, setBalance] = useState(0);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [isBurning, setIsBurning] = useState(false);
  const [burnedId, setBurnedId] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'nfts' | 'rewards'>('nfts');
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [inventoryNote, setInventoryNote] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchInventory() {
      setIsInventoryLoading(true);
      setInventoryNote('');

      try {
        if (!walletAddress) {
          if (!cancelled) {
            setUserNfts([]);
            setInventoryNote('Connect a wallet to load OpenSea inventory.');
          }
          return;
        }

        const query = new URLSearchParams();
        query.set('address', walletAddress);
        query.set('max', '2000');
        if (BURN_COLLECTION_SLUG) {
          query.set('collection', BURN_COLLECTION_SLUG);
        } else if (claimResponse?.rewardContract || REWARD_CONTRACT) {
          query.set('contract', claimResponse?.rewardContract || REWARD_CONTRACT);
        }

        const response = await fetch(`/api/nfts-to-burn?${query.toString()}`);
        const body = (await response.json().catch(() => ({}))) as BurnInventoryResponse;

        if (!response.ok || !body.ok) {
          throw new Error(body.error || 'Failed to load OpenSea inventory.');
        }

        const fromOpenSea = mapBurnInventoryToNfts(body.nfts || []);
        if (!cancelled) {
          if (fromOpenSea.length > 0) {
            setUserNfts(fromOpenSea);
            setInventoryNote(
              BURN_COLLECTION_SLUG
                ? `OpenSea synced ${fromOpenSea.length} NFT(s) from ${BURN_COLLECTION_SLUG}.`
                : `OpenSea synced ${fromOpenSea.length} NFT(s) to burn.`
            );
          } else {
            setUserNfts([]);
            setInventoryNote(
              BURN_COLLECTION_SLUG
                ? `No NFTs from ${BURN_COLLECTION_SLUG} found in this wallet.`
                : 'No burnable NFTs found on OpenSea for this wallet.'
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          setUserNfts([]);
          setInventoryNote(error instanceof Error ? error.message : 'OpenSea inventory sync unavailable.');
        }
      } finally {
        if (!cancelled) setIsInventoryLoading(false);
      }
    }

    fetchInventory();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, claimResponse?.rewardContract]);

  useEffect(() => {
    if (activeTab !== 'nfts') {
      setSelectedNft(null);
    }
  }, [activeTab]);

  const handleRedeem = (reward: Reward) => {
    if (balance < reward.cost) return;
    setBalance((prev) => prev - reward.cost);
    setRedeemSuccess(reward.name);
    setTimeout(() => setRedeemSuccess(null), 4000);
  };

  const handleBurn = async () => {
    if (!selectedNft) return;

    setIsBurning(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    setBalance((prev) => prev + selectedNft.burnValue);
    setBurnedId(selectedNft.id);

    setTimeout(() => {
      setUserNfts((prev) => prev.filter((nft) => nft.id !== selectedNft.id));
      setSelectedNft(null);
      setIsBurning(false);
      setBurnedId(null);
    }, 800);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-white selection:text-black relative overflow-hidden">
      <AnimatePresence>
        {redeemSuccess && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6"
          >
            <div className="bg-white text-black p-4 rounded-xl shadow-2xl flex items-center gap-4 border border-black/10">
              <div className="w-10 h-10 bg-black text-white flex items-center justify-center rounded-lg">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display font-bold uppercase text-sm">Redemption Successful</div>
                <div className="text-xs font-mono opacity-60">ITEM: {redeemSuccess}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_0%,transparent_70%)]" />
        <div className="scanline" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-t-0 border-x-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white flex items-center justify-center rounded-sm">
              <Flame className="text-black w-6 h-6" />
            </div>
            <span className="font-display font-bold text-xl tracking-tighter uppercase">{websiteCopy.brandName}</span>
          </div>

          <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-full border border-white/10">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="font-mono text-sm font-bold">
              {balance} <span className="text-white/40">CREDITS</span>
            </span>
            <div className="w-px h-4 bg-white/20" />
            <Wallet className="w-4 h-4" />
            <span className="font-mono text-xs text-white/60">{shortAddress(walletAddress)}</span>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto relative z-10">
        <section className="mb-12">
          <div className="glass-panel rounded-2xl p-5 text-sm">
            {entryMode === 'claim' ? (
              <>
                <div className="font-mono uppercase text-xs tracking-[0.16em] text-white/60">Claim Confirmed</div>
                <div className="mt-2 text-white/85">
                  {claimResponse?.rewardNftsPerClaim || claimedNfts.length} reward NFTs unlocked and loaded into your burn inventory.
                </div>
                {claimResponse?.txHash ? (
                  <a
                    href={`https://basescan.org/tx/${claimResponse.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-cyan-300 underline"
                  >
                    View claim tx on BaseScan
                  </a>
                ) : null}
              </>
            ) : (
              <>
                <div className="font-mono uppercase text-xs tracking-[0.16em] text-white/60">Gate Access Confirmed</div>
                <div className="mt-2 text-white/85">
                  Website access granted via token-gate NFT. No new rewards were claimed in this session.
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-end">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-6xl md:text-8xl font-black leading-[0.85] tracking-tighter uppercase mb-8"
              >
                Burn <br />
                <span className="text-white/20">to</span> <br />
                Redeem
              </motion.h1>
              <p className="text-white/60 max-w-md text-lg leading-relaxed">
                {websiteCopy.burnHeroSubtitle}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <Shield className="w-5 h-5 text-white/40" />
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">Protocol Status</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-3xl font-display font-bold">ACTIVE</div>
                    <div className="text-xs font-mono text-white/40">NETWORK: BASE MAINNET</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-display font-bold">{userNfts.length}</div>
                    <div className="text-xs font-mono text-white/40">BURNABLE_NFTS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <div className="glass-panel rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('nfts')}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] rounded-lg border ${
                  activeTab === 'nfts'
                    ? 'bg-white text-black border-white'
                    : 'bg-black/40 text-white/70 border-white/20 hover:text-white'
                }`}
              >
                {websiteCopy.nftsTabLabel}
              </button>
              <button
                onClick={() => setActiveTab('rewards')}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] rounded-lg border ${
                  activeTab === 'rewards'
                    ? 'bg-white text-black border-white'
                    : 'bg-black/40 text-white/70 border-white/20 hover:text-white'
                }`}
              >
                {websiteCopy.rewardsTabLabel}
              </button>
            </div>
          </div>
        </section>

        {activeTab === 'nfts' ? (
          <section id="gallery" className="mb-32">
            <div className="flex items-center justify-between mb-12">
              <h2 className="font-display text-4xl font-bold uppercase tracking-tighter">{websiteCopy.nftsSectionTitle}</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                <Info className="w-4 h-4" />
                SELECT AN NFT TO BURN FOR CREDITS
              </div>
            </div>

            {isInventoryLoading ? (
              <div className="glass-panel rounded-3xl p-10 text-center text-white/60">
                Syncing OpenSea inventory...
              </div>
            ) : null}

            {inventoryNote ? (
              <div className="mb-6 rounded-xl border border-neutral-700/70 bg-neutral-900/70 px-4 py-3 text-xs font-mono text-neutral-300">
                {inventoryNote}
              </div>
            ) : null}

            {userNfts.length === 0 ? (
              <div className="glass-panel rounded-3xl p-16 text-center text-white/50">
                No claimed rewards left to burn.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {userNfts.map((nft) => (
                    <motion.div
                      key={nft.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{
                        opacity: burnedId === nft.id ? 0 : 1,
                        scale: burnedId === nft.id ? 1.1 : 1,
                        filter: burnedId === nft.id ? 'brightness(2) saturate(0)' : 'none'
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => !isBurning && setSelectedNft(nft)}
                      className={`group relative cursor-pointer rounded-2xl overflow-hidden brutalist-border ${selectedNft?.id === nft.id ? 'border-white ring-2 ring-white/20' : ''}`}
                    >
                      <div className="aspect-square overflow-hidden bg-neutral-900">
                        {nft.image ? (
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center text-xs text-neutral-400 font-mono uppercase">
                            No Image
                          </div>
                        )}
                      </div>

                      <div className="p-6 bg-black/80 backdrop-blur-sm absolute bottom-0 left-0 right-0 border-t border-white/10">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-display font-bold text-lg leading-none mb-1">{nft.name}</h3>
                            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{nft.collection}</p>
                          </div>
                          <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono uppercase">{nft.rarity}</div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-white/40" />
                            <span className="font-mono text-sm font-bold">
                              {nft.burnValue} <span className="text-white/40">VAL</span>
                            </span>
                          </div>
                          {selectedNft?.id === nft.id ? (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-white text-black p-1 rounded-full">
                              <Check className="w-4 h-4" />
                            </motion.div>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        ) : null}

        <AnimatePresence>
          {selectedNft && activeTab === 'nfts' ? (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-6"
            >
              <div className="bg-white text-black p-6 rounded-2xl shadow-2xl flex items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedNft.image ? (
                      <img src={selectedNft.image} alt="" className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-neutral-200 text-[9px] font-mono uppercase flex items-center justify-center text-neutral-500">
                        No Image
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-mono uppercase tracking-widest opacity-50">Initiate Burn</div>
                    <div className="text-xl font-display font-black uppercase">{selectedNft.name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-mono uppercase tracking-widest opacity-50">Receive</div>
                    <div className="text-xl font-mono font-bold">+{selectedNft.burnValue} CREDITS</div>
                  </div>
                  <button
                    onClick={handleBurn}
                    disabled={isBurning}
                    className={`h-16 px-8 rounded-xl font-display font-bold uppercase tracking-tighter text-lg flex items-center gap-3 transition-all ${isBurning ? 'bg-black/10 cursor-not-allowed' : 'bg-black text-white hover:scale-105 active:scale-95'}`}
                  >
                    {isBurning ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                          <Flame className="w-5 h-5" />
                        </motion.div>
                        Burning...
                      </>
                    ) : (
                      <>
                        Confirm Burn
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedNft(null)}
                    disabled={isBurning}
                    className="w-16 h-16 rounded-xl border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {activeTab === 'rewards' ? (
          <section id="redeem" className="mb-32">
            <div className="flex items-center justify-between mb-12">
              <h2 className="font-display text-4xl font-bold uppercase tracking-tighter">{websiteCopy.rewardsSectionTitle}</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                <Zap className="w-4 h-4" />
                USE CREDITS TO UNLOCK EXCLUSIVE ITEMS
              </div>
            </div>

            <div className="mb-8 rounded-2xl border border-white/15 bg-neutral-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/55">Manual Reward Claim</div>
                  <div className="mt-2 text-sm text-white/85">
                    {claimResponse?.ok
                      ? `Claim completed${claimResponse.claimedWithGateTokenId ? ` with gate token #${claimResponse.claimedWithGateTokenId}` : ''}.`
                      : gatePass
                        ? 'Sign once here to claim rewards.'
                        : 'Refresh gate access to claim rewards.'}
                  </div>
                </div>
                <button
                  onClick={onClaimRewards}
                  disabled={!gatePass || isClaimSigning || Boolean(claimResponse?.ok)}
                  className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-black disabled:opacity-50"
                >
                  {claimResponse?.ok
                    ? 'Rewards Claimed'
                    : isClaimSigning
                      ? 'Claiming...'
                      : 'Sign & Claim Rewards'}
                </button>
              </div>
              {claimError ? (
                <div className="mt-4 rounded-lg border border-red-600/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                  {claimError}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {MOCK_REWARDS.map((reward) => (
                <div key={reward.id} className="glass-panel rounded-3xl overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={reward.image}
                      alt={reward.name}
                      className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-8 flex-grow flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-display font-bold text-2xl uppercase tracking-tighter leading-none">{reward.name}</h3>
                      <div className="text-xs font-mono text-white/40">STOCK: {reward.stock}</div>
                    </div>
                    <p className="text-white/60 text-sm mb-8 leading-relaxed">{reward.description}</p>
                    <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                      <div className="font-mono text-xl font-bold">
                        {reward.cost} <span className="text-white/40 text-xs">CREDITS</span>
                      </div>
                      <button
                        onClick={() => handleRedeem(reward)}
                        disabled={balance < reward.cost}
                        className={`px-6 py-3 rounded-xl font-display font-bold uppercase tracking-tighter transition-all ${balance >= reward.cost ? 'bg-white text-black hover:scale-105 active:scale-95' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                      >
                        Redeem
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  const [gatePass, setGatePass] = useState('');
  const [claimResponse, setClaimResponse] = useState<ClaimResponse | null>(null);
  const [websiteCopy, setWebsiteCopy] = useState<WebsiteCopy>(DEFAULT_WEBSITE_COPY);
  const [entryMode, setEntryMode] = useState<'claim' | 'gate-only'>('claim');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGateSigning, setIsGateSigning] = useState(false);
  const [isClaimSigning, setIsClaimSigning] = useState(false);
  const [error, setError] = useState('');
  const [enteredWebsite, setEnteredWebsite] = useState(false);

  const claimedNfts = useMemo(
    () => expandClaimAllocationsToNfts(claimResponse?.allocations),
    [claimResponse?.allocations]
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchWebsiteCopy() {
      try {
        const response = await fetch('/api/website-config');
        const body = (await response.json().catch(() => ({}))) as WebsiteConfigResponse;
        if (!response.ok || !body.ok || !body.website) return;

        if (!cancelled) {
          setWebsiteCopy((prev) => ({
            ...prev,
            ...body.website
          }));
        }
      } catch {
        // Keep defaults if endpoint is unavailable.
      }
    }

    fetchWebsiteCopy();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setEntryMode('gate-only');
      setEnteredWebsite(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token gate signing failed';
      setError(message);
    } finally {
      setIsGateSigning(false);
    }
  }

  async function handleClaimSignature() {
    setError('');
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
        const claimError = String(body?.error || '').trim();
        throw new Error(claimError || 'Claim failed.');
      }

      setClaimResponse(body);
      setEntryMode('claim');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Claim signature failed';
      setError(message);
    } finally {
      setIsClaimSigning(false);
    }
  }

  const isConnected = Boolean(walletAddress);
  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

  if (enteredWebsite) {
    return (
      <BurnWebsite
        walletAddress={walletAddress}
        gatePass={gatePass}
        claimResponse={claimResponse}
        claimedNfts={claimedNfts}
        websiteCopy={websiteCopy}
        entryMode={entryMode}
        isClaimSigning={isClaimSigning}
        claimError={error}
        onClaimRewards={handleClaimSignature}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">{websiteCopy.accessTitle}</h1>
        <p className="mt-2 text-sm text-neutral-400">
          {websiteCopy.accessSubtitle}
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
            <div className="flex items-center gap-2">
              <LockKeyhole className="w-5 h-5 text-cyan-300" />
              <h2 className="text-lg font-semibold">{websiteCopy.step1Title}</h2>
            </div>
            <p className="text-sm text-neutral-400">{websiteCopy.step1Subtitle}</p>

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
                  disabled={isGateSigning || Boolean(gatePass)}
                  className="rounded-lg bg-emerald-300 px-4 py-2 font-semibold text-black disabled:opacity-50"
                >
                  {gatePass
                    ? 'Gate Access Verified'
                    : isGateSigning
                      ? 'Waiting for signature...'
                      : 'Sign Token-Gate Message'}
                </button>
              )}
            </div>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-600/40 bg-red-900/20 p-4 text-sm text-red-200">{error}</div>
        ) : null}

      </div>
    </div>
  );
}
