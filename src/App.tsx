import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Crown,
  ExternalLink,
  Flame,
  Info,
  Layers,
  LockKeyhole,
  Medal,
  Plus,
  RefreshCw,
  Sparkles,
  Shield,
  ShieldCheck,
  Target,
  Trophy,
  Wallet,
  X,
  Zap
} from 'lucide-react';
import { ethers } from 'ethers';
import { NFT } from './types';

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
  maxClaimsAllowed?: string;
  walletClaimCountBefore?: string;
  walletClaimCountAfter?: string;
  claimsRemainingAfter?: string;
  unclaimedGateTokenIdsOwned?: string[];
  allocations?: ClaimAllocation[];
  error?: string;
};

type BurnInventoryNft = {
  tokenId: string;
  quantity?: string | number;
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
  strategy?: string;
  nfts?: BurnInventoryNft[];
  error?: string;
};

type BurnRewardWin = {
  cid: string;
  tokenUri: string;
  imageUrl: string;
};

type BurnRewardResponse = {
  ok: boolean;
  burnedUnits?: number;
  creditsAwarded?: number;
  burnTxHash?: string;
  walletProgress?: WalletProgressSnapshot | null;
  claimableRewards?: number;
  unlockedRewards?: number;
  autoMintOnBurn?: boolean;
  progressionUpdatedAt?: string;
  wins?: BurnRewardWin[];
  error?: string;
};

type WalletProgressSnapshot = {
  address: string;
  burnUnits: number;
  points: number;
  unlockedRewards: number;
  claimedRewards: number;
  claimableRewards: number;
  tipCount?: number;
  tippedWei?: string;
  updatedAt?: string | null;
};

type LeaderboardProgressRow = {
  rank: number;
  address: string;
  points: number;
  burnUnits: number;
  unlockedRewards: number;
  claimedRewards: number;
  claimableRewards: number;
  updatedAt?: string | null;
};

type ProgressionBurnEvent = {
  address: string;
  burnTxHash: string;
  burnedUnits: number;
  creditsAwarded: number;
  burnMode: string;
  timestamp: string;
};

type ProgressionStatsResponse = {
  ok: boolean;
  wallet?: WalletProgressSnapshot | null;
  leaderboard?: LeaderboardProgressRow[];
  recentBurns?: ProgressionBurnEvent[];
  tipConfig?: {
    tipReceiverAddress?: string;
    tipPointsPerEth?: number;
    tipMinWei?: string;
  };
  updatedAt?: string | null;
  error?: string;
};

type TipPointsClaimResponse = {
  ok: boolean;
  alreadyProcessed?: boolean;
  tipTxHash?: string;
  tipWei?: string;
  tipEth?: string;
  pointsAwarded?: number;
  walletProgress?: WalletProgressSnapshot | null;
  progressionUpdatedAt?: string | null;
  tipConfig?: {
    tipReceiverAddress?: string;
    tipPointsPerEth?: number;
    tipMinWei?: string;
  };
  error?: string;
};

type ClaimUnlockedRewardsResponse = {
  ok: boolean;
  claimedUnits?: number;
  claimableBefore?: number;
  claimableAfter?: number;
  walletProgress?: WalletProgressSnapshot | null;
  progressionUpdatedAt?: string;
  rewardMutableNftContract?: string;
  mintTxHash?: string;
  wins?: BurnRewardWin[];
  mintedRewards?: Array<{ tokenId: string; tokenUri: string }>;
  error?: string;
};

type RewardCidGalleryItem = {
  index: number;
  label: string;
  cid: string;
  name?: string;
  description?: string;
  tokenUri: string;
  metadataUrl?: string;
  imageUrl: string;
};

type RewardCidGalleryResponse = {
  ok: boolean;
  total?: number;
  rewardMintEnabled?: boolean;
  rewardMutableNftContract?: string;
  items?: RewardCidGalleryItem[];
  error?: string;
};

type RewardCidMintResponse = {
  ok: boolean;
  cid?: string;
  tokenUri?: string;
  imageUrl?: string;
  tokenId?: string | null;
  mintTxHash?: string;
  rewardMutableNftContract?: string;
  error?: string;
};

type RedeemedRewardNft = {
  tokenId: string;
  name: string;
  description: string;
  tokenUri: string;
  metadataUrl: string;
  imageUrl: string;
  txHash: string;
  basescanUrl: string;
};

type RedeemedRewardsResponse = {
  ok: boolean;
  contractAddress?: string;
  total?: number;
  nfts?: RedeemedRewardNft[];
  error?: string;
};

type MonochromeNft = {
  id: string;
  name: string;
  description: string;
  image: string;
  rarity: 'Common' | 'Rare' | 'Legendary';
};

type MonochromeRedemption = {
  id: string;
  name: string;
  description: string;
  image: string;
  requiredBurnId: string;
};

type DestinyImage = {
  id: string;
  url: string;
  name: string;
};

type DestinyFortune = {
  title: string;
  description: string;
  attire: string;
};

type BurnChamberArtifact = {
  id: string;
  name: string;
  rarity: 'Artifact' | 'Legendary';
  description: string;
  image: string;
};

type NewWorldRewardTier = {
  id: string;
  name: string;
  image: string;
  requirement: number;
  description: string;
};

type KekCharacter = {
  id: number;
  name: string;
  trait: string;
  image: string;
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

type WebsiteUiConfig = {
  showHeroPanel: boolean;
  showEntryBanner: boolean;
  showFooter: boolean;
  showTabNfts: boolean;
  showTabRewards: boolean;
  showTabB2R: boolean;
  showTabBonfire: boolean;
  showTabForge: boolean;
  showTabBurnchamber: boolean;
  showTabNewworld: boolean;
  showTabTipstarter: boolean;
  showTabMonochrome: boolean;
  showTabDestiny: boolean;
  showTabKek: boolean;
  showTabLeaderboard: boolean;
};

type MainTabId =
  | 'nfts'
  | 'rewards'
  | 'b2r'
  | 'bonfire'
  | 'forge'
  | 'burnchamber'
  | 'newworld'
  | 'tipstarter'
  | 'monochrome'
  | 'destiny'
  | 'kek'
  | 'leaderboard';

type WebsiteConfigResponse = {
  ok: boolean;
  website?: Partial<WebsiteCopy>;
  ui?: Partial<WebsiteUiConfig>;
  error?: string;
};

type BurnWebsiteProps = {
  walletAddress: string;
  gatePass: string;
  claimResponse: ClaimResponse | null;
  websiteCopy: WebsiteCopy;
  websiteUi: WebsiteUiConfig;
  entryMode: 'claim' | 'gate-only';
  isClaimSigning: boolean;
  claimError: string;
  onClaimRewards: () => Promise<ClaimResponse>;
};

type RedeemedLimitOption = 6 | 12 | 24 | 40 | 80;

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
const REWARD_PREVIEW_WALLET = '0x0672700f90ce2aa72c68268219385e7e0c4a6418';
const BURN_CREDITS_PER_NFT = 20;
const BURN_TO_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const REWARD_SPIN_CARD_WIDTH = 172;
const DESTINY_REEL_ITEM_HEIGHT = 206;
const BURN_TRANSFER_ABI = [
  'function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)'
];
const GATE_SESSION_STORAGE_KEY = 'burn_to_redeem_gate_session_v1';

const DEFAULT_WEBSITE_COPY: WebsiteCopy = {
  brandName: 'Burn to Redeem',
  accessTitle: 'Burn to Redeem Access',
  accessSubtitle:
    'Sign once for token-gate access. Claim rewards later from the Redeemable Rewards tab inside the website.',
  step1Title: 'Step 1: Token-Gated Signature',
  step1Subtitle: 'Connect on Base and sign to prove ownership of the gate NFT.',
  step2Title: 'Step 2: Claim Rewards In Redeemable Rewards Tab',
  step2Subtitle: 'After entry, open Redeemable Rewards and sign to claim your random NFT allocation.',
  burnHeroSubtitle: 'Burn your claimed rewards to stack game credits and redeem new digital art.',
  nftsTabLabel: 'NFTS TO BURN',
  rewardsTabLabel: 'REDEEMABLE REWARDS',
  nftsSectionTitle: 'NFTS TO BURN',
  rewardsSectionTitle: 'Redeemable Rewards'
};

const DEFAULT_WEBSITE_UI: WebsiteUiConfig = {
  showHeroPanel: true,
  showEntryBanner: true,
  showFooter: true,
  showTabNfts: true,
  showTabRewards: true,
  showTabB2R: true,
  showTabBonfire: true,
  showTabForge: true,
  showTabBurnchamber: true,
  showTabNewworld: true,
  showTabTipstarter: true,
  showTabMonochrome: true,
  showTabDestiny: true,
  showTabKek: true,
  showTabLeaderboard: true
};

const B2R_FLOW = [
  {
    title: 'Acquire',
    description: 'Hold collectible NFTs in your wallet and select what you are ready to sacrifice.'
  },
  {
    title: 'Burn',
    description: 'Send NFTs to the burn address to remove supply and convert each burn into game credits.'
  },
  {
    title: 'Redeem',
    description: 'Use stacked credits in Redeemable Rewards to unlock new digital art from protocol drops.'
  }
];

const BONFIRE_MANIFESTO = [
  'In a world of infinite digital abundance, scarcity is the only truth.',
  'Every burn is permanent, on-chain, and measurable by the protocol.',
  'Participants choose between preserving history or creating future rarity.'
];

const BONFIRE_ROADMAP = [
  { phase: 'Phase 1', title: 'Genesis Collection Live', status: 'Live' },
  { phase: 'Phase 2', title: 'Bonfire Ritual Activation', status: 'Active' },
  { phase: 'Phase 3', title: 'Echo Drop Reveal', status: 'Upcoming' },
  { phase: 'Phase 4', title: 'Protocol Expansion', status: 'Locked' }
];

const MONOCHROME_MOCK_NFTS: MonochromeNft[] = [
  {
    id: '1',
    name: 'VOID-01',
    description: 'The first iteration of the void. Pure darkness.',
    image: 'https://picsum.photos/seed/void1/800/800?grayscale',
    rarity: 'Common'
  },
  {
    id: '2',
    name: 'VOID-02',
    description: 'A fracture in the silence. Something stirs.',
    image: 'https://picsum.photos/seed/void2/800/800?grayscale',
    rarity: 'Common'
  },
  {
    id: '3',
    name: 'ECLIPSE-X',
    description: 'The ultimate convergence of light and shadow.',
    image: 'https://picsum.photos/seed/eclipse/800/800?grayscale',
    rarity: 'Rare'
  },
  {
    id: '4',
    name: 'NULL-POINT',
    description: 'The center of everything and nothing.',
    image: 'https://picsum.photos/seed/null/800/800?grayscale',
    rarity: 'Legendary'
  }
];

const MONOCHROME_REDEMPTION_OPTIONS: MonochromeRedemption[] = [
  {
    id: 'r1',
    name: 'THE AWAKENING',
    description: 'Redeem your VOID NFT for a physical high-contrast print.',
    image: 'https://picsum.photos/seed/redeem1/800/800?grayscale',
    requiredBurnId: '1'
  },
  {
    id: 'r2',
    name: 'SILENT ECHO',
    description: 'Exchange your VOID-02 for a limited edition vinyl.',
    image: 'https://picsum.photos/seed/redeem2/800/800?grayscale',
    requiredBurnId: '2'
  },
  {
    id: 'r3',
    name: 'SOLARIS',
    description: 'The Rare Eclipse-X transforms into a digital sculpture.',
    image: 'https://picsum.photos/seed/redeem3/800/800?grayscale',
    requiredBurnId: '3'
  }
];

const DESTINY_DEFAULT_IMAGES: DestinyImage[] = [
  { id: 'd1', url: 'https://picsum.photos/seed/heaven/600/600', name: 'Celestial Gate' },
  { id: 'd2', url: 'https://picsum.photos/seed/hell/600/600', name: 'Inferno Core' },
  { id: 'd3', url: 'https://picsum.photos/seed/nature/600/600', name: 'Ancient Grove' },
  { id: 'd4', url: 'https://picsum.photos/seed/cyber/600/600', name: 'Neon Abyss' },
  { id: 'd5', url: 'https://picsum.photos/seed/space/600/600', name: 'Void Traveler' },
  { id: 'd6', url: 'https://picsum.photos/seed/ocean/600/600', name: 'Deep Tide' },
  { id: 'd7', url: 'https://picsum.photos/seed/desert/600/600', name: 'Solstice Sands' },
  { id: 'd8', url: 'https://picsum.photos/seed/mountain/600/600', name: 'Zenith Peak' }
];

const BURN_CHAMBER_ARTIFACTS: BurnChamberArtifact[] = [
  {
    id: 'bc-artifact-1',
    name: 'ECLIPSE_PRIME',
    rarity: 'Artifact',
    description: 'Born from the sacrifice of two voids.',
    image: 'https://picsum.photos/seed/forge1/800/800?grayscale'
  },
  {
    id: 'bc-artifact-2',
    name: 'NEBULA_CORE',
    rarity: 'Artifact',
    description: 'A cosmic anomaly forged in fire.',
    image: 'https://picsum.photos/seed/forge2/800/800?grayscale'
  },
  {
    id: 'bc-artifact-3',
    name: 'SINGULARITY',
    rarity: 'Legendary',
    description: 'The point of no return.',
    image: 'https://picsum.photos/seed/forge3/800/800?grayscale'
  }
];

const NEW_WORLD_REWARDS: NewWorldRewardTier[] = [
  {
    id: 'nwo-r1',
    name: 'THE MONOLITH',
    image: 'https://picsum.photos/seed/mono/800/800',
    requirement: 3,
    description: 'Physical 1/1 sculpture. Requires 3 VOID burns.'
  },
  {
    id: 'nwo-r2',
    name: 'GENESIS KEY',
    image: 'https://picsum.photos/seed/key/800/800',
    requirement: 1,
    description: 'Access to private protocol drops. Requires 1 VOID burn.'
  }
];

const KEK_SPIN_COST = 10;
const KEK_SPIN_ITEM_WIDTH = 208;
const KEK_SPIN_DURATION_MS = 4000;
const KEK_CHARACTERS: KekCharacter[] = [
  { id: 1, name: 'King Cat', trait: 'Royal', image: 'https://picsum.photos/seed/kingcat/600/600' },
  { id: 2, name: 'Tracksuit Rabbit', trait: 'Athletic', image: 'https://picsum.photos/seed/tracksuitrabbit/600/600' },
  { id: 3, name: 'Tactical Raccoon', trait: 'Security', image: 'https://picsum.photos/seed/tacticalraccoon/600/600' },
  { id: 4, name: 'One Love Sheep', trait: 'Peace', image: 'https://picsum.photos/seed/onelovesheep/600/600' },
  { id: 5, name: 'VR Zebra', trait: 'Digital', image: 'https://picsum.photos/seed/vrzebra/600/600' },
  { id: 6, name: 'Gambler Cheetah', trait: 'Risk', image: 'https://picsum.photos/seed/gamblercheetah/600/600' },
  { id: 7, name: 'Melting Frog', trait: 'Liquid', image: 'https://picsum.photos/seed/meltingfrog/600/600' },
  { id: 8, name: 'Security Mouse', trait: 'Guardian', image: 'https://picsum.photos/seed/securitymouse/600/600' }
];
const KEK_REEL_ITEMS: KekCharacter[] = Array.from({ length: KEK_CHARACTERS.length * 12 }, (_, index) => {
  return KEK_CHARACTERS[index % KEK_CHARACTERS.length];
});

const CLAIM_RITUAL_STEPS = [
  { label: 'Portal Warmup', hint: 'Syncing claim ritual effects' },
  { label: 'Wallet Signature', hint: 'Confirm the signature in wallet' },
  { label: 'Gate Verification', hint: 'Validating your gated access token' },
  { label: 'Reward Distribution', hint: 'Dispatching your reward allocation' }
] as const;

const BURN_RITUAL_STEPS = [
  { label: 'Wallet Ready', hint: 'Preparing burn transaction request' },
  { label: 'On-Chain Burn', hint: 'Confirm and send burn transaction' },
  { label: 'Confirmation', hint: 'Waiting for Base block confirmation' },
  { label: 'Protocol Index', hint: 'Recording burn, +20 credits, and unlocks' }
] as const;

const CLAIM_PARTICLES = [
  { left: '8%', top: '16%', delay: 0 },
  { left: '26%', top: '12%', delay: 0.25 },
  { left: '44%', top: '22%', delay: 0.4 },
  { left: '62%', top: '11%', delay: 0.55 },
  { left: '81%', top: '18%', delay: 0.75 },
  { left: '16%', top: '76%', delay: 0.15 },
  { left: '38%', top: '83%', delay: 0.35 },
  { left: '72%', top: '78%', delay: 0.65 }
] as const;

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

function buildCidMintMessage(address: string, chainId: number, issuedAt: number, gatePass: string, cid: string) {
  return [
    'Burn to Redeem CID Mint',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`,
    `CID: ${cid}`
  ].join('\n');
}

function buildUnlockClaimMessage(
  address: string,
  chainId: number,
  issuedAt: number,
  gatePass: string,
  claimUnits: number
) {
  return [
    'Burn to Redeem Unlock Claim',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`,
    `Claim Units: ${claimUnits}`
  ].join('\n');
}

function buildTipPointsMessage(
  address: string,
  chainId: number,
  issuedAt: number,
  gatePass: string,
  tipTxHash: string
) {
  return [
    'Burn to Redeem Tip Points',
    `Address: ${address.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    `Issued At: ${issuedAt}`,
    `Gate Pass: ${gatePass}`,
    `Tip Tx: ${tipTxHash.toLowerCase()}`
  ].join('\n');
}

function normalizeDestinyImageName(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Unknown Artifact';
  const withoutExtension = trimmed.replace(/\.[a-z0-9]+$/i, '');
  return withoutExtension || trimmed;
}

function generateDestinyFortune(name: string): DestinyFortune {
  const archetypes = [
    'Architect of Ruin',
    'Oracle of Static',
    'Keeper of Ember',
    'Harbinger of Light',
    'Warden of Echoes'
  ];
  const prophecyLines = [
    'Your path bends scarcity into legend. What you burn will return as myth.',
    'The reel has chosen momentum over mercy. Your next play expands the protocol.',
    'Signals converge around your wallet. Rare outcomes now favor decisive burns.',
    'The vault opens where discipline meets chaos. Hold focus and the drop appears.',
    'Old supply dissolves, new artifacts emerge. You are now in the ascension lane.'
  ];
  const attireLines = [
    'Obsidian cloak with neon-gold trim and mirrored visor.',
    'Monochrome armor with ash-silver crest and static halo.',
    'Void-tailored coat with sigil stitching and chrome gauntlets.',
    'Ceremonial tactical weave with carbon mask and bright edge piping.',
    'Dust-black mantle with fractured prism accents and runic cuffs.'
  ];

  const title = `${archetypes[Math.floor(Math.random() * archetypes.length)]}: ${name}`;
  const description = prophecyLines[Math.floor(Math.random() * prophecyLines.length)];
  const attire = attireLines[Math.floor(Math.random() * attireLines.length)];

  return { title, description, attire };
}

type StoredGateSession = {
  address: string;
  gatePass: string;
  expiresAt: number;
};

function readStoredGateSession() {
  try {
    const raw = window.localStorage.getItem(GATE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGateSession;
    if (!parsed?.address || !parsed?.gatePass || !Number.isFinite(parsed?.expiresAt)) return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeGateSession(address: string, gatePass: string, expiresInSeconds: number) {
  const expiresAt = Date.now() + Math.max(1, Number(expiresInSeconds || 0)) * 1000;
  const payload: StoredGateSession = {
    address: address.toLowerCase(),
    gatePass,
    expiresAt
  };
  try {
    window.localStorage.setItem(GATE_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore localStorage write errors.
  }
}

function clearGateSession() {
  try {
    window.localStorage.removeItem(GATE_SESSION_STORAGE_KEY);
  } catch {
    // Ignore localStorage removal errors.
  }
}

function rarityFromToken(tokenId: number): NFT['rarity'] {
  const mod = tokenId % 4;
  if (mod === 0) return 'Mythic';
  if (mod === 1) return 'Legendary';
  if (mod === 2) return 'Rare';
  return 'Common';
}

function burnValueFromToken() {
  return BURN_CREDITS_PER_NFT;
}

function parseQuantity(value: string | number | undefined) {
  const parsed = Number.parseInt(String(value || '1'), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function mapBurnInventoryToNfts(items: BurnInventoryNft[]): NFT[] {
  const byKey = new Map<string, NFT>();

  for (const item of items) {
    const tokenIdNum = Number.parseInt(String(item.tokenId || ''), 10);
    if (!Number.isInteger(tokenIdNum) || tokenIdNum < 0) continue;

    const contractAddress = String(item.contractAddress || '').toLowerCase();
    const tokenId = String(item.tokenId);
    const key = `${contractAddress}-${tokenId}`;
    const quantity = parseQuantity(item.quantity);

    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + quantity;
      continue;
    }

    byKey.set(key, {
      id: key,
      name: item.name || `TREASURE #${item.tokenId}`,
      collection: item.collectionName || item.collection || 'TREASURY_DROP',
      image: item.displayImageUrl || item.imageUrl || '',
      rarity: rarityFromToken(tokenIdNum),
        burnValue: burnValueFromToken(),
      quantity,
      tokenId,
      contractAddress
    });
  }

  return Array.from(byKey.values());
}

