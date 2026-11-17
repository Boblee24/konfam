/**
 * Konfam receipts (CLAUDE.md "Receipt design"). Isomorphic and pure: no DOM, no network.
 *
 * A receipt = a PAID attestation signed by the merchant's Nostr key + the payment preimage + the bolt11.
 * It travels in the URL fragment (`/r#<base64url(json)>`), which browsers never send to a server.
 *
 * What a valid receipt proves, exactly:
 *   "Merchant <npub> acknowledged receiving N sats at T, and the payment hash matches."
 *   1. signature: the attestation was signed by the key behind <npub>.
 *   2. preimage: sha256(preimage) === payment_hash, i.e. someone holds the secret that only the
 *      payer receives when a Lightning payment settles.
 *   3. invoice: the bolt11's payment hash and amount match the attestation.
 * It does NOT prove which person paid, nor that <npub> is the shop in front of you: compare the
 * name/npub with the one the shop displays (Konfam ID).
 */
import { z } from "zod";
import { decodeBolt11, verifyPreimage } from "@sats/lightning";
import { npubEncode, tagValue, verifyEvent, type NostrEvent } from "@sats/nostr";

/** NIP-78 app-specific data (parameterized replaceable), d = payment hash. */
export const RECEIPT_KIND = 30078;
export const RECEIPT_TAG = "konfam-receipt";
const MAX_FRAGMENT = 4000;

const HEX64 = /^[0-9a-f]{64}$/;

export const receiptContentSchema = z.object({
  v: z.literal(1),
  payment_hash: z.string().regex(HEX64),
  sats: z.number().int().positive(),
  fiat: z.number().int().nonnegative(),
  currency: z.enum(["NGN", "XOF"]),
  settled_at: z.number().int().positive(),
  merchant_name: z.string().min(1).max(40),
});
export type ReceiptContent = z.infer<typeof receiptContentSchema>;

const payloadSchema = z.object({
  event: z.unknown(),
  preimage: z.string().max(64),
  bolt11: z.string().min(20).max(2000),
});
export type ReceiptPayload = { event: NostrEvent; preimage: string; bolt11: string };

export type SignFn = (o: { kind: number; content: string; tags: string[][] }) => Promise<NostrEvent>;

/** Sign the PAID attestation. Throws if the preimage doesn't match: never issue a receipt we can't back. */
export async function createReceipt(
  o: { content: Omit<ReceiptContent, "v">; preimage: string; bolt11: string },
  sign: SignFn,
): Promise<ReceiptPayload> {
  const content = receiptContentSchema.parse({ v: 1, ...o.content });
  if (!verifyPreimage(o.preimage, content.payment_hash)) throw new Error("preimage does not match payment hash");
  const event = await sign({
    kind: RECEIPT_KIND,
    content: JSON.stringify(content),
    tags: [
      ["d", content.payment_hash],
      ["t", RECEIPT_TAG],
    ],
  });
  return { event, preimage: o.preimage.toLowerCase(), bolt11: o.bolt11.trim().toLowerCase() };
}

// --- fragment encoding (base64url of UTF-8 JSON) ---------------------------------------------

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeReceipt(p: ReceiptPayload): string {
  return toBase64Url(JSON.stringify(p));
}

/** Full link for the QR. */
export function receiptUrl(origin: string, p: ReceiptPayload): string {
  return `${origin}/r#${encodeReceipt(p)}`;
}

// --- verification -----------------------------------------------------------------------------

export type CheckId = "format" | "signature" | "preimage" | "invoice";
export type Check = { id: CheckId; ok: boolean; why?: string };
export type Verification = {
  ok: boolean;
  checks: Check[];
  content?: ReceiptContent;
  npub?: string;
};

/** Verify a fragment (with or without the leading "#"). Never throws. */
export function verifyReceiptFragment(fragment: string): Verification {
  const f = fragment.replace(/^#/, "");
  if (!f || f.length > MAX_FRAGMENT || !/^[A-Za-z0-9_-]+$/.test(f)) return fail("format", "This is not a Konfam receipt link.");
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(f));
  } catch {
    return fail("format", "The receipt is damaged or incomplete.");
  }
  const p = payloadSchema.safeParse(raw);
  if (!p.success) return fail("format", "The receipt is damaged or incomplete.");
  return verifyReceipt(p.data);
}

export function verifyReceipt(p: { event: unknown; preimage: string; bolt11: string }): Verification {
  const checks: Check[] = [];

  // 1. Signature + shape of the attestation.
  const sigOk = verifyEvent(p.event);
  let content: ReceiptContent | undefined;
  let npub: string | undefined;
  if (sigOk) {
    const e = p.event as NostrEvent;
    npub = npubEncode(e.pubkey);
    let parsed: unknown;
    try {
      parsed = JSON.parse(e.content);
    } catch {
      parsed = null;
    }
    const c = receiptContentSchema.safeParse(parsed);
    if (e.kind !== RECEIPT_KIND || tagValue(e, "t") !== RECEIPT_TAG || !c.success || tagValue(e, "d") !== c.data.payment_hash) {
      checks.push({ id: "signature", ok: false, why: "Signed, but not a Konfam PAID receipt." });
    } else {
      content = c.data;
      checks.push({ id: "signature", ok: true });
    }
  } else {
    checks.push({ id: "signature", ok: false, why: "The merchant's signature is not valid: the receipt was changed or forged." });
  }

  // 2. Preimage ↔ payment hash.
  if (!content) checks.push({ id: "preimage", ok: false, why: "No signed payment hash to check against." });
  else if (verifyPreimage(p.preimage, content.payment_hash)) checks.push({ id: "preimage", ok: true });
  else checks.push({ id: "preimage", ok: false, why: "The payment proof (preimage) does not match the payment hash." });

  // 3. Invoice ↔ attestation.
  if (!content) checks.push({ id: "invoice", ok: false, why: "No signed amount to check against." });
  else {
    try {
      const d = decodeBolt11(p.bolt11);
      if (d.paymentHash !== content.payment_hash) checks.push({ id: "invoice", ok: false, why: "The invoice is for a different payment." });
      else if (d.sats !== content.sats) checks.push({ id: "invoice", ok: false, why: "The invoice amount differs from the receipt amount." });
      else checks.push({ id: "invoice", ok: true });
    } catch {
      checks.push({ id: "invoice", ok: false, why: "The Lightning invoice is not valid." });
    }
  }

  return { ok: checks.every((c) => c.ok), checks, content, npub };
}

function fail(id: CheckId, why: string): Verification {
  return { ok: false, checks: [{ id, ok: false, why }] };
}
