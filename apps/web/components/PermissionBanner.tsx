"use client";
import type { PermissionReport } from "@/lib/konfam";

/** Red banner when the merchant connection can spend; blocking error when it can't make invoices. */
export function PermissionBanner({ report }: { report: PermissionReport }) {
  return (
    <>
      {report.canSpend && (
        <div role="alert" className="rounded-xl border-[3px] border-ink bg-alarm p-3 font-bold text-white">
          <p>⚠ This connection can spend money. For real use, create a receive-only connection in your wallet.</p>
          <p className="mt-1 text-sm font-normal">
            Can spend: {report.forbidden.join(", ") || "yes"}. (Demo faucet wallets allow everything.)
          </p>
        </div>
      )}
      {report.blocked && (
        <p role="alert" className="rounded-xl border-[3px] border-alarm bg-white p-3 font-bold text-alarm">
          This connection can&apos;t create or check invoices (missing: {report.missing.join(", ")}). Box mode won&apos;t work.
        </p>
      )}
      {!report.canSpend && !report.blocked && (
        <p className="rounded-xl border-[3px] border-ink bg-money p-3 font-bold text-white">🔒 Receive-only. This connection cannot move money out.</p>
      )}
    </>
  );
}
