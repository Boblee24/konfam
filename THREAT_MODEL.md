# Threat model: Konfam

Konfam is client-heavy on purpose: the only server route it uses is `GET /api/rates`. There is no database. The
seller's wallet connection and receipt key never leave the seller's phone.

## Assets
| Asset | Where it lives | Why it matters |
|---|---|---|
| Seller's NWC connection string | Seller's browser, IndexedDB (`sats:nwc:merchant`) | Can create invoices and read payments; if it can spend, it can move money |
| Buyer demo NWC string (`/pay`) | Buyer's browser, IndexedDB (`sats:nwc:customer`) | Spends test sats |
| Seller's Nostr key ("Konfam ID") | Seller's browser, IndexedDB; backup shown once ("write it down") | Signs receipts; whoever holds it can issue receipts as the seller |
| Receipts | URL fragment `/r#…` | Proof of payment shown to buyers and third parties |
| Shop settings | Seller's browser, IndexedDB | Name shown on receipts |

Konfam holds no funds (no custody) and stores no personal data on a server.

## Actors
- Honest seller, honest buyer, a third party checking a receipt
- Attackers: buyer with a fake alert or screenshot, buyer playing a fake confirmation sound, receipt forger,
  someone who steals or borrows the box phone, network attacker, malicious script (XSS), curious server operator

## Trust boundaries
```
seller browser ⇄ Nostr relays (wss://relay.getalby.com, relay2) ⇄ seller's wallet service
seller browser ⇄ Konfam server (GET /api/rates only) ⇄ CoinGecko
buyer browser  ⇄ /r page (static; verification runs locally)
```

## Threats → mitigations
| Threat | Mitigation | Test / evidence |
|---|---|---|
| Fake bank alert / "I don pay" screenshot | The box turns green **only** on its own wallet's `payment_received` notification or its own `lookup_invoice`; nothing the buyer shows is an input | `app/box/page.tsx`; live test |
| Fake confirmation sound played from the buyer's phone | Full-screen green screen + amount on the seller's own device; the seller is told to trust only their own box. Stretch: a daily secret word | UI; [DEMO.md](DEMO.md) |
| Underpayment | Fixed-amount invoice; the box also rejects any settled payment smaller than asked | `box.underpaid` path |
| Notification replay / duplicates | `watchPayments` filters by payment hash, ignores outgoing/unsettled/old events, and dedupes | `watchPayments.test.ts` |
| Relay down or wallet never notifies | Polling `lookup_invoice` every 1.5 s | NWC_FINDINGS: 1 of 5 runs detected by polling |
| Forged or edited receipt | Signature over the content (seller key), `sha256(preimage) == payment_hash`, bolt11 hash + amount match; any change → NOT PROOF | `receipt.test.ts` (tampered preimage, amount, invoice swap, bad signature, every-character mutation) |
| Receipt from a different key claiming the shop's name | Verifier shows the npub and tells the user to compare it with the shop's displayed Konfam ID | `receipt.test.ts` ("re-signed by a different key") |
| Malicious receipt QR redirecting elsewhere | Scanners keep only the fragment and open it on this app's own `/r`; charset-checked | `receiptLink.test.ts` |
| Over-powerful wallet connection | On connect, `assertPermissions` against a receive-only policy; red banner if `pay_invoice`/`pay_keysend`/`multi_pay_invoice` is granted | `konfam.test.ts` |
| Bad wallet sends a wrong preimage to the buyer | `/pay` verifies `sha256(preimage)` against the invoice before showing "Paid" | `app/pay/page.tsx` |
| Ambiguous payment failure (timeout) leads to double pay | `/pay` never retries automatically; it tells the buyer to check the box first | `app/pay/page.tsx` |
| XSS / injected scripts steal the NWC string or key | Per-request nonce CSP, `connect-src` limited to the exact relay origins, no third-party scripts, self-hosted fonts; React escaping; shop name restricted (no `<`/`>`) | `csp.test.ts`, `konfam.test.ts` |
| Huge or malformed inputs | zod on settings and receipts; keypad cap (₦500,000 / 250,000 FCFA); receipt fragment ≤ 4,000 chars; bolt11 ≤ 2,000 | unit tests |
| Server learns the seller's data | The server never receives the NWC string, the key, invoices or receipts; the receipt sits in the URL fragment, which isn't sent in requests | architecture |
| PII leakage via logs | Allowlisted logger only; eslint bans `console` | `log.test.ts` |

## Residual risks (accepted, stated honestly)
- **A stolen, unlocked box phone** gives access to the NWC connection and the receipt key. Mitigations: a receive-only
  connection (cannot spend), the key backup lets the seller move to a new phone; a lost key means receipts from the
  thief would show the old npub. No remote revocation yet.
- **Faucet connections can spend.** Demo only; the red banner says so.
- **The seller must look at their own box.** If the seller trusts the buyer's phone instead, Konfam can't help.
- **Fiat amounts** depend on the BTC price source; the sats amount on the invoice is what is proven.
- **Receipts prove acknowledgement by a key**, not identity: binding an npub to a real shop is social (displayed ID)
  until Nostr-published merchant IDs exist.

## What we log / never log
- **Log:** event name, id, paymentHash, latencyMs, status, code, count
- **Never log:** request bodies, IPs, NWC strings, keys, preimages, invoices, receipts, shop names, images, audio
