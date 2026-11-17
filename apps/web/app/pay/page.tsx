"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { errorCode, formatSats, log } from "@sats/core";
import { decodeBolt11, isDefinitivePayFailure, normalizeBolt11, verifyPreimage, type DecodedBolt11 } from "@sats/lightning";
import { BigButton, ScanButton, useWalletConnection } from "@sats/ui";
import { ConnectWallet } from "@/components/ConnectWallet";
import { receiptPathFromScan } from "@/lib/receiptLink";

/**
 * Customer demo wallet: a second faucet wallet that pays the box's invoice.
 * Stored in its own IndexedDB slot ("customer"), separate from the merchant's.
 */
export default function PayPage() {
  const conn = useWalletConnection("customer");
  const [balance, setBalance] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [inv, setInv] = useState<(DecodedBolt11 & { bolt11: string }) | null>(null);
  const [state, setState] = useState<"idle" | "paying" | "paid" | "unknown">("idle");
  const [preimage, setPreimage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!conn.wallet) return;
    conn.wallet.balanceSats().then(setBalance, () => setBalance(null));
  }, [conn.wallet, state]);

  const read = (raw: string) => {
    setError(null);
    setText(raw);
    try {
      const d = decodeBolt11(raw);
      if (d.sats === null || d.sats <= 0) throw new Error("amountless");
      if (d.expiresAt < Date.now() / 1000) {
        setError("This invoice has expired. Ask the seller for a new one.");
        setInv(null);
        return;
      }
      setInv({ ...d, bolt11: normalizeBolt11(raw) });
    } catch {
      setInv(null);
      if (raw.trim()) setError("That isn't a Lightning invoice with an amount.");
    }
  };

  const pay = async () => {
    if (!conn.wallet || !inv) return;
    setState("paying");
    setError(null);
    const t0 = Date.now();
    try {
      const r = await conn.wallet.payInvoice(inv.bolt11);
      // The wallet's word is checked, not trusted: the preimage must hash to the invoice's payment hash.
      if (!verifyPreimage(r.preimage, inv.paymentHash)) throw Object.assign(new Error("bad preimage"), { code: "BAD_PREIMAGE" });
      setPreimage(r.preimage);
      setState("paid");
      log.info("pay.sent", { paymentHash: inv.paymentHash, latencyMs: Date.now() - t0 });
    } catch (err) {
      const code = errorCode(err);
      log.warn("pay.failed", { code });
      if (isDefinitivePayFailure(err)) {
        setState("idle");
        setError(`Payment failed (${code}). No money left your wallet.`);
      } else {
        // Timeouts are ambiguous: the money may have gone. Never retry blindly.
        setState("unknown");
        setError(`No answer from the wallet (${code}). The payment may still go through: check the seller's box before paying again.`);
      }
    }
  };

  if (conn.status === "loading") return <p className="pt-8 text-[var(--muted)]">…</p>;

  return (
    <section className="flex w-full max-w-md flex-col gap-4 pt-4">
      <h1 className="text-2xl font-bold">Customer wallet (demo)</h1>
      <p className="text-sm text-[var(--muted)]">
        Plays the buyer in the demo: a second test wallet that pays the Konfam box. Test sats only.
      </p>

      {conn.status !== "connected" || !conn.wallet ? (
        <ConnectWallet busy={conn.status === "connecting"} error={conn.error} onConnect={conn.connect} label="Connect customer wallet" />
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-3">
            <span>
              Balance: <b className="tabular-nums">{balance === null ? "—" : formatSats(balance)}</b>
            </span>
            <BigButton variant="ghost" onClick={() => void conn.disconnect()}>Disconnect</BigButton>
          </div>

          {state === "paid" && preimage && inv ? (
            <div className="flex flex-col gap-3 rounded-2xl border-2 border-[var(--ok)] p-4">
              <p className="text-2xl font-bold text-[var(--ok)]">✓ Paid {formatSats(inv.sats ?? 0)}</p>
              <p className="text-sm text-[var(--muted)]">Proof of payment (preimage). Only the payer gets this, and only once the money has settled:</p>
              <p className="break-all rounded bg-[var(--surface-2)] p-2 font-mono text-xs">{preimage}</p>
              <p className="font-semibold">Get your receipt: scan the receipt code on the seller&apos;s box.</p>
              <ScanButton
                label="Scan receipt"
                onResult={(raw) => {
                  const path = receiptPathFromScan(raw, window.location.origin);
                  if (path) router.push(path);
                  else setError("That code isn't a Konfam receipt.");
                }}
              />
              {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
              <BigButton
                variant="secondary"
                onClick={() => {
                  setState("idle");
                  setInv(null);
                  setText("");
                  setPreimage(null);
                  setError(null);
                }}
              >
                Pay another
              </BigButton>
            </div>
          ) : (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-[var(--muted)]">Paste the invoice from the box (lnbc…)</span>
                <textarea
                  value={text}
                  onChange={(e) => read(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  autoComplete="off"
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs"
                />
              </label>
              <ScanButton label="Scan the box" onResult={read} />
              {inv && (
                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4">
                  <p className="text-3xl font-black tabular-nums">{formatSats(inv.sats ?? 0)}</p>
                  {inv.description && <p className="text-sm text-[var(--muted)]">For: {inv.description.slice(0, 60)}</p>}
                  <BigButton disabled={state !== "idle"} onClick={() => void pay()}>
                    {state === "paying" ? "Paying…" : `Pay ${formatSats(inv.sats ?? 0)}`}
                  </BigButton>
                </div>
              )}
              {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
            </>
          )}
        </>
      )}
    </section>
  );
}
