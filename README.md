# Konfam: your phone shouts when the money is REAL

Fake bank alerts and fake "I don pay" screenshots cheat sellers every day, from Lagos to Dakar. Konfam turns an old
Android phone into a **talking Lightning till**: it speaks only when real money lands in the merchant's own wallet,
gives every buyer a receipt nobody can forge, and checks payment screenshots against the wallet's real records.

> Work in progress for Dakar Bitcoin Hack 2026. The full README (metrics, threat model, demo) comes in Phase 5.

## Quick start
```bash
pnpm demo
```
Creates `.env.local`, two faucet test wallets (`NWC_MERCHANT`, `NWC_CUSTOMER`), fills `NWC_RELAY_ORIGINS`, builds and
starts http://localhost:3000.

1. Merchant phone: open `/`, enter the shop name, voice and currency, paste `NWC_MERCHANT`, open **Box**.
2. Customer phone: open `/pay`, paste `NWC_CUSTOMER`, scan the box's QR, pay.
3. The box turns green and speaks. Its receipt QR opens `/r`, which anyone can verify offline.

**Demo note:** faucet wallets grant every permission, so the setup page shows a red "this connection can spend money"
banner. That is the feature working: for real use, create a receive-only connection in your wallet.

## Pages
| Route | Purpose |
|---|---|
| `/` | Setup: shop name, voice language, NGN/XOF, connect wallet (receive-only check), Konfam ID + backup |
| `/box` | Box mode: keypad → invoice QR → waits → green screen + voice → receipt QR |
| `/pay` | Customer demo wallet (second faucet wallet) |
| `/r` | Receipt verifier (client-side only) |
| `/wallet` | Merchant wallet (`@sats/ui` WalletPanel) |

## Built on `sats-starter`
| Package | What it does |
|---|---|
| `@sats/core` | zod env, allowlisted logger, rate limit, sats↔NGN/XOF, i18n (en/pcm/fr), CSP builder |
| `@sats/lightning` | NWC wallet wrapper (integer sats), `watchPayments` (notifications + polling, deduped), bolt11 decode, `verifyPreimage`, permission checks |
| `@sats/nostr` | browser key in IndexedDB + backup, sign/verify |
| `@sats/ai` | `extractJson`: Gemini structured output, zod-validated, prompt-injection wrapper, `AI_MOCK` fixtures |
| `@sats/ui` | `WalletPanel`, `SatsAmount`, `BigButton`, `QR`, `ScanButton`, banners |

## Scripts
| Command | |
|---|---|
| `pnpm wallets:new <label> [sats]` | faucet test wallet → `NWC_<LABEL>` in `.env.local` (secret masked) |
| `pnpm nwc:probe` | methods, notification support, relay origins, balance for each wallet |
| `pnpm nwc:latency [recv] [payer] [runs]` | pay → detected latency, notification vs polling |
| `pnpm typecheck && pnpm test && pnpm lint` | before every commit |

## Rules (see STARTER_RULES.md)
Integer sats everywhere; log only through `@sats/core/log`; secrets only in server env; zod on every input;
AI never moves money; no custody. The merchant's wallet connection lives only in the browser's IndexedDB.

## Known limits
- Faucet wallets hold test sats; they pay each other, not the real Lightning network.
- Browser wallets need their relay in `NWC_RELAY_ORIGINS` (CSP); `pnpm demo` fills it.
