# Burn to Redeem Reward Claims + Website Access

This app uses a gated-entry + manual-claim flow:

1. Wallet signs a token-gate message (`/api/auth-gate`).
2. User enters the burn website immediately after token-gate verification.
3. In the `Redeemable Rewards` tab, wallet signs a claim message (`/api/claim-reward`) when ready to claim.
4. Backend verifies signature + token-gate ownership, then transfers a random ERC-1155 reward batch from treasury wallet to claimant.

Burn rewards can also run in mutable mint mode:

1. User burns NFT(s) (directly to dead address or through `MultiCollectionBurnRouter`).
2. Backend verifies on-chain burn logs.
3. Backend rolls random CID wins (`BURN_REWARD_CID_1..5`) and mints them into one mutable ERC-721 contract (`MutableCidRewardCollection`).

## Environment variables

Copy from `.env.example` and set real values in Vercel Project Settings.

Required:

- `TOKEN_GATE_CONTRACT`
- `TOKEN_GATE_STANDARD` (`erc721` or `erc1155`)
- `TOKEN_GATE_TOKEN_ID` (single `erc1155` gate token ID) or `TOKEN_GATE_TOKEN_IDS` (comma-separated IDs)
- `VITE_BURN_COLLECTION_SLUG` (frontend burn gallery collection slug, default `cc0-by-pierre`)
- `BURN_COLLECTION_SLUG` (server default collection slug used by `/api/nfts-to-burn`)
- `CLAIM_SIGNING_SECRET`
- `TREASURY_PRIVATE_KEY`
- `REWARD_ERC1155_CONTRACT`
- `REWARD_COLLECTION_SLUG` (default `cc0-by-pierre`; rewards are discovered from this collection in treasury wallet)
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
- `OPENSEA_HTTP_RETRY_ATTEMPTS` / `OPENSEA_HTTP_RETRY_DELAY_MS` (retry tuning for transient OpenSea 429/5xx responses)
- `NFTS_TO_BURN_CACHE_TTL_SECONDS` / `NFTS_TO_BURN_CACHE_STALE_SECONDS` (burn gallery cache + stale fallback window)
- `REWARD_GAS_MODE` (`lowest` recommended)
- `REWARD_MIN_PRIORITY_GWEI`
- `REWARD_BASE_FEE_MULTIPLIER_BPS`
- `REWARD_GAS_PRICE_MULTIPLIER_BPS`
- `REWARD_GAS_LIMIT_MULTIPLIER_BPS`
- `REWARD_TX_RETRY_ATTEMPTS`
- `REWARD_TX_RETRY_WAIT_MS`
- `REWARD_RETRY_FEE_BUMP_BPS`
- `BURN_ROUTER_CONTRACT` (optional; if set, burn txs routed through this contract are accepted and parsed via `BurnRecorded`)
- `BURN_ALLOWED_COLLECTIONS` (optional comma/newline-separated contract allowlist for direct burn tx verification)
- `REWARD_MUTABLE_NFT_CONTRACT` (optional mutable ERC-721 contract used to mint CID burn rewards)
- `REWARD_MINT_ENABLED` (`1`/`0`; enable or disable mutable reward minting from backend)
- `BURN_REWARD_CID_1` ... `BURN_REWARD_CID_5` (up to 5 CID prizes for random post-burn drops)
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `ADMIN_SESSION_TTL_SECONDS`
- `RUNTIME_CONFIG_INTERNAL_SECRET`
- `RUNTIME_CONFIG_BACKEND` (`blob` recommended for durable admin runtime overrides)
- `RUNTIME_CONFIG_BLOB_PATH` (default `state/runtime-overrides-v1.json`)
- `RUNTIME_CONFIG_BLOB_RW_TOKEN` (optional token override; otherwise uses `BLOB_READ_WRITE_TOKEN`)
- `PROGRESSION_STATE_BACKEND` (`blob` or `postgres`; use `postgres` for scalable durable leaderboard/progression state)
- `PROGRESSION_POSTGRES_URL` (required when `PROGRESSION_STATE_BACKEND=postgres`; `POSTGRES_URL` is used as fallback)
- `PROGRESSION_POSTGRES_POOL_MAX` (optional, default `5`)
- `PROGRESSION_BLOB_STATE_PATH` (default `state/progression-v1.json` when blob backend is used)
- `PROGRESSION_BLOB_RW_TOKEN` (optional token override; otherwise uses `BLOB_READ_WRITE_TOKEN`)
- `PROGRESSION_INDEXER_SECRET` (optional shared secret for manual indexer triggers)
- `PROGRESSION_INDEXER_MAX_WALLETS` (max tracked wallets scanned per cron run)
- `WEBSITE_*` copy keys (see `.env.example`) if you want deploy-time defaults for website text

