"use client";
import { WalletPanel, useRates } from "@sats/ui";
import { useSettings } from "@/lib/settings";
import { useAppLang } from "../shell";

export default function WalletPage() {
  const lang = useAppLang();
  const rates = useRates();
  const { settings } = useSettings();
  return (
    <section className="flex w-full max-w-md flex-col gap-4">
      <div>
        <p className="text-sm font-bold uppercase">Your money, your wallet</p>
        <h1 className="display text-6xl">Wallet</h1>
      </div>
      <div className="[&>section]:panel [&>section]:!rounded-[14px]">
        <WalletPanel slot="merchant" lang={lang} rates={rates} currency={settings?.currency ?? (lang === "fr" ? "XOF" : "NGN")} warnIfCanSpend />
      </div>
      <p className="text-sm font-bold">Konfam never holds your money. Payments land straight in this wallet.</p>
    </section>
  );
}
