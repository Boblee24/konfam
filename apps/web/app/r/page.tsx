"use client";
import { useEffect, useState } from "react";
import { formatFiat, formatSats } from "@sats/core";
import { BigButton, ScanButton } from "@sats/ui";
import { verifyReceiptFragment, type Verification } from "@/lib/receipt";
import { receiptPathFromScan } from "@/lib/receiptLink";

const LABEL = {
  format: "Receipt format",
  signature: "Signed by the merchant",
  preimage: "Payment proof matches",
  invoice: "Invoice matches amount",
} as const;

/**
 * Receipt verifier. Runs entirely in this browser: the receipt lives in the URL fragment (#…),
 * which is never sent to any server. Works offline once the page is cached.
 */
export default function ReceiptPage() {
  const [v, setV] = useState<Verification | null | undefined>(undefined);
  const [paste, setPaste] = useState("");

  useEffect(() => {
    const run = () => setV(window.location.hash.length > 1 ? verifyReceiptFragment(window.location.hash) : null);
    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, []);

  const open = (raw: string) => {
    const path = receiptPathFromScan(raw, window.location.origin);
    if (path) window.location.hash = path.slice(2);
    else setV(verifyReceiptFragment("#invalid"));
  };

  if (v === undefined) return <p className="pt-8 text-[var(--muted)]">…</p>;

  return (
    <section className="flex w-full max-w-md flex-col gap-4 pt-4">
      {v === null ? (
        <>
          <h1 className="text-2xl font-bold">Check a Konfam receipt</h1>
          <p className="text-[var(--muted)]">Scan the receipt QR or paste the receipt link. Checking happens on this phone only.</p>
        </>
      ) : v.ok && v.content && v.npub ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-[#0f7a2e] p-5 text-white">
          <p className="text-4xl font-black">✓ PAID. PROVEN.</p>
          <p className="text-3xl font-bold tabular-nums">{formatFiat(v.content.fiat, v.content.currency)}</p>
          <p className="text-lg tabular-nums opacity-90">{formatSats(v.content.sats)}</p>
          <p className="text-lg">
            to <b>{v.content.merchant_name}</b>
          </p>
          <p className="text-sm opacity-90">{new Date(v.content.settled_at * 1000).toLocaleString()}</p>
        </div>
      ) : (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-[var(--danger)] p-5 text-white">
          <p className="text-4xl font-black">✗ NOT PROOF</p>
          <p className="text-lg">{v.checks.find((c) => !c.ok)?.why}</p>
          <p className="text-sm opacity-90">Don&apos;t accept this as proof of payment.</p>
        </div>
      )}

      {v && (
        <ul className="flex flex-col gap-1 rounded-xl border border-[var(--border)] p-3">
          {v.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <span aria-hidden className={c.ok ? "text-[var(--ok)]" : "text-[var(--danger)]"}>
                {c.ok ? "✓" : "✗"}
              </span>
              <span>
                {LABEL[c.id]}
                {!c.ok && c.why && <span className="block text-sm text-[var(--muted)]">{c.why}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {v?.ok && v.content && v.npub && (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <b>What this proves:</b> merchant &quot;{v.content.merchant_name}&quot; acknowledged receiving {formatSats(v.content.sats)} at{" "}
            {new Date(v.content.settled_at * 1000).toLocaleTimeString()}, and the payment hash matches a real Lightning payment proof.
          </p>
          <p className="text-[var(--muted)]">
            Make sure this Konfam ID is the one the shop shows. Anyone can make their own key and call themselves any name.
          </p>
          <p className="break-all rounded bg-[var(--surface-2)] p-2 font-mono text-xs">{v.npub}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <ScanButton label="Scan a receipt" onResult={open} />
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--muted)]">…or paste a receipt link</span>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={2}
            spellCheck={false}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-xs"
          />
        </label>
        <BigButton variant="secondary" disabled={!paste.trim()} onClick={() => open(paste)}>
          Check
        </BigButton>
      </div>
    </section>
  );
}
