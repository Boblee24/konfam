"use client";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBanner, LanguageSwitch, OfflineBanner, useLang } from "@sats/ui";

const LangCtx = createContext<{ lang: string; setLang: (l: string) => void }>({ lang: "en", setLang: () => {} });
export const useAppLang = () => useContext(LangCtx).lang;
export const useSetAppLang = () => useContext(LangCtx).setLang;

export function Shell({ children, demo }: { children: ReactNode; demo: boolean; nonce?: string }) {
  const [lang, setLang] = useLang("en");
  const path = usePathname();
  // Box mode is a full-screen till: no header, no banners on top of the QR.
  const bare = path === "/box";

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      {bare ? (
        children
      ) : (
        <>
          <DemoBanner show={demo} lang={lang} />
          <OfflineBanner lang={lang} />
          <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="text-lg font-bold">
              ✅ Konfam
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-3 text-sm">
              <Link href="/box" className="font-medium underline-offset-4 hover:underline">Box</Link>
              <Link href="/r" className="font-medium underline-offset-4 hover:underline">Verify</Link>
              <Link href="/wallet" className="font-medium underline-offset-4 hover:underline">Wallet</Link>
              <LanguageSwitch value={lang} onChange={setLang} langs={["en", "pcm", "fr"]} />
            </nav>
          </header>
          <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-16">{children}</main>
        </>
      )}
    </LangCtx.Provider>
  );
}
