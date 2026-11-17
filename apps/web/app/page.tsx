"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { BigButton } from "@sats/ui";
import { useWalletConnection } from "@sats/ui";
import { checkMerchantPermissions, settingsSchema, uiLangFor, VOICE_LANG_LABEL, VOICE_LANGS, type VoiceLang } from "@/lib/konfam";
import { useSettings } from "@/lib/settings";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PermissionBanner } from "@/components/PermissionBanner";
import { KonfamId } from "@/components/KonfamId";
import { useSetAppLang } from "./shell";

export default function Home() {
  const { settings, save } = useSettings();
  const conn = useWalletConnection("merchant");
  const setAppLang = useSetAppLang();
  const report = conn.info ? checkMerchantPermissions(conn.info) : null;
  const ready = !!settings && conn.status === "connected" && !!report && !report.blocked;

  return (
    <section className="flex w-full max-w-xl flex-col gap-5 pt-4">
      <h1 className="text-3xl font-bold leading-tight">Your phone shouts when the money is REAL.</h1>
      <p className="text-[var(--muted)]">
        Fake alerts and fake &quot;I don pay&quot; screenshots cheat sellers every day. Konfam turns an old Android phone into a
        talking Lightning till. It speaks only when real money lands in <b>your</b> wallet, and gives every buyer a receipt
        nobody can forge.
      </p>

      {ready && (
        <Link
          href="/box"
          className="inline-flex min-h-14 items-center justify-center rounded-xl bg-[var(--ok)] px-6 text-xl font-bold text-white"
        >
          Open my Konfam box →
        </Link>
      )}

      <Step n={1} title="Your shop" done={!!settings}>
        {settings === undefined ? (
          <p className="text-[var(--muted)]">…</p>
        ) : (
          <ShopForm
            key={settings ? "edit" : "new"}
            initial={settings ?? undefined}
            onSave={async (s) => {
              await save(s);
              setAppLang(uiLangFor(s.lang));
            }}
          />
        )}
      </Step>

      <Step n={2} title="Connect your wallet" done={conn.status === "connected"}>
        {conn.status === "loading" ? (
          <p className="text-[var(--muted)]">…</p>
        ) : conn.status === "connected" && conn.info && report ? (
          <div className="flex flex-col gap-3">
            <p>
              Connected{conn.info.alias ? ` to ${conn.info.alias}` : ""}. Payment alerts:{" "}
              {conn.info.notifications.includes("payment_received") ? "live" : "checked every 1.5 s"}.
            </p>
            <PermissionBanner report={report} />
            <BigButton variant="ghost" onClick={() => void conn.disconnect()}>
              Disconnect
            </BigButton>
          </div>
        ) : (
          <ConnectWallet busy={conn.status === "connecting"} error={conn.error} onConnect={conn.connect} />
        )}
      </Step>

      <Step n={3} title="Your Konfam ID" done>
        <KonfamId />
      </Step>

      <ul className="list-disc space-y-1 pl-6 text-sm text-[var(--muted)]">
        <li>Your wallet connection and receipt key stay on this phone. Our server never sees them.</li>
        <li>Konfam never holds your money: it lands straight in your own wallet.</li>
        <li>
          Got a receipt? <Link href="/r" className="underline">Verify it here</Link>.
        </li>
      </ul>
    </section>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <h2 className="text-xl font-bold">
        <span aria-hidden>{done ? "✅" : `${n}.`}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function ShopForm({
  initial,
  onSave,
}: {
  initial?: { merchantName: string; lang: VoiceLang; currency: "NGN" | "XOF" };
  onSave: (s: { v: 1; merchantName: string; lang: VoiceLang; currency: "NGN" | "XOF" }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.merchantName ?? "");
  const [lang, setLang] = useState<VoiceLang>(initial?.lang ?? "pcm");
  const [currency, setCurrency] = useState<"NGN" | "XOF">(initial?.currency ?? "NGN");
  const [saved, setSaved] = useState(!!initial);
  const [error, setError] = useState<string | null>(null);

  // Sensible currency default when the language changes on a new setup.
  useEffect(() => {
    if (!initial) setCurrency(lang === "fr" || lang === "wo" ? "XOF" : "NGN");
  }, [lang, initial]);

  const submit = async () => {
    const r = settingsSchema.safeParse({ v: 1, merchantName: name, lang, currency });
    if (!r.success) {
      setError("Shop name: 1 to 40 letters, no < or >.");
      return;
    }
    setError(null);
    await onSave(r.data);
    setSaved(true);
  };

  const field = "min-h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base";
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onChange={() => setSaved(false)}
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm text-[var(--muted)]">Shop name (shown on receipts)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--muted)]">Voice</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as VoiceLang)} className={field}>
            {VOICE_LANGS.map((l) => (
              <option key={l} value={l}>
                {VOICE_LANG_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--muted)]">Money</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as "NGN" | "XOF")} className={field}>
            <option value="NGN">Naira (₦)</option>
            <option value="XOF">FCFA</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-[var(--danger)]">{error}</p>}
      <BigButton type="submit" variant={saved ? "secondary" : "primary"}>
        {saved ? "Saved ✓" : "Save"}
      </BigButton>
    </form>
  );
}
