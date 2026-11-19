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
import { btn } from "@/components/ui";
import { Wordmark } from "../shell";

const INVOICE_EXPIRY_SEC = 600;
/** Polling fallback for wallets/relays that never send payment_received. */
const POLL_MS = 1500;
/** How long the receipt QR stays on the box after a payment. */
const RECEIPT_SHOW_MS = 20_000;

type Invoice = { bolt11: string; paymentHash: string; expiresAt: number; sats: number; fiat: number; createdMs: number };
type Paid = { invoice: Invoice; tx: Tx; source: PaySource };

export default function BoxPage() {
  const { settings } = useSettings();
  const conn = useWalletConnection("merchant");
  const [started, setStarted] = useState(false);

  if (settings === undefined || conn.status === "loading" || conn.status === "connecting") {
    return (
      <Screen className="bg-danfo">
        <Wordmark className="text-5xl" />
        <p className="dots text-2xl" aria-label="Loading">
          <span />
          <span />
          <span />
        </p>
      </Screen>
    );
  }
  const report = conn.info ? checkMerchantPermissions(conn.info) : null;
  if (!settings || conn.status !== "connected" || !conn.wallet || !report || report.blocked) {
    return (
      <Screen className="bg-danfo">
        <Wordmark className="text-5xl" />
        <p className="display text-center text-5xl">Set up first</p>
        <p className="max-w-xs text-center text-lg font-bold">Add your shop name and connect your wallet.</p>
        <Link href="/" className={`${btn.primary} min-w-60`}>
          Set up →
        </Link>
      </Screen>
    );
  }
  if (!started) {
    return (
      <Screen className="bg-danfo">
        <Wordmark className="text-5xl" />
        <p className="display rise text-center text-6xl leading-none">{settings.merchantName}</p>
        <p className="rise-2 max-w-xs text-center text-lg font-bold">
          Turn the volume up. Konfam speaks only when real money lands in your wallet.
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
          className={`${btn.primary} rise-3 min-h-28 w-full max-w-sm rounded-2xl text-4xl`}
        >
          <span aria-hidden>🔊</span> Start box
        </button>
        {report.canSpend && (
          <p className="max-w-xs rounded-lg bg-ink px-3 py-1 text-center text-sm font-bold text-white">
            ⚠ Demo wallet: this connection can also spend.
          </p>
        )}
        <Link href="/" className={btn.link}>
          Back
        </Link>
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

  const onPaid = useCallback(
    (inv: Invoice, tx: Tx, source: PaySource) => {
      // latencyMs here = time since the invoice was CREATED (includes the buyer scanning and paying).
      // It is NOT pay→detected: the wallet's settled_at is on another clock with 1 s precision, so we
      // don't use it. Pay→detected latency is measured with `pnpm nwc:latency` (docs/NWC_FINDINGS.md).
      log.info("box.paid", { paymentHash: tx.paymentHash, latencyMs: Date.now() - inv.createdMs, status: source, count: tx.sats });
      setPaid({ invoice: inv, tx, source });
      setInvoice(null);
      void speak(paidAnnouncement(settings.lang, inv.fiat, settings.currency)).then(() =>
        // Also measured from invoice creation.
        log.info("box.spoken", { paymentHash: tx.paymentHash, latencyMs: Date.now() - inv.createdMs }),
      );
    },
    [settings.lang, settings.currency],
  );

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
      <Screen className="bg-money text-white">
        <div
          className="burst grid size-32 place-items-center rounded-full border-[6px] border-white bg-money-deep text-7xl leading-none"
          aria-hidden
        >
          ✓
        </div>
        <p role="status" className="display rise text-center text-[3.4rem] sm:text-8xl">
          {PAID_TITLE[settings.lang]}
        </p>
        <p className="display rise-2 text-7xl tabular-nums">{formatFiat(paid.invoice.fiat, currency)}</p>
        <p className="rise-2 text-2xl font-bold tabular-nums">{formatSats(paid.tx.sats)}</p>
        <p className="rounded-full bg-money-deep px-3 py-1 text-sm font-bold">
          Confirmed by your wallet · {paid.source === "notification" ? "live" : "checked"}
        </p>
        <ReceiptQr wallet={wallet} paid={paid} settings={settings} />
        <button
          type="button"
          onClick={() => {
            setPaid(null);
            setAmount("");
          }}
          className={`${btn.plain} min-h-16 w-full max-w-sm text-2xl`}
        >
          Next customer →
        </button>
      </Screen>
    );
  }

  if (invoice) {
    return <InvoiceScreen invoice={invoice} currency={currency} live={live} onCancel={() => setInvoice(null)} />;
  }

  return (
    <main className="flex min-h-dvh w-full flex-col items-center bg-paper">
      <div className="flex w-full items-center justify-between gap-2 bg-danfo px-4 py-2">
        <span className="display truncate text-2xl">{settings.merchantName}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-bold text-danfo">{live ? "LIVE ⚡" : "CHECKING"}</span>
          <Link href="/" className="rounded-md border-2 border-ink px-2 py-0.5 text-sm font-bold">
            Exit
          </Link>
        </span>
      </div>
      <div className="stripe w-full" aria-hidden />
      <div className="flex w-full max-w-sm grow flex-col justify-center gap-4 p-4">
        {/* Price board: yellow digits on black, readable across a stall. */}
        <div className="panel flex min-h-36 flex-col items-end justify-center bg-ink px-4 py-3 text-right">
          <p className="display text-[4.2rem] text-danfo tabular-nums" aria-live="polite">
            {formatFiat(fiat, currency)}
          </p>
          <p className="text-lg font-bold text-white tabular-nums">
            {price ? (sats ? `= ${formatSats(sats)}` : "Type the amount") : "Loading prices…"}
            {rates?.source === "fallback" && <span className="ml-2 text-sm text-danfo">(offline price)</span>}
          </p>
        </div>
        <Keypad onKey={(k) => setAmount((a) => pressKey(a, k, MAX_FIAT[currency]))} />
        {error && (
          <p role="alert" className="rounded-xl border-[3px] border-alarm bg-white p-3 font-bold text-alarm">
            Could not make the invoice ({error}). Check your signal and try again.
          </p>
        )}
        <button type="button" disabled={!sats || busy} onClick={() => void charge()} className={`${btn.go} display min-h-20 w-full text-4xl`}>
          {busy ? "…" : sats ? `Collect ${formatFiat(fiat, currency)}` : "Collect"}
        </button>
      </div>
    </main>
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

  if (state.status === "making") return <p className="text-sm font-bold">Signing receipt…</p>;
  if (state.status === "unavailable") return <p className="text-sm font-bold">Receipt not available: the wallet did not share the payment proof.</p>;
  if (state.status === "hidden") {
    return (
      <button
        type="button"
        onClick={() => setState({ status: "ready", url: state.url })}
        className="min-h-12 font-bold underline decoration-2 underline-offset-4"
      >
        Show receipt again
      </button>
    );
  }
  return (
    <div className="rise-3 flex flex-col items-center gap-1 rounded-2xl border-[3px] border-ink bg-white p-3 text-ink">
      <p className="display text-2xl">🧾 Scan for your receipt</p>
      <QR value={state.url} size={230} label="Receipt QR" />
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
      <Screen className="bg-paper">
        <p className="display text-center text-6xl">Code expired</p>
        <p className="text-lg font-bold">No money landed. Make a new one.</p>
        <button type="button" onClick={onCancel} className={`${btn.primary} min-w-60`}>
          OK
        </button>
      </Screen>
    );
  }
  return (
    <main className="flex min-h-dvh w-full flex-col items-center bg-white text-ink">
      <div className="flex w-full flex-col items-center bg-danfo px-4 pt-3 pb-2">
        <p className="display text-6xl tabular-nums">{formatFiat(invoice.fiat, currency)}</p>
        <p className="text-lg font-bold tabular-nums">{formatSats(invoice.sats)} · Lightning</p>
      </div>
      <div className="stripe w-full" aria-hidden />
      <div className="flex w-full max-w-sm grow flex-col items-center justify-center gap-3 p-4">
        {/* Tapping the QR opens a Lightning wallet on this same phone. */}
        <a href={`lightning:${invoice.bolt11}`} className="rounded-2xl border-[3px] border-ink p-1" aria-label="Open in a Lightning wallet">
          <QR value={`lightning:${invoice.bolt11}`} size={290} label="Scan to pay with Lightning" />
        </a>
        <CopyInvoice bolt11={invoice.bolt11} />
        <p className="flex items-center gap-2 text-2xl font-bold">
          Waiting for the money
          <span className="dots text-base" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </p>
        <p className="rounded-xl bg-ink px-3 py-2 text-center font-bold text-danfo">
          ✋ Don&apos;t release goods until this screen turns green and speaks.
        </p>
        <p className="text-sm font-bold tabular-nums">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left · {live ? "live alerts" : "checking every 1.5 s"}
        </p>
        <button type="button" onClick={onCancel} className={btn.link}>
          Cancel
        </button>
      </div>
    </main>
  );
}

/** Small secondary action: the QR stays the main way to pay. For desktops without a camera scanner. */
function CopyInvoice({ bolt11 }: { bolt11: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard
          ?.writeText(bolt11)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {})
      }
      className="min-h-10 rounded-lg border-2 border-ink px-4 text-sm font-bold"
    >
      {copied ? "Copied ✓" : "Copy invoice"}
    </button>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];

function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid w-full grid-cols-3 gap-3">
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
          aria-label={k === "⌫" ? "Delete (long-press to clear)" : k}
          className={`press display min-h-16 rounded-xl text-4xl ${k === "⌫" ? "bg-danfo" : "bg-white"}`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

function Screen({ className, children }: { className: string; children: React.ReactNode }) {
  return <main className={`flex min-h-dvh w-full flex-col items-center justify-center gap-5 p-5 ${className}`}>{children}</main>;
}
