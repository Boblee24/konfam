# Konfam: 3-minute demo script

Read this while recording. Times are targets. **Bold** = say it. *Italic* = do it.

## Before you hit record
- **Box phone (Android):** Konfam open at https://konfam-liard.vercel.app, shop set up ("Mama Nkechi Foods", Pidgin,
  Naira), merchant wallet connected, volume at max, screen brightness max. Open **Box** and tap **Start box** (this
  unlocks the sound).
- **Buyer device (laptop or second phone):** `/pay` open, customer wallet connected, balance visible.
- **Third device** (any phone camera) ready to scan the receipt.
- Have a fake "I don pay" screenshot ready on the buyer's phone (any edited transfer screenshot).
- Do one practice payment so the relay connection is warm.

---

## 0:00–0:20 Hook
*Show the headline (Vanguard / Guardian Nigeria, Ogun, May 2026).*
**"Ogun, May 2026: a man showed a food vendor a fake transfer alert for about two thousand six hundred naira of food.
Police say he allegedly did it again and again. This happens every day, from Lagos to Dakar. A screenshot is not money."**

## 0:20–1:00 The box speaks only when money lands
*On the box phone, type 2000. The board shows ₦2,000 = sats. Tap Collect.*
**"Mama Nkechi's old phone is now her till. She types two thousand naira. It becomes a Lightning invoice."**
*Buyer device: scan the QR (or Copy invoice → paste on /pay). Tap Pay.*
*Box turns green and speaks.*
**"Listen. It speaks only when the money is in her own wallet. Not when someone shows her a screen."**
*Optional, if time: Settings → Français + FCFA → Box → 1000 → pay → it speaks French.*
**"Same box in Dakar: francs CFA, in French or Wolof."**

## 1:00–1:30 A receipt nobody can forge
*On the green screen, the receipt QR appears. Scan it with the third phone.*
**"Every buyer gets a receipt, signed by the seller's key, with the Lightning proof of payment inside."**
*Show PAID. PROVEN.*
*Copy the receipt link, change one character, open it.*
**"Change one character… NOT PROOF. Try forging that."**

## 1:30–2:10 The scam, live
*Buyer holds up the fake "I don pay" screenshot to the box phone.*
**"Now the scammer's trick: a fake screenshot. Watch the box."**
*Point at the box: it is still on the keypad or waiting screen, silent.*
**"Nothing. No green, no voice. The box doesn't read screens: it asks the seller's own wallet. No money, no voice, no
goods. That's the rule a trader can follow without reading anything."**

## 2:10–2:40 Why this is safe
*Show Settings → Wallet (the red banner) and the Konfam ID.*
**"Why Bitcoin? A bank alert travels separately from the money, so it can be faked. On Lightning, the payment and the
proof of payment are the same cryptographic event: the proof only exists once the money has settled."**
**"Konfam never holds the money. The wallet connection and the key never leave this phone; the server only fetches
the naira price. This red banner? It warns when a connection can spend money. Test wallets allow everything, so it
shows here; for real use, the seller makes a receive-only connection."**
**"Detection took about 0.7 seconds on average in our tests."**

## 2:40–3:00 What's next
**"Next: an AI checker that reads a buyer's screenshot, while the wallet's own records decide; cash-out to naira and
CFA; and a seventeen-dollar box version. Konfam: when the money is real, your phone shouts."**

---

## Honesty checklist (don't overclaim on camera)
- Say "test sats" once. Faucet wallets don't touch the real Lightning network.
- The AI screenshot checker is **next steps**, not in this build.
- "Allegedly" for the ₦10m figure.
- Don't say "instant": say "under a second and a half in our tests" (p50 662 ms, p95 1,169 ms).
