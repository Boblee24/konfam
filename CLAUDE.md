# Konfam: "Your phone shouts when the money is REAL"

This repo was created from `sats-starter`. **Read the starter rules first (`STARTER_RULES.md`); they still apply** (units, logging allowlist, secrets, zod, AI never moves money, HUMAN TODO blocks). Work through `BUILD_ORDER.md` in order.

## The pitch (10-second version)
Fake bank alerts and fake "I don pay" screenshots cheat sellers every day, from Lagos to Dakar. Konfam turns an old Android phone into a **talking Lightning till**. It speaks only when real money lands, in Pidgin, Yoruba, Hausa, Wolof or French. It gives every buyer a receipt nobody can forge. Its AI checker catches fake payment screenshots by comparing them against the wallet's real records.

- **Primary user:** market sellers, food vendors, POS agents and WhatsApp/Instagram sellers who release goods on the strength of an alert or a screenshot.
- **Why Bitcoin (say it exactly like this):** bank and mobile-money alerts can be forged because the alert travels separately from the money. On Lightning, the payment and the proof of payment are the same cryptographic event: the preimage only exists in the payer's hands once the money has settled.
- **Why Nostr:** NWC (wallet connection over Nostr) delivers the real-time `payment_received` signal. The merchant's Nostr key signs receipts ("Konfam ID").
- **Why AI:** a vision model reads the scammer's screenshot, but **the ledger decides, not the AI**.
- **Not a POS.** Konfam is a trust and verification layer that works alongside any Lightning merchant tool (SunuSats, Caisse Teranga…) and Banxaas-style cash-out.

## Architecture (client-heavy on purpose: smaller attack surface)
- **No database.** The merchant's NWC connection string lives **only in the browser** (IndexedDB) on the merchant's own phone. The server never sees it.
- Server routes (the only server code):
  - `POST /api/check`: receives a downscaled screenshot (≤1024px JPEG), calls `@sats/ai.extractJson`, returns the extracted fields. **Doesn't store or log the image.** Rate-limited.
  - `GET /api/rates`: from the starter.
- **Matching happens in the browser:** the client compares the AI-extracted fields with its own `listTransactions`, so the ledger never leaves the device.

### Pages
| Route | Purpose |
|---|---|
| `/` | Landing + "Set up my Konfam" (merchant name, language, currency NGN/XOF, connect wallet) |
| `/box` | **Box mode**: fullscreen, keypad → invoice QR → waits → speaks + green screen → receipt QR |
| `/pay` | Customer demo wallet (second faucet wallet): scan/paste invoice → pay → show preimage |
| `/r` | Receipt verifier (works for anyone, offline-capable, client-side only) |
| `/check` | Konfam Check: upload screenshot → spoken verdict |
| `/wallet` | WalletPanel from `@sats/ui` (the wallet-implementation requirement) |
| `/settings` | Language, voice test, Konfam ID (npub + QR), backup key, permissions status |

## Security design (put all of this in THREAT_MODEL.md)
- **Receive-only connection:** on connect, call `info()` and run `assertPermissions(info, { allow: ["make_invoice","lookup_invoice","list_transactions","get_balance","get_info"], forbid: ["pay_invoice","pay_keysend","multi_pay_invoice"] })`. If spending methods are present, show a **red banner**: "This connection can spend money. For real use, create a receive-only connection in your wallet." Faucet wallets grant everything, so the banner shows in the demo too. Mention that in the README; it's a feature.
- **Fake audio from the buyer's phone:** the box shows a full-screen visual plus a spoken confirmation, and trust comes only from the merchant's own device. Stretch: a daily secret word in the spoken phrase.
- **Notification replay/duplicates:** `watchPayments` dedupes by paymentHash and ignores events older than the session start. Polling fallback if the relay is down.
- **Forged receipt:** the receipt is a merchant-signed Nostr event plus the preimage; see the receipt design below.
- **AI:** only extracts. Output is zod-validated. Any instruction-like text inside a screenshot is ignored (untrusted_content wrapper). The verdict comes from a deterministic matcher.
- **Inputs:** amount keypad capped (e.g. ≤ ₦500,000 / ≤ 250,000 FCFA in demo), image type/size checks client- and server-side, CSP from the starter.
- **No PII:** the screenshot is processed in memory and discarded; logs hold only event names, latency and status. No custody: funds sit in the merchant's own wallet.

