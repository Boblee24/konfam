"use client";
import { useState } from "react";
import { ScanButton } from "@sats/ui";
import { btn } from "./ui";

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
        <span className="font-bold">Paste your wallet connection</span>
        <textarea
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          rows={3}
          autoComplete="off"
          spellCheck={false}
          placeholder="nostr+walletconnect://…"
          className="rounded-xl border-[3px] border-ink bg-white p-3 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-danfo"
        />
      </label>
      {busy && <p className="font-bold">Connecting… the first connection can take up to 30 s on slow data.</p>}
      {error && !busy && (
        <p role="alert" className="rounded-xl border-[3px] border-alarm bg-white p-3 font-bold text-alarm">
          {error === "INVALID_NWC_URL"
            ? "That doesn't look like a wallet connection (nostr+walletconnect://…)."
            : `Could not connect (${error}). Check the string and your signal, then try again.`}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={`${btn.primary} grow`} disabled={busy || !url.trim()} onClick={() => void onConnect(url).then((ok) => ok && setUrl(""))}>
          {busy ? "Connecting…" : label}
        </button>
        <ScanButton onResult={(text) => void onConnect(text)} />
      </div>
      <p className="text-sm font-bold">🔒 Stored only on this phone. Never sent to our server.</p>
    </div>
  );
}