## Security notes

- Keep `TREASURY_PRIVATE_KEY` server-side only.
- Use a dedicated treasury wallet with limited funds.
- For mutable burn rewards, grant this wallet minter permission on `MutableCidRewardCollection`.
- For high-value rewards, the best long-term design is an on-chain claim registry/distributor contract that tracks per-wallet claim usage against gated balance.
- `safeBatchTransferFrom` is used (one tx) and low-gas EIP-1559 overrides are applied when `REWARD_GAS_MODE=lowest`.
- If a tx remains pending, retries reuse the same nonce with a fee bump for replacement until confirmation.
- Current backend claim enforcement counts prior treasury transfer logs from `REWARD_CLAIM_START_BLOCK` to ensure a wallet cannot over-claim versus gated token units held.
- For ERC-721 token gating, claim locking is now one-time per gate token ID by embedding gate-token claim context in reward transfer calldata and scanning claim history logs.
- If `REWARD_ERC1155_TOKEN_IDS` is empty, the backend auto-discovers treasury-held token IDs from OpenSea plus on-chain transfer logs (from `REWARD_TOKEN_DISCOVERY_START_BLOCK`) before selecting random rewards.

## Admin backend login

Admin auth endpoints:

- `POST /api/admin/login` with `{ \"password\": \"...\" }`
- `GET /api/admin/config` to read effective runtime config
- `PUT /api/admin/config` to update editable runtime config keys
- `DELETE /api/admin/config` to clear overrides
- `POST /api/admin/logout` to clear admin session

Note: runtime overrides are persisted durably when Blob is enabled (`RUNTIME_CONFIG_BACKEND=blob` + Blob token). Otherwise they fall back to ephemeral `/tmp` storage.

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

### Autonomous progression indexer

- Cron endpoint: `GET /api/indexer/progression-sync` (rewritten to `/api/progression-stats?indexer=1`)
- Default schedule in `vercel.json`: daily at `03:00` UTC (`0 3 * * *`) to match Vercel Hobby limits.
- This scans known participant wallets, ingests any missed burn txs, and keeps:
  - leaderboard points
  - burn units
  - unlocked claimable rewards
  in sync without requiring users to open the app first.
- Manual run (if secret configured):  
  `GET /api/progression-stats?indexer=1&indexerSecret=YOUR_SECRET`

## Contract deployment (Base)

From project root (`/Users/pierre/Documents/New project`), deploy the new burn + mutable reward contracts:

```bash
npm run deploy:burn-reward-stack:base
```

Optional env for deployment:
- `BURN_SOURCE_COLLECTIONS` (comma-separated contracts)
- `BURN_SOURCE_TOKEN_STANDARDS` (`1` ERC-721 / `2` ERC-1155)
- `BURN_SOURCE_USE_BURN_FUNCTION` (`true/false` list)
- `REWARD_MUTABLE_MINTERS` (comma-separated addresses to grant minter role)

## Burn inventory gallery

- UI includes a `NFTS TO BURN` tab that loads wallet inventory from `GET /api/nfts-to-burn` (OpenSea-backed, server-side key only), filtered by `cc0-by-pierre` by default.
- Optional contract filtering still applies when a reward contract is configured, and the gallery is shown in a card grid ready for burn selection.
- Burn action uses wallet-signed ERC-1155 transfer to dead address, awards `20` credits per burned NFT in UI, and calls `POST /api/burn-reward` for random CID drops (`1 in 5` chance per burn).
