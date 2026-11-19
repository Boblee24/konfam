# Konfam: your phone shouts when the money is REAL

> Built for Dakar Bitcoin Hack 2026. MIT licensed. **Demo: test sats, sample data.**

Konfam turns an old Android phone into a **talking Lightning till**. It speaks only when real money lands in the
seller's own wallet, in Pidgin, Yoruba, Hausa, English, French or Wolof, and gives every buyer a receipt nobody can
forge.

- **Live MVP:** https://konfam-liard.vercel.app
- **3-minute demo script:** [DEMO.md](DEMO.md) · video: _link to add_
- **Threat model:** [THREAT_MODEL.md](THREAT_MODEL.md)

## Problem & primary user
Sellers release goods on the strength of a bank alert or an "I don pay" screenshot, and both can be faked. For
example, Ogun police arrested a 23-year-old on May 17, 2026 in Agbado after he showed a food vendor a fake transfer
alert for about ₦2,600 of food; he allegedly confessed to about ₦10m in similar frauds (police-reported, not proven).
Sources: [Vanguard](https://www.vanguardngr.com/2026/05/ogun-police-arrest-23-year-old-over-alleged-n10m-fake-bank-transfer/),
[The Guardian Nigeria](https://guardian.ng/news/nigeria/metro/suspect-arrested-over-serial-fake-bank-transfer-fraud-in-ogun/).

- **Primary user:** market sellers, food vendors, POS agents and WhatsApp/Instagram sellers who hand over goods on
  an alert or a screenshot, from Lagos to Dakar.
- **Not a POS.** Konfam is a trust and verification layer that sits beside any Lightning merchant tool and cash-out.

## How it works
```
 Seller's phone ("the box")                                Buyer's phone
 ┌──────────────────────────────┐                          ┌──────────────────┐
 │ keypad ₦2,000 → 2,327 sats   │  invoice QR  ──────────▶ │ any Lightning    │
 │ waits…                       │                          │ wallet pays      │
 │ payment_received (NWC) ◀─────┼── Nostr relay ◀── seller's wallet ◀──┘
 │ GREEN + speaks "E don land!" │
 │ signs PAID receipt (Nostr)   │  receipt QR  ──────────▶  /r verifies on-device
 └──────────────────────────────┘
 Server: only GET /api/rates (BTC→NGN/XOF). No database. The wallet connection and the
 receipt-signing key live in the seller's browser (IndexedDB) and never reach the server.
```

1. **Setup (`/`):** shop name, voice, NGN or FCFA, paste the wallet's NWC connection. Konfam checks the connection's
   permissions and shows a red banner if it can spend (see Security).
2. **Box (`/box`):** type the amount, show the QR, wait. The box listens for the wallet's `payment_received`
   notification over Nostr, with a 1.5 s polling fallback, and only then turns green and speaks.
3. **Receipt:** the box signs a PAID attestation with the seller's Nostr key ("Konfam ID") and shows it as a QR for
   20 s. Anyone can check it at `/r`, offline, in the browser.
4. **Buyer demo wallet (`/pay`):** a second test wallet that pays the box, for the demo.

## Why Bitcoin / Lightning / Nostr
- **Lightning:** bank and mobile-money alerts can be forged because the alert travels separately from the money. On
  Lightning, the payment and the proof of payment are the same cryptographic event: the preimage only exists in the
  payer's hands once the money has settled.
- **Nostr:** NWC (Nostr Wallet Connect) delivers the real-time `payment_received` signal from the seller's own wallet,
  and the seller's Nostr key signs receipts.

## What a receipt proves (and what it doesn't)
The receipt is `{ signed PAID event, preimage, bolt11 }` in the URL fragment (`/r#…`), which browsers never send to a
server. `/r` checks:
1. the event's signature → it was issued by this Konfam ID (npub shown);
2. `sha256(preimage) == payment_hash` → the hash belongs to a real Lightning payment preimage;
3. the bolt11's hash and amount match the event.

All three pass → **PAID. PROVEN.** Any one fails → **NOT PROOF**, naming the failed check. Changing one character
turns it red (tested). Honest wording: *"Merchant X acknowledged receiving N sats at T, and the payment hash
matches."* It does not prove who paid, or that the npub belongs to the shop in front of you: shops display their
Konfam ID for that.

## Where AI is used
**Not in this submission.** The planned Konfam Check (a vision model reads a buyer's payment screenshot; the wallet's
own ledger, not the AI, decides) is designed but not built: see [Next steps](#next-steps). The box itself needs no AI:
it trusts only the seller's wallet.

## Security by design
Summary (details in [THREAT_MODEL.md](THREAT_MODEL.md)):
- **Receive-only check:** on connect, Konfam lists the connection's permissions and shows a red banner if it can
  spend (`pay_invoice`, `pay_keysend`, `multi_pay_invoice`). Faucet test wallets grant everything, so **the banner
  shows in the demo too: that's the feature working.** For real use, create a receive-only connection.
- **No custody, no database:** money lands in the seller's own wallet. The NWC string and Nostr key live only in the
  seller's browser.
- **Trust only the seller's own device:** the box turns green only on its own wallet's notification or lookup, never
  on anything the buyer shows. Replayed notifications are deduped by payment hash and old ones ignored.
- **Inputs:** zod on every input; keypad capped (₦500,000 / 250,000 FCFA in the demo); invoice amount checked against
  the payment.
- **CSP:** per-request nonce, exact relay origins only, self-hosted fonts, no third-party scripts.
- **No PII in logs:** an allowlisted logger (event, id, paymentHash, latencyMs, status, code, count), enforced by a test.

## Low-bandwidth UX
- **First-load JS:** about **280 KB gzipped** (about 890 KB uncompressed) per page, measured by summing every
  `<script>` a page loads from the production build, fetched with gzip. About 150 KB of that is the React/Next
  runtime; the Lightning/Nostr/QR libraries are about 57 KB. This is above our 200 KB target (see Next steps).
- **Voice is offline:** recorded clips are static files cached by the service worker; missing clips fall back to the
  phone's built-in voice. No network TTS ever.
- Phone-first UI: huge tap targets, high contrast, always light for use in sunlight; app shell cached for bad signal.

## Metrics
| Metric | Value | How measured |
|---|---|---|
| Payment → detected (NWC), p50 | **662 ms** | `pnpm nwc:latency merchant customer 5`, faucet wallets, 2026-11-17 |
| Payment → detected (NWC), p95 | **1,169 ms** | same run; 4 of 5 detected by notification, the first by polling |
| Faucet wallets send `payment_received` | **Yes** | `pnpm nwc:probe` + live box showed "live alerts" |
| Phase 1 checkpoint (pay on one phone → box green) | **Verified live** | on https://konfam-liard.vercel.app with two devices |
| First-load JS | **~280 KB gzip** | see Low-bandwidth UX |
| Receipt QR payload | < 1.6 KB | unit test (`receipt.test.ts`) |
| Tests | 97 passing | `pnpm test` (amounts spoken 0–9,999,999, receipt tamper cases, permissions, keypad caps) |
| Audio pack per language | _pending_ | clips being recorded; `pnpm voice:import` prints the size |

Details: [docs/NWC_FINDINGS.md](docs/NWC_FINDINGS.md).

## Setup (one command)
```bash
pnpm demo
```
Creates `.env.local`, two faucet test wallets (`NWC_MERCHANT`, `NWC_CUSTOMER`), fills `NWC_RELAY_ORIGINS` (the
browser CSP needs the wallet relays), builds and starts http://localhost:3000.

1. Seller phone: open `/`, set up the shop, paste `NWC_MERCHANT`, open **Box**, tap **Start box**.
2. Buyer phone or laptop: open `/pay`, paste `NWC_CUSTOMER`, scan the QR (or tap **Copy invoice** on the box and paste).
3. The box turns green and speaks; scan its receipt QR, or open the link on any device.

Docker: `docker compose up`. Voice clips: record per [VOICE_CLIPS.md](VOICE_CLIPS.md), put the raw files in
`voice-raw/<lang>/`, run `pnpm voice:import`.

## Constraints & what's simulated
- **Test sats:** faucet wallets (faucet.nwc.dev) hold test sats; they pay each other, not the real Lightning network.
- **The buyer** is a second faucet wallet in `/pay`; a real buyer would use any Lightning wallet.
- **The box** is a phone browser, not hardware.
- **No bank API:** Konfam can't verify bank or mobile-money transfers; it only confirms Lightning payments to the
  seller's own wallet.
- **Fiat prices** come from CoinGecko via `/api/rates`, with a fallback price if it's down ("offline price" is shown).
- **Voice:** until the recorded clips are in, the phone's built-in voice speaks (English for Pidgin/Yoruba/Hausa,
  French for French/Wolof).

## Next steps
- **Konfam Check (AI):** a vision model extracts amount/hash/app from a buyer's screenshot (zod-validated, prompt
  injection ignored) and the seller's own wallet ledger decides MATCHED / NOT IN WALLET / CAN'T VERIFY BANK MONEY.
- First-load JS under 200 KB (smaller schema library on the client, lazy-load the wallet panel).
- Daily secret word in the spoken confirmation (defeats a buyer playing a fake "E don land" sound).
- Banxaas-style cash-out to naira/FCFA, a $17 ESP32 hardware box, Nostr-published merchant IDs.
- Out of scope for now: bank/mobile-money integration, USSD, multi-merchant accounts, mainnet onboarding.

## License
MIT
