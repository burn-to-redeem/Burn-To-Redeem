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
- `REWARD_RANDOM_STRATEGY` (`token_uniform` recommended for random distribution across token IDs, or `unit_weighted`)
- `CLAIMS_PER_GATE_TOKEN` (set to `1` to allow one reward claim per gated token unit)
- `BASE_RPC_FALLBACK_URLS` (optional comma/newline-separated Base RPC URLs for failover on log scans)
- `RPC_LOG_RETRY_ATTEMPTS` (retry passes per configured RPC endpoint for log scans)
- `RPC_LOG_RETRY_DELAY_MS` (delay between retry attempts)
- `REWARD_CLAIM_START_BLOCK` (required for claim limit enforcement; set this to the deployment block for reward claims)
- `REWARD_LOG_SCAN_STEP` (default `9000`; lower if RPC log queries time out)
- `REWARD_TOKEN_DISCOVERY_START_BLOCK` (start block for treasury token ID discovery via on-chain logs when IDs are not manually configured)
- `REWARD_TOKEN_DISCOVERY_LOG_SCAN_STEP`
- `REWARD_TOKEN_DISCOVERY_MAX_ITEMS`
- `OPENSEA_API_KEY` (used for `NFTS TO BURN` gallery and automatic reward token ID discovery)
- `OPENSEA_MCP_TOKEN` (optional alternative/extra auth header for OpenSea calls)
- `REWARD_GAS_MODE` (`lowest` recommended)
- `REWARD_MIN_PRIORITY_GWEI`
- `REWARD_BASE_FEE_MULTIPLIER_BPS`
- `REWARD_GAS_PRICE_MULTIPLIER_BPS`
- `REWARD_GAS_LIMIT_MULTIPLIER_BPS`
- `REWARD_TX_RETRY_ATTEMPTS`
- `REWARD_TX_RETRY_WAIT_MS`
- `REWARD_RETRY_FEE_BUMP_BPS`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `ADMIN_SESSION_TTL_SECONDS`
- `RUNTIME_CONFIG_INTERNAL_SECRET`
- `WEBSITE_*` copy keys (see `.env.example`) if you want deploy-time defaults for website text

## Security notes

- Keep `TREASURY_PRIVATE_KEY` server-side only.
- Use a dedicated treasury wallet with limited funds.
- For high-value rewards, the best long-term design is an on-chain claim registry/distributor contract that tracks per-wallet claim usage against gated balance.
- `safeBatchTransferFrom` is used (one tx) and low-gas EIP-1559 overrides are applied when `REWARD_GAS_MODE=lowest`.
- If a tx remains pending, retries reuse the same nonce with a fee bump for replacement until confirmation.
- Current backend claim enforcement counts prior treasury transfer logs from `REWARD_CLAIM_START_BLOCK` to ensure a wallet cannot over-claim versus gated token units held.
- If `REWARD_ERC1155_TOKEN_IDS` is empty, the backend auto-discovers treasury-held token IDs from OpenSea plus on-chain transfer logs (from `REWARD_TOKEN_DISCOVERY_START_BLOCK`) before selecting random rewards.

## Admin backend login

Admin auth endpoints:

- `POST /api/admin/login` with `{ \"password\": \"...\" }`
- `GET /api/admin/config` to read effective runtime config
- `PUT /api/admin/config` to update editable runtime config keys
- `DELETE /api/admin/config` to clear overrides
- `POST /api/admin/logout` to clear admin session

Note: runtime overrides are stored in serverless runtime storage and may reset when instances restart. Use Vercel env vars for durable defaults.

Admin UI:

- `/admin` (or `/?admin=1` fallback)
- Includes `Runtime Tab` and `Website Tab` so you can edit website copy/content from backend.

Public website-config endpoint:

- `GET /api/website-config` (frontend reads this to apply website text edited in admin)

## Local development

```bash
npm install
npm run dev
```

## Deploy

Deploy to Vercel and set env vars in the project dashboard.

## Burn inventory gallery

- UI includes a `NFTS TO BURN` tab that loads wallet inventory from `GET /api/nfts-to-burn` (OpenSea-backed, server-side key only).
- The gallery is filtered to the configured reward ERC-1155 contract and shown in a card grid ready for burn selection.
