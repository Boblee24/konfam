"use client";
import { useEffect, useState } from "react";
import { exportBackup, getOrCreateKey, isBackedUp } from "@sats/nostr/browser";
import { CopyButton, QR } from "@sats/ui";
import { btn } from "./ui";

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
      <p>Your Konfam ID signs every receipt. Buyers check receipts against it, so show it at your stall.</p>
      <p className="break-all rounded-xl border-[3px] border-dashed border-ink bg-paper p-3 font-mono text-sm">{npub}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={npub} />
      </div>
      {showQr && (
        <div className="self-center">
          <QR value={npub} size={200} label="Konfam ID" />
        </div>
      )}
      {nsec ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border-[3px] border-ink bg-danfo p-3">
          <p className="display text-2xl">Write this down. Keep it secret.</p>
          <p className="text-sm font-bold">Anyone with it can sign receipts as you. If you lose this phone, it is the only way to keep your Konfam ID.</p>
          <p className="break-all rounded-lg bg-white p-2 font-mono text-sm">{nsec}</p>
          <button
            type="button"
            className={btn.primary}
            onClick={() => {
              setNsec(null);
              setBackedUp(true);
            }}
          >
            I have written it down
          </button>
        </div>
      ) : backedUp ? (
        <button type="button" className={btn.link} onClick={() => void exportBackup().then(setNsec)}>
          Show my backup key again
        </button>
      ) : (
        <button type="button" className={btn.yellow} onClick={() => void exportBackup().then(setNsec)}>
          ⚠ Back up my Konfam ID
        </button>
      )}
    </div>
  );
}
