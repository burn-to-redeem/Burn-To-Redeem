import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

function clean(value, fallback) {
  const parsed = String(value || '').trim();
  return parsed || fallback;
}

function parseToggle(value, fallback = true) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const runtime = await getRuntimeConfigForRequest(req);
    return res.status(200).json({
      ok: true,
      website: {
        brandName: clean(runtime.websiteBrandName, 'Burn to Redeem'),
        accessTitle: clean(runtime.websiteAccessTitle, 'Burn to Redeem Access'),
        accessSubtitle: clean(
          runtime.websiteAccessSubtitle,
          'Sign once for token-gate access. Claim rewards later from the Redeemable Rewards tab inside the website.'
        ),
        step1Title: clean(runtime.websiteStep1Title, 'Step 1: Token-Gated Signature'),
        step1Subtitle: clean(runtime.websiteStep1Subtitle, 'Connect on Base and sign to prove ownership of the gate NFT.'),
        step2Title: clean(runtime.websiteStep2Title, 'Step 2: Claim Rewards In Redeemable Rewards Tab'),
        step2Subtitle: clean(
          runtime.websiteStep2Subtitle,
          'After entry, open Redeemable Rewards and sign to claim your random NFT allocation.'
        ),
        burnHeroSubtitle: clean(
          runtime.websiteBurnHeroSubtitle,
          'Burn your claimed rewards to stack game credits and redeem new digital art.'
        ),
        nftsTabLabel: clean(runtime.websiteNftsTabLabel, 'NFTS TO BURN'),
        rewardsTabLabel: clean(runtime.websiteRewardsTabLabel, 'REDEEMABLE REWARDS'),
        nftsSectionTitle: clean(runtime.websiteNftsSectionTitle, 'NFTS TO BURN'),
        rewardsSectionTitle: clean(runtime.websiteRewardsSectionTitle, 'Redeemable Rewards')
      },
      ui: {
        showHeroPanel: parseToggle(runtime.websiteShowHeroPanel, true),
        showEntryBanner: parseToggle(runtime.websiteShowEntryBanner, true),
        showFooter: parseToggle(runtime.websiteShowFooter, true),
        showTabNfts: parseToggle(runtime.websiteShowTabNfts, true),
        showTabRewards: parseToggle(runtime.websiteShowTabRewards, true),
        showTabB2R: parseToggle(runtime.websiteShowTabB2R, true),
        showTabBonfire: parseToggle(runtime.websiteShowTabBonfire, true),
        showTabForge: parseToggle(runtime.websiteShowTabForge, true),
        showTabBurnchamber: parseToggle(runtime.websiteShowTabBurnchamber, true),
        showTabNewworld: parseToggle(runtime.websiteShowTabNewworld, true),
        showTabTipstarter: parseToggle(runtime.websiteShowTabTipstarter, true),
        showTabMonochrome: parseToggle(runtime.websiteShowTabMonochrome, true),
        showTabDestiny: parseToggle(runtime.websiteShowTabDestiny, true),
        showTabKek: parseToggle(runtime.websiteShowTabKek, true),
        showTabLeaderboard: parseToggle(runtime.websiteShowTabLeaderboard, true)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return res.status(500).json({ ok: false, error: message });
  }
}
