# Burn to Redeem Reward Claims + Website Access

This app uses a two-signature flow:

1. Wallet signs a token-gate message (`/api/auth-gate`).
2. Wallet signs a claim message (`/api/claim-reward`).
3. Backend verifies both signatures and token-gate ownership, then transfers a random ERC-1155 reward batch from treasury wallet to claimant.
4. User is routed into the burn website experience and can burn claimed rewards.

## Environment variables

Copy from `.env.example` and set real values in Vercel Project Settings.

Required:

- `TOKEN_GATE_CONTRACT`
- `TOKEN_GATE_STANDARD` (`erc721` or `erc1155`)
- `TOKEN_GATE_TOKEN_ID` (single `erc1155` gate token ID) or `TOKEN_GATE_TOKEN_IDS` (comma-separated IDs)
- `CLAIM_SIGNING_SECRET`
- `TREASURY_PRIVATE_KEY`
- `REWARD_ERC1155_CONTRACT`
- `REWARD_ERC1155_TOKEN_IDS`
- `REWARD_NFTS_PER_CLAIM` (set to `20` for the current reward policy)

## Security notes

- Keep `TREASURY_PRIVATE_KEY` server-side only.
- Use a dedicated treasury wallet with limited funds.
- For high-value rewards, move to contract-based allowlists/nonces and persistent claim tracking.

## Local development

```bash
npm install
npm run dev
```

## Deploy

Deploy to Vercel and set env vars in the project dashboard.
