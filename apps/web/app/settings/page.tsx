"use client";
import { useState } from "react";
import Link from "next/link";
import { BigButton, useWalletConnection } from "@sats/ui";
import { checkMerchantPermissions, settingsSchema, uiLangFor, VOICE_LANG_LABEL, VOICE_LANGS, type VoiceLang } from "@/lib/konfam";
import { useSettings } from "@/lib/settings";
import { preloadVoice, speak, unlockAudio } from "@/lib/voice/player";
import { paidAnnouncement } from "@/lib/voice/phrases";
import { KonfamId } from "@/components/KonfamId";
import { PermissionBanner } from "@/components/PermissionBanner";
import { useSetAppLang } from "../shell";

export default function SettingsPage() {
  const { settings, save } = useSettings();
  const conn = useWalletConnection("merchant");
  const setAppLang = useSetAppLang();
  const [pack, setPack] = useState<string | null>(null);

  if (settings === undefined) return <p className="pt-8 text-[var(--muted)]">…</p>;
  if (!settings) {
    return (
      <p className="pt-8">
        Set up your shop first: <Link href="/" className="underline">start here</Link>.
      </p>
    );
  }

  const setLang = async (lang: VoiceLang) => {
    const next = settingsSchema.parse({ ...settings, lang });
    await save(next);
    setAppLang(uiLangFor(lang));
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
    <section className="flex w-full max-w-xl flex-col gap-5 pt-4">
      <h1 className="text-2xl font-bold">Settings · {settings.merchantName}</h1>

      <Card title="Voice">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--muted)]">Language the box speaks</span>
          <select
            value={settings.lang}
            onChange={(e) => void setLang(e.target.value as VoiceLang)}
            className="min-h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-base"
          >
            {VOICE_LANGS.map((l) => (
              <option key={l} value={l}>
                {VOICE_LANG_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <BigButton variant="secondary" onClick={() => void test()}>
          🔊 Test the voice
        </BigButton>
        {pack && <p className="text-sm text-[var(--muted)]">{pack}</p>}
      </Card>

      <Card title="Konfam ID">
        <KonfamId showQr />
      </Card>

      <Card title="Wallet permissions">
        {conn.status === "connected" && report ? (
          <>
            <PermissionBanner report={report} />
            <p className="text-sm text-[var(--muted)]">
              Payment alerts: {conn.info?.notifications.includes("payment_received") ? "live (payment_received)" : "polling every 1.5 s"}
            </p>
          </>
        ) : (
          <p>
            Not connected. <Link href="/" className="underline">Connect your wallet</Link>.
          </p>
        )}
      </Card>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
