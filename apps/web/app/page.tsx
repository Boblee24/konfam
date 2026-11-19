"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWalletConnection } from "@sats/ui";
import { checkMerchantPermissions, settingsSchema, uiLangFor, VOICE_LANG_LABEL, VOICE_LANGS, type VoiceLang } from "@/lib/konfam";
import { useSettings } from "@/lib/settings";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PermissionBanner } from "@/components/PermissionBanner";
import { KonfamId } from "@/components/KonfamId";
import { btn, field, Panel } from "@/components/ui";
import { useSetAppLang } from "./shell";

export default function Home() {
  const { settings, save } = useSettings();
  const conn = useWalletConnection("merchant");
  const setAppLang = useSetAppLang();
  const report = conn.info ? checkMerchantPermissions(conn.info) : null;
  const ready = !!settings && conn.status === "connected" && !!report && !report.blocked;

  return (
    <section className="flex w-full max-w-xl flex-col gap-6">
      <div className="rise flex flex-col gap-4 pt-2">
        <h1 className="display text-[3.4rem] sm:text-7xl">
          Your phone shouts when the money is{" "}
          <span className="stamp bg-white text-money">real</span>
        </h1>
        <p className="text-lg font-bold">
          Fake alert. Fake &quot;I don pay&quot; screenshot. Goods gone. <span className="bg-danfo px-1">Not again.</span>
        </p>
        <p className="text-[var(--muted)]">
          Konfam turns an old Android phone into a talking Lightning till. It speaks only when real money lands in{" "}
          <b className="text-ink">your</b> wallet, and gives every buyer a receipt nobody can forge.
        </p>
      </div>

      <ol className="rise-2 grid grid-cols-3 gap-2 text-center text-sm font-bold">
        {[
          ["Type amount", "₦"],
          ["Buyer scans", "▣"],
          ["Box shouts", "📢"],
        ].map(([label, icon], i) => (
          <li key={label} className="panel flex flex-col items-center gap-1 px-1 py-3">
            <span aria-hidden className="display text-4xl">{icon}</span>
            <span>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {ready && (
        <Link href="/box" className={`${btn.go} rise-3 min-h-20 text-2xl`}>
          Open my Konfam box →
        </Link>
      )}

      <Panel title="Your shop" step={1} done={!!settings}>
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
      </Panel>

      <Panel title="Your wallet" step={2} done={conn.status === "connected"}>
        {conn.status === "loading" ? (
          <p className="text-[var(--muted)]">…</p>
        ) : conn.status === "connected" && conn.info && report ? (
          <div className="flex flex-col gap-3">
            <p className="font-bold">
              Connected{conn.info.alias ? ` to ${conn.info.alias}` : ""}. Payment alerts:{" "}
              {conn.info.notifications.includes("payment_received") ? "live ⚡" : "checked every 1.5 s"}
            </p>
            <PermissionBanner report={report} />
            <button type="button" className={btn.link} onClick={() => void conn.disconnect()}>
              Disconnect this wallet
            </button>
          </div>
        ) : (
          <ConnectWallet busy={conn.status === "connecting"} error={conn.error} onConnect={conn.connect} />
        )}
      </Panel>

      <Panel title="Your Konfam ID" step={3} done>
        <KonfamId />
      </Panel>

      <ul className="flex flex-col gap-2 text-sm font-bold">
        <li>🔒 Your wallet connection and receipt key stay on this phone. Our server never sees them.</li>
        <li>💸 Konfam never holds your money: it lands straight in your own wallet.</li>
        <li>
          🧾 Got a receipt?{" "}
          <Link href="/r" className="underline decoration-2 underline-offset-4">
            Check it here
          </Link>
        </li>
      </ul>
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

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onChange={() => setSaved(false)}
    >
      <label className="flex flex-col gap-1">
        <span className="font-bold">Shop name (shown on receipts)</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Mama Nkechi Foods" className={field} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Voice</legend>
        <div className="grid grid-cols-3 gap-2">
          {VOICE_LANGS.map((l) => (
            <label
              key={l}
              className={`press flex min-h-14 cursor-pointer items-center justify-center rounded-xl px-1 text-center font-bold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[var(--focus)] ${lang === l ? "bg-ink text-danfo" : "bg-white"}`}
            >
              <input type="radio" name="lang" value={l} checked={lang === l} onChange={() => setLang(l)} className="sr-only" />
              {VOICE_LANG_LABEL[l]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-bold">Money</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["NGN", "₦ Naira"],
              ["XOF", "FCFA"],
            ] as const
          ).map(([c, label]) => (
            <label
              key={c}
              className={`press flex min-h-14 cursor-pointer items-center justify-center rounded-xl font-bold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[var(--focus)] ${currency === c ? "bg-ink text-danfo" : "bg-white"}`}
            >
              <input type="radio" name="currency" value={c} checked={currency === c} onChange={() => setCurrency(c)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="font-bold text-alarm">
          {error}
        </p>
      )}
      <button type="submit" className={saved ? btn.plain : btn.primary}>
        {saved ? "Saved ✓" : "Save my shop"}
      </button>
    </form>
  );
}
