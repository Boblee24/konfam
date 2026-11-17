"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { errorCode, fiatToSats, formatFiat, formatSats, log, priceFor, type Fiat } from "@sats/core";
import { watchPayments, type PaySource, type Tx, type Wallet } from "@sats/lightning";
import { QR, useRates, useWalletConnection } from "@sats/ui";
import { checkMerchantPermissions, MAX_FIAT, pressKey, type Settings } from "@/lib/konfam";
import { useSettings } from "@/lib/settings";
import { enterFullscreen, keepAwake } from "@/lib/device";
import { signEvent } from "@sats/nostr/browser";
import { createReceipt, receiptUrl } from "@/lib/receipt";
import { preloadVoice, speak, unlockAudio } from "@/lib/voice/player";
import { paidAnnouncement, PAID_TITLE, phrase } from "@/lib/voice/phrases";

const INVOICE_EXPIRY_SEC = 600;
/** Polling fallback for wallets/relays that never send payment_received. */
const POLL_MS = 1500;
/** How long the receipt QR stays on the box after a payment. */
const RECEIPT_SHOW_MS = 20_000;

type Invoice = { bolt11: string; paymentHash: string; expiresAt: number; sats: number; fiat: number; createdMs: number };
type Paid = { invoice: Invoice; tx: Tx; source: PaySource; latencyMs: number };

export default function BoxPage() {
  const { settings } = useSettings();
  const conn = useWalletConnection("merchant");
  const [started, setStarted] = useState(false);

  if (settings === undefined || conn.status === "loading" || conn.status === "connecting") {
    return <Screen className="bg-[var(--bg)]"><p className="text-2xl">…</p></Screen>;
  }
  const report = conn.info ? checkMerchantPermissions(conn.info) : null;
  if (!settings || conn.status !== "connected" || !conn.wallet || !report || report.blocked) {
    return (
      <Screen className="bg-[var(--bg)]">
        <p className="text-2xl font-bold">Set up Konfam first</p>
        <p className="text-[var(--muted)]">Add your shop name and connect your wallet.</p>
        <Link href="/" className="rounded-xl bg-[var(--accent)] px-6 py-3 text-xl font-bold text-[var(--accent-fg)]">
          Set up →
        </Link>
      </Screen>
    );
  }
  if (!started) {
    return (
      <Screen className="bg-[var(--bg)]">
        <p className="text-3xl font-bold">{settings.merchantName}</p>
        <p className="max-w-sm text-center text-[var(--muted)]">
          Turn the volume up. Konfam will speak only when real money lands in your wallet.
        </p>
        <button
          type="button"
          onClick={() => {
            // Inside the tap: mobile browsers only allow sound after a user gesture.
            unlockAudio();
            enterFullscreen();
            setStarted(true);
            void preloadVoice(settings.lang).then(() => speak([phrase(settings.lang, "ready")]));
          }}
          className="min-h-24 rounded-3xl bg-[var(--ok)] px-10 text-3xl font-black text-white shadow-lg"
        >
          🔊 Enable sound &amp; start
        </button>
        {report.canSpend && (
          <p className="max-w-sm text-center text-sm text-[var(--danger)]">⚠ This connection can spend money (demo faucet wallet).</p>
        )}
      </Screen>
    );
  }
  return <Till wallet={conn.wallet} settings={settings} live={conn.info?.notifications.includes("payment_received") ?? false} />;
}

