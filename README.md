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
- `REWARD_GAS_MODE` (`lowest` recommended)
- `REWARD_MIN_PRIORITY_GWEI`
- `REWARD_BASE_FEE_MULTIPLIER_BPS`
- `REWARD_GAS_PRICE_MULTIPLIER_BPS`
- `REWARD_GAS_LIMIT_MULTIPLIER_BPS`
- `REWARD_TX_RETRY_ATTEMPTS`
- `REWARD_TX_RETRY_WAIT_MS`
- `REWARD_RETRY_FEE_BUMP_BPS`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `ADMIN_SESSION_TTL_SECONDS`
- `RUNTIME_CONFIG_INTERNAL_SECRET`

## Security notes

- Keep `TREASURY_PRIVATE_KEY` server-side only.
- Use a dedicated treasury wallet with limited funds.
- For high-value rewards, move to contract-based allowlists/nonces and persistent claim tracking.
- `safeBatchTransferFrom` is used (one tx) and low-gas EIP-1559 overrides are applied when `REWARD_GAS_MODE=lowest`.
- If a tx remains pending, retries reuse the same nonce with a fee bump for replacement until confirmation.

## Admin backend login

Admin auth endpoints:

- `POST /api/admin/login` with `{ \"username\": \"...\", \"password\": \"...\" }`
- `GET /api/admin/config` to read effective runtime config
- `PUT /api/admin/config` to update editable runtime config keys
- `DELETE /api/admin/config` to clear overrides
- `POST /api/admin/logout` to clear admin session

Note: runtime overrides are stored in serverless runtime storage and may reset when instances restart. Use Vercel env vars for durable defaults.

Admin UI:

- `/admin` (or `/?admin=1` fallback)

## Local development

```bash
npm install
npm run dev
```

## Deploy

Deploy to Vercel and set env vars in the project dashboard.
