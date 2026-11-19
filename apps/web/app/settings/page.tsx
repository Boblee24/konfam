"use client";
import { useState } from "react";
import Link from "next/link";
import { useWalletConnection } from "@sats/ui";
import { checkMerchantPermissions, settingsSchema, uiLangFor, VOICE_LANG_LABEL, VOICE_LANGS, type VoiceLang } from "@/lib/konfam";
import { useSettings } from "@/lib/settings";
import { preloadVoice, speak, unlockAudio } from "@/lib/voice/player";
import { paidAnnouncement } from "@/lib/voice/phrases";
import { KonfamId } from "@/components/KonfamId";
import { PermissionBanner } from "@/components/PermissionBanner";
import { btn, Panel } from "@/components/ui";
import { useSetAppLang } from "../shell";

const choice = (on: boolean) =>
  `press flex min-h-14 items-center justify-center rounded-xl px-1 text-center font-bold ${on ? "bg-ink text-danfo" : "bg-white"}`;

export default function SettingsPage() {
  const { settings, save } = useSettings();
  const conn = useWalletConnection("merchant");
  const setAppLang = useSetAppLang();
  const [pack, setPack] = useState<string | null>(null);

  if (settings === undefined) return <p className="pt-8 text-[var(--muted)]">…</p>;
  if (!settings) {
    return (
      <div className="flex flex-col items-center gap-4 pt-8">
        <p className="display text-5xl">Set up first</p>
        <Link href="/" className={btn.primary}>
          Start here →
        </Link>
      </div>
    );
  }

  const update = async (patch: Partial<{ lang: VoiceLang; currency: "NGN" | "XOF" }>) => {
    const next = settingsSchema.parse({ ...settings, ...patch });
    await save(next);
    if (patch.lang) setAppLang(uiLangFor(patch.lang));
    setPack(null);
  };

  const test = async () => {
    unlockAudio();
    const r = await preloadVoice(settings.lang);
    const numbersNeeded = settings.lang === "fr" || settings.lang === "wo" ? 0 : 1;
    setPack(
      `${r.phrases}/6 recorded phrases` +
        (numbersNeeded ? `, ${r.numbers}/34 recorded number + currency clips` : ", amounts by the French voice") +
        (r.phrases < 6 || (numbersNeeded && r.numbers < 34) ? " · the rest uses the phone's voice" : ""),
    );
    await speak(paidAnnouncement(settings.lang, settings.currency === "NGN" ? 2500 : 1000, settings.currency));
  };

  const report = conn.info ? checkMerchantPermissions(conn.info) : null;
  return (
    <section className="flex w-full max-w-xl flex-col gap-5">
      <div>
        <p className="text-sm font-bold uppercase">Settings</p>
        <h1 className="display text-6xl">{settings.merchantName}</h1>
      </div>

      <Panel title="Voice">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Language the box speaks">
          {VOICE_LANGS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={settings.lang === l} className={choice(settings.lang === l)} onClick={() => void update({ lang: l })}>
              {VOICE_LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Money">
          {(
            [
              ["NGN", "₦ Naira"],
              ["XOF", "FCFA"],
            ] as const
          ).map(([c, label]) => (
            <button key={c} type="button" role="radio" aria-checked={settings.currency === c} className={choice(settings.currency === c)} onClick={() => void update({ currency: c })}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className={btn.yellow} onClick={() => void test()}>
          🔊 Test the voice
        </button>
        {pack && <p className="text-sm font-bold">{pack}</p>}
      </Panel>

      <Panel title="Konfam ID">
        <KonfamId showQr />
      </Panel>

      <Panel title="Wallet">
        {conn.status === "connected" && report ? (
          <>
            <PermissionBanner report={report} />
            <p className="font-bold">
              Payment alerts: {conn.info?.notifications.includes("payment_received") ? "live ⚡ (payment_received)" : "checked every 1.5 s"}
            </p>
          </>
        ) : (
          <p className="font-bold">
            Not connected.{" "}
            <Link href="/" className="underline decoration-2 underline-offset-4">
              Connect your wallet
            </Link>
          </p>
        )}
      </Panel>
    </section>
  );
}
