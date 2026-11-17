"use client";
import type { PermissionReport } from "@/lib/konfam";

/** Red banner when the merchant connection can spend; blocking error when it can't make invoices. */
export function PermissionBanner({ report }: { report: PermissionReport }) {
  return (
    <>
      {report.canSpend && (
        <p role="alert" className="rounded-lg bg-[var(--danger)] px-3 py-2 font-medium text-white">
          ⚠ This connection can spend money. For real use, create a receive-only connection in your wallet.
          <span className="block text-sm font-normal opacity-90">Can spend: {report.forbidden.join(", ") || "yes"}</span>
        </p>
      )}
      {report.blocked && (
        <p role="alert" className="rounded-lg border-2 border-[var(--danger)] px-3 py-2 font-medium text-[var(--danger)]">
          This connection can&apos;t create or check invoices (missing: {report.missing.join(", ")}). Box mode won&apos;t work.
        </p>
      )}
      {!report.canSpend && !report.blocked && (
        <p className="rounded-lg bg-[var(--ok)] px-3 py-2 font-medium text-white">🔒 Receive-only connection. It cannot move money out.</p>
      )}
    </>
  );
}