## Receipt design (state precisely what it proves)
After `watchPayments` fires for invoice X, the box creates a **PAID attestation** signed with the merchant's Nostr key:
`{ kind: 30078 (or a regular kind), content: JSON { v:1, payment_hash, sats, fiat, currency, settled_at, merchant_name }, tags: [["t","konfam-receipt"]] }`.
The receipt QR/link is `/r#<base64url({ event, preimage, bolt11 })>`. The fragment never reaches the server.
The verifier checks:
1. The event signature is valid → it was issued by this merchant npub (show the npub + name).
2. `sha256(preimage) === payment_hash` → the hash belongs to a real Lightning payment preimage.
3. The bolt11's amount and hash match the event.
It then shows **"PAID. PROVEN."** (green) or **"NOT PROOF"** (red, with the failing check).
Honest wording: "Merchant X acknowledged receiving N sats at T, and the payment hash matches." Tamper test: change one character → red.

## Voice design
- Files live under `public/voice/<lang>/<clip>.mp3`, recorded by the human (see `VOICE_CLIPS.md`) and precached by the service worker. **No live TTS during the demo.**
- Amounts are spoken with **English number clips** for `pcm`/`yo`/`ha`/`en` (Nigerian traders say amounts in English all the time) and with **French via `speechSynthesis` `fr-FR`** for `fr`/`wo`, unless recorded French/Wolof clips exist.
- `composeAmount(n, lang)` → a clip sequence (e.g. 2500 → `two, thousand, five, hundred` + `naira`). Unit-test it from 0 to 9,999,999.
- Phrase templates per language: `received`, `landed`, `not_found`, `amount_differs`, `bank_alert`, `ready`.
- Until the human's clips arrive, fall back to `speechSynthesis` `en-NG`/`en-GB` so you're never blocked.
- Mobile autoplay rules: the box needs a one-tap "Enable sound" step. Request a Wake Lock in box mode.

## Konfam Check (AI) flow and verdicts
1. The merchant picks a screenshot → the client downscales it to ≤1024px JPEG (canvas re-encode also strips EXIF) → `POST /api/check`.
2. Server: `extractJson` with this schema:
   ```ts
   z.object({
     kind: z.enum(["lightning","bank","mobile_money","unknown"]),
     app_name: z.string().max(40).nullable(),
     amount: z.number().nonnegative().nullable(),
     currency: z.enum(["sats","NGN","XOF","USD","unknown"]),
     timestamp_text: z.string().max(40).nullable(),
     reference: z.string().max(80).nullable(),
     payment_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
     tamper_signals: z.array(z.enum(["font_mismatch","misaligned_text","edited_amount","duplicate_alert","impossible_time","none"])).max(5),
     confidence: z.number().min(0).max(1)
   })
   ```
3. Client-side matcher, against `listTransactions({ type:"incoming", fromUnix: now-24h })`:
   - `lightning` + payment_hash match → **MATCHED**
   - `lightning` + amount match within ±10 min of the stated time → **MATCHED (by amount/time)**
   - `lightning` + a near-match with a different amount → **AMOUNT_DIFFERS**
   - `lightning` + no match → **NOT_IN_WALLET**: speak `not_found` ("No money don land for this one. No release goods.")
   - `bank` / `mobile_money` → **CAN'T VERIFY BANK MONEY**: speak `bank_alert` ("Check your bank app yourself. Never release goods on a screenshot."). Show any `tamper_signals` as hints only, never as proof.
4. Show what the AI extracted beside the verdict, so the merchant can see the reasoning.

## 3-minute demo script (build towards this)
1. 0:00–0:20 Hook: a real fake-alert arrest headline (Ogun, May 2026, ₦2,600 of food). "This happens every day from Lagos to Dakar."
2. 0:20–1:00 Box mode: ₦2,000 → the customer phone pays → the box speaks Pidgin. Switch to French/Wolof → 1,000 FCFA.
3. 1:00–1:30 Receipt: scan it on a third device → PAID. PROVEN. Edit one character → red.
4. 1:30–2:10 Scam: upload a forged "50,000 sats sent" screenshot → AI reads it → ledger says no → the box says it out loud.
5. 2:10–2:40 Security: receive-only permissions, no custody, the ledger never leaves the phone, no PII, offline audio.
6. 2:40–3:00 Reach + next: Banxaas-style cash-out, a $17 ESP32 box version, Nostr-published merchant IDs.

## README metrics (measure, don't guess)
Payment-to-voice latency p50/p95 (20 payments; notification vs polling) · first-load JS KB · audio pack KB per language · Konfam Check eval: extraction accuracy, fake-detection precision/recall on the labelled set, p50 latency, cost per check · offline announce works Y/N · fresh-clone setup time.

## Out of scope (list under "Next steps")
Hardware box, bank/mobile-money API integration, USSD, multi-merchant accounts, mainnet onboarding flows.
