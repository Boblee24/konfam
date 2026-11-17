import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { hashPreimage } from "@sats/lightning";
import { makeTestInvoice } from "@sats/lightning/testInvoice";
import { signWithKey, type EventInput } from "@sats/nostr";
const generateSecretKey = () => new Uint8Array(randomBytes(32));
import { createReceipt, encodeReceipt, RECEIPT_KIND, verifyReceipt, verifyReceiptFragment, type ReceiptPayload } from "./receipt";

const sk = generateSecretKey();
const sign = async (o: EventInput) => signWithKey(o, sk);

async function makeReceipt(o: { sats?: number; invoiceSats?: number } = {}) {
  const preimage = randomBytes(32).toString("hex");
  const paymentHash = hashPreimage(preimage);
  const sats = o.sats ?? 2300;
  const bolt11 = makeTestInvoice({ sats: o.invoiceSats ?? sats, paymentHash, description: "Konfam" });
  const r = await createReceipt(
    {
      content: { payment_hash: paymentHash, sats, fiat: 2000, currency: "NGN", settled_at: 1_763_380_000, merchant_name: "Mama Nkechi" },
      preimage,
      bolt11,
    },
    sign,
  );
  return { r, preimage, paymentHash, bolt11 };
}

const failing = (v: ReturnType<typeof verifyReceipt>) => v.checks.filter((c) => !c.ok).map((c) => c.id);

/** Flip one hex character. */
const flip = (s: string, i = 10) => s.slice(0, i) + (s[i] === "0" ? "1" : "0") + s.slice(i + 1);

describe("receipts", () => {
  it("a genuine receipt verifies, through the URL fragment too", async () => {
    const { r } = await makeReceipt();
    const v = verifyReceiptFragment(`#${encodeReceipt(r)}`);
    expect(v.ok).toBe(true);
    expect(v.content).toMatchObject({ sats: 2300, fiat: 2000, merchant_name: "Mama Nkechi" });
    expect(v.npub).toMatch(/^npub1/);
    expect(r.event.kind).toBe(RECEIPT_KIND);
  });

  it("refuses to issue a receipt with a preimage that doesn't match", async () => {
    const { paymentHash, bolt11 } = await makeReceipt();
    await expect(
      createReceipt(
        { content: { payment_hash: paymentHash, sats: 1, fiat: 1, currency: "NGN", settled_at: 1, merchant_name: "x" }, preimage: "00".repeat(32), bolt11 },
        sign,
      ),
    ).rejects.toThrow();
  });

  it("tampered preimage → NOT PROOF (preimage check)", async () => {
    const { r } = await makeReceipt();
    const v = verifyReceipt({ ...r, preimage: flip(r.preimage) });
    expect(v.ok).toBe(false);
    expect(failing(v)).toEqual(["preimage"]);
  });

  it("tampered amount in the signed content → bad signature", async () => {
    const { r } = await makeReceipt();
    const event = { ...r.event, content: r.event.content.replace('"sats":2300', '"sats":23000') };
    const v = verifyReceipt({ ...r, event });
    expect(v.ok).toBe(false);
    expect(failing(v)).toContain("signature");
  });

  it("invoice amount differs from the signed amount → invoice check fails", async () => {
    const { r } = await makeReceipt({ sats: 2300, invoiceSats: 230 });
    const v = verifyReceipt(r);
    expect(failing(v)).toEqual(["invoice"]);
  });

  it("someone else's invoice swapped in → invoice check fails", async () => {
    const { r } = await makeReceipt();
    const other = await makeReceipt();
    expect(failing(verifyReceipt({ ...r, bolt11: other.bolt11 }))).toEqual(["invoice"]);
  });

  it("bad signature → NOT PROOF", async () => {
    const { r } = await makeReceipt();
    const v = verifyReceipt({ ...r, event: { ...r.event, sig: flip(r.event.sig) } });
    expect(failing(v)).toEqual(["signature", "preimage", "invoice"]);
  });

  it("re-signed by a different key verifies, but shows that other key's npub", async () => {
    const { r } = await makeReceipt();
    const forger = generateSecretKey();
    const event = signWithKey({ kind: r.event.kind, content: r.event.content, tags: r.event.tags }, forger);
    const v = verifyReceipt({ ...r, event });
    expect(v.ok).toBe(true);
    expect(v.npub).not.toBe(verifyReceipt(r).npub);
  });

  it("changing any one character of the link → not a valid receipt", async () => {
    const { r } = await makeReceipt();
    const frag = encodeReceipt(r);
    let anyPassed = 0;
    for (let i = 0; i < frag.length; i += 7) {
      const c = frag[i] === "A" ? "B" : "A";
      if (verifyReceiptFragment(frag.slice(0, i) + c + frag.slice(i + 1)).ok) anyPassed++;
    }
    expect(anyPassed).toBe(0);
  });

  it("garbage fragments fail closed", () => {
    expect(verifyReceiptFragment("").ok).toBe(false);
    expect(verifyReceiptFragment("#<script>").ok).toBe(false);
    expect(verifyReceiptFragment("#" + "A".repeat(5000)).ok).toBe(false);
    expect(verifyReceiptFragment("#e30").ok).toBe(false); // "{}"
  });

  it("the QR payload stays small enough to scan", async () => {
    const { r } = await makeReceipt();
    expect(encodeReceipt(r as ReceiptPayload).length).toBeLessThan(1600);
  });
});