function Till({ wallet, settings, live }: { wallet: Wallet; settings: Settings; live: boolean }) {
  const rates = useRates();
  const currency: Fiat = settings.currency;
  const [amount, setAmount] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionStart = useRef(Math.floor(Date.now() / 1000));

  useEffect(() => keepAwake(), []);

  const fiat = Number(amount || "0");
  const price = rates ? priceFor(rates, currency) : null;
  const sats = price && fiat > 0 ? fiatToSats(fiat, price) : 0;

  const charge = async () => {
    if (!sats || busy) return;
    setBusy(true);
    setError(null);
    try {
      const inv = await wallet.makeInvoice({ sats, memo: "Konfam", expirySec: INVOICE_EXPIRY_SEC });
      setInvoice({ ...inv, sats, fiat, createdMs: Date.now() });
      log.info("box.invoice", { count: sats });
    } catch (err) {
      setError(errorCode(err));
      log.warn("box.invoice_failed", { code: errorCode(err) });
    } finally {
      setBusy(false);
    }
  };

  const onPaid = useCallback((inv: Invoice, tx: Tx, source: PaySource) => {
    // Settlement time from the wallet (second precision) to the moment we turn green.
    const latencyMs = tx.settledAt ? Math.max(0, Date.now() - tx.settledAt * 1000) : Date.now() - inv.createdMs;
    log.info("box.paid", { paymentHash: tx.paymentHash, latencyMs, status: source, count: tx.sats });
    setPaid({ invoice: inv, tx, source, latencyMs });
    setInvoice(null);
    void speak(paidAnnouncement(settings.lang, inv.fiat, settings.currency)).then(() =>
      log.info("box.spoken", { paymentHash: tx.paymentHash, latencyMs: Date.now() - inv.createdMs }),
    );
  }, [settings.lang, settings.currency]);

  useEffect(() => {
    if (!invoice) return;
    const inv = invoice;
    // A payment for this hash can't predate the invoice; allow 60 s of clock skew between phone and wallet.
    return watchPayments(wallet, {
      paymentHash: inv.paymentHash,
      sinceUnix: sessionStart.current - 60,
      pollMs: POLL_MS,
      onPaid: (tx, source) => {
        // Never trust a smaller payment than asked (some wallets accept any amount on an invoice).
        if (tx.sats < inv.sats) {
          log.warn("box.underpaid", { paymentHash: tx.paymentHash, count: tx.sats });
          return;
        }
        onPaid(inv, tx, source);
      },
    });
  }, [invoice, wallet, onPaid]);

  if (paid) {
    return (
      <Screen className="bg-[#0f7a2e] text-white">
        <p className="text-[22vw] leading-none sm:text-9xl" aria-hidden>✓</p>
        <p role="status" className="text-center text-5xl font-black tracking-tight">{PAID_TITLE[settings.lang]}</p>
        <p className="text-6xl font-black tabular-nums">{formatFiat(paid.invoice.fiat, currency)}</p>
        <p className="text-2xl tabular-nums opacity-90">{formatSats(paid.tx.sats)}</p>
        <p className="text-sm opacity-75">
          Confirmed by your wallet · {(paid.latencyMs / 1000).toFixed(1)} s · {paid.source === "notification" ? "live" : "checked"}
        </p>
        <ReceiptQr wallet={wallet} paid={paid} settings={settings} />
        <button
          type="button"
          onClick={() => {
            setPaid(null);
            setAmount("");
          }}
          className="mt-4 min-h-16 rounded-2xl bg-white px-10 text-2xl font-bold text-[#0f7a2e]"
        >
          Next customer
        </button>
      </Screen>
    );
  }

  if (invoice) {
    return (
      <InvoiceScreen
        invoice={invoice}
        currency={currency}
        live={live}
        onCancel={() => setInvoice(null)}
      />
    );
  }

  return (
    <Screen className="bg-[var(--bg)]">
      <p className="text-lg font-semibold text-[var(--muted)]">{settings.merchantName}</p>
      <div className="flex min-h-28 flex-col items-center justify-center">
        <p className="text-6xl font-black tabular-nums">{formatFiat(fiat, currency)}</p>
        <p className="text-xl tabular-nums text-[var(--muted)]">
          {price ? (sats ? `= ${formatSats(sats)}` : " ") : "Loading prices…"}
          {rates?.source === "fallback" && <span className="ml-2 text-sm">(offline price)</span>}
        </p>
      </div>
      <Keypad onKey={(k) => setAmount((a) => pressKey(a, k, MAX_FIAT[currency]))} />
      {error && <p role="alert" className="text-[var(--danger)]">Could not make the invoice ({error}). Check your signal and try again.</p>}
      <button
        type="button"
        disabled={!sats || busy}
        onClick={() => void charge()}
        className="min-h-20 w-full max-w-sm rounded-2xl bg-[var(--accent)] text-3xl font-black text-[var(--accent-fg)] disabled:opacity-40"
      >
        {busy ? "…" : "Collect"}
      </button>
      <Link href="/" className="text-sm text-[var(--muted)] underline">Exit box</Link>
    </Screen>
  );
}

