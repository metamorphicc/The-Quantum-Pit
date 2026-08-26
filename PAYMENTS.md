# Payments & Donations

Quantum Pit sells **cosmetic-only** items. There are two payment rails, chosen
by how the player logged in — they are never mixed:

| Login          | Rail                | Currency | Server verification            |
| -------------- | ------------------- | -------- | ------------------------------ |
| Telegram       | Telegram Stars      | XTR      | `successful_payment` webhook   |
| Base wallet    | Base (onchain USDC) | USDC     | `eth_getTransactionReceipt`    |

The guiding rule: **the server is the only authority on what a player owns.**
The client never marks itself as paid, and paid state is never trusted from
`localStorage`. Because cosmetics are rendered locally, editing local save only
fools yourself — the meaningful guarantee is that **no entitlement is granted or
restored without a payment the server independently verified.**

---

## Audit summary (what changed)

**Before:** the checkout referenced a TON path and the "owned" flag was set
purely client-side after the wallet/Telegram call returned — there was no
server confirmation, no record of payments, and nothing to restore a purchase
on another device. Telegram Stars and Base were not actually verified.

**Now:**

- TON removed. `DonationPaymentProvider` is `'base' | 'telegram-stars'`.
- Telegram mode shows a **Stars** CTA; Base mode shows a **USDC** CTA. The
  wrong rail can't be invoked for a given login.
- Stars: invoice created server-side via the Bot API, payment confirmed by the
  `successful_payment` webhook, entitlement granted only then.
- Base: the client sends the USDC transfer, then the server confirms the
  transaction receipt on-chain and grants to the **on-chain payer**, not to any
  address the client claims.
- Every grant is **idempotent** and **replay-safe** (keyed by Stars charge id /
  tx hash), and every payment is **recorded**.
- Entitlements are **restored from the server** on login, so purchases survive
  reinstalls and move across devices.

---

## Server endpoints (`api/`)

Shared, non-routed helpers live in `api/_lib/` (the leading underscore keeps
Vercel from exposing them as functions):

- `_lib/http.ts` — tiny request/response helpers.
- `_lib/env.ts` — env accessors (with legacy-name fallbacks).
- `_lib/products.ts` — **server-side price authority**. The client cannot set a
  price; the server always uses this catalogue.
- `_lib/store.ts` — KV access, `claimOnce` (idempotency), entitlement sets.
- `_lib/telegram-auth.ts` — validates Telegram `initData` (HMAC).
- `_lib/base-rpc.ts` — reads a Base receipt and decodes the USDC `Transfer` log.

Routed functions:

- `POST /api/checkout/telegram-stars` — validates `initData`, then creates a
  Stars invoice link for a catalogue product. Refuses (503) if the store is
  unconfigured, so no charge is ever taken that couldn't be recorded.
- `POST /api/checkout/base-cosmetic` — returns the exact USDC transfer the
  wallet should send (to the treasury, amount from the catalogue).
- `POST /api/checkout/base-verify` — given `{productId, walletAddress, txHash}`,
  confirms the transaction on-chain and grants to the verified payer. Returns
  `{verified:false, pending:true}` while the tx is still unconfirmed.
- `POST /api/entitlements` — read-only; returns what the caller owns
  (Telegram user id or Base address), used to restore purchases on login.
- `POST /api/telegram` — the bot webhook: `/start` intro, `pre_checkout_query`
  (answered fast), and `successful_payment` (grants the entitlement).

### Telegram Stars flow

1. Client calls `/api/checkout/telegram-stars` with the Mini App `initData`.
2. Server validates `initData` (HMAC with the bot token), looks up the product,
   and calls `createInvoiceLink` (currency `XTR`, empty `provider_token`) with a
   signed payload carrying the product id and the Telegram user id.
3. Client opens the invoice. Telegram sends `pre_checkout_query` → the webhook
   answers it (only if currency + amount match the catalogue).
4. On payment, Telegram sends `successful_payment` → the webhook grants the
   entitlement to `message.from.id`, keyed by `telegram_payment_charge_id`
   (idempotent). If the store write fails, the webhook returns 500 so Telegram
   retries; the grant is safe to repeat.
5. Client polls `/api/entitlements` and unlocks the cosmetic.

### Base (USDC) flow

1. Client calls `/api/checkout/base-cosmetic` and receives the transfer calldata
   (USDC contract, `transfer(treasury, amount)`), amount from the catalogue.
2. Wallet sends the transaction (`eth_sendTransaction`).
3. Client calls `/api/checkout/base-verify` with the tx hash. The server fetches
   the receipt via `BASE_RPC_URL`, requires `status == 0x1`, and looks for a USDC
   `Transfer` log **to the treasury** with value **≥ the catalogue price**.
4. The entitlement is granted to the **payer decoded from the log**, keyed by tx
   hash (idempotent). Replaying the same hash grants nothing new.
5. Client unlocks the cosmetic once `verified` is returned.

---

## Environment

Copy [`.env.example`](.env.example) and fill it in (locally as `.env`, or in
Vercel → Project → Settings → Environment Variables). `.env`/`.env.local` are
gitignored — never commit real secrets.

Required for the rails to function:

- **Telegram Stars:** `TELEGRAM_BOT_TOKEN` (+ `WEBHOOK_SECRET`) and a store.
- **Base USDC:** `TREASURY_ADDRESS`, `BASE_RPC_URL`, and a store.

If the store is not configured, the payment endpoints **fail closed** (they
refuse rather than hand out entitlements the client asks for).

### Store (Vercel KV / Upstash Redis)

Create a KV/Redis store and add its REST credentials:

- Vercel KV: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, **or**
- Upstash: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

Keys used:

- `pay:tg:<chargeId>` / `pay:base:<txHash>` — one record per payment (idempotency).
- `ent:tg:<userId>` / `ent:base:<address>` — the set of owned product ids.

### Registering the Telegram webhook

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-app>/api/telegram" \
  -d "secret_token=<WEBHOOK_SECRET>" \
  -d 'allowed_updates=["message","pre_checkout_query"]'
```

---

## Optional donation contract

A plain `TREASURY_ADDRESS` is enough for v1 — the Base verifier only needs to see
USDC land in the treasury. If you later want onchain, indexable donation records,
an optional `QuantumPitDonations` contract and its **Base Sepolia-first** deploy
steps are in [`contracts/README.md`](contracts/README.md). It is **not** wired
into cosmetic checkout; set `DONATION_CONTRACT_ADDRESS` only if you deploy it.

## Testnet first

Verify the whole flow on Base Sepolia before mainnet: deploy (if using the
contract) and exercise a real Stars purchase and a real USDC transfer end to
end, confirming entitlements persist and replays grant nothing, before pointing
`BASE_RPC_URL` at mainnet.
