"use client";
import { useState } from "react";
import { BigButton, ScanButton } from "@sats/ui";

/** Paste or scan an NWC string. The string goes only to IndexedDB on this device. */
export function ConnectWallet({
  busy,
  error,
  onConnect,
  label = "Connect wallet",
}: {
  busy: boolean;
  error: string | null;
  onConnect: (url: string) => Promise<boolean>;
  label?: string;
}) {
  const [url, setUrl] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-sm text-[var(--muted)]">Paste your wallet connection (nostr+walletconnect://…)</span>
        <textarea
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          rows={3}
          autoComplete="off"
          spellCheck={false}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-sm"
        />
      </label>
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {error === "INVALID_NWC_URL" ? "That doesn't look like a wallet connection (nostr+walletconnect://…)." : `Could not connect (${error}). Check the string and your signal.`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <BigButton disabled={busy || !url.trim()} onClick={() => void onConnect(url).then((ok) => ok && setUrl(""))}>
          {busy ? "Connecting…" : label}
        </BigButton>
        <ScanButton onResult={(text) => void onConnect(text)} />
      </div>
      <p className="text-xs text-[var(--muted)]">🔒 Stored only on this device. Never sent to our server.</p>
    </div>
  );
}
