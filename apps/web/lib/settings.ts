"use client";
/** Merchant settings, stored only in this browser's IndexedDB. */
import { useCallback, useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { settingsSchema, type Settings } from "./konfam";

const KEY = "konfam:settings";

export async function loadSettings(): Promise<Settings | null> {
  try {
    const r = settingsSchema.safeParse(await get(KEY));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function saveSettings(s: Settings): Promise<Settings> {
  const parsed = settingsSchema.parse(s);
  await set(KEY, parsed);
  return parsed;
}

/** undefined = still loading, null = not set up yet. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => !cancelled && setSettings(s));
    return () => {
      cancelled = true;
    };
  }, []);
  const save = useCallback(async (s: Settings) => setSettings(await saveSettings(s)), []);
  return { settings, save };
}
