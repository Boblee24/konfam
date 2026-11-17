# NWC findings

Measured against faucet test wallets (merchant + customer), 2026-11-17.

## Do faucet wallets send `payment_received`?

**Yes.** The merchant connection reports `payment_received`, and the box showed "live alerts" in the live
test on a phone. In the latency run below, 4 of 5 payments were detected via the notification.

## Latency

`pnpm nwc:latency merchant customer 5` (pay → detected by the receiving wallet):

| Runs | p50 | p95 | Detected via notification | Detected via polling |
|---|---|---|---|---|
| 5 | 662 ms | 1169 ms | 4 | 1 |

The first run fell back to polling (presumably the notification subscription wasn't up yet), which is why the
polling fallback stays on in box mode (every 1.5 s).

_Paste the full per-run table the script printed here._

Note: the box's `box.paid` log measures time since the invoice was **created** (it includes the buyer scanning
and paying), not pay → detected. The wallet's `settled_at` is on another clock with 1 s precision, so the box
doesn't use it. Use this script for pay → detected latency.

## Relay origins (for `NWC_RELAY_ORIGINS`)

`wss://relay.getalby.com,wss://relay2.getalby.com`
