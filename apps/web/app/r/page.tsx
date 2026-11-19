"use client";
import { useEffect, useState } from "react";
import { formatFiat, formatSats } from "@sats/core";
import { ScanButton } from "@sats/ui";
import { btn, Panel } from "@/components/ui";
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
    <section className="flex w-full max-w-md flex-col gap-5">
      {v === null ? (
        <div className="flex flex-col gap-2">
          <h1 className="display text-6xl">Check a receipt</h1>
          <p className="font-bold">Scan the receipt QR or paste the link. The check happens on this phone only.</p>
        </div>
      ) : v.ok && v.content && v.npub ? (
        <div role="status" className="panel flex flex-col items-start gap-3 overflow-hidden bg-money p-5 text-white">
          <p className="display stamp bg-money-deep text-[2.6rem]">Paid. Proven.</p>
          <p className="display text-7xl tabular-nums">{formatFiat(v.content.fiat, v.content.currency)}</p>
          <p className="text-xl font-bold tabular-nums">{formatSats(v.content.sats)}</p>
          <p className="text-xl">
            to <b>{v.content.merchant_name}</b>
          </p>
          <p className="font-bold">{new Date(v.content.settled_at * 1000).toLocaleString()}</p>
        </div>
      ) : (
        <div role="alert" className="panel flex flex-col items-start gap-3 bg-alarm p-5 text-white">
          <p className="display stamp text-5xl">Not proof</p>
          <p className="text-xl font-bold">{v.checks.find((c) => !c.ok)?.why}</p>
          <p className="rounded-lg bg-ink px-3 py-1 font-bold text-danfo">✋ Don&apos;t release goods on this.</p>
        </div>
      )}

      {v && (
        <ul className="panel flex flex-col divide-y-2 divide-ink/15 px-4 py-2">
          {v.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 py-2">
              <span
                aria-hidden
                className={`grid size-8 shrink-0 place-items-center rounded-md border-2 border-ink font-bold text-white ${c.ok ? "bg-money" : "bg-alarm"}`}
              >
                {c.ok ? "✓" : "✗"}
              </span>
              <span className="font-bold">
                {LABEL[c.id]}
                {!c.ok && c.why && <span className="block text-sm font-normal">{c.why}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {v?.ok && v.content && v.npub && (
        <Panel title="What this proves">
          <p>
            Merchant &quot;{v.content.merchant_name}&quot; acknowledged receiving {formatSats(v.content.sats)} at{" "}
            {new Date(v.content.settled_at * 1000).toLocaleTimeString()}, and the payment hash matches a real Lightning payment proof.
          </p>
          <p className="rounded-xl bg-danfo p-3 font-bold">
            Check this Konfam ID against the one the shop shows. Anyone can make a key and call themselves any name.
          </p>
          <p className="break-all rounded-xl border-2 border-dashed border-ink bg-paper p-2 font-mono text-xs">{v.npub}</p>
        </Panel>
      )}

      <Panel title={v ? "Check another" : undefined}>
        <ScanButton label="Scan a receipt" onResult={open} />
        <label className="flex flex-col gap-1">
          <span className="font-bold">Paste a receipt link</span>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder="https://…/r#…"
            className="rounded-xl border-[3px] border-ink bg-white p-2 font-mono text-xs focus:outline-none focus:ring-4 focus:ring-danfo"
          />
        </label>
        <button type="button" className={btn.primary} disabled={!paste.trim()} onClick={() => open(paste)}>
          Check receipt
        </button>
      </Panel>
    </section>
  );
}
