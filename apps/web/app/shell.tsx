"use client";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoBanner, LanguageSwitch, OfflineBanner, useLang } from "@sats/ui";

const LangCtx = createContext<{ lang: string; setLang: (l: string) => void }>({ lang: "en", setLang: () => {} });
export const useAppLang = () => useContext(LangCtx).lang;
export const useSetAppLang = () => useContext(LangCtx).setLang;

const TABS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/box", label: "Box", icon: "▣" },
  { href: "/r", label: "Verify", icon: "✓" },
  { href: "/wallet", label: "Wallet", icon: "₿" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display inline-flex items-center gap-2 text-[2rem] ${className}`}>
      <span aria-hidden className="grid size-9 -rotate-6 place-items-center rounded-lg border-[3px] border-ink bg-paper text-2xl text-money">
        ✓
      </span>
      Konfam
    </span>
  );
}

export function Shell({ children, demo }: { children: ReactNode; demo: boolean; nonce?: string }) {
  const [lang, setLang] = useLang("en");
  const path = usePathname();
  // Box mode is a full-screen till: no header, no tabs, no banners over the QR.
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
        <div className="grain min-h-dvh">
          <DemoBanner show={demo} lang={lang} />
          <OfflineBanner lang={lang} />
          <header className="bg-danfo">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
              <Link href="/" aria-label="Konfam home">
                <Wordmark />
              </Link>
              <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
                {TABS.slice(1).map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`rounded-lg px-3 py-2 font-bold ${path === t.href ? "bg-ink text-danfo" : "hover:bg-ink/10"}`}
                  >
                    {t.label}
                  </Link>
                ))}
              </nav>
              <LanguageSwitch value={lang} onChange={setLang} langs={["en", "pcm", "fr"]} />
            </div>
            <div className="stripe" aria-hidden />
          </header>
          <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pt-5 pb-32 sm:pb-16">{children}</main>
          <nav
            aria-label="Tabs"
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t-[3px] border-ink bg-paper pb-[env(safe-area-inset-bottom)] sm:hidden"
          >
            {TABS.map((t) => {
              const on = path === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center text-xs font-bold ${on ? "bg-ink text-danfo" : "text-ink"}`}
                >
                  <span aria-hidden className="text-xl leading-none">{t.icon}</span>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </LangCtx.Provider>
  );
}
