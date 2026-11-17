"use client";
import { useEffect, useState } from "react";
import { exportBackup, getOrCreateKey, isBackedUp } from "@sats/nostr/browser";
import { BigButton, CopyButton, QR } from "@sats/ui";

/** The merchant's Konfam ID: a Nostr key kept in this browser that signs every receipt. */
export function KonfamId({ showQr = false }: { showQr?: boolean }) {
  const [npub, setNpub] = useState<string | null>(null);
  const [backedUp, setBackedUp] = useState(true);
  const [nsec, setNsec] = useState<string | null>(null);

  useEffect(() => {
    void getOrCreateKey().then((k) => setNpub(k.npub));
    void isBackedUp().then(setBackedUp);
  }, []);

  if (!npub) return <p className="text-[var(--muted)]">…</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">Your Konfam ID signs every receipt. Customers check receipts against it.</p>
      <p className="break-all rounded-lg bg-[var(--surface-2)] p-3 font-mono text-sm">{npub}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={npub} />
      </div>
      {showQr && <QR value={npub} size={200} label="Konfam ID" />}
      {nsec ? (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border-2 border-[var(--warn)] p-3">
          <p className="font-bold">Write this down on paper. Keep it secret.</p>
          <p className="text-sm">Anyone with it can sign receipts as you. If you lose this phone, it is the only way to keep your Konfam ID.</p>
          <p className="break-all rounded bg-[var(--surface-2)] p-2 font-mono text-sm">{nsec}</p>
          <BigButton variant="secondary" onClick={() => { setNsec(null); setBackedUp(true); }}>
            I have written it down
          </BigButton>
        </div>
      ) : (
        <BigButton variant={backedUp ? "ghost" : "secondary"} onClick={() => void exportBackup().then(setNsec)}>
          {backedUp ? "Show backup key again" : "⚠ Back up my Konfam ID"}
        </BigButton>
      )}
    </div>
  );
}
