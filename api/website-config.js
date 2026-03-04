import { getRuntimeConfigForRequest } from './_lib/runtimeOverrides.js';

function clean(value, fallback) {
  const parsed = String(value || '').trim();
  return parsed || fallback;
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
          'Sign once for token-gate access, then sign again to claim random rewards before entering the burn website.'
        ),
        step1Title: clean(runtime.websiteStep1Title, 'Step 1: Token-Gated Signature'),
        step1Subtitle: clean(runtime.websiteStep1Subtitle, 'Connect on Base and sign to prove ownership of the gate NFT.'),
        step2Title: clean(runtime.websiteStep2Title, 'Step 2: Claim 20 Random Reward NFTs'),
        step2Subtitle: clean(
          runtime.websiteStep2Subtitle,
          'Sign again to receive a random 20-NFT allocation from treasury wallet.'
        ),
        burnHeroSubtitle: clean(
          runtime.websiteBurnHeroSubtitle,
          'Burn your claimed rewards to stack credits and redeem premium drops.'
        ),
        nftsTabLabel: clean(runtime.websiteNftsTabLabel, 'NFTS TO BURN'),
        rewardsTabLabel: clean(runtime.websiteRewardsTabLabel, 'REDEEMABLE REWARDS'),
        nftsSectionTitle: clean(runtime.websiteNftsSectionTitle, 'NFTS TO BURN'),
        rewardsSectionTitle: clean(runtime.websiteRewardsSectionTitle, 'Redeemable Rewards')
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return res.status(500).json({ ok: false, error: message });
  }
}