type SiteFooterProps = {
  className?: string;
};

function SiteFooter({ className = '' }: SiteFooterProps) {
  return (
    <footer className={`relative z-10 border-t border-white/10 bg-black/60 ${className}`.trim()}>
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm">
        <div className="font-mono text-white/70">© 2026 Burn to Redeem Protocol by Pierre ⌐◨-◨</div>
        <div className="flex items-center gap-4 font-mono text-white/70">
          <a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-white">
            Twitter
          </a>
          <a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-white">
            Discord
          </a>
          <a href="https://etherscan.io" target="_blank" rel="noreferrer" className="hover:text-white">
            Etherscan
          </a>
        </div>
      </div>
    </footer>
  );
}

function BurnWebsite({
  walletAddress,
  gatePass,
  claimResponse,
  websiteCopy,
  websiteUi,
  entryMode,
  isClaimSigning,
  claimError,
  onClaimRewards
}: BurnWebsiteProps) {
  const [isClaimPopupOpen, setIsClaimPopupOpen] = useState(false);
  const [claimPopupState, setClaimPopupState] = useState<'prep' | 'wallet' | 'processing' | 'success' | 'error'>('prep');
  const [claimPopupProgress, setClaimPopupProgress] = useState(0);
  const [claimPopupStep, setClaimPopupStep] = useState(0);
  const [claimPopupError, setClaimPopupError] = useState('');
  const [claimPopupTxHash, setClaimPopupTxHash] = useState('');
  const claimProgressTimerRef = useRef<number | null>(null);
  const [isBurnPopupOpen, setIsBurnPopupOpen] = useState(false);
  const [burnPopupState, setBurnPopupState] = useState<
    'prep' | 'wallet' | 'burning' | 'confirming' | 'indexing' | 'success' | 'error'
  >('prep');
  const [burnPopupProgress, setBurnPopupProgress] = useState(0);
  const [burnPopupStep, setBurnPopupStep] = useState(0);
  const [burnPopupError, setBurnPopupError] = useState('');
  const [burnPopupTxHash, setBurnPopupTxHash] = useState('');
  const [burnPopupClaimable, setBurnPopupClaimable] = useState(0);
  const burnProgressTimerRef = useRef<number | null>(null);
  const [userNfts, setUserNfts] = useState<NFT[]>([]);
  const [balance, setBalance] = useState(0);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [isBurning, setIsBurning] = useState(false);
  const [burnError, setBurnError] = useState('');
  const [burnDrops, setBurnDrops] = useState<BurnRewardWin[]>([]);
  const [burnedId, setBurnedId] = useState<string | null>(null);
  const [redeemedRewards, setRedeemedRewards] = useState<RedeemedRewardNft[]>([]);
  const [isRedeemedRewardsLoading, setIsRedeemedRewardsLoading] = useState(false);
  const [redeemedRewardsError, setRedeemedRewardsError] = useState('');
  const [rewardCollectionAddress, setRewardCollectionAddress] = useState('');
  const [redeemedRefreshNonce, setRedeemedRefreshNonce] = useState(0);
  const [redeemedLimit, setRedeemedLimit] = useState<RedeemedLimitOption>(24);
  const [rewardCidGallery, setRewardCidGallery] = useState<RewardCidGalleryItem[]>([]);
  const [isRewardCidGalleryLoading, setIsRewardCidGalleryLoading] = useState(false);
  const [rewardCidGalleryError, setRewardCidGalleryError] = useState('');
  const [rewardCidMintContract, setRewardCidMintContract] = useState('');
  const [rewardSpinIndex, setRewardSpinIndex] = useState(0);
  const [rewardSpinResultIndex, setRewardSpinResultIndex] = useState<number | null>(null);
  const [isRewardSpinRunning, setIsRewardSpinRunning] = useState(false);
  const [isRewardCidMinting, setIsRewardCidMinting] = useState(false);
  const [rewardCidMintError, setRewardCidMintError] = useState('');
  const [rewardCidMintSuccess, setRewardCidMintSuccess] = useState('');
  const [rewardCidMintTxHash, setRewardCidMintTxHash] = useState('');
  const [activeTab, setActiveTab] = useState<MainTabId>('nfts');
  const [walletProgress, setWalletProgress] = useState<WalletProgressSnapshot | null>(null);
  const [liveLeaderboardRows, setLiveLeaderboardRows] = useState<LeaderboardProgressRow[]>([]);
  const [recentBurns, setRecentBurns] = useState<ProgressionBurnEvent[]>([]);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [progressRefreshNonce, setProgressRefreshNonce] = useState(0);
  const [isClaimingUnlocked, setIsClaimingUnlocked] = useState(false);
  const [claimUnlockedError, setClaimUnlockedError] = useState('');
  const [claimUnlockedSuccess, setClaimUnlockedSuccess] = useState('');
  const [claimUnlockedTxHash, setClaimUnlockedTxHash] = useState('');
  const [isB2RCarouselOpen, setIsB2RCarouselOpen] = useState(false);
  const [isRewardsCarouselOpen, setIsRewardsCarouselOpen] = useState(false);
  const [rewardPreviewNfts, setRewardPreviewNfts] = useState<NFT[]>([]);
  const [isRewardPreviewLoading, setIsRewardPreviewLoading] = useState(false);
  const [rewardPreviewError, setRewardPreviewError] = useState('');
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [inventoryNote, setInventoryNote] = useState('');
  const [bonfireSelectedNft, setBonfireSelectedNft] = useState<NFT | null>(null);
  const [monochromeNfts, setMonochromeNfts] = useState<MonochromeNft[]>(MONOCHROME_MOCK_NFTS);
  const [monochromeSelectedNft, setMonochromeSelectedNft] = useState<MonochromeNft | null>(null);
  const [isMonochromeBurning, setIsMonochromeBurning] = useState(false);
  const [monochromeRedeemedItem, setMonochromeRedeemedItem] = useState<MonochromeRedemption | null>(null);
  const [showMonochromeSuccess, setShowMonochromeSuccess] = useState(false);
  const [forgeSlot1, setForgeSlot1] = useState<NFT | null>(null);
  const [forgeSlot2, setForgeSlot2] = useState<NFT | null>(null);
  const [isForgeBurning, setIsForgeBurning] = useState(false);
  const [isForgeSuccessOpen, setIsForgeSuccessOpen] = useState(false);
  const [forgeMintedPreview, setForgeMintedPreview] = useState<BurnRewardWin[]>([]);
  const [burnChamberSlot1, setBurnChamberSlot1] = useState<NFT | null>(null);
  const [burnChamberSlot2, setBurnChamberSlot2] = useState<NFT | null>(null);
  const [isBurnChamberForging, setIsBurnChamberForging] = useState(false);
  const [burnChamberArtifacts, setBurnChamberArtifacts] = useState<BurnChamberArtifact[]>(BURN_CHAMBER_ARTIFACTS);
  const [burnChamberLastArtifact, setBurnChamberLastArtifact] = useState<BurnChamberArtifact | null>(null);
  const [newWorldSelectedNft, setNewWorldSelectedNft] = useState<NFT | null>(null);
  const [newWorldToast, setNewWorldToast] = useState('');
  const [tipReceiverAddress, setTipReceiverAddress] = useState('');
  const [tipPointsPerEth, setTipPointsPerEth] = useState(20000);
  const [tipMinWei, setTipMinWei] = useState('1000000000000000');
  const [tipAmountEth, setTipAmountEth] = useState('0.01');
  const [isTipSubmitting, setIsTipSubmitting] = useState(false);
  const [tipSubmitError, setTipSubmitError] = useState('');
  const [tipSubmitSuccess, setTipSubmitSuccess] = useState('');
  const [tipSubmitTxHash, setTipSubmitTxHash] = useState('');
  const [destinyImages, setDestinyImages] = useState<DestinyImage[]>(DESTINY_DEFAULT_IMAGES);
  const [destinyGameState, setDestinyGameState] = useState<'idle' | 'spinning' | 'stopping' | 'result'>('idle');
  const [destinyReelIndex, setDestinyReelIndex] = useState(0);
  const [destinyTargetIndex, setDestinyTargetIndex] = useState<number | null>(null);
  const [destinyFortune, setDestinyFortune] = useState<DestinyFortune | null>(null);
  const [isDestinyFortuneLoading, setIsDestinyFortuneLoading] = useState(false);
  const [destinySpinCount, setDestinySpinCount] = useState(0);
  const [kekBalance, setKekBalance] = useState(1250);
  const [isKekSpinning, setIsKekSpinning] = useState(false);
  const [kekSpinOffset, setKekSpinOffset] = useState(0);
  const [kekResult, setKekResult] = useState<KekCharacter | null>(null);
  const [isKekMintModalOpen, setIsKekMintModalOpen] = useState(false);
  const bonfireScrollRef = useRef<HTMLDivElement | null>(null);
  const b2rCarouselScrollRef = useRef<HTMLDivElement | null>(null);
  const rewardsCarouselScrollRef = useRef<HTMLDivElement | null>(null);
  const destinyUploadInputRef = useRef<HTMLInputElement | null>(null);
  const rewardSpinAbortRef = useRef(false);
  const destinySpinAbortRef = useRef(false);
  const kekSpinAbortRef = useRef(false);
  const totalBurnableUnits = userNfts.reduce((sum, nft) => sum + (nft.quantity || 1), 0);
  const burnChamberSelectionCount = [burnChamberSlot1, burnChamberSlot2].filter(Boolean).length;
  const newWorldBurnCount = walletProgress?.burnUnits ?? 0;
  const tipCount = Number(walletProgress?.tipCount || 0);
  const tippedEth = (() => {
    try {
      return ethers.formatEther(BigInt(String(walletProgress?.tippedWei || '0')));
    } catch {
      return '0';
    }
  })();
  const tipMinEth = (() => {
    try {
      return ethers.formatEther(BigInt(String(tipMinWei || '0')));
    } catch {
      return '0';
    }
  })();
  const estimatedTipPoints = (() => {
    try {
      const value = ethers.parseEther(String(tipAmountEth || '0'));
      return Number((value * BigInt(Math.max(1, tipPointsPerEth))) / (10n ** 18n));
    } catch {
      return 0;
    }
  })();
  const rewardSpinStrip =
    rewardCidGallery.length > 0
      ? Array.from({ length: Math.max(60, rewardCidGallery.length * 24) }, (_, index) => {
          return rewardCidGallery[index % rewardCidGallery.length];
        })
      : [];
  const selectedRewardCid =
    rewardCidGallery.length > 0
      ? rewardCidGallery[((rewardSpinIndex % rewardCidGallery.length) + rewardCidGallery.length) % rewardCidGallery.length]
      : null;
  const destinyDisplayImages =
    destinyImages.length > 0
      ? Array.from({ length: Math.max(60, destinyImages.length * 20) }, (_, index) => {
          return destinyImages[index % destinyImages.length];
        })
      : [];
  const selectedDestinyImage =
    destinyImages.length > 0
      ? destinyImages[((destinyReelIndex % destinyImages.length) + destinyImages.length) % destinyImages.length]
      : null;
  const kekReelStrip = KEK_REEL_ITEMS;
  const monochromeBurnedCount = Math.max(0, MONOCHROME_MOCK_NFTS.length - monochromeNfts.length);
  const mintedRewardCount = walletProgress?.claimedRewards ?? redeemedRewards.length;
  const unlockedRewardCount = walletProgress?.unlockedRewards ?? 0;
  const claimableRewardCount = walletProgress?.claimableRewards ?? 0;
  const burnUnitsCount = walletProgress?.burnUnits ?? 0;
  const claimCompleted = Boolean(claimResponse?.ok);
  const claimsRemainingAfter = Number.parseInt(String(claimResponse?.claimsRemainingAfter || ''), 10);
  const hasMoreGateClaims = Number.isFinite(claimsRemainingAfter) && claimsRemainingAfter > 0;
  const progressionScore = walletProgress?.points ?? balance;
  const progressionLevel = Math.max(1, Math.floor(progressionScore / 500) + 1);
  const currentLevelStart = (progressionLevel - 1) * 500;
  const nextLevelTarget = progressionLevel * 500;
  const levelProgressPct =
    nextLevelTarget > currentLevelStart
      ? Math.min(100, Math.round(((progressionScore - currentLevelStart) / (nextLevelTarget - currentLevelStart)) * 100))
      : 0;
  const leaderboardRows =
    liveLeaderboardRows.length > 0
      ? liveLeaderboardRows.map((entry) => {
          const isUser = entry.address.toLowerCase() === walletAddress.toLowerCase();
          return {
            rank: entry.rank,
            name: isUser ? 'You' : shortAddress(entry.address),
            score: entry.points,
            badge: entry.claimableRewards > 0 ? 'Unlocked' : entry.claimedRewards > 0 ? 'Claimed' : 'Active',
            accent: isUser
          };
        })
      : [
          {
            rank: 1,
            name: 'You',
            score: progressionScore,
            badge: 'Live',
            accent: true
          }
        ];
  const userLeaderboardEntry = leaderboardRows.find((entry) => entry.accent);
  const newWorldToastVisible = Boolean(newWorldToast);
  const tabVisibility: Record<MainTabId, boolean> = {
    nfts: websiteUi.showTabNfts,
    rewards: websiteUi.showTabRewards,
    b2r: websiteUi.showTabB2R,
    bonfire: websiteUi.showTabBonfire,
    forge: websiteUi.showTabForge,
    burnchamber: websiteUi.showTabBurnchamber,
    newworld: websiteUi.showTabNewworld,
    tipstarter: websiteUi.showTabTipstarter,
    monochrome: websiteUi.showTabMonochrome,
    destiny: websiteUi.showTabDestiny,
    kek: websiteUi.showTabKek,
    leaderboard: websiteUi.showTabLeaderboard
  };
  const visibleTabs = (Object.keys(tabVisibility) as MainTabId[]).filter((tab) => tabVisibility[tab]);
  const tabButtons: Array<{ id: MainTabId; label: string; visible: boolean }> = [
    { id: 'nfts', label: websiteCopy.nftsTabLabel, visible: websiteUi.showTabNfts },
    { id: 'rewards', label: websiteCopy.rewardsTabLabel, visible: websiteUi.showTabRewards },
    { id: 'b2r', label: 'B2R', visible: websiteUi.showTabB2R },
    { id: 'bonfire', label: 'BONFIRE', visible: websiteUi.showTabBonfire },
    { id: 'forge', label: 'BURN TO FORGE', visible: websiteUi.showTabForge },
    { id: 'burnchamber', label: 'BURN CHAMBER', visible: websiteUi.showTabBurnchamber },
    { id: 'newworld', label: 'NEW WORLD ORDER', visible: websiteUi.showTabNewworld },
    { id: 'tipstarter', label: 'TIP YOUR FIRE STARTER', visible: websiteUi.showTabTipstarter },
    { id: 'monochrome', label: 'MONOCHROME', visible: websiteUi.showTabMonochrome },
    { id: 'destiny', label: 'DESTINY', visible: websiteUi.showTabDestiny },
    { id: 'kek', label: 'KEK', visible: websiteUi.showTabKek },
    { id: 'leaderboard', label: 'LEADERBOARD', visible: websiteUi.showTabLeaderboard }
  ];
  const missionRows = [
    {
      title: 'Burn Units',
      value: burnUnitsCount,
      target: 20
    },
    {
      title: 'Credits Stack',
      value: balance,
      target: 400
    },
    {
      title: 'Unlocked Rewards',
      value: unlockedRewardCount,
      target: 50
    },
    {
      title: 'Claimable Rewards',
      value: claimableRewardCount,
      target: 20
    }
  ];

  const stopClaimProgressTimer = () => {
    if (claimProgressTimerRef.current !== null) {
      window.clearInterval(claimProgressTimerRef.current);
      claimProgressTimerRef.current = null;
    }
  };

  const stopBurnProgressTimer = () => {
    if (burnProgressTimerRef.current !== null) {
      window.clearInterval(burnProgressTimerRef.current);
      burnProgressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopClaimProgressTimer();
      stopBurnProgressTimer();
    };
  }, []);

  useEffect(() => {
    if (tabVisibility[activeTab]) return;
    if (visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0]);
    }
  }, [activeTab, tabVisibility, visibleTabs]);

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
        query.set('all', '1');
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
            const uniqueCollections = new Set(
              fromOpenSea.map((entry) => String(entry.collection || '').trim().toLowerCase()).filter(Boolean)
            );
            setUserNfts(fromOpenSea);
            if (body.strategy === 'allowed-contracts') {
              setInventoryNote(
                `OpenSea synced ${fromOpenSea.length} NFT(s) across ${Math.max(1, uniqueCollections.size)} allowed collection(s).`
              );
            } else {
              setInventoryNote(
                BURN_COLLECTION_SLUG
                  ? `OpenSea synced ${fromOpenSea.length} NFT(s) from ${BURN_COLLECTION_SLUG}.`
                  : `OpenSea synced ${fromOpenSea.length} NFT(s) to burn.`
              );
            }
          } else {
            setUserNfts([]);
            if (body.strategy === 'allowed-contracts') {
              setInventoryNote('No burnable NFTs found across allowed collections for this wallet.');
            } else {
              setInventoryNote(
                BURN_COLLECTION_SLUG
                  ? `No NFTs from ${BURN_COLLECTION_SLUG} found in this wallet.`
                  : 'No burnable NFTs found on OpenSea for this wallet.'
              );
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'OpenSea inventory sync unavailable.';
          const isRateLimited = /rate limit|too many requests/i.test(message);
          if (!isRateLimited) {
            setUserNfts([]);
          }
          setInventoryNote(
            isRateLimited
              ? 'OpenSea is rate-limiting requests right now. Please retry in 20-60 seconds.'
              : message
          );
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

  useEffect(() => {
    let cancelled = false;

    async function fetchProgression() {
      if (!walletAddress) {
        if (!cancelled) {
          setWalletProgress(null);
          setLiveLeaderboardRows([]);
          setRecentBurns([]);
          setProgressError('');
          setBalance(0);
        }
        return;
      }

      setIsProgressLoading(true);
      setProgressError('');
      try {
        const query = new URLSearchParams();
        query.set('address', walletAddress);
        query.set('limit', '40');
        query.set('recent', '24');

        const response = await fetch(`/api/progression-stats?${query.toString()}`);
        const body = (await response.json().catch(() => ({}))) as ProgressionStatsResponse;
        if (!response.ok || !body.ok) {
          throw new Error(body.error || 'Failed to load progression stats.');
        }

        if (!cancelled) {
          setWalletProgress(body.wallet || null);
          setLiveLeaderboardRows(Array.isArray(body.leaderboard) ? body.leaderboard : []);
          setRecentBurns(Array.isArray(body.recentBurns) ? body.recentBurns : []);
          if (body.tipConfig) {
            setTipReceiverAddress(String(body.tipConfig.tipReceiverAddress || ''));
            setTipPointsPerEth(Number(body.tipConfig.tipPointsPerEth || 20000));
            setTipMinWei(String(body.tipConfig.tipMinWei || '1000000000000000'));
          }
          if (body.wallet && Number.isFinite(Number(body.wallet.points))) {
            setBalance(Number(body.wallet.points));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setProgressError(error instanceof Error ? error.message : 'Failed to load progression stats.');
        }
      } finally {
        if (!cancelled) setIsProgressLoading(false);
      }
    }

    fetchProgression();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, progressRefreshNonce]);

  useEffect(() => {
    if (activeTab !== 'monochrome') {
      setMonochromeSelectedNft(null);
      setIsMonochromeBurning(false);
      setShowMonochromeSuccess(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'forge') {
      setForgeSlot1(null);
      setForgeSlot2(null);
      setIsForgeBurning(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'burnchamber') {
      setBurnChamberSlot1(null);
      setBurnChamberSlot2(null);
      setIsBurnChamberForging(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'newworld') {
      setNewWorldSelectedNft(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'tipstarter') {
      setTipSubmitError('');
      setTipSubmitSuccess('');
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'destiny' && destinyGameState === 'spinning') {
      destinySpinAbortRef.current = true;
      setDestinyGameState('idle');
    }
  }, [activeTab, destinyGameState]);

  useEffect(() => {
    if (activeTab !== 'kek' && isKekSpinning) {
      kekSpinAbortRef.current = true;
      setIsKekSpinning(false);
    }
  }, [activeTab, isKekSpinning]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRedeemedRewards() {
      if (!walletAddress) {
        if (!cancelled) {
          setRedeemedRewards([]);
          setRedeemedRewardsError('');
          setRewardCollectionAddress('');
        }
        return;
      }

      setIsRedeemedRewardsLoading(true);
      setRedeemedRewardsError('');
      try {
        const query = new URLSearchParams();
        query.set('address', walletAddress);
        query.set('max', String(redeemedLimit));

        const response = await fetch(`/api/redeemed-nfts?${query.toString()}`);
        const body = (await response.json().catch(() => ({}))) as RedeemedRewardsResponse;
        if (!response.ok || !body.ok) {
          throw new Error(body.error || 'Failed to load redeemed NFTs.');
        }

        if (!cancelled) {
          setRedeemedRewards(body.nfts || []);
          setRewardCollectionAddress(String(body.contractAddress || ''));
        }
      } catch (error) {
        if (!cancelled) {
          setRedeemedRewards([]);
          setRedeemedRewardsError(error instanceof Error ? error.message : 'Failed to load redeemed NFTs.');
        }
      } finally {
        if (!cancelled) {
          setIsRedeemedRewardsLoading(false);
        }
      }
    }

    fetchRedeemedRewards();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, redeemedRefreshNonce, redeemedLimit]);

  useEffect(() => {
    return () => {
      rewardSpinAbortRef.current = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      destinySpinAbortRef.current = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      kekSpinAbortRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchRewardCidGallery() {
      if (activeTab !== 'rewards') return;

      setIsRewardCidGalleryLoading(true);
      setRewardCidGalleryError('');

      try {
        const response = await fetch('/api/reward-cid-gallery');
        const body = (await response.json().catch(() => ({}))) as RewardCidGalleryResponse;
        if (!response.ok || !body.ok) {
          throw new Error(body.error || 'Failed to load reward CIDs.');
        }

        if (!cancelled) {
          const items = Array.isArray(body.items) ? body.items : [];
          setRewardCidGallery(items);
          setRewardCidMintContract(String(body.rewardMutableNftContract || ''));
          if (items.length > 0) {
            setRewardSpinIndex(items.length * 4);
          } else {
            setRewardSpinIndex(0);
          }
          setRewardSpinResultIndex(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRewardCidGallery([]);
          setRewardCidMintContract('');
          setRewardSpinIndex(0);
          setRewardSpinResultIndex(null);
          setRewardCidGalleryError(error instanceof Error ? error.message : 'Failed to load reward CIDs.');
        }
      } finally {
        if (!cancelled) setIsRewardCidGalleryLoading(false);
      }
    }

    fetchRewardCidGallery();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleSpinRewardCarousel = async () => {
    if (isRewardSpinRunning || rewardCidGallery.length === 0) return;

    rewardSpinAbortRef.current = false;
    setRewardCidMintError('');
    setRewardCidMintSuccess('');
    setRewardCidMintTxHash('');
    setRewardSpinResultIndex(null);
    setIsRewardSpinRunning(true);

    const gallerySize = rewardCidGallery.length;
    let cursor = rewardSpinIndex;
    const currentIndex = ((cursor % gallerySize) + gallerySize) % gallerySize;
    const targetIndex = Math.floor(Math.random() * gallerySize);
    const loops = 5 + Math.floor(Math.random() * 4);
    const steps = loops * gallerySize + ((targetIndex - currentIndex + gallerySize) % gallerySize);

    try {
      for (let step = 0; step < steps; step += 1) {
        if (rewardSpinAbortRef.current) return;

        cursor += 1;
        setRewardSpinIndex(cursor);

        const progress = step / Math.max(1, steps - 1);
        const delayMs = progress < 0.55 ? 26 : progress < 0.82 ? 50 : progress < 0.94 ? 82 : 126;
        await wait(delayMs);
      }

      if (rewardSpinAbortRef.current) return;
      const anchored = gallerySize * 4 + ((cursor % gallerySize) + gallerySize) % gallerySize;
      setRewardSpinIndex(anchored);
      setRewardSpinResultIndex(((anchored % gallerySize) + gallerySize) % gallerySize);
    } finally {
      if (!rewardSpinAbortRef.current) {
        setIsRewardSpinRunning(false);
      }
    }
  };

  const handleMintSelectedRewardCid = async () => {
    if (!selectedRewardCid || !gatePass || isRewardSpinRunning || isRewardCidMinting) return;
    if (!window.ethereum) {
      setRewardCidMintError('No wallet detected.');
      return;
    }

    setRewardCidMintError('');
    setRewardCidMintSuccess('');
    setRewardCidMintTxHash('');
    setIsRewardCidMinting(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);

      if (currentChainId !== TARGET_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to Base (chain ${TARGET_CHAIN_ID}).`);
      }

      const issuedAt = Date.now();
      const message = buildCidMintMessage(
        address,
        currentChainId,
        issuedAt,
        gatePass,
        selectedRewardCid.cid
      );
      const signature = await signer.signMessage(message);

      const response = await fetch('/api/reward-cid-mint', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address,
          chainId: currentChainId,
          issuedAt,
          gatePass,
          cid: selectedRewardCid.cid,
          signature
        })
      });
      const body = (await response.json().catch(() => ({}))) as RewardCidMintResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Reward mint failed.');
      }

      const tokenIdSuffix = body.tokenId ? ` #${body.tokenId}` : '';
      setRewardCidMintSuccess(`Minted ${selectedRewardCid.label}${tokenIdSuffix}.`);
      setRewardCidMintTxHash(String(body.mintTxHash || ''));
      setRedeemedRefreshNonce((value) => value + 1);
    } catch (error) {
      setRewardCidMintError(error instanceof Error ? error.message : 'Reward mint failed.');
    } finally {
      setIsRewardCidMinting(false);
    }
  };

  const closeBurnPopup = () => {
    if (isBurning && burnPopupState !== 'success' && burnPopupState !== 'error') return;
    stopBurnProgressTimer();
    setIsBurnPopupOpen(false);
  };

  const handleBurn = async (overrideNft?: NFT): Promise<BurnRewardResponse | null> => {
    const burnTarget = overrideNft || selectedNft;
    if (!burnTarget) return null;
    if (!burnTarget.contractAddress || !burnTarget.tokenId) {
      setBurnError('Missing contract or token ID for this NFT.');
      return null;
    }
    if (!window.ethereum) {
      setBurnError('No wallet detected for burn transaction.');
      return null;
    }

    stopBurnProgressTimer();
    setBurnPopupError('');
    setBurnPopupTxHash('');
    setBurnPopupClaimable(0);
    setBurnPopupStep(0);
    setBurnPopupProgress(8);
    setBurnPopupState('wallet');
    setIsBurnPopupOpen(true);

    setIsBurning(true);
    setBurnError('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const sender = await signer.getAddress();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== TARGET_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to Base (chain ${TARGET_CHAIN_ID}).`);
      }

      setBurnPopupState('burning');
      setBurnPopupStep(1);
      setBurnPopupProgress(28);

      const burnContract = new ethers.Contract(burnTarget.contractAddress, BURN_TRANSFER_ABI, signer);
      const tokenId = BigInt(burnTarget.tokenId);
      let tx;

      try {
        tx = await burnContract[
          'safeTransferFrom(address,address,uint256,uint256,bytes)'
        ](sender, BURN_TO_ADDRESS, tokenId, 1n, '0x');
      } catch {
        try {
          tx = await burnContract[
            'safeTransferFrom(address,address,uint256)'
          ](sender, BURN_TO_ADDRESS, tokenId);
        } catch {
          tx = await burnContract[
            'transferFrom(address,address,uint256)'
          ](sender, BURN_TO_ADDRESS, tokenId);
        }
      }

      setBurnPopupTxHash(tx.hash);
      setBurnPopupState('confirming');
      setBurnPopupStep(2);
      setBurnPopupProgress(55);
      burnProgressTimerRef.current = window.setInterval(() => {
        setBurnPopupProgress((value) => {
          if (value >= 90) return value;
          return Math.min(90, value + 2 + Math.floor(Math.random() * 4));
        });
      }, 240);

      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new Error('Burn transaction failed.');
      }

      stopBurnProgressTimer();
      setBurnPopupState('indexing');
      setBurnPopupStep(3);
      setBurnPopupProgress(86);

      setBurnedId(burnTarget.id);
      setBalance((prev) => prev + BURN_CREDITS_PER_NFT);

      setUserNfts((prev) => {
        const next = [];
        for (const nft of prev) {
          if (nft.id !== burnTarget.id) {
            next.push(nft);
            continue;
          }

          const currentQuantity = nft.quantity || 1;
          const updatedQuantity = currentQuantity - 1;
          if (updatedQuantity > 0) {
            next.push({ ...nft, quantity: updatedQuantity });
          }
        }
        return next;
      });

      setSelectedNft((prev) => {
        if (!prev || prev.id !== burnTarget.id) return prev;
        const currentQuantity = prev.quantity || 1;
        const updatedQuantity = currentQuantity - 1;
        return updatedQuantity > 0 ? { ...prev, quantity: updatedQuantity } : null;
      });
      setBonfireSelectedNft((prev) => {
        if (!prev || prev.id !== burnTarget.id) return prev;
        const currentQuantity = prev.quantity || 1;
        const updatedQuantity = currentQuantity - 1;
        return updatedQuantity > 0 ? { ...prev, quantity: updatedQuantity } : null;
      });

      const dropResponse = await fetch('/api/burn-reward', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address: sender,
          burnTxHash: tx.hash,
          contractAddress: burnTarget.contractAddress
        })
      });
      const dropBody = (await dropResponse.json().catch(() => ({}))) as BurnRewardResponse;
      if (!dropResponse.ok || !dropBody.ok) {
        throw new Error(dropBody.error || 'Burn reward indexing failed.');
      }

      if (Array.isArray(dropBody.wins) && dropBody.wins.length > 0) {
        setBurnDrops((prev) => [...dropBody.wins!, ...prev].slice(0, 30));
      }

      if (dropBody.walletProgress) {
        setWalletProgress(dropBody.walletProgress);
        if (Number.isFinite(Number(dropBody.walletProgress.points))) {
          setBalance(Number(dropBody.walletProgress.points));
        }
      } else if (Number.isFinite(Number(dropBody.creditsAwarded))) {
        setBalance((prev) => prev + Number(dropBody.creditsAwarded || 0) - BURN_CREDITS_PER_NFT);
      }

      setBurnPopupClaimable(Number(dropBody.claimableRewards || dropBody.walletProgress?.claimableRewards || 0));
      setBurnPopupProgress(100);
      setBurnPopupState('success');
      setProgressRefreshNonce((value) => value + 1);
      setRedeemedRefreshNonce((value) => value + 1);
      return dropBody;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Burn failed.';
      stopBurnProgressTimer();
      setBurnError(message);
      setBurnPopupState('error');
      setBurnPopupError(message);
      setBurnPopupProgress((value) => Math.max(value, 42));
      return null;
    } finally {
      setIsBurning(false);
      setTimeout(() => setBurnedId(null), 600);
    }
  };

  const handleClaimUnlockedRewards = async () => {
    if (!gatePass || isClaimingUnlocked || !window.ethereum) return;

    setClaimUnlockedError('');
    setClaimUnlockedSuccess('');
    setClaimUnlockedTxHash('');
    setIsClaimingUnlocked(true);

    try {
      const claimableRewards = Math.max(0, Number(walletProgress?.claimableRewards || 0));
      if (claimableRewards <= 0) {
        throw new Error('No unlocked rewards available yet. Burn NFTs to unlock rewards first.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);

      if (currentChainId !== TARGET_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to Base (chain ${TARGET_CHAIN_ID}).`);
      }

      const issuedAt = Date.now();
      const claimUnits = Math.min(claimableRewards, 20);
      const message = buildUnlockClaimMessage(address, currentChainId, issuedAt, gatePass, claimUnits);
      const signature = await signer.signMessage(message);

      const response = await fetch('/api/claim-unlocked-rewards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address,
          chainId: currentChainId,
          issuedAt,
          gatePass,
          claimUnits,
          signature
        })
      });
      const body = (await response.json().catch(() => ({}))) as ClaimUnlockedRewardsResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Unlocked reward claim failed.');
      }

      if (body.walletProgress) {
        setWalletProgress(body.walletProgress);
        setBalance(Number(body.walletProgress.points || 0));
      }
      setClaimUnlockedSuccess(`Claimed ${body.claimedUnits || 0} unlocked reward NFT(s).`);
      setClaimUnlockedTxHash(String(body.mintTxHash || ''));
      if (Array.isArray(body.wins) && body.wins.length > 0) {
        setBurnDrops((prev) => [...body.wins!, ...prev].slice(0, 30));
      }
      setProgressRefreshNonce((value) => value + 1);
      setRedeemedRefreshNonce((value) => value + 1);
    } catch (error) {
      setClaimUnlockedError(error instanceof Error ? error.message : 'Unlocked reward claim failed.');
    } finally {
      setIsClaimingUnlocked(false);
    }
  };

  const handleBurnChamberSelect = (nft: NFT) => {
    if (isBurnChamberForging || isBurning) return;

    if (burnChamberSlot1?.id === nft.id) {
      setBurnChamberSlot1(null);
      return;
    }
    if (burnChamberSlot2?.id === nft.id) {
      setBurnChamberSlot2(null);
      return;
    }

    const selectedCount = [burnChamberSlot1, burnChamberSlot2].filter((slot) => slot?.id === nft.id).length;
    const maxSelectable = Math.max(1, Number(nft.quantity || 1));
    if (selectedCount >= maxSelectable) return;

    if (!burnChamberSlot1) {
      setBurnChamberSlot1(nft);
      return;
    }
    if (!burnChamberSlot2) {
      setBurnChamberSlot2(nft);
      return;
    }
    setBurnChamberSlot2(nft);
  };

  const handleBurnChamberForge = async () => {
    if (!burnChamberSlot1 || !burnChamberSlot2 || isBurnChamberForging || isBurning) return;

    setIsBurnChamberForging(true);
    const collectedWins: BurnRewardWin[] = [];

    try {
      const first = await handleBurn(burnChamberSlot1);
      if (!first) throw new Error('First sacrifice failed.');
      if (Array.isArray(first.wins) && first.wins.length > 0) {
        collectedWins.push(...first.wins);
      }
      await wait(250);

      const second = await handleBurn(burnChamberSlot2);
      if (!second) throw new Error('Second sacrifice failed.');
      if (Array.isArray(second.wins) && second.wins.length > 0) {
        collectedWins.push(...second.wins);
      }

      const mintedArtifacts: BurnChamberArtifact[] =
        collectedWins.length > 0
          ? collectedWins.map((win, index) => ({
              id: `burn-chamber-${Date.now()}-${index}`,
              name: `FORGED_${String(win.cid || '').slice(0, 6).toUpperCase()}`,
              rarity: 'Artifact',
              description: 'A fresh relic minted from the Burn Chamber ritual.',
              image: win.imageUrl
            }))
          : [
              {
                ...BURN_CHAMBER_ARTIFACTS[Math.floor(Math.random() * BURN_CHAMBER_ARTIFACTS.length)],
                id: `burn-chamber-fallback-${Date.now()}`
              }
            ];

      setBurnChamberArtifacts((prev) => [...mintedArtifacts, ...prev].slice(0, 30));
      setBurnChamberLastArtifact(mintedArtifacts[0] || null);
      setBurnChamberSlot1(null);
      setBurnChamberSlot2(null);
    } catch (error) {
      setBurnError(error instanceof Error ? error.message : 'Burn Chamber ritual failed.');
    } finally {
      setIsBurnChamberForging(false);
    }
  };

  const handleNewWorldBurn = async () => {
    if (!newWorldSelectedNft || isBurning) return;
    const burnedName = newWorldSelectedNft.name;
    const result = await handleBurn(newWorldSelectedNft);
    if (!result) return;

    setNewWorldSelectedNft(null);
    setNewWorldToast(`${burnedName} was purified. +${BURN_CREDITS_PER_NFT} credits added.`);
    window.setTimeout(() => setNewWorldToast(''), 3200);
  };

  const handleTipStarter = async () => {
    if (!window.ethereum || !gatePass || isTipSubmitting) return;

    setTipSubmitError('');
    setTipSubmitSuccess('');
    setTipSubmitTxHash('');
    setIsTipSubmitting(true);

    try {
      const receiver = String(tipReceiverAddress || '').trim();
      if (!receiver) {
        throw new Error('Tip receiver wallet is not configured.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const currentChainId = Number(network.chainId);
      if (currentChainId !== TARGET_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to Base (chain ${TARGET_CHAIN_ID}).`);
      }

      const amountEth = String(tipAmountEth || '').trim();
      if (!amountEth) {
        throw new Error('Enter an ETH amount to tip.');
      }

      const tipWei = ethers.parseEther(amountEth);
      if (tipWei <= 0n) {
        throw new Error('Tip amount must be greater than zero.');
      }

      const minWei = BigInt(String(tipMinWei || '0'));
      if (tipWei < minWei) {
        throw new Error(`Tip must be at least ${tipMinEth} ETH.`);
      }

      const tx = await signer.sendTransaction({
        to: receiver,
        value: tipWei
      });

      setTipSubmitTxHash(tx.hash);
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new Error('Tip transaction failed.');
      }

      const issuedAt = Date.now();
      const message = buildTipPointsMessage(address, currentChainId, issuedAt, gatePass, tx.hash);
      const signature = await signer.signMessage(message);

      const response = await fetch('/api/progression-stats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address,
          chainId: currentChainId,
          issuedAt,
          gatePass,
          tipTxHash: tx.hash,
          signature
        })
      });
      const body = (await response.json().catch(() => ({}))) as TipPointsClaimResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Tip points claim failed.');
      }

      if (body.walletProgress) {
        setWalletProgress(body.walletProgress);
        if (Number.isFinite(Number(body.walletProgress.points))) {
          setBalance(Number(body.walletProgress.points));
        }
      }
      if (body.tipConfig) {
        setTipReceiverAddress(String(body.tipConfig.tipReceiverAddress || receiver));
        setTipPointsPerEth(Number(body.tipConfig.tipPointsPerEth || tipPointsPerEth));
        setTipMinWei(String(body.tipConfig.tipMinWei || tipMinWei));
      }

      setProgressRefreshNonce((value) => value + 1);
      setTipSubmitSuccess(
        body.alreadyProcessed
          ? 'Tip already processed for points.'
          : `Tip confirmed. +${Number(body.pointsAwarded || 0)} points added.`
      );
      setTipSubmitTxHash(String(body.tipTxHash || tx.hash));
    } catch (error) {
      setTipSubmitError(error instanceof Error ? error.message : 'Tip submission failed.');
    } finally {
      setIsTipSubmitting(false);
    }
  };

  const handleForgeSelect = (nft: NFT) => {
    if (isForgeBurning || isBurning) return;
    const selectedCount = [forgeSlot1, forgeSlot2].filter((slot) => slot?.id === nft.id).length;
    const maxSelectable = Math.max(1, Number(nft.quantity || 1));
    if (selectedCount >= maxSelectable) return;
    if (!forgeSlot1) {
      setForgeSlot1(nft);
      return;
    }
    if (!forgeSlot2) {
      setForgeSlot2(nft);
    }
  };

  const handleForgeBurn = async () => {
    if (!forgeSlot1 || !forgeSlot2 || isForgeBurning || isBurning) return;

    setIsForgeBurning(true);
    const collectedWins: BurnRewardWin[] = [];

    try {
      const first = await handleBurn(forgeSlot1);
      if (!first) throw new Error('First burn did not complete.');
      if (Array.isArray(first.wins) && first.wins.length > 0) {
        collectedWins.push(...first.wins);
      }
      setForgeSlot1(null);

      await wait(300);

      const second = await handleBurn(forgeSlot2);
      if (!second) throw new Error('Second burn did not complete.');
      if (Array.isArray(second.wins) && second.wins.length > 0) {
        collectedWins.push(...second.wins);
      }
      setForgeSlot2(null);
      setForgeMintedPreview(collectedWins.slice(0, 6));
      setIsForgeSuccessOpen(true);
    } catch (error) {
      setBurnError(error instanceof Error ? error.message : 'Forge burn failed.');
    } finally {
      setIsForgeBurning(false);
    }
  };

  const handleMonochromeBurn = async (nft: MonochromeNft) => {
    if (isMonochromeBurning) return;

    setIsMonochromeBurning(true);
    await wait(2500);

    const redemption = MONOCHROME_REDEMPTION_OPTIONS.find((entry) => entry.requiredBurnId === nft.id) || null;

    setMonochromeNfts((prev) => prev.filter((entry) => entry.id !== nft.id));
    setIsMonochromeBurning(false);
    setMonochromeSelectedNft(null);

    if (redemption) {
      setMonochromeRedeemedItem(redemption);
      setShowMonochromeSuccess(true);
    }
  };

  const openDestinyUpload = () => {
    destinyUploadInputRef.current?.click();
  };

  const handleDestinyUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const uploaded: DestinyImage[] = Array.from(files).map((file, index) => ({
      id: `destiny-local-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      name: normalizeDestinyImageName(file.name)
    }));

    setDestinyImages(uploaded);
    setDestinyGameState('idle');
    setDestinyFortune(null);
    setDestinyTargetIndex(null);
    setDestinyReelIndex(uploaded.length * 4);

    event.target.value = '';
  };

  const handleDestinySpin = async () => {
    if (destinyGameState === 'spinning' || destinyGameState === 'stopping' || destinyImages.length === 0) return;

    destinySpinAbortRef.current = false;
    setDestinySpinCount((value) => value + 1);
    setDestinyFortune(null);
    setIsDestinyFortuneLoading(false);
    setDestinyGameState('spinning');

    const imageCount = destinyImages.length;
    const startIndex = ((destinyReelIndex % imageCount) + imageCount) % imageCount;
    const winnerIndex = Math.floor(Math.random() * imageCount);
    setDestinyTargetIndex(winnerIndex);

    const loops = 6 + Math.floor(Math.random() * 4);
    const totalSteps = loops * imageCount + ((winnerIndex - startIndex + imageCount) % imageCount);
    let cursor = destinyReelIndex;

    for (let step = 0; step < totalSteps; step += 1) {
      if (destinySpinAbortRef.current) return;

      cursor += 1;
      setDestinyReelIndex(cursor);

      const progress = step / Math.max(1, totalSteps - 1);
      const delayMs = progress < 0.62 ? 24 : progress < 0.84 ? 48 : progress < 0.95 ? 80 : 126;
      await wait(delayMs);
    }

    if (destinySpinAbortRef.current) return;

    const anchored = imageCount * 4 + winnerIndex;
    setDestinyReelIndex(anchored);
    setDestinyGameState('stopping');
    await wait(260);
    if (destinySpinAbortRef.current) return;

    setDestinyGameState('result');
    setIsDestinyFortuneLoading(true);
    await wait(700);
    if (destinySpinAbortRef.current) return;

    const winner = destinyImages[winnerIndex] || selectedDestinyImage;
    setDestinyFortune(generateDestinyFortune(winner?.name || 'Unknown Artifact'));
    setIsDestinyFortuneLoading(false);
  };

  const handleKekSpin = async () => {
    if (isKekSpinning || kekBalance < KEK_SPIN_COST) return;

    kekSpinAbortRef.current = false;
    setIsKekSpinning(true);
    setKekResult(null);
    setIsKekMintModalOpen(false);
    setKekBalance((value) => Math.max(0, value - KEK_SPIN_COST));
    setKekSpinOffset(0);
    await wait(40);

    const winnerIndex = Math.floor(Math.random() * KEK_CHARACTERS.length);
    const loops = 5 + Math.floor(Math.random() * 3);
    const totalSteps = loops * KEK_CHARACTERS.length + winnerIndex;
    setKekSpinOffset(-(totalSteps * KEK_SPIN_ITEM_WIDTH));

    await wait(KEK_SPIN_DURATION_MS + 120);
    if (kekSpinAbortRef.current) return;

    setIsKekSpinning(false);
    setKekResult(KEK_CHARACTERS[winnerIndex]);
    setIsKekMintModalOpen(true);
  };

  const scrollBonfire = (direction: 'left' | 'right') => {
    const container = bonfireScrollRef.current;
    if (!container) return;
    const step = Math.max(260, Math.floor(container.clientWidth * 0.65));
    const target = direction === 'left' ? container.scrollLeft - step : container.scrollLeft + step;
    container.scrollTo({ left: target, behavior: 'smooth' });
  };

  const scrollB2RCarousel = (direction: 'left' | 'right') => {
    const container = b2rCarouselScrollRef.current;
    if (!container) return;
    const step = Math.max(260, Math.floor(container.clientWidth * 0.7));
    const delta = direction === 'left' ? -step : step;
    container.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const openB2RCarousel = () => {
    setIsRewardsCarouselOpen(false);
    setIsB2RCarouselOpen(true);
    window.setTimeout(() => {
      const container = b2rCarouselScrollRef.current;
      if (!container) return;
      container.scrollTo({ left: container.scrollWidth, behavior: 'instant' as ScrollBehavior });
    }, 50);
  };

  const scrollRewardsCarousel = (direction: 'left' | 'right') => {
    const container = rewardsCarouselScrollRef.current;
    if (!container) return;
    const step = Math.max(260, Math.floor(container.clientWidth * 0.7));
    const delta = direction === 'left' ? -step : step;
    container.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const openRewardsCarousel = () => {
    setIsB2RCarouselOpen(false);
    setIsRewardsCarouselOpen(true);
    setIsRewardPreviewLoading(true);
    setRewardPreviewError('');
    setRewardPreviewNfts([]);

    fetch(
      `/api/nfts-to-burn?address=${encodeURIComponent(REWARD_PREVIEW_WALLET)}&max=2000&all=1`
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as BurnInventoryResponse;
        if (!response.ok || !body.ok) {
          throw new Error(body.error || 'Failed to load reward wallet holdings.');
        }
        setRewardPreviewNfts(mapBurnInventoryToNfts(body.nfts || []));
      })
      .catch((error) => {
        setRewardPreviewError(
          error instanceof Error ? error.message : 'Failed to load reward wallet holdings.'
        );
      })
      .finally(() => {
        setIsRewardPreviewLoading(false);
      });

    window.setTimeout(() => {
      const container = rewardsCarouselScrollRef.current;
      if (!container) return;
      container.scrollTo({ left: container.scrollWidth, behavior: 'auto' });
    }, 50);
  };

  const handleClaimRewardsInteractive = async () => {
    if (!gatePass || isClaimSigning) return;

    stopClaimProgressTimer();
    setClaimPopupError('');
    setClaimPopupTxHash('');
    setClaimPopupStep(0);
    setClaimPopupProgress(6);
    setClaimPopupState('prep');
    setIsClaimPopupOpen(true);

    await wait(220);
    setClaimPopupProgress(18);
    setClaimPopupState('wallet');
    setClaimPopupStep(1);

    await wait(280);
    setClaimPopupState('processing');
    setClaimPopupProgress(30);
    setClaimPopupStep(2);

    claimProgressTimerRef.current = window.setInterval(() => {
      setClaimPopupProgress((value) => {
        if (value >= 92) return value;
        const next = Math.min(92, value + 2 + Math.floor(Math.random() * 7));
        if (next >= 76) {
          setClaimPopupStep(3);
        } else if (next >= 48) {
          setClaimPopupStep(2);
        }
        return next;
      });
    }, 220);

    try {
      const result = await onClaimRewards();
      stopClaimProgressTimer();
      setClaimPopupStep(CLAIM_RITUAL_STEPS.length - 1);
      setClaimPopupProgress(100);
      setClaimPopupState('success');
      setClaimPopupTxHash(String(result.txHash || ''));
    } catch (error) {
      stopClaimProgressTimer();
      setClaimPopupState('error');
      setClaimPopupProgress((value) => Math.max(value, 48));
      setClaimPopupError(error instanceof Error ? error.message : 'Claim failed.');
    }
  };

  const closeClaimPopup = () => {
    if (isClaimSigning && claimPopupState !== 'error') return;
    stopClaimProgressTimer();
    setIsClaimPopupOpen(false);
  };

  return (
    <div className="min-h-screen font-sans selection:bg-white selection:text-black relative overflow-hidden">
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

      <main className="pt-28 md:pt-32 pb-14 sm:pb-16 md:pb-20 px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
        <section className="mb-6 sm:mb-8 md:mb-10">
          <div className="glass-panel rounded-2xl p-2.5 sm:p-3">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {tabButtons
                .filter((tab) => tab.visible)
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-mono uppercase tracking-[0.14em] rounded-lg border ${
                      activeTab === tab.id
                        ? 'bg-white text-black border-white'
                        : 'bg-black/40 text-white/70 border-white/20 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
          </div>
        </section>

        <section className="mb-8 sm:mb-10 md:mb-12">
          <div
            className={`grid gap-4 sm:gap-5 md:gap-6 ${
              websiteUi.showHeroPanel ? 'lg:grid-cols-[1.15fr_0.85fr]' : ''
            }`}
          >
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.12),transparent_45%),linear-gradient(145deg,rgba(20,20,22,0.9),rgba(8,8,9,0.95))] p-6 sm:p-7 md:p-10 lg:p-12">
              <div className="absolute -right-20 top-0 h-60 w-60 rounded-full bg-white/10 blur-[110px]" />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-5xl sm:text-6xl md:text-8xl font-black leading-[0.82] tracking-tighter uppercase"
              >
                Burn <br />
                <span className="text-white/25">to</span> <br />
                Redeem
              </motion.h1>
              <p className="mt-5 sm:mt-6 md:mt-7 max-w-lg text-lg sm:text-xl leading-relaxed text-white/68">
                {websiteCopy.burnHeroSubtitle}
              </p>
            </div>

            {websiteUi.showHeroPanel ? (
              <div className="grid gap-4">
                <div className="glass-panel rounded-3xl p-5 sm:p-6 md:p-7">
                  <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-[0.16em] text-white/45">
                    <Shield className="h-4 w-4" />
                    Protocol Status
                  </div>
                  <div className="mt-4 sm:mt-5 flex items-end justify-between">
                    <div>
                      <div className="font-display text-4xl sm:text-5xl font-black">ACTIVE</div>
                      <div className="mt-2 text-xs font-mono uppercase tracking-[0.14em] text-white/45">
                        Network: Base Mainnet
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-4xl sm:text-5xl font-black">{totalBurnableUnits}</div>
                      <div className="mt-2 text-xs font-mono uppercase tracking-[0.14em] text-white/45">Burnable Units</div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel rounded-3xl p-4 sm:p-5 md:p-6">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Credits</div>
                      <div className="mt-2 font-display text-3xl font-bold">{balance}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Wallet</div>
                      <div className="mt-2 text-sm font-mono text-white/80">{shortAddress(walletAddress)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {websiteUi.showEntryBanner ? (
          <section className="mb-8 sm:mb-10 md:mb-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-neutral-950/95 via-black/80 to-neutral-900/70 p-4 sm:p-5 md:p-7">
              <div className="absolute -right-10 -top-8 h-28 w-28 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -left-10 -bottom-8 h-24 w-24 rounded-full bg-cyan-300/10 blur-3xl" />
              {entryMode === 'claim' ? (
                <>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-200">
                    <Check className="h-3.5 w-3.5" />
                    Claim Confirmed
                  </div>
                  <div className="mt-3 text-base text-white/90">
                    {claimResponse?.rewardNftsPerClaim || 0} reward NFTs claimed from treasury.
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/75">
                    <Flame className="h-3.5 w-3.5" />
                    Sacrifice the many for the one.
                  </div>
                  <div className="mt-3 max-w-5xl text-[12px] leading-relaxed text-white/88 md:text-sm">
                    The ultimate sacrifice for digital evolution. Destroy the past to claim the future. A deflationary
                    art experiment on the edge of the void.
                  </div>
                </>
              )}
            </div>
          </section>
        ) : null}

        {visibleTabs.length === 0 ? (
          <section className="mb-16">
            <div className="glass-panel rounded-3xl p-8 text-center text-sm text-white/70">
              All website tabs are hidden in admin settings. Re-enable at least one tab to show page content.
            </div>
          </section>
        ) : null}

        {websiteUi.showTabNfts && activeTab === 'nfts' ? (
          <section id="gallery" className="mb-20 md:mb-24">
            <div className="mb-5 sm:mb-7 md:mb-8 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tighter">{websiteCopy.nftsSectionTitle}</h2>
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
              <div className="mb-4 sm:mb-6 rounded-xl border border-neutral-700/70 bg-neutral-900/70 px-4 py-3 text-xs font-mono text-neutral-300">
                {inventoryNote}
              </div>
            ) : null}

            {burnError ? (
              <div className="mb-4 sm:mb-6 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs font-mono text-red-200">
                {burnError}
              </div>
            ) : null}

            {userNfts.length === 0 ? (
              <div className="glass-panel rounded-3xl p-16 text-center text-white/50">
                No burnable NFTs found for this wallet.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5">
                <AnimatePresence mode="popLayout">
                  {userNfts.map((nft, index) => {
                    const hoverRotate = index % 2 === 0 ? -1.4 : 1.4;
                    return (
                      <motion.div
                        key={nft.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{
                          opacity: burnedId === nft.id ? 0 : 1,
                          scale: burnedId === nft.id ? 1.05 : 1
                        }}
                        whileHover={{ y: -10, rotate: hoverRotate, scale: 1.02 }}
                        whileTap={{ scale: 0.985, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => !isBurning && setSelectedNft(nft)}
                        className={`group relative cursor-pointer rounded-2xl overflow-hidden brutalist-border bg-black/55 shadow-[0_12px_30px_rgba(0,0,0,0.45)] ${selectedNft?.id === nft.id ? 'border-white ring-2 ring-white/20' : ''}`}
                      >
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.18),transparent_52%)]" />
                          <div className="absolute inset-x-6 bottom-0 h-20 bg-cyan-300/15 blur-2xl" />
                        </div>
                        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-neutral-950 to-neutral-900 p-3">
                          {nft.image ? (
                            <img
                              src={nft.image}
                              alt={nft.name}
                              className="h-full w-full rounded-xl object-cover ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-[1.06]"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center text-xs text-neutral-400 font-mono uppercase">
                              No Image
                            </div>
                          )}
                        </div>

                        <div className="relative p-3 sm:p-4 border-t border-white/10">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-display font-bold text-sm leading-tight mb-1">{nft.name}</h3>
                              <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{nft.collection}</p>
                            </div>
                            <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-mono uppercase">x{nft.quantity || 1}</div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2">
                              <Flame className="w-4 h-4 text-white/50" />
                              <span className="font-mono text-sm font-bold">
                                {nft.burnValue} <span className="text-white/40">CREDITS</span>
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
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        ) : null}

        <AnimatePresence>
          {websiteUi.showTabNfts && selectedNft && activeTab === 'nfts' ? (
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
                      <img src={selectedNft.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                    <div className="text-xl font-mono font-bold">+{BURN_CREDITS_PER_NFT} CREDITS</div>
                    <div className="text-[10px] font-mono uppercase opacity-50 mt-1">
                      Remaining: {selectedNft.quantity || 1}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleBurn()}
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

        {websiteUi.showTabRewards && activeTab === 'rewards' ? (
          <section id="redeem" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-12 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tighter">{websiteCopy.rewardsSectionTitle}</h2>
              <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                <Zap className="w-4 h-4" />
                LIVE REDEEMED NFTS FROM YOUR BURNS
              </div>
            </div>

            <div className="mb-8 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-cyan-100/80">Unlocked Reward Queue</div>
                  <div className="mt-2 text-sm text-white/85">
                    Every burn unlocks reward mints automatically. Claim from this queue whenever you want.
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-100/80">
                    <span className="rounded-lg border border-cyan-300/30 bg-black/30 px-2.5 py-1">
                      Burn Units: {burnUnitsCount}
                    </span>
                    <span className="rounded-lg border border-cyan-300/30 bg-black/30 px-2.5 py-1">
                      Unlocked: {unlockedRewardCount}
                    </span>
                    <span className="rounded-lg border border-cyan-300/30 bg-black/30 px-2.5 py-1">
                      Claimable Now: {claimableRewardCount}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => void handleClaimUnlockedRewards()}
                  disabled={!gatePass || isClaimingUnlocked || claimableRewardCount <= 0}
                  className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-black disabled:opacity-45"
                >
                  {isClaimingUnlocked ? 'Claiming...' : 'Claim Unlocked Rewards'}
                </button>
              </div>
              {claimUnlockedError ? (
                <div className="mt-4 rounded-lg border border-red-600/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                  {claimUnlockedError}
                </div>
              ) : null}
              {claimUnlockedSuccess ? (
                <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
                  {claimUnlockedSuccess}
                  {claimUnlockedTxHash ? (
                    <a
                      href={`https://basescan.org/tx/${claimUnlockedTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 underline"
                    >
                      View tx
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mb-8 rounded-2xl border border-white/15 bg-neutral-900/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/55">CID Reward Spin Vault</div>
                  <div className="mt-2 max-w-3xl text-sm text-white/82">
                    Spin the carousel through your 5 CID reward images, land on one, then mint it or keep spinning.
                  </div>
                </div>
                <div className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-right">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Mint Contract</div>
                  <div className="mt-1 font-mono text-[11px] text-white/75">
                    {rewardCidMintContract || rewardCollectionAddress || 'Not configured'}
                  </div>
                </div>
              </div>

              {isRewardCidGalleryLoading ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs font-mono text-white/60">
                  Loading reward CID gallery...
                </div>
              ) : null}

              {rewardCidGalleryError ? (
                <div className="mt-5 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs font-mono text-red-200">
                  {rewardCidGalleryError}
                </div>
              ) : null}

              {!isRewardCidGalleryLoading && !rewardCidGalleryError && rewardCidGallery.length > 0 ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
                    {rewardCidGallery.map((item, index) => {
                      const isActive = selectedRewardCid?.cid === item.cid;
                      return (
                        <div
                          key={`cid-gallery-${item.cid}-${index}`}
                          className={`overflow-hidden rounded-xl border bg-black/35 ${
                            isActive ? 'border-cyan-300/70 ring-1 ring-cyan-200/35' : 'border-white/15'
                          }`}
                        >
                          <div className="aspect-square bg-neutral-950 p-2">
                            <img
                              src={item.imageUrl}
                              alt={item.label}
                              className="h-full w-full rounded-lg object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="border-t border-white/10 px-3 py-2">
                            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/48">{item.label}</div>
                            <div className="mt-1 truncate font-display text-xs font-bold uppercase tracking-tight text-white/90">
                              {item.name || item.cid}
                            </div>
                            <div className="mt-1 truncate font-mono text-[11px] text-white/70">{item.cid}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-black/35 p-3">
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-neutral-950/70 py-3">
                      <div className="pointer-events-none absolute inset-y-1 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-cyan-200/80 shadow-[0_0_25px_rgba(34,211,238,0.9)]" />
                      <motion.div
                        className="flex items-center gap-3 px-3"
                        animate={{
                          x: `calc(50% - ${(rewardSpinIndex + 0.5) * REWARD_SPIN_CARD_WIDTH}px)`
                        }}
                        transition={{
                          duration: isRewardSpinRunning ? 0.08 : 0.3,
                          ease: isRewardSpinRunning ? 'linear' : [0.22, 1, 0.36, 1]
                        }}
                      >
                        {rewardSpinStrip.map((item, index) => {
                          const isCenter = index === rewardSpinIndex;
                          return (
                            <div
                              key={`reward-spin-${item.cid}-${index}`}
                              style={{ width: REWARD_SPIN_CARD_WIDTH }}
                              className={`flex-shrink-0 overflow-hidden rounded-lg border bg-black/45 transition-all ${
                                isCenter ? 'border-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.35)]' : 'border-white/15'
                              }`}
                            >
                              <div className="h-24 w-full bg-neutral-900 p-2">
                                <img
                                  src={item.imageUrl}
                                  alt={item.label}
                                  className="h-full w-full rounded-md object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="border-t border-white/10 px-2.5 py-2">
                                <div className="text-[10px] font-mono uppercase tracking-[0.13em] text-white/50">
                                  {item.label}
                                </div>
                                <div className="mt-1 truncate font-display text-[11px] font-bold uppercase tracking-tight text-white/90">
                                  {item.name || item.cid}
                                </div>
                                <div className="mt-1 truncate font-mono text-[10px] text-white/65">{item.cid}</div>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => void handleSpinRewardCarousel()}
                      disabled={isRewardSpinRunning || isRewardCidMinting}
                      className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-cyan-100 hover:bg-cyan-300/25 disabled:opacity-45"
                    >
                      {isRewardSpinRunning ? 'Spinning...' : rewardSpinResultIndex === null ? 'Spin Fast' : 'Continue Spinning'}
                    </button>
                    <button
                      onClick={() => void handleMintSelectedRewardCid()}
                      disabled={
                        !gatePass ||
                        rewardSpinResultIndex === null ||
                        !selectedRewardCid ||
                        isRewardSpinRunning ||
                        isRewardCidMinting
                      }
                      className="rounded-lg bg-white px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-black disabled:opacity-45"
                    >
                      {isRewardCidMinting ? 'Minting...' : 'Mint Selected'}
                    </button>
                    <div className="text-xs font-mono uppercase tracking-[0.13em] text-white/60">
                      {selectedRewardCid ? `Current: ${selectedRewardCid.name || selectedRewardCid.label}` : 'Spin to select a CID reward'}
                    </div>
                  </div>

                  {selectedRewardCid?.description ? (
                    <div className="mt-3 rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-xs text-white/70">
                      {selectedRewardCid.description}
                    </div>
                  ) : null}

                  {rewardCidMintError ? (
                    <div className="mt-4 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs font-mono text-red-200">
                      {rewardCidMintError}
                    </div>
                  ) : null}

                  {rewardCidMintSuccess ? (
                    <div className="mt-4 rounded-xl border border-emerald-600/50 bg-emerald-900/20 px-4 py-3 text-xs font-mono text-emerald-200">
                      {rewardCidMintSuccess}
                      {rewardCidMintTxHash ? (
                        <a
                          href={`https://basescan.org/tx/${rewardCidMintTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 underline"
                        >
                          View tx
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="mb-8 rounded-2xl border border-white/15 bg-neutral-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/55">Manual Reward Claim</div>
                  <div className="mt-2 text-sm text-white/85">
                    {claimResponse?.ok
                      ? `Claim completed${claimResponse.claimedWithGateTokenId ? ` with gate token #${claimResponse.claimedWithGateTokenId}` : ''}.${hasMoreGateClaims ? ` ${claimsRemainingAfter} gate claim(s) remaining.` : ''}`
                      : gatePass
                        ? 'Sign once here to claim rewards.'
                        : 'Refresh gate access to claim rewards.'}
                  </div>
                </div>
                <button
                  onClick={() => void handleClaimRewardsInteractive()}
                  disabled={!gatePass || isClaimSigning}
                  className="rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-black disabled:opacity-50"
                >
                  {isClaimSigning
                    ? 'Claiming...'
                    : claimResponse?.ok
                      ? hasMoreGateClaims
                        ? `Claim Again (${claimsRemainingAfter} left)`
                        : 'Claim Again'
                      : 'Sign & Claim Rewards'}
                </button>
              </div>
              {claimError ? (
                <div className="mt-4 rounded-lg border border-red-600/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                  {claimError}
                </div>
              ) : null}
            </div>

            {burnDrops.length > 0 ? (
              <div className="mb-8 rounded-2xl border border-white/15 bg-neutral-900/70 p-5">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/55 mb-4">Burn Drop Wins</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {burnDrops.map((drop, index) => (
                    <a
                      key={`${drop.cid}-${index}`}
                      href={drop.tokenUri || drop.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-lg border border-white/10 bg-black/40 px-4 py-3 hover:border-white/25 transition-colors"
                    >
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">CID</div>
                      <div className="mt-1 truncate font-mono text-sm text-white/85">{drop.cid}</div>
                      <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-300/80">
                        Open Metadata
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-5 rounded-2xl border border-white/12 bg-neutral-900/60 px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Reward Contract</div>
              <div className="mt-1 font-mono text-xs text-white/80 break-all">
                {rewardCollectionAddress || 'Not configured'}
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-neutral-900/40 px-4 py-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/50">
                Sort: Newest First
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Show Last</label>
                <select
                  value={redeemedLimit}
                  onChange={(event) => setRedeemedLimit(Number(event.target.value) as RedeemedLimitOption)}
                  className="rounded-lg border border-white/20 bg-black/60 px-2.5 py-1.5 text-xs font-mono text-white"
                >
                  <option value={6}>6</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={40}>40</option>
                  <option value={80}>80</option>
                </select>
                <button
                  onClick={() => setRedeemedRefreshNonce((value) => value + 1)}
                  className="rounded-lg border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/80 hover:text-white"
                >
                  Refresh
                </button>
              </div>
            </div>

            {isRedeemedRewardsLoading ? (
              <div className="glass-panel rounded-3xl p-10 text-center text-white/60">Loading redeemed NFTs...</div>
            ) : null}

            {redeemedRewardsError ? (
              <div className="mb-6 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs font-mono text-red-200">
                {redeemedRewardsError}
              </div>
            ) : null}

            {!isRedeemedRewardsLoading && !redeemedRewardsError && redeemedRewards.length === 0 ? (
              <div className="glass-panel rounded-3xl p-10 text-center text-white/55">
                No redeemed burn NFTs found for this wallet yet.
              </div>
            ) : null}

            {redeemedRewards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
                {redeemedRewards.map((nft) => (
                  <div key={`${nft.tokenId}-${nft.txHash}`} className="glass-panel rounded-3xl overflow-hidden flex flex-col">
                    <div className="aspect-square bg-neutral-950 border-b border-white/10">
                      {nft.imageUrl ? (
                        <img
                          src={nft.imageUrl}
                          alt={nft.name}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs font-mono uppercase text-white/35">
                          No Image
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-display text-2xl font-bold uppercase tracking-tight">{nft.name}</h3>
                        <div className="text-[10px] font-mono uppercase text-white/45">#{nft.tokenId}</div>
                      </div>

                      {nft.description ? <p className="text-sm text-white/65 leading-relaxed">{nft.description}</p> : null}

                      <div className="mt-1 flex flex-wrap gap-2">
                        {nft.metadataUrl ? (
                          <a
                            href={nft.metadataUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/75 hover:text-white"
                          >
                            Metadata
                          </a>
                        ) : null}
                        {nft.basescanUrl ? (
                          <a
                            href={nft.basescanUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-200"
                          >
                            Mint Tx
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {websiteUi.showTabB2R && activeTab === 'b2r' ? (
          <section id="b2r" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-5">
              <div className="glass-panel rounded-3xl p-6 md:p-8 xl:col-span-3">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">B2R Protocol</div>
                <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  Burn Assets.
                  <br />
                  Rebuild Value.
                </h2>
                <p className="mt-5 max-w-2xl text-white/70 leading-relaxed">
                  B2R is the core loop: each burn is permanent, each sacrifice increases scarcity, and every burn
                  converts into spendable game credits for future digital art.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {websiteUi.showTabNfts ? (
                    <button
                      onClick={openB2RCarousel}
                      className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-white hover:bg-white hover:text-black transition-colors"
                    >
                      Open NFTs To Burn
                    </button>
                  ) : null}
                  {websiteUi.showTabRewards ? (
                    <button
                      onClick={openRewardsCarousel}
                      className="rounded-lg border border-white/20 bg-black/40 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-white/80 hover:text-white"
                    >
                      Open Redeemable Rewards
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:gap-4 xl:col-span-2">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Burnable Units</div>
                  <div className="mt-2 font-display text-4xl font-bold">{totalBurnableUnits}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Current Credits</div>
                  <div className="mt-2 font-display text-4xl font-bold">{balance}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Reward Mode</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">
                    Guaranteed unlock + 20 credits per burn
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:gap-5 md:grid-cols-3">
              {B2R_FLOW.map((item, index) => (
                <div key={item.title} className="glass-panel rounded-2xl p-5 md:p-6">
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">
                    Step {index + 1}
                  </div>
                  <div className="mt-3 font-display text-2xl font-bold uppercase tracking-tight">{item.title}</div>
                  <p className="mt-3 text-sm text-white/70 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {websiteUi.showTabBonfire && activeTab === 'bonfire' ? (
          <section id="bonfire" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-5">
              <div className="glass-panel rounded-3xl p-6 md:p-8 xl:col-span-3">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Bonfire Ritual</div>
                <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  Sacrifice.
                  <br />
                  Transform.
                </h2>
                <p className="mt-5 max-w-2xl text-white/70 leading-relaxed">
                  Imported from your BONFIRE design: choose a Genesis piece, burn it on-chain, and convert scarcity
                  into credits and rewards.
                </p>
              </div>

              <div className="grid gap-3 md:gap-4 xl:col-span-2">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Selected Offering</div>
                  <div className="mt-2 font-display text-2xl font-bold uppercase">
                    {bonfireSelectedNft ? bonfireSelectedNft.name : 'None'}
                  </div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Burn Value</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">
                    {bonfireSelectedNft ? `+${BURN_CREDITS_PER_NFT} credits` : 'Select an NFT'}
                  </div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Collection</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">{BURN_COLLECTION_SLUG || 'cc0-by-pierre'}</div>
                </div>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight">The Genesis Collection</h3>
                <p className="mt-2 text-xs font-mono uppercase tracking-[0.16em] text-white/45">
                  Pick an NFT to stage it in the Bonfire portal
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => scrollBonfire('left')}
                  disabled={userNfts.length === 0}
                  className="rounded-full border border-white/15 p-3 text-white/75 hover:bg-white/10 disabled:opacity-30"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => scrollBonfire('right')}
                  disabled={userNfts.length === 0}
                  className="rounded-full border border-white/15 p-3 text-white/75 hover:bg-white/10 disabled:opacity-30"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {userNfts.length === 0 ? (
              <div className="glass-panel rounded-3xl p-16 text-center text-white/50">
                No burnable NFTs found for this wallet.
              </div>
            ) : (
              <div ref={bonfireScrollRef} className="mb-12 flex gap-5 overflow-x-auto pb-2 no-scrollbar">
                {userNfts.map((nft) => (
                  <motion.button
                    key={`bonfire-${nft.id}`}
                    whileHover={{ y: -6 }}
                    onClick={() => setBonfireSelectedNft(nft)}
                    className={`group relative min-w-[250px] md:min-w-[300px] overflow-hidden rounded-2xl border bg-black/50 text-left ${
                      bonfireSelectedNft?.id === nft.id ? 'border-white/70' : 'border-white/20'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden bg-gradient-to-br from-neutral-950 to-neutral-900 p-3">
                      {nft.image ? (
                        <img
                          src={nft.image}
                          alt={nft.name}
                          className="h-full w-full rounded-xl object-cover ring-1 ring-white/10 transition-all duration-500 group-hover:scale-[1.03]"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/40">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4">
                      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/55">{nft.collection}</div>
                      <div className="mt-1 font-display text-xl font-bold uppercase tracking-tight">{nft.name}</div>
                      <div className="mt-2 text-xs font-mono uppercase text-white/70">x{nft.quantity || 1}</div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            <div className="grid gap-5 md:gap-6 lg:grid-cols-2">
              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <div className="grid gap-5 md:gap-6 md:grid-cols-[220px_1fr]">
                  <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
                    {bonfireSelectedNft?.image ? (
                      <img
                        src={bonfireSelectedNft.image}
                        alt={bonfireSelectedNft.name}
                        className={`h-full w-full object-cover transition-all duration-500 ${isBurning ? 'blur-sm scale-105' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-white/40">
                        <Plus className="h-9 w-9" />
                        <div className="text-[10px] font-mono uppercase tracking-[0.16em]">
                          Select an NFT to begin the ritual
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-3xl font-black uppercase tracking-tight">The Burn Portal</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/68">
                      Burning permanently removes supply. In exchange, each burn grants game credits and unlocks a
                      claimable CID reward in your dashboard.
                    </p>

                    <div className="mt-5 space-y-3">
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                        <Zap className="h-4 w-4 text-white/55" />
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Reward Value</div>
                          <div className="text-sm font-mono">+{BURN_CREDITS_PER_NFT} Credits</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                        <RefreshCw className="h-4 w-4 text-white/55" />
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Drop Logic</div>
                          <div className="text-sm font-mono">Guaranteed unlock per burn</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={() => void handleBurn(bonfireSelectedNft || undefined)}
                        disabled={!bonfireSelectedNft || isBurning}
                        className="rounded-xl bg-white px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.1em] text-black transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isBurning ? 'Processing...' : 'Initiate Burn'}
                      </button>
                      <button
                        onClick={() => {
                          if (!bonfireSelectedNft) return;
                          setSelectedNft(bonfireSelectedNft);
                          setActiveTab('nfts');
                        }}
                        disabled={!bonfireSelectedNft || isBurning}
                        className="rounded-xl border border-white/20 bg-black/30 px-5 py-3 text-xs font-mono uppercase tracking-[0.14em] text-white/80 hover:text-white disabled:opacity-40"
                      >
                        Open Burn Queue
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <h3 className="font-display text-3xl font-black uppercase tracking-tight">The Art of Destruction</h3>
                <div className="mt-6 space-y-4">
                  {BONFIRE_MANIFESTO.map((line, index) => (
                    <div key={line} className="flex gap-4">
                      <div className="pt-0.5 text-[10px] font-mono uppercase tracking-[0.16em] text-white/35">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <p className="text-sm leading-relaxed text-white/70">{line}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-2xl border border-white/12 bg-black/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-white/45">
                    <ShieldCheck className="h-4 w-4" />
                    Bonfire Roadmap
                  </div>
                  <div className="mt-4 space-y-3">
                    {BONFIRE_ROADMAP.map((item) => (
                      <div key={item.phase} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/40">{item.phase}</div>
                          <div className="font-display text-base font-bold uppercase tracking-tight">{item.title}</div>
                        </div>
                        <div
                          className={`rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] ${
                            item.status === 'Live' || item.status === 'Active'
                              ? 'bg-white text-black'
                              : 'border border-white/30 text-white/70'
                          }`}
                        >
                          {item.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {websiteUi.showTabForge && activeTab === 'forge' ? (
          <section id="burn-to-forge" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="glass-panel rounded-3xl p-6 md:p-8">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Burn to Forge</div>
                <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  Burn Two.
                  <br />
                  Forge New.
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/72">
                  Imported from your latest zip: stage two NFTs, run the ritual, and process two burns in sequence.
                  Each burn awards +20 points and unlocks rewards in your dashboard.
                </p>
              </div>

              <div className="grid gap-3 md:gap-4">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Slot Progress</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">
                    {forgeSlot1 ? 'Slot 1 ready' : 'Slot 1 empty'} / {forgeSlot2 ? 'Slot 2 ready' : 'Slot 2 empty'}
                  </div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Burn Rewards</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">+40 points after full forge cycle</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Claimable Queue</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">{claimableRewardCount} unlocked</div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
              {[forgeSlot1, forgeSlot2].map((slot, index) => {
                const slotNumber = index + 1;
                return (
                  <div key={`forge-slot-${slotNumber}`} className="glass-panel rounded-3xl p-5 md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
                        Input Slot {String(slotNumber).padStart(2, '0')}
                      </div>
                      {slot ? (
                        <button
                          onClick={() => (slotNumber === 1 ? setForgeSlot1(null) : setForgeSlot2(null))}
                          className="text-[10px] font-mono uppercase tracking-[0.14em] text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="aspect-square overflow-hidden rounded-2xl border border-dashed border-white/20 bg-black/30 p-3">
                      {slot ? (
                        <div className="h-full w-full overflow-hidden rounded-xl border border-white/10 bg-neutral-950">
                          {slot.image ? (
                            <img
                              src={slot.image}
                              alt={slot.name}
                              className="h-full w-full object-cover grayscale"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                              No Image
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-white/35">
                          <Plus className="h-8 w-8" />
                          <div className="text-[10px] font-mono uppercase tracking-[0.16em]">Select NFT</div>
                        </div>
                      )}
                    </div>
                    {slot ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                        <div className="font-display text-xl font-bold uppercase tracking-tight">{slot.name}</div>
                        <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                          {slot.collection} • x{slot.quantity || 1}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="flex items-center justify-center lg:px-2">
                <button
                  onClick={() => void handleForgeBurn()}
                  disabled={!forgeSlot1 || !forgeSlot2 || isForgeBurning || isBurning}
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full border transition-all ${
                    forgeSlot1 && forgeSlot2 && !isForgeBurning && !isBurning
                      ? 'border-white/70 bg-white text-black shadow-[0_0_32px_rgba(255,255,255,0.35)]'
                      : 'border-white/20 bg-white/10 text-white/45'
                  }`}
                >
                  {isForgeBurning || isBurning ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                      <RefreshCw className="h-8 w-8" />
                    </motion.div>
                  ) : (
                    <Flame className="h-8 w-8" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display text-3xl font-bold uppercase tracking-tight">Forge Inventory</h3>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                  Tap cards to load slot 1 then slot 2
                </div>
              </div>
              {userNfts.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 text-center text-white/55">
                  No burnable NFTs available for forge mode.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {userNfts.map((nft) => {
                    const selectedCount = [forgeSlot1, forgeSlot2].filter((slot) => slot?.id === nft.id).length;
                    const maxSelectable = Math.max(1, Number(nft.quantity || 1));
                    const isSelected = selectedCount >= maxSelectable;
                    return (
                      <motion.button
                        key={`forge-inventory-${nft.id}`}
                        whileHover={{ y: -6 }}
                        onClick={() => handleForgeSelect(nft)}
                        disabled={isSelected || isForgeBurning || isBurning}
                        className={`group overflow-hidden rounded-2xl border bg-black/45 text-left transition-all ${
                          isSelected ? 'border-white/65 opacity-45' : 'border-white/15 hover:border-white/45'
                        }`}
                      >
                        <div className="aspect-square overflow-hidden border-b border-white/10 bg-neutral-950 p-3">
                          {nft.image ? (
                            <img
                              src={nft.image}
                              alt={nft.name}
                              className="h-full w-full rounded-xl object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                              No Image
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="font-display text-lg font-bold uppercase tracking-tight">{nft.name}</div>
                          <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                            {nft.collection} • x{nft.quantity || 1}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : null}

        <AnimatePresence>
          {isForgeSuccessOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 px-4"
              onClick={() => setIsForgeSuccessOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.97 }}
                className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-neutral-950 p-6 sm:p-7"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">Forge Result</div>
                <h3 className="mt-3 font-display text-3xl font-black uppercase tracking-tight">Ritual Completed</h3>
                <p className="mt-3 text-sm text-white/75">
                  Two burns processed. Your leaderboard points and claimable rewards were updated instantly.
                </p>

                {forgeMintedPreview.length > 0 ? (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {forgeMintedPreview.map((item, index) => (
                      <div key={`forge-preview-${item.cid}-${index}`} className="overflow-hidden rounded-xl border border-white/12 bg-black/35">
                        <div className="aspect-square bg-neutral-950 p-2">
                          <img
                            src={item.imageUrl}
                            alt={item.cid}
                            className="h-full w-full rounded-lg object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="border-t border-white/10 px-2.5 py-2 text-[10px] font-mono uppercase tracking-[0.13em] text-white/65">
                          Unlocked CID
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setIsForgeSuccessOpen(false)}
                    className="rounded-lg bg-white px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-black"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {websiteUi.showTabBurnchamber && activeTab === 'burnchamber' ? (
          <section id="burn-chamber" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="glass-panel rounded-3xl p-6 md:p-8">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Zip 5 Integration</div>
                <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  The Burn
                  <br />
                  Chamber
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/72">
                  Sacrifice two assets in one ritual cycle. Each sacrifice executes a real burn transaction and feeds
                  the live rewards engine.
                </p>
              </div>

              <div className="grid gap-3 md:gap-4">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Chamber Inputs</div>
                  <div className="mt-2 font-display text-4xl font-bold">{burnChamberSelectionCount}/2</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Burnable Units</div>
                  <div className="mt-2 font-display text-4xl font-bold">{totalBurnableUnits}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Unlocked Rewards</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">{claimableRewardCount} claimable</div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
              {[burnChamberSlot1, burnChamberSlot2].map((slot, index) => {
                const slotNumber = index + 1;
                return (
                  <div key={`burn-chamber-slot-${slotNumber}`} className="glass-panel rounded-3xl p-5 md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
                        Sacrifice Slot {String(slotNumber).padStart(2, '0')}
                      </div>
                      {slot ? (
                        <button
                          onClick={() => (slotNumber === 1 ? setBurnChamberSlot1(null) : setBurnChamberSlot2(null))}
                          className="text-[10px] font-mono uppercase tracking-[0.14em] text-red-300 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="aspect-square overflow-hidden rounded-2xl border border-dashed border-white/20 bg-black/30 p-3">
                      {slot ? (
                        <div className="h-full w-full overflow-hidden rounded-xl border border-white/10 bg-neutral-950">
                          {slot.image ? (
                            <img
                              src={slot.image}
                              alt={slot.name}
                              className="h-full w-full object-cover grayscale"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                              No Image
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-white/35">
                          <Plus className="h-8 w-8" />
                          <div className="text-[10px] font-mono uppercase tracking-[0.16em]">Select Sacrifice</div>
                        </div>
                      )}
                    </div>

                    {slot ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                        <div className="font-display text-xl font-bold uppercase tracking-tight">{slot.name}</div>
                        <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                          {slot.collection} • x{slot.quantity || 1}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="flex items-center justify-center lg:px-2">
                <button
                  onClick={() => void handleBurnChamberForge()}
                  disabled={!burnChamberSlot1 || !burnChamberSlot2 || isBurnChamberForging || isBurning}
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full border transition-all ${
                    burnChamberSlot1 && burnChamberSlot2 && !isBurnChamberForging && !isBurning
                      ? 'border-white/70 bg-white text-black shadow-[0_0_32px_rgba(255,255,255,0.35)]'
                      : 'border-white/20 bg-white/10 text-white/45'
                  }`}
                >
                  {isBurnChamberForging || isBurning ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                      <RefreshCw className="h-8 w-8" />
                    </motion.div>
                  ) : (
                    <Flame className="h-8 w-8" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display text-3xl font-bold uppercase tracking-tight">Burn Chamber Inventory</h3>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                  Tap to route assets into slot 1 and slot 2
                </div>
              </div>

              {userNfts.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 text-center text-white/55">
                  No burnable NFTs available for this ritual.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {userNfts.map((nft) => {
                    const isSelected = burnChamberSlot1?.id === nft.id || burnChamberSlot2?.id === nft.id;
                    return (
                      <motion.button
                        key={`burn-chamber-inventory-${nft.id}`}
                        whileHover={{ y: -6 }}
                        onClick={() => handleBurnChamberSelect(nft)}
                        disabled={isBurnChamberForging || isBurning}
                        className={`group overflow-hidden rounded-2xl border bg-black/45 text-left transition-all ${
                          isSelected ? 'border-white/70 shadow-[0_0_18px_rgba(255,255,255,0.2)]' : 'border-white/15 hover:border-white/45'
                        }`}
                      >
                        <div className="aspect-square overflow-hidden border-b border-white/10 bg-neutral-950 p-3">
                          {nft.image ? (
                            <img
                              src={nft.image}
                              alt={nft.name}
                              className="h-full w-full rounded-xl object-cover grayscale transition-all duration-500 group-hover:grayscale-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                              No Image
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="font-display text-lg font-bold uppercase tracking-tight">{nft.name}</div>
                          <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                            {nft.collection} • x{nft.quantity || 1}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-10 grid gap-4 md:gap-5 md:grid-cols-2">
              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Latest Artifact</div>
                {burnChamberLastArtifact ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black/30">
                    <div className="aspect-square p-3">
                      <img
                        src={burnChamberLastArtifact.image}
                        alt={burnChamberLastArtifact.name}
                        className="h-full w-full rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="border-t border-white/10 px-4 py-3">
                      <div className="font-display text-2xl font-bold uppercase tracking-tight">{burnChamberLastArtifact.name}</div>
                      <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                        {burnChamberLastArtifact.rarity}
                      </div>
                      <p className="mt-2 text-sm text-white/70">{burnChamberLastArtifact.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-white/45">
                    Complete a Burn Chamber ritual to mint and reveal your latest artifact.
                  </div>
                )}
              </div>

              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Artifact Vault</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {burnChamberArtifacts.slice(0, 6).map((artifact) => (
                    <div key={artifact.id} className="overflow-hidden rounded-xl border border-white/12 bg-black/30">
                      <div className="aspect-square p-2">
                        <img
                          src={artifact.image}
                          alt={artifact.name}
                          className="h-full w-full rounded-lg object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="border-t border-white/10 px-2.5 py-2">
                        <div className="truncate font-display text-base font-bold uppercase tracking-tight">
                          {artifact.name}
                        </div>
                        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/45">{artifact.rarity}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {websiteUi.showTabNewworld && activeTab === 'newworld' ? (
          <section id="new-world-order" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
                <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-white/10 blur-[95px]" />
                <div className="relative">
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Zip 6 Integration</div>
                  <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                    New World
                    <br />
                    Order
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/72">
                    Sacrifice for the new world. Burn your VOID assets to purify supply and redeem next-generation
                    rewards through the live protocol.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:gap-4">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Total Burned</div>
                  <div className="mt-2 font-display text-4xl font-bold">{newWorldBurnCount}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Active Redeemers</div>
                  <div className="mt-2 font-display text-4xl font-bold">{Math.max(1, liveLeaderboardRows.length)}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Network Status</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Stable
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-display text-3xl font-bold uppercase tracking-tight">Your Collection</h3>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                  Select one asset to initiate a burn sequence
                </div>
              </div>

              {userNfts.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 text-center text-white/55">
                  Wallet has no burnable assets in the selected collection filter.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {userNfts.map((nft) => (
                    <motion.button
                      key={`new-world-inventory-${nft.id}`}
                      whileHover={{ y: -6 }}
                      onClick={() => setNewWorldSelectedNft(nft)}
                      className="group overflow-hidden rounded-2xl border border-white/15 bg-black/45 text-left hover:border-white/45"
                    >
                      <div className="aspect-square overflow-hidden border-b border-white/10 bg-neutral-950 p-3">
                        {nft.image ? (
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="h-full w-full rounded-xl object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-[1.03]"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="font-display text-lg font-bold uppercase tracking-tight">{nft.name}</div>
                        <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                          {nft.collection} • x{nft.quantity || 1}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-3xl p-6 md:p-8">
              <div className="mb-6 text-center">
                <h3 className="font-display text-4xl font-black uppercase tracking-tight">Redemption Tiers</h3>
                <p className="mt-3 text-sm text-white/65">Accumulate burns to unlock protocol reward thresholds.</p>
              </div>
              <div className="grid gap-4 md:gap-5 md:grid-cols-2">
                {NEW_WORLD_REWARDS.map((reward) => {
                  const progress = Math.min(100, Math.round((newWorldBurnCount / reward.requirement) * 100));
                  const unlocked = newWorldBurnCount >= reward.requirement;
                  return (
                    <div key={reward.id} className="overflow-hidden rounded-2xl border border-white/12 bg-black/35">
                      <div className="grid gap-3 p-3 sm:grid-cols-[1fr_1.15fr]">
                        <div className="aspect-square overflow-hidden rounded-xl border border-white/10">
                          <img
                            src={reward.image}
                            alt={reward.name}
                            className="h-full w-full object-cover grayscale"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="py-1">
                          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                            Requirement
                          </div>
                          <h4 className="mt-1 font-display text-2xl font-black uppercase tracking-tight">{reward.name}</h4>
                          <p className="mt-2 text-sm text-white/65 leading-relaxed">{reward.description}</p>
                          <div className="mt-4">
                            <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.13em] text-white/45">
                              <span>{newWorldBurnCount} / {reward.requirement} burns</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                              <motion.div
                                initial={false}
                                animate={{ width: `${progress}%` }}
                                transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                                className="h-full rounded-full bg-white"
                              />
                            </div>
                          </div>
                          <button
                            disabled={!unlocked}
                            className={`mt-4 w-full rounded-xl px-3 py-2.5 text-[10px] font-mono uppercase tracking-[0.14em] ${
                              unlocked
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white/35 cursor-not-allowed'
                            }`}
                          >
                            {unlocked ? 'Redeem Tier' : `Need ${Math.max(0, reward.requirement - newWorldBurnCount)} More Burns`}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {newWorldSelectedNft ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[105] flex items-center justify-center bg-black/85 px-4"
                  onClick={() => !isBurning && setNewWorldSelectedNft(null)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 18, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 18, scale: 0.97 }}
                    className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-neutral-950"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="grid md:grid-cols-[1fr_1fr]">
                      <div className="aspect-square overflow-hidden border-b border-white/10 md:border-b-0 md:border-r">
                        {newWorldSelectedNft.image ? (
                          <img
                            src={newWorldSelectedNft.image}
                            alt={newWorldSelectedNft.name}
                            className={`h-full w-full object-cover transition-all duration-700 ${isBurning ? 'scale-110 blur-sm brightness-125' : 'grayscale-0'}`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                            No Image
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-between p-6 md:p-8">
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Sequence Initiation</div>
                              <h4 className="mt-2 font-display text-4xl font-black uppercase tracking-tight">
                                {newWorldSelectedNft.name}
                              </h4>
                            </div>
                            <button
                              onClick={() => !isBurning && setNewWorldSelectedNft(null)}
                              className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>

                          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-white/60">
                              <Info className="h-4 w-4" />
                              Warning
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-white/68">
                              Burning this asset is irreversible. One confirmed burn grants +{BURN_CREDITS_PER_NFT}
                              credits and unlock progression rewards.
                            </p>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Rarity</div>
                              <div className="mt-1 text-sm font-bold">{newWorldSelectedNft.rarity}</div>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Burn Value</div>
                              <div className="mt-1 text-sm font-bold">+{BURN_CREDITS_PER_NFT} Credits</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 space-y-3">
                          <button
                            onClick={() => void handleNewWorldBurn()}
                            disabled={isBurning}
                            className={`w-full rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-[0.16em] ${
                              isBurning ? 'bg-white/10 text-white/35 cursor-not-allowed' : 'bg-white text-black'
                            }`}
                          >
                            {isBurning ? 'Processing...' : 'Confirm Burn Sequence'}
                          </button>
                          <button
                            onClick={() => !isBurning && setNewWorldSelectedNft(null)}
                            disabled={isBurning}
                            className="w-full text-[10px] font-mono uppercase tracking-[0.14em] text-white/45 hover:text-white disabled:opacity-40"
                          >
                            Cancel Initiation
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {newWorldToastVisible ? (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  className="fixed bottom-8 left-1/2 z-[106] w-[min(92vw,560px)] -translate-x-1/2 rounded-full border border-white/20 bg-white px-5 py-3 text-black shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div className="truncate text-xs font-mono uppercase tracking-[0.14em]">{newWorldToast}</div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        ) : null}

        {websiteUi.showTabTipstarter && activeTab === 'tipstarter' ? (
          <section id="tip-your-fire-starter" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="glass-panel rounded-3xl p-6 md:p-8">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Support Loop</div>
                <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  Tip Your
                  <br />
                  Fire Starter
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/72">
                  Deposit ETH on Base to the fire starter wallet and convert each confirmed tip into progression
                  points. Points feed your live leaderboard rank immediately.
                </p>
              </div>

              <div className="grid gap-3 md:gap-4">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Total Tip Events</div>
                  <div className="mt-2 font-display text-4xl font-bold">{tipCount}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Total Tipped</div>
                  <div className="mt-2 font-display text-4xl font-bold">{Number(tippedEth).toFixed(4)} ETH</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Points Per ETH</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">{tipPointsPerEth} points</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="glass-panel rounded-3xl p-6 md:p-8">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Tip Transaction</div>
                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                      ETH Amount
                    </span>
                    <input
                      value={tipAmountEth}
                      onChange={(event) => setTipAmountEth(event.target.value)}
                      placeholder="0.01"
                      className="w-full rounded-xl border border-white/20 bg-black/40 px-3 py-3 font-mono text-sm text-white outline-none focus:border-cyan-300/60"
                    />
                  </label>

                  <div className="rounded-xl border border-white/12 bg-black/30 p-4">
                    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Estimated Points</div>
                    <div className="mt-1 font-display text-3xl font-bold">{estimatedTipPoints}</div>
                    <div className="mt-2 text-xs text-white/55">
                      Minimum tip: {tipMinEth} ETH. Receiver: {tipReceiverAddress ? shortAddress(tipReceiverAddress) : 'Not configured'}.
                    </div>
                  </div>

                  <button
                    onClick={() => void handleTipStarter()}
                    disabled={isTipSubmitting || !tipReceiverAddress}
                    className={`w-full rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-[0.16em] ${
                      isTipSubmitting || !tipReceiverAddress
                        ? 'cursor-not-allowed bg-white/10 text-white/35'
                        : 'bg-white text-black'
                    }`}
                  >
                    {isTipSubmitting ? 'Processing Tip...' : 'Deposit ETH & Claim Points'}
                  </button>

                  {tipSubmitError ? (
                    <div className="rounded-xl border border-red-700/60 bg-red-900/25 px-4 py-3 text-xs text-red-200">
                      {tipSubmitError}
                    </div>
                  ) : null}
                  {tipSubmitSuccess ? (
                    <div className="rounded-xl border border-emerald-700/60 bg-emerald-900/25 px-4 py-3 text-xs text-emerald-200">
                      {tipSubmitSuccess}
                    </div>
                  ) : null}
                  {tipSubmitTxHash ? (
                    <a
                      href={`https://basescan.org/tx/${tipSubmitTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-xs font-mono uppercase tracking-[0.14em] text-cyan-300 underline"
                    >
                      View tip tx on BaseScan
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-panel rounded-3xl p-5 md:p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">How It Works</div>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <div>1. Send ETH tip on Base to the fire starter wallet.</div>
                    <div>2. Sign once so backend verifies tx sender, receiver, and value.</div>
                    <div>3. Points are written to progression state and leaderboard updates.</div>
                  </div>
                </div>
                <div className="glass-panel rounded-3xl p-5 md:p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Protocol Rules</div>
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <div>Minimum accepted tip: {tipMinEth} ETH.</div>
                    <div>Every tx hash can only be counted once for points.</div>
                    <div>Wallet must still pass token-gate access to claim tip points.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {websiteUi.showTabMonochrome && activeTab === 'monochrome' ? (
          <section id="monochrome" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-5">
              <div className="glass-panel rounded-3xl p-6 md:p-8 xl:col-span-3">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Monochrome Protocol</div>
                <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  Burn.
                  <br />
                  Redeem.
                </h2>
                <p className="mt-5 max-w-2xl text-white/70 leading-relaxed">
                  Sacrifice digital assets to unlock physical and digital redemptions. Imported from your monochrome-redemption build.
                </p>
              </div>

              <div className="grid gap-3 md:gap-4 xl:col-span-2">
                {[
                  { label: 'Total Burned', value: '1,240' },
                  { label: 'Redeemed', value: '842' },
                  { label: 'Floor Price', value: '0.85 ETH' }
                ].map((stat) => (
                  <div key={stat.label} className="glass-panel rounded-2xl p-4 md:p-5">
                    <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">{stat.label}</div>
                    <div className="mt-2 font-display text-3xl font-bold">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between gap-3">
              <h3 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight flex items-center gap-3">
                <Layers className="h-7 w-7" />
                Monochrome Gallery
              </h3>
              <span className="text-xs font-mono uppercase tracking-[0.14em] text-white/45">{monochromeNfts.length} Items Found</span>
            </div>

            {monochromeNfts.length === 0 ? (
              <div className="glass-panel rounded-3xl p-12 text-center text-white/55">
                All monochrome assets have been burned.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <AnimatePresence mode="popLayout">
                  {monochromeNfts.map((nft) => (
                    <motion.button
                      key={`monochrome-${nft.id}`}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                      whileHover={{ y: -8 }}
                      whileTap={{ scale: 0.99 }}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 text-left"
                      onClick={() => setMonochromeSelectedNft(nft)}
                    >
                      <div className="aspect-square overflow-hidden bg-neutral-950 p-3">
                        <img
                          src={nft.image}
                          alt={nft.name}
                          className="h-full w-full rounded-xl object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="border-t border-white/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-display text-xl font-bold tracking-tight">{nft.name}</h4>
                            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                              {nft.rarity}
                            </p>
                          </div>
                          <div className="rounded-full bg-white/10 p-2">
                            <Flame className="h-4 w-4 text-white/70" />
                          </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-center text-[10px] font-mono uppercase tracking-[0.14em] text-white/75 transition-colors group-hover:bg-white group-hover:text-black">
                          View Details
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <AnimatePresence>
              {monochromeSelectedNft ? (
                <div className="fixed inset-0 z-[98] flex items-center justify-center p-6">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => !isMonochromeBurning && setMonochromeSelectedNft(null)}
                    className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 18 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 18 }}
                    className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-neutral-950"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2">
                      <div className="h-full bg-neutral-900">
                        <img
                          src={monochromeSelectedNft.image}
                          alt={monochromeSelectedNft.name}
                          className="h-full w-full object-cover grayscale"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex flex-col justify-between p-8 md:p-10">
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">
                                Asset ID #{monochromeSelectedNft.id}
                              </div>
                              <h4 className="mt-2 font-display text-4xl font-black tracking-tight">
                                {monochromeSelectedNft.name}
                              </h4>
                            </div>
                            <button
                              onClick={() => setMonochromeSelectedNft(null)}
                              disabled={isMonochromeBurning}
                              className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>

                          <p className="mt-5 text-sm leading-relaxed text-white/68">
                            {monochromeSelectedNft.description}
                          </p>

                          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.14em] text-white/65">
                              <Info className="h-4 w-4" />
                              Redemption Available
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-white/55">
                              Burning this asset permanently removes it and unlocks a unique physical or digital redemption.
                            </p>
                          </div>
                        </div>

                        <div className="mt-8">
                          <button
                            onClick={() => void handleMonochromeBurn(monochromeSelectedNft)}
                            disabled={isMonochromeBurning}
                            className="w-full rounded-2xl bg-white px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-black disabled:opacity-50"
                          >
                            {isMonochromeBurning ? 'Burning Asset...' : 'Initiate Burn'}
                          </button>
                          <div className="mt-3 text-center text-[10px] font-mono uppercase tracking-[0.14em] text-white/40">
                            Warning: This action is irreversible
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {showMonochromeSuccess && monochromeRedeemedItem ? (
                <div className="fixed inset-0 z-[99] flex items-center justify-center p-6">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 32 }}
                    className="relative w-full max-w-2xl space-y-10 text-center text-black"
                  >
                    <div className="flex justify-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black text-white">
                        <CheckCircle2 className="h-10 w-10" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-display text-6xl font-black uppercase tracking-tight">Redeemed</h4>
                      <p className="mx-auto max-w-lg text-lg">
                        You successfully burned your asset and unlocked <span className="underline">{monochromeRedeemedItem.name}</span>.
                      </p>
                    </div>

                    <div className="mx-auto aspect-square max-w-xs overflow-hidden rounded-3xl border-4 border-black shadow-2xl">
                      <img
                        src={monochromeRedeemedItem.image}
                        alt={monochromeRedeemedItem.name}
                        className="h-full w-full object-cover grayscale"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="mx-auto flex max-w-sm flex-col gap-3">
                      <button
                        onClick={() => setShowMonochromeSuccess(false)}
                        className="w-full rounded-2xl bg-black px-4 py-4 text-xs font-black uppercase tracking-[0.16em] text-white"
                      >
                        Return to Gallery
                      </button>
                      <button className="flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.14em] text-black/60">
                        View Transaction <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                </div>
              ) : null}
            </AnimatePresence>
          </section>
        ) : null}

        {websiteUi.showTabDestiny && activeTab === 'destiny' ? (
          <section id="destiny" className="mb-24 md:mb-32">
            <div className="mb-8 md:mb-10 grid gap-4 md:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
                <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-yellow-400/15 blur-[95px]" />
                <div className="absolute -left-16 -bottom-14 h-48 w-48 rounded-full bg-cyan-300/10 blur-[95px]" />
                <div className="relative">
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-yellow-200/70">Divine Reel</div>
                  <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                    Destiny
                    <br />
                    Jackpot
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/72">
                    Spin a ritual reel, let fate select one artifact, then reveal a stylized verdict and attire prophecy.
                    Imported from your divine-reel-jackpot build and tuned to match this protocol UI.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:gap-4">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Destiny Spins</div>
                  <div className="mt-2 font-display text-4xl font-bold">{destinySpinCount}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Artifact Pool</div>
                  <div className="mt-2 font-display text-4xl font-bold">{destinyImages.length}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Reel State</div>
                  <div className="mt-2 text-sm font-mono uppercase text-white/80">
                    {destinyGameState === 'spinning'
                      ? 'Manifesting'
                      : destinyGameState === 'stopping'
                        ? 'Landing'
                        : destinyGameState === 'result'
                          ? 'Revealed'
                          : 'Idle'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:gap-5 xl:grid-cols-[0.9fr_1.3fr_0.8fr]">
              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Asset Scribe</div>
                <p className="mt-3 text-sm leading-relaxed text-white/68">
                  Upload your own image set to replace the default destiny pool.
                </p>
                <button
                  onClick={openDestinyUpload}
                  className="mt-5 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-mono uppercase tracking-[0.14em] text-white hover:bg-white hover:text-black transition-colors"
                >
                  Upload Destiny Images
                </button>
                <input
                  ref={destinyUploadInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleDestinyUpload}
                />

                <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Pool History</div>
                  <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                    {destinyImages.slice(0, 16).map((image, index) => (
                      <div
                        key={`destiny-pool-${image.id}`}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/35 px-2.5 py-2"
                      >
                        <div className="truncate text-[10px] font-mono uppercase tracking-[0.12em] text-white/70">
                          {image.name}
                        </div>
                        <div className="ml-2 text-[9px] font-mono uppercase text-white/35">
                          #{String(index + 1).padStart(2, '0')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <div className="relative overflow-hidden rounded-2xl border border-yellow-300/25 bg-black/45 p-3">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black to-transparent opacity-85 z-20" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black to-transparent opacity-85 z-20" />
                  <div className="pointer-events-none absolute inset-y-2 left-1 z-20 w-0.5 bg-yellow-200/60" />
                  <div className="pointer-events-none absolute inset-y-2 right-1 z-20 w-0.5 bg-yellow-200/60" />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-[2px] -translate-y-1/2 bg-yellow-300/45 shadow-[0_0_16px_rgba(250,204,21,0.65)]" />

                  <div className="relative h-[420px] overflow-hidden rounded-xl border border-white/10 bg-neutral-950/70">
                    <motion.div
                      className="flex flex-col gap-3 px-3 py-3"
                      animate={{
                        y: `calc(50% - ${(destinyReelIndex + 0.5) * DESTINY_REEL_ITEM_HEIGHT}px)`
                      }}
                      transition={{
                        duration: destinyGameState === 'spinning' ? 0.07 : destinyGameState === 'stopping' ? 0.18 : 0.32,
                        ease: destinyGameState === 'spinning' ? 'linear' : [0.22, 1, 0.36, 1]
                      }}
                    >
                      {destinyDisplayImages.map((image, index) => {
                        const isCenter = index === destinyReelIndex;
                        return (
                          <div
                            key={`destiny-reel-${image.id}-${index}`}
                            className={`relative overflow-hidden rounded-xl border ${
                              isCenter ? 'border-yellow-300/70 shadow-[0_0_24px_rgba(250,204,21,0.32)]' : 'border-white/12'
                            }`}
                            style={{ height: DESTINY_REEL_ITEM_HEIGHT - 12 }}
                          >
                            <img
                              src={image.url}
                              alt={image.name}
                              className="h-full w-full object-cover grayscale transition-all duration-500 hover:grayscale-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                              <div className="truncate font-display text-sm font-bold uppercase tracking-tight text-white">
                                {image.name}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => void handleDestinySpin()}
                    disabled={destinyGameState === 'spinning' || destinyGameState === 'stopping' || destinyImages.length === 0}
                    className={`rounded-full border px-7 py-3 text-sm font-black uppercase tracking-[0.16em] transition-all ${
                      destinyGameState === 'spinning' || destinyGameState === 'stopping'
                        ? 'cursor-not-allowed border-white/20 bg-white/10 text-white/40'
                        : 'border-yellow-200/60 bg-yellow-300 text-black hover:scale-[1.04] shadow-[0_0_24px_rgba(250,204,21,0.38)]'
                    }`}
                  >
                    {destinyGameState === 'spinning' || destinyGameState === 'stopping' ? 'Manifesting...' : 'Spin Destiny'}
                  </button>
                  <div className="text-xs font-mono uppercase tracking-[0.14em] text-white/60">
                    {selectedDestinyImage ? `Current: ${selectedDestinyImage.name}` : 'No artifact selected'}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="glass-panel rounded-3xl p-5 md:p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-yellow-200/75">The Verdict</div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
                    {selectedDestinyImage ? (
                      <img
                        src={selectedDestinyImage.url}
                        alt={selectedDestinyImage.name}
                        className="h-44 w-full rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center rounded-xl bg-neutral-900 text-xs font-mono uppercase text-white/40">
                        Awaiting spin
                      </div>
                    )}
                    <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                      {destinyTargetIndex !== null ? `Landed Slot #${destinyTargetIndex + 1}` : 'No landed slot yet'}
                    </div>
                    <div className="mt-1 font-display text-xl font-bold uppercase tracking-tight">
                      {destinyFortune?.title || (selectedDestinyImage ? selectedDestinyImage.name : 'No Verdict')}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-white/70">
                      {isDestinyFortuneLoading
                        ? 'Reading aura patterns and composing your prophecy...'
                        : destinyFortune?.description || 'Spin to reveal the verdict.'}
                    </p>
                  </div>
                </div>

                <div className="glass-panel rounded-3xl p-5 md:p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-cyan-200/75">Divine Attire</div>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">
                    {isDestinyFortuneLoading
                      ? 'Synchronizing wardrobe signals...'
                      : destinyFortune?.attire || 'Attire insight appears after each spin result.'}
                  </p>
                </div>

                <div className="glass-panel rounded-3xl p-5 md:p-6">
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Instructions</div>
                  <div className="mt-3 space-y-2 text-xs text-white/65">
                    <div>1. Upload custom images or use default destiny artifacts.</div>
                    <div>2. Spin to roll fate and land on one manifest.</div>
                    <div>3. Read verdict and attire to continue progression.</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {websiteUi.showTabKek && activeTab === 'kek' ? (
          <section id="kek" className="mb-24 md:mb-32">
            <div className="glass-panel rounded-3xl p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.16em] text-emerald-300/80">On-Chain Jackpot</div>
                  <h2 className="mt-3 font-display text-4xl md:text-6xl font-black uppercase leading-[0.88] tracking-tight">
                    KEK Spinner
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70">
                    Spin the reel, land a character, and mint the selected drop. Styled to match your burn protocol
                    flow while keeping the KEK game energy.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-black/40 px-4 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Balance</div>
                  <div className="mt-1 flex items-center gap-2 font-display text-2xl font-black">
                    <Coins className="h-5 w-5 text-emerald-300" />
                    <span>{kekBalance.toLocaleString()} KEK</span>
                  </div>
                </div>
              </div>

              <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/12 bg-black/45">
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-0.5 -translate-x-1/2 bg-emerald-300/70 shadow-[0_0_18px_rgba(110,231,183,0.55)]" />
                <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.65)]" />
                <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 h-4 w-4 -translate-x-1/2 translate-y-1/2 rotate-45 bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.65)]" />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-black to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-black to-transparent" />

                <motion.div
                  initial={false}
                  animate={{ x: kekSpinOffset }}
                  transition={{ duration: KEK_SPIN_DURATION_MS / 1000, ease: [0.45, 0.05, 0.55, 0.95] }}
                  className="flex items-center gap-4 px-[40%] py-7"
                >
                  {kekReelStrip.map((character, index) => (
                    <div
                      key={`kek-${character.id}-${index}`}
                      className="h-64 w-48 flex-shrink-0 overflow-hidden rounded-2xl border border-white/12 bg-white/5"
                    >
                      <div className="relative h-full w-full">
                        <img
                          src={character.image}
                          alt={character.name}
                          className="h-full w-full object-cover opacity-70 transition-all duration-500 hover:opacity-100"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 px-4 py-3">
                          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">{character.trait}</div>
                          <div className="mt-1 truncate font-display text-lg font-bold uppercase tracking-tight">
                            {character.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <div className="rounded-xl border border-white/12 bg-black/40 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-white/65">
                  Cost per spin: {KEK_SPIN_COST} KEK
                </div>
                <button
                  onClick={() => void handleKekSpin()}
                  disabled={isKekSpinning || kekBalance < KEK_SPIN_COST}
                  className={`rounded-full border px-8 py-3 text-sm font-black uppercase tracking-[0.16em] transition-all ${
                    isKekSpinning || kekBalance < KEK_SPIN_COST
                      ? 'cursor-not-allowed border-white/20 bg-white/10 text-white/40'
                      : 'border-emerald-200/70 bg-emerald-300 text-black hover:scale-[1.03] shadow-[0_0_24px_rgba(110,231,183,0.42)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {isKekSpinning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                    {isKekSpinning ? 'Spinning...' : 'Spin Reel'}
                  </span>
                </button>
                <div className="ml-auto text-xs font-mono uppercase tracking-[0.14em] text-white/45">
                  {kekResult ? `Last landed: ${kekResult.name}` : 'No spin result yet'}
                </div>
              </div>

              {kekResult ? (
                <div className="mt-6 grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="overflow-hidden rounded-2xl border border-white/12 bg-black/40">
                    <img
                      src={kekResult.image}
                      alt={kekResult.name}
                      className="h-52 w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-black/35 p-5">
                    <div className="text-xs font-mono uppercase tracking-[0.14em] text-emerald-300/80">Winning Character</div>
                    <div className="mt-2 font-display text-3xl font-black uppercase tracking-tight">{kekResult.name}</div>
                    <p className="mt-2 text-sm text-white/70">
                      Trait: <span className="font-mono uppercase">{kekResult.trait}</span>. You can mint this drop
                      directly from the KEK modal.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <AnimatePresence>
              {isKekMintModalOpen && kekResult ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                >
                  <button
                    className="absolute inset-0 bg-black/85 backdrop-blur-sm"
                    onClick={() => setIsKekMintModalOpen(false)}
                    aria-label="Close KEK mint modal"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 14 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 14 }}
                    className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b0d]"
                  >
                    <img
                      src={kekResult.image}
                      alt={kekResult.name}
                      className="h-72 w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="p-6">
                      <div className="text-xs font-mono uppercase tracking-[0.14em] text-emerald-300/80">Rare Drop</div>
                      <div className="mt-2 font-display text-4xl font-black uppercase tracking-tight">{kekResult.name}</div>
                      <p className="mt-2 text-sm text-white/70">
                        Mint the landed KEK result on-chain or keep spinning for another outcome.
                      </p>
                      <div className="mt-5 flex items-center gap-3">
                        <button
                          onClick={() => setIsKekMintModalOpen(false)}
                          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-mono uppercase tracking-[0.14em] text-white/80 hover:bg-white/10"
                        >
                          Continue Spinning
                        </button>
                        <button
                          onClick={() => setIsKekMintModalOpen(false)}
                          className="rounded-xl border border-emerald-200/70 bg-emerald-300 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-black hover:scale-[1.01]"
                        >
                          <span className="inline-flex items-center gap-2">
                            Mint On-Chain
                            <ExternalLink className="h-4 w-4" />
                          </span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>
        ) : null}

        {websiteUi.showTabLeaderboard && activeTab === 'leaderboard' ? (
          <section id="leaderboard" className="mb-24 md:mb-32">
            <div className="mb-8 grid gap-4 md:gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="glass-panel rounded-3xl p-6 md:p-8">
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">Live Leaderboard</div>
                <h2 className="mt-4 font-display text-4xl md:text-6xl font-black uppercase leading-[0.9] tracking-tight">
                  Game Progression
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72">
                  Real-time score is on-chain burn based: every burned unit adds +20 points and unlocks reward claims.
                </p>
                {isProgressLoading ? (
                  <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                    Syncing live progression...
                  </div>
                ) : null}
                {progressError ? (
                  <div className="mt-3 rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-2 text-xs text-red-200">
                    {progressError}
                  </div>
                ) : null}

                <div className="mt-6 rounded-2xl border border-white/12 bg-black/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-yellow-300" />
                      <div className="text-xs font-mono uppercase tracking-[0.14em] text-white/70">
                        Your Rank #{userLeaderboardEntry?.rank ?? '-'}
                      </div>
                    </div>
                    <div className="text-xs font-mono uppercase tracking-[0.14em] text-white/70">
                      Level {progressionLevel}
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="font-display text-4xl font-black">{progressionScore}</div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">XP Score</div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.13em] text-white/45">
                      <span>Progress to level {progressionLevel + 1}</span>
                      <span>{levelProgressPct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={false}
                        animate={{ width: `${levelProgressPct}%` }}
                        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:gap-4">
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Burn Units</div>
                  <div className="mt-2 font-display text-4xl font-bold">{burnUnitsCount}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Rewards Claimed</div>
                  <div className="mt-2 font-display text-4xl font-bold">{mintedRewardCount}</div>
                </div>
                <div className="glass-panel rounded-2xl p-4 md:p-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">Claimable Rewards</div>
                  <div className="mt-2 font-display text-4xl font-bold">{claimableRewardCount}</div>
                </div>
              </div>
            </div>

            <div className="mb-6 grid gap-4 md:gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-white/50">
                  <Trophy className="h-4 w-4" />
                  Ranking Board
                </div>
                <div className="space-y-3">
                  {leaderboardRows.map((entry) => (
                    <div
                      key={`lb-${entry.name}`}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                        entry.accent
                          ? 'border-cyan-300/45 bg-cyan-300/10'
                          : 'border-white/10 bg-black/25'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-mono ${
                            entry.rank === 1
                              ? 'bg-yellow-300 text-black'
                              : entry.rank === 2
                                ? 'bg-white/80 text-black'
                                : entry.rank === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-white/10 text-white'
                          }`}
                        >
                          {entry.rank}
                        </div>
                        <div>
                          <div className="font-display text-xl font-bold uppercase tracking-tight">{entry.name}</div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">{entry.badge}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl font-bold">{entry.score}</div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">XP</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-white/50">
                  <Target className="h-4 w-4" />
                  Mission Tracker
                </div>
                <div className="space-y-4">
                  {missionRows.map((mission) => {
                    const progress = Math.min(100, Math.round((mission.value / Math.max(1, mission.target)) * 100));
                    return (
                      <div key={mission.title} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-white/55">
                          <span>{mission.title}</span>
                          <span>
                            {mission.value}/{mission.target}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            initial={false}
                            animate={{ width: `${progress}%` }}
                            transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                            className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.14em] text-white/55">
                    <Medal className="h-4 w-4" />
                    Session Status
                  </div>
                  <div className="mt-2 text-sm text-white/70">
                    {claimCompleted
                      ? 'Gate claim confirmed. Keep burning and minting to climb the board.'
                      : 'Complete gate claim first, then stack burns and mints for max XP.'}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs font-mono uppercase tracking-[0.14em] text-white/55">Latest Burns</div>
                  {recentBurns.length === 0 ? (
                    <div className="mt-2 text-sm text-white/60">No burn activity recorded yet.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {recentBurns.slice(0, 5).map((event) => (
                        <div key={`${event.burnTxHash}-${event.timestamp}`} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                          <div className="text-[10px] font-mono uppercase tracking-[0.13em] text-white/70">
                            {event.address.toLowerCase() === walletAddress.toLowerCase() ? 'You' : shortAddress(event.address)} • +{event.creditsAwarded}
                          </div>
                          <a
                            href={`https://basescan.org/tx/${event.burnTxHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-[10px] font-mono text-cyan-200/85 hover:underline"
                          >
                            {event.burnTxHash}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <AnimatePresence>
          {websiteUi.showTabNfts && isB2RCarouselOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[88] flex items-center justify-center bg-black/75 px-4"
              onClick={() => setIsB2RCarouselOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_40%),linear-gradient(150deg,rgba(13,13,15,0.98),rgba(4,4,5,0.98))] p-5 sm:p-6 md:p-7"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-[90px]" />
                <div className="absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-white/10 blur-[90px]" />

                <div className="relative">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-200/90">
                        Burn Inventory Portal
                      </div>
                      <h3 className="mt-2 font-display text-3xl sm:text-4xl font-black uppercase tracking-tight">
                        Burnable Inventory
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm text-white/70">
                        Browse your burnable NFTs in this live carousel. Click a card to open it directly in the burn queue.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsB2RCarouselOpen(false)}
                      className="rounded-xl border border-white/20 bg-black/40 p-2 text-white/80 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                      {isInventoryLoading ? 'Syncing inventory...' : `${userNfts.length} burnable NFT(s)`}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => scrollB2RCarousel('right')}
                        disabled={userNfts.length === 0}
                        className="rounded-full border border-white/20 bg-black/40 p-2 text-white/75 hover:bg-white/10 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => scrollB2RCarousel('left')}
                        disabled={userNfts.length === 0}
                        className="rounded-full border border-white/20 bg-black/40 p-2 text-white/75 hover:bg-white/10 disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isInventoryLoading ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/60">
                      Syncing OpenSea inventory...
                    </div>
                  ) : userNfts.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/60">
                      No burnable NFTs found for this wallet.
                    </div>
                  ) : (
                    <div
                      ref={b2rCarouselScrollRef}
                      dir="rtl"
                      className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
                    >
                      {userNfts.map((nft) => (
                        <motion.button
                          key={`b2r-carousel-${nft.id}`}
                          whileHover={{ y: -6, scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => {
                            setSelectedNft(nft);
                            setActiveTab('nfts');
                            setIsB2RCarouselOpen(false);
                          }}
                          dir="ltr"
                          className="group relative min-w-[240px] sm:min-w-[280px] snap-start overflow-hidden rounded-2xl border border-white/15 bg-black/45 text-left"
                        >
                          <div className="aspect-square overflow-hidden border-b border-white/10 bg-neutral-950 p-3">
                            {nft.image ? (
                              <img
                                src={nft.image}
                                alt={nft.name}
                                className="h-full w-full rounded-xl object-cover ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-[1.04]"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">{nft.collection}</div>
                            <div className="mt-1 font-display text-xl font-bold uppercase tracking-tight">{nft.name}</div>
                            <div className="mt-3 flex items-center justify-between">
                              <div className="text-xs font-mono uppercase text-white/65">x{nft.quantity || 1}</div>
                              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase text-cyan-200/85">
                                <Flame className="h-3.5 w-3.5" /> +{nft.burnValue}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {websiteUi.showTabRewards && isRewardsCarouselOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[89] flex items-center justify-center bg-black/75 px-4"
              onClick={() => setIsRewardsCarouselOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="relative w-full max-w-6xl overflow-hidden rounded-3xl border border-white/20 bg-[radial-gradient(circle_at_78%_0%,rgba(250,204,21,0.16),transparent_45%),linear-gradient(150deg,rgba(14,14,16,0.98),rgba(4,4,5,0.98))] p-5 sm:p-6 md:p-7"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-amber-200/20 blur-[90px]" />
                <div className="absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-cyan-300/10 blur-[90px]" />

                <div className="relative">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-100/90">
                        Reward Treasury Portal
                      </div>
                      <h3 className="mt-2 font-display text-3xl sm:text-4xl font-black uppercase tracking-tight">
                        Reward Vault
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm text-white/70">
                        Wallet {shortAddress(REWARD_PREVIEW_WALLET)} holdings shown as a live carousel for redeemable rewards inventory.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveTab('rewards');
                          setIsRewardsCarouselOpen(false);
                        }}
                        className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-white"
                      >
                        Open Rewards Tab
                      </button>
                      <button
                        onClick={() => setIsRewardsCarouselOpen(false)}
                        className="rounded-xl border border-white/20 bg-black/40 p-2 text-white/80 hover:text-white"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">
                      {isRewardPreviewLoading
                        ? 'Syncing reward wallet...'
                        : `${rewardPreviewNfts.length} NFT(s) in reward wallet`}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => scrollRewardsCarousel('right')}
                        disabled={rewardPreviewNfts.length === 0}
                        className="rounded-full border border-white/20 bg-black/40 p-2 text-white/75 hover:bg-white/10 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => scrollRewardsCarousel('left')}
                        disabled={rewardPreviewNfts.length === 0}
                        className="rounded-full border border-white/20 bg-black/40 p-2 text-white/75 hover:bg-white/10 disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isRewardPreviewLoading ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/60">
                      Loading reward wallet holdings...
                    </div>
                  ) : rewardPreviewError ? (
                    <div className="mt-5 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs font-mono text-red-200">
                      {rewardPreviewError}
                    </div>
                  ) : rewardPreviewNfts.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/60">
                      No reward NFTs found in this wallet.
                    </div>
                  ) : (
                    <div
                      ref={rewardsCarouselScrollRef}
                      dir="rtl"
                      className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
                    >
                      {rewardPreviewNfts.map((nft, index) => (
                        <motion.div
                          key={`rewards-carousel-wallet-${nft.id}-${index}`}
                          whileHover={{ y: -6, scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          dir="ltr"
                          className="group relative min-w-[240px] sm:min-w-[280px] snap-start overflow-hidden rounded-2xl border border-white/15 bg-black/45 text-left"
                        >
                          <div className="aspect-square overflow-hidden border-b border-white/10 bg-neutral-950 p-3">
                            {nft.image ? (
                              <img
                                src={nft.image}
                                alt={nft.name}
                                className="h-full w-full rounded-xl object-cover ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-[1.04]"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-mono uppercase text-white/45">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Reward Holding</div>
                            <div className="mt-1 font-display text-xl font-bold uppercase tracking-tight">
                              {nft.name || `Token #${nft.tokenId || '0'}`}
                            </div>
                            <div className="mt-2 text-xs font-mono uppercase text-white/65">
                              {nft.collection} #{nft.tokenId || '0'}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <div className="rounded-lg border border-white/20 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/80">
                                Qty x{nft.quantity || 1}
                              </div>
                              <div className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-200">
                                +{nft.burnValue} Credits
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {isBurnPopupOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[91] flex items-center justify-center bg-black/75 px-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-neutral-950 p-6 sm:p-7"
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -left-16 -top-10 h-44 w-44 rounded-full bg-orange-300/20 blur-3xl" />
                  <div className="absolute -right-16 -bottom-12 h-44 w-44 rounded-full bg-red-400/20 blur-3xl" />
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-orange-200/80">
                        Burn Progress
                      </div>
                      <h3 className="mt-2 font-display text-3xl font-black uppercase tracking-tight">
                        {burnPopupState === 'success'
                          ? 'Burn confirmed'
                          : burnPopupState === 'error'
                            ? 'Burn interrupted'
                            : burnPopupState === 'confirming'
                              ? 'Waiting confirmation'
                              : burnPopupState === 'indexing'
                                ? 'Indexing rewards'
                                : burnPopupState === 'burning'
                                  ? 'Submitting burn'
                                  : 'Prepare wallet'}
                      </h3>
                    </div>
                    <motion.div
                      animate={burnPopupState === 'success' || burnPopupState === 'error' ? { rotate: 0 } : { rotate: 360 }}
                      transition={
                        burnPopupState === 'success' || burnPopupState === 'error'
                          ? { duration: 0.2 }
                          : { duration: 1.3, repeat: Infinity, ease: 'linear' }
                      }
                      className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                        burnPopupState === 'success'
                          ? 'border-emerald-300/60 bg-emerald-500/20'
                          : burnPopupState === 'error'
                            ? 'border-red-400/50 bg-red-500/20'
                            : 'border-orange-300/60 bg-orange-400/20'
                      }`}
                    >
                      {burnPopupState === 'success' ? (
                        <Check className="h-6 w-6 text-emerald-200" />
                      ) : burnPopupState === 'error' ? (
                        <X className="h-6 w-6 text-red-200" />
                      ) : (
                        <Flame className="h-6 w-6 text-orange-100" />
                      )}
                    </motion.div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-white/55">
                      <span>Progress</span>
                      <span>{burnPopupProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={`h-full rounded-full ${
                          burnPopupState === 'error'
                            ? 'bg-gradient-to-r from-red-500 to-rose-400'
                            : 'bg-gradient-to-r from-orange-300 via-amber-300 to-red-300'
                        }`}
                        initial={false}
                        animate={{ width: `${burnPopupProgress}%` }}
                        transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {BURN_RITUAL_STEPS.map((step, index) => {
                      const isDone = burnPopupState === 'success' || index < burnPopupStep;
                      const isActive =
                        burnPopupState !== 'success' && burnPopupState !== 'error' && index === burnPopupStep;
                      return (
                        <div
                          key={step.label}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                            isDone
                              ? 'border-orange-200/35 bg-orange-300/10'
                              : isActive
                                ? 'border-orange-300/45 bg-orange-300/10'
                                : 'border-white/10 bg-black/25'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-mono uppercase tracking-[0.14em] text-white/85">{step.label}</div>
                            <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-white/45">{step.hint}</div>
                          </div>
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              isDone ? 'bg-orange-200 shadow-[0_0_16px_rgba(253,186,116,0.85)]' : isActive ? 'bg-orange-300' : 'bg-white/20'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {burnPopupTxHash ? (
                    <a
                      href={`https://basescan.org/tx/${burnPopupTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block truncate rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-xs font-mono text-cyan-200/85 hover:underline"
                    >
                      {burnPopupTxHash}
                    </a>
                  ) : null}

                  {burnPopupState === 'error' ? (
                    <div className="mt-4 rounded-xl border border-red-500/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                      {burnPopupError || 'Burn failed. Try again.'}
                    </div>
                  ) : null}

                  {burnPopupState === 'success' ? (
                    <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-900/15 px-3 py-2 text-sm text-emerald-200">
                      Burn completed. {burnPopupClaimable} reward NFT(s) currently claimable.
                    </div>
                  ) : null}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={closeBurnPopup}
                      disabled={isBurning && burnPopupState !== 'error' && burnPopupState !== 'success'}
                      className="rounded-lg border border-white/20 bg-black/50 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-white/80 disabled:opacity-40"
                    >
                      {burnPopupState === 'success' ? 'Continue' : 'Close'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {isClaimPopupOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-neutral-950 p-6 sm:p-7"
              >
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute -left-16 -top-12 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
                  <div className="absolute -right-14 -bottom-12 h-44 w-44 rounded-full bg-indigo-400/20 blur-3xl" />
                  {CLAIM_PARTICLES.map((particle) => (
                    <motion.div
                      key={`${particle.left}-${particle.top}`}
                      className="absolute h-1.5 w-1.5 rounded-full bg-cyan-200/80"
                      style={{ left: particle.left, top: particle.top }}
                      animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, delay: particle.delay }}
                    />
                  ))}
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-200/85">
                        Claim Ritual
                      </div>
                      <h3 className="mt-2 font-display text-3xl font-black uppercase tracking-tight">
                        {claimPopupState === 'success'
                          ? 'Rewards unlocked'
                          : claimPopupState === 'error'
                            ? 'Claim interrupted'
                            : claimPopupState === 'wallet'
                              ? 'Sign in wallet'
                              : 'Processing claim'}
                      </h3>
                    </div>
                    <motion.div
                      animate={claimPopupState === 'success' || claimPopupState === 'error' ? { rotate: 0 } : { rotate: 360 }}
                      transition={
                        claimPopupState === 'success' || claimPopupState === 'error'
                          ? { duration: 0.2 }
                          : { duration: 1.4, repeat: Infinity, ease: 'linear' }
                      }
                      className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                        claimPopupState === 'success'
                          ? 'border-emerald-300/60 bg-emerald-500/20'
                          : claimPopupState === 'error'
                            ? 'border-red-400/50 bg-red-500/20'
                            : 'border-cyan-300/50 bg-cyan-400/20'
                      }`}
                    >
                      {claimPopupState === 'success' ? (
                        <Check className="h-6 w-6 text-emerald-200" />
                      ) : claimPopupState === 'error' ? (
                        <X className="h-6 w-6 text-red-200" />
                      ) : (
                        <Sparkles className="h-6 w-6 text-cyan-100" />
                      )}
                    </motion.div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-white/55">
                      <span>Progress</span>
                      <span>{claimPopupProgress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={`h-full rounded-full ${
                          claimPopupState === 'error'
                            ? 'bg-gradient-to-r from-red-500 to-rose-400'
                            : 'bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300'
                        }`}
                        initial={false}
                        animate={{ width: `${claimPopupProgress}%` }}
                        transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {CLAIM_RITUAL_STEPS.map((step, index) => {
                      const isDone = claimPopupState === 'success' || index < claimPopupStep;
                      const isActive = claimPopupState !== 'success' && claimPopupState !== 'error' && index === claimPopupStep;
                      return (
                        <div
                          key={step.label}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                            isDone
                              ? 'border-cyan-200/35 bg-cyan-300/10'
                              : isActive
                                ? 'border-cyan-300/45 bg-cyan-300/10'
                                : 'border-white/10 bg-black/25'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-mono uppercase tracking-[0.14em] text-white/85">{step.label}</div>
                            <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-white/45">{step.hint}</div>
                          </div>
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              isDone ? 'bg-cyan-200 shadow-[0_0_16px_rgba(125,211,252,0.85)]' : isActive ? 'bg-cyan-300' : 'bg-white/20'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {claimPopupState === 'error' ? (
                    <div className="mt-4 rounded-xl border border-red-500/40 bg-red-900/20 px-3 py-2 text-sm text-red-200">
                      {claimPopupError || 'Claim failed. Try again.'}
                    </div>
                  ) : null}

                  {claimPopupState === 'success' ? (
                    <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-900/15 px-3 py-2 text-sm text-emerald-200">
                      Rewards claimed successfully.
                      {claimPopupTxHash ? (
                        <a
                          href={`https://basescan.org/tx/${claimPopupTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 underline underline-offset-2"
                        >
                          View tx
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={closeClaimPopup}
                      disabled={isClaimSigning && claimPopupState !== 'error'}
                      className="rounded-lg border border-white/20 bg-black/50 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-white/80 disabled:opacity-40"
                    >
                      {claimPopupState === 'success' ? 'Continue' : 'Close'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      {websiteUi.showFooter ? <SiteFooter /> : null}
    </div>
  );
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  const [gatePass, setGatePass] = useState('');
  const [claimResponse, setClaimResponse] = useState<ClaimResponse | null>(null);
  const [websiteCopy, setWebsiteCopy] = useState<WebsiteCopy>(DEFAULT_WEBSITE_COPY);
  const [websiteUi, setWebsiteUi] = useState<WebsiteUiConfig>(DEFAULT_WEBSITE_UI);
  const [entryMode, setEntryMode] = useState<'claim' | 'gate-only'>('claim');
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [isClaimSigning, setIsClaimSigning] = useState(false);
  const [error, setError] = useState('');
  const [enteredWebsite, setEnteredWebsite] = useState(false);

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
          setWebsiteUi((prev) => ({
            ...prev,
            ...(body.ui || {})
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

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const synced = await syncWalletIfAvailable();
      if (!synced || cancelled) return;

      const stored = readStoredGateSession();
      if (!stored) return;

      if (stored.address !== synced.address.toLowerCase()) {
        clearGateSession();
        return;
      }

      setGatePass(stored.gatePass);
      setEntryMode('gate-only');
      setEnteredWebsite(true);
    }

    restoreSession().catch(() => {
      // Ignore restore failures.
    });

    const handleAccountsChanged = (accounts: unknown) => {
      const values = Array.isArray(accounts) ? accounts : [];
      if (values.length === 0) {
        setWalletAddress('');
        setChainId(null);
        setGatePass('');
        setEnteredWebsite(false);
        setClaimResponse(null);
        clearGateSession();
        return;
      }
      syncWallet().catch(() => {
        // Ignore sync failures.
      });
    };

    window.ethereum?.on?.('accountsChanged', handleAccountsChanged);

    return () => {
      cancelled = true;
      window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
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

  async function syncWalletIfAvailable() {
    if (!window.ethereum) return null;
    const accounts = (await window.ethereum.request({ method: 'eth_accounts' }).catch(() => [])) as string[];
    if (!Array.isArray(accounts) || accounts.length === 0) return null;
    return syncWallet();
  }

  async function switchToBase() {
    try {
      if (!window.ethereum) throw new Error('No wallet detected.');
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${TARGET_CHAIN_ID.toString(16)}` }]
      });
      await syncWallet();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to switch network');
    }
  }

  async function handleAccessLogin() {
    setError('');
    setIsAccessLoading(true);

    try {
      if (!window.ethereum) {
        throw new Error('No wallet detected. Install MetaMask or another injected wallet.');
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const { signer, address, chainId: currentChainId } = await syncWallet();
      let activeSigner = signer;
      let activeAddress = address;
      let activeChainId = currentChainId;

      if (activeChainId !== TARGET_CHAIN_ID) {
        await switchToBase();
        const synced = await syncWallet();
        activeSigner = synced.signer;
        activeAddress = synced.address;
        activeChainId = synced.chainId;
      }

      if (activeChainId !== TARGET_CHAIN_ID) {
        throw new Error(`Wrong network. Switch to Base (chain ${TARGET_CHAIN_ID}).`);
      }

      const issuedAt = Date.now();
      const message = buildGateMessage(activeAddress, activeChainId, issuedAt);
      const signature = await activeSigner.signMessage(message);

      const response = await fetch('/api/auth-gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address: activeAddress,
          chainId: activeChainId,
          issuedAt,
          signature
        })
      });

      const body = await response.json();
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || 'Token gate verification failed.');
      }

      setGatePass(body.gatePass);
      storeGateSession(activeAddress, body.gatePass, Number(body.expiresInSeconds || 900));
      setEntryMode('gate-only');
      setEnteredWebsite(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token gate login failed';
      setError(message);
    } finally {
      setIsAccessLoading(false);
    }
  }

  async function handleClaimSignature(): Promise<ClaimResponse> {
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
      return body;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Claim signature failed';
      setError(message);
      throw err instanceof Error ? err : new Error(message);
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
        websiteCopy={websiteCopy}
        websiteUi={websiteUi}
        entryMode={entryMode}
        isClaimSigning={isClaimSigning}
        claimError={error}
        onClaimRewards={handleClaimSignature}
      />
    );
  }

  return (
    <div className="min-h-screen font-sans selection:bg-white selection:text-black relative overflow-hidden text-neutral-100">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12)_0%,transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.08)_0%,transparent_45%)]" />
        <div className="scanline" />
      </div>

      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14 md:py-16">
        <div className="w-full max-w-3xl">
          <div className="glass-panel rounded-3xl p-7 sm:p-10 md:p-14">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-11 h-11 bg-white text-black rounded-sm flex items-center justify-center">
                <LockKeyhole className="w-6 h-6" />
              </div>
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-white/60">
                Token-Gated Access
              </div>
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight leading-[0.9] uppercase">
              {websiteCopy.accessTitle}
            </h1>
            <p className="mt-5 text-base md:text-lg text-white/70 max-w-2xl leading-relaxed">
              {websiteCopy.accessSubtitle}
            </p>

            <div className="mt-10 rounded-2xl border border-white/15 bg-black/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.15em] text-white/50">Wallet</div>
                  <div className="mt-1 text-white/85 font-mono">
                    {isConnected ? shortAddress(walletAddress) : 'Not connected'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-[0.15em] text-white/50">Network</div>
                  <div className={`mt-1 font-mono ${isWrongNetwork ? 'text-amber-300' : 'text-white/85'}`}>
                    {chainId === null ? 'Not connected' : `Chain ${chainId}`}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleAccessLogin}
              disabled={isAccessLoading}
              className="mt-8 w-full rounded-xl bg-white text-black py-4 px-6 font-display font-bold uppercase tracking-[0.08em] text-lg transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isAccessLoading
                ? 'Connecting...'
                : !isConnected
                  ? 'Connect Wallet & Enter'
                  : isWrongNetwork
                    ? 'Switch To Base & Enter'
                    : 'Enter Website'}
            </button>

            <div className="mt-4 text-xs font-mono text-white/45">
              One click: connect, switch network if needed, sign, and enter.
            </div>

            {error ? (
              <div className="mt-6 rounded-xl border border-red-600/40 bg-red-900/20 p-4 text-sm text-red-200">{error}</div>
            ) : null}
          </div>
        </div>
      </main>
      {websiteUi.showFooter ? <SiteFooter /> : null}
    </div>
  );
}
