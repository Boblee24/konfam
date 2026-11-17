/**
 * Konfam config + pure helpers (browser- and test-safe: no DOM, no IndexedDB here).
 */
import { z } from "zod";
import { assertPermissions, canSpend, type WalletInfo } from "@sats/lightning";
import type { Fiat } from "@sats/core";

/** Voice languages. pcm = Nigerian Pidgin. */
export const VOICE_LANGS = ["pcm", "yo", "ha", "en", "fr", "wo"] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number];

export const VOICE_LANG_LABEL: Record<VoiceLang, string> = {
  pcm: "Pidgin",
  yo: "Yorùbá",
  ha: "Hausa",
  en: "English",
  fr: "Français",
  wo: "Wolof",
};

/** UI language for a voice language (UI strings exist in en, pcm, fr). */
export function uiLangFor(lang: VoiceLang): "en" | "pcm" | "fr" {
  if (lang === "pcm") return "pcm";
  if (lang === "fr" || lang === "wo") return "fr";
  return "en";
}

/** Demo caps on the keypad (whole naira / francs). */
export const MAX_FIAT: Record<Fiat, number> = { NGN: 500_000, XOF: 250_000 };

export const settingsSchema = z.object({
  v: z.literal(1),
  merchantName: z
    .string()
    .trim()
    .min(1)
    .max(40)
    // Printable text only: it is spoken, shown on receipts and signed.
    .regex(/^[^\u0000-\u001f\u007f<>]+$/),
  lang: z.enum(VOICE_LANGS),
  currency: z.enum(["NGN", "XOF"]),
});
export type Settings = z.infer<typeof settingsSchema>;

/** Receive-only permission policy for the merchant connection (CLAUDE.md "Security design"). */
export const MERCHANT_PERMS = {
  allow: ["make_invoice", "lookup_invoice", "list_transactions", "get_balance", "get_info"],
  forbid: ["pay_invoice", "pay_keysend", "multi_pay_invoice"],
};

/** Methods without which box mode cannot work at all. */
const REQUIRED = ["make_invoice", "lookup_invoice"];

export type PermissionReport = {
  /** The connection can move money out: show the red banner. */
  canSpend: boolean;
  /** Box mode can't run (no make_invoice / lookup_invoice). */
  blocked: boolean;
  missing: string[];
  forbidden: string[];
};

export function checkMerchantPermissions(info: Pick<WalletInfo, "methods">): PermissionReport {
  const r = assertPermissions(info, MERCHANT_PERMS);
  return {
    canSpend: canSpend(info) || r.forbidden.length > 0,
    blocked: REQUIRED.some((m) => !info.methods.includes(m)),
    missing: r.missing,
    forbidden: r.forbidden,
  };
}

/**
 * Keypad reducer for whole fiat amounts. Returns the new display string.
 * Never exceeds `max`, no leading zeros, digits only.
 */
export function pressKey(current: string, key: string, max: number): string {
  if (key === "C") return "";
  if (key === "⌫") return current.slice(0, -1);
  if (!/^(0|00|[1-9])$/.test(key)) return current;
  const next = current === "" && key.startsWith("0") ? "" : current + key;
  if (next === "") return "";
  return Number(next) > max ? current : next;
}
