"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { errorCode, formatSats, log } from "@sats/core";
import { decodeBolt11, isDefinitivePayFailure, normalizeBolt11, verifyPreimage, type DecodedBolt11 } from "@sats/lightning";
import { ScanButton, useWalletConnection } from "@sats/ui";
import { ConnectWallet } from "@/components/ConnectWallet";
import { btn, Panel, Tag } from "@/components/ui";
import { receiptPathFromScan } from "@/lib/receiptLink";

/**
 * Customer demo wallet: a second faucet wallet that pays the box's invoice.
 * Stored in its own IndexedDB slot ("customer"), separate from the merchant's.
 * Paste always works; scanning appears only where the browser supports BarcodeDetector.
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

  const reset = () => {
    setState("idle");
    setInv(null);
    setText("");
    setPreimage(null);
    setError(null);
  };

  if (conn.status === "loading") return <p className="pt-8 text-[var(--muted)]">…</p>;

  return (
    <section className="flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Tag tone="ink">Demo buyer</Tag>
        <h1 className="display text-6xl">Pay the box</h1>
        <p className="font-bold">Plays the customer in the demo: a second test wallet that pays the Konfam box. Test sats only.</p>
      </div>

      {conn.status !== "connected" || !conn.wallet ? (
        <Panel title="Connect buyer wallet">
          <ConnectWallet busy={conn.status === "connecting"} error={conn.error} onConnect={conn.connect} label="Connect buyer wallet" />
        </Panel>
      ) : (
        <>
          <div className="panel flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white">
            <span>
              <span className="block text-xs font-bold text-danfo uppercase">Buyer balance</span>
              <span className="display text-3xl tabular-nums">{balance === null ? "—" : formatSats(balance)}</span>
            </span>
            <button type="button" className="text-sm font-bold underline" onClick={() => void conn.disconnect()}>
              Disconnect
            </button>
          </div>

          {state === "paid" && preimage && inv ? (
            <div className="panel flex flex-col gap-4 p-4">
              <p className="display stamp self-start bg-white text-5xl text-money">Paid</p>
              <p className="display text-4xl tabular-nums">{formatSats(inv.sats ?? 0)}</p>
              <div>
                <p className="text-sm font-bold">Proof of payment (preimage). Only the payer gets this, and only once the money has settled:</p>
                <p className="mt-1 break-all rounded-lg border-2 border-dashed border-ink bg-paper p-2 font-mono text-xs">{preimage}</p>
              </div>
              <p className="rounded-xl bg-danfo p-3 font-bold">🧾 Get your receipt: scan the receipt code on the seller&apos;s box.</p>
              <ScanButton
                label="Scan receipt"
                onResult={(raw) => {
                  const path = receiptPathFromScan(raw, window.location.origin);
                  if (path) router.push(path);
                  else setError("That code isn't a Konfam receipt.");
                }}
              />
              {error && (
                <p role="alert" className="font-bold text-alarm">
                  {error}
                </p>
              )}
              <button type="button" className={btn.plain} onClick={reset}>
                Pay another
              </button>
            </div>
          ) : (
            <Panel title="Invoice">
              <label className="flex flex-col gap-2">
                <span className="font-bold">Paste the invoice from the box</span>
                <textarea
                  value={text}
                  onChange={(e) => read(e.target.value)}
                  rows={4}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="lnbc…"
                  className="rounded-xl border-[3px] border-ink bg-white p-3 font-mono text-xs focus:outline-none focus:ring-4 focus:ring-danfo"
                />
              </label>
              <ScanButton label="Scan the box" onResult={read} />
              {inv && (
                <div className="flex flex-col gap-3 rounded-xl border-[3px] border-ink bg-paper p-4">
                  <p className="text-sm font-bold uppercase">You are paying</p>
                  <p className="display text-6xl tabular-nums">{formatSats(inv.sats ?? 0)}</p>
                  {inv.description && <p className="text-sm font-bold">For: {inv.description.slice(0, 60)}</p>}
                  <button type="button" className={`${btn.go} min-h-20 text-2xl`} disabled={state !== "idle"} onClick={() => void pay()}>
                    {state === "paying" ? "Paying…" : `Pay ${formatSats(inv.sats ?? 0)}`}
                  </button>
                </div>
              )}
              {error && (
                <p role="alert" className="rounded-xl border-[3px] border-alarm bg-white p-3 font-bold text-alarm">
                  {error}
                </p>
              )}
              {state === "unknown" && (
                <button type="button" className={btn.link} onClick={reset}>
                  Start over
                </button>
              )}
            </Panel>
          )}
        </>
      )}
    </section>
  );
}
