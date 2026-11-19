import type { ReactNode } from "react";

/** Button looks (plain class strings: no extra JS). */
export const btn = {
  primary: "press inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-xl font-bold text-danfo",
  go: "press inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-money px-6 text-xl font-bold text-white",
  yellow: "press inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-danfo px-6 text-xl font-bold text-ink",
  plain: "press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-lg font-bold text-ink",
  link: "inline-flex min-h-12 items-center font-bold underline decoration-2 underline-offset-4",
};

export const field =
  "min-h-14 w-full rounded-xl border-[3px] border-ink bg-white px-3 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-danfo";

export function Panel({ title, step, done, children, className = "" }: { title?: string; step?: number; done?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={`panel flex w-full flex-col gap-4 p-4 ${className}`}>
      {title && (
        <h2 className="flex items-center gap-3">
          {step !== undefined && (
            <span
              aria-hidden
              className={`display grid size-11 shrink-0 place-items-center rounded-lg border-[3px] border-ink text-2xl ${done ? "bg-money text-white" : "bg-danfo text-ink"}`}
            >
              {done ? "✓" : step}
            </span>
          )}
          <span className="display text-3xl">{title}</span>
        </h2>
      )}
      {children}
    </section>
  );
}

export function Tag({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "yellow" | "red" | "green" }) {
  const c = { ink: "bg-ink text-danfo", yellow: "bg-danfo text-ink", red: "bg-alarm text-white", green: "bg-money text-white" }[tone];
  return <span className={`inline-block self-start rounded-md px-2 py-0.5 text-xs font-bold tracking-wide uppercase ${c}`}>{children}</span>;
}