type ReceiptState = { status: "making" } | { status: "ready" | "hidden"; url: string } | { status: "unavailable" };

/** Sign the PAID attestation with the merchant's Konfam ID and show it as a QR for 20 s. */
function ReceiptQr({ wallet, paid, settings }: { wallet: Wallet; paid: Paid; settings: Settings }) {
  const [state, setState] = useState<ReceiptState>({ status: "making" });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { tx, invoice } = paid;
      // Some wallets leave the preimage out of notifications; ask once more.
      const preimage = tx.preimage ?? (await wallet.lookupInvoice(tx.paymentHash).catch(() => null))?.preimage;
      if (!preimage) throw Object.assign(new Error("no preimage"), { code: "NO_PREIMAGE" });
      const payload = await createReceipt(
        {
          content: {
            payment_hash: tx.paymentHash,
            sats: tx.sats,
            fiat: invoice.fiat,
            currency: settings.currency,
            settled_at: tx.settledAt ?? Math.floor(Date.now() / 1000),
            merchant_name: settings.merchantName,
          },
          preimage,
          bolt11: tx.bolt11 || invoice.bolt11,
        },
        signEvent,
      );
      if (cancelled) return;
      setState({ status: "ready", url: receiptUrl(window.location.origin, payload) });
      log.info("box.receipt", { paymentHash: tx.paymentHash });
    })().catch((err) => {
      log.warn("box.receipt_failed", { code: errorCode(err) });
      if (!cancelled) setState({ status: "unavailable" });
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, paid, settings]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const url = state.url;
    const t = setTimeout(() => setState({ status: "hidden", url }), RECEIPT_SHOW_MS);
    return () => clearTimeout(t);
  }, [state]);

  if (state.status === "making") return <p className="text-sm opacity-75">Signing receipt…</p>;
  if (state.status === "unavailable") return <p className="text-sm opacity-75">Receipt not available: the wallet did not share the payment proof.</p>;
  if (state.status === "hidden") {
    return (
      <button type="button" onClick={() => setState({ status: "ready", url: state.url })} className="text-sm underline opacity-90">
        Show receipt again
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white p-3 text-black">
      <QR value={state.url} size={240} label="Receipt QR" />
      <p className="text-sm font-semibold">Scan for your receipt</p>
    </div>
  );
}

function InvoiceScreen({ invoice, currency, live, onCancel }: { invoice: Invoice; currency: Fiat; live: boolean; onCancel: () => void }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const left = invoice.expiresAt - now;
  if (left <= 0) {
    return (
      <Screen className="bg-[var(--bg)]">
        <p className="text-3xl font-bold">This code expired</p>
        <p className="text-[var(--muted)]">No money landed. Make a new one.</p>
        <button type="button" onClick={onCancel} className="min-h-16 rounded-2xl bg-[var(--accent)] px-10 text-2xl font-bold text-[var(--accent-fg)]">
          OK
        </button>
      </Screen>
    );
  }
  return (
    <Screen className="bg-white text-black">
      <p className="text-5xl font-black tabular-nums">{formatFiat(invoice.fiat, currency)}</p>
      <p className="text-xl tabular-nums">{formatSats(invoice.sats)}</p>
      <div className="rounded-2xl bg-white p-2">
        <QR value={`lightning:${invoice.bolt11}`} size={300} label="Scan to pay with Lightning" />
      </div>
      <p className="animate-pulse text-xl font-semibold">Waiting for the money…</p>
      <p className="text-sm text-neutral-600">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left · {live ? "live alerts" : "checking every 1.5 s"}
      </p>
      <p className="max-w-xs text-center text-sm text-neutral-600">Don&apos;t release goods until this screen turns green and speaks.</p>
      <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-neutral-300 px-6 text-lg">
        Cancel
      </button>
    </Screen>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];

function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid w-full max-w-sm grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          onContextMenu={(e) => {
            // Long-press ⌫ clears.
            if (k === "⌫") {
              e.preventDefault();
              onKey("C");
            }
          }}
          aria-label={k === "⌫" ? "Delete" : k}
          className="min-h-16 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-3xl font-bold active:bg-[var(--surface-2)]"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function Screen({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <main className={`flex min-h-dvh w-full flex-col items-center justify-center gap-4 p-4 ${className}`}>{children}</main>
  );
}
