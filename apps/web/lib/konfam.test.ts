import { describe, expect, it } from "vitest";
import { checkMerchantPermissions, pressKey, settingsSchema, uiLangFor } from "./konfam";

describe("pressKey", () => {
  it("builds amounts and ignores junk", () => {
    let s = "";
    for (const k of ["2", "0", "0", "0"]) s = pressKey(s, k, 500_000);
    expect(s).toBe("2000");
    expect(pressKey(s, "x", 500_000)).toBe("2000");
    expect(pressKey(s, "⌫", 500_000)).toBe("200");
    expect(pressKey(s, "C", 500_000)).toBe("");
    expect(pressKey("5", "00", 500_000)).toBe("500");
  });
  it("has no leading zeros", () => {
    expect(pressKey("", "0", 100)).toBe("");
    expect(pressKey("", "00", 100)).toBe("");
  });
  it("never exceeds the cap", () => {
    expect(pressKey("50000", "0", 500_000)).toBe("500000");
    expect(pressKey("500000", "1", 500_000)).toBe("500000");
    expect(pressKey("25000", "1", 250_000)).toBe("25000");
  });
});

describe("checkMerchantPermissions", () => {
  it("flags a spending connection (faucet wallets grant everything)", () => {
    const r = checkMerchantPermissions({
      methods: ["get_info", "get_balance", "make_invoice", "pay_invoice", "lookup_invoice", "list_transactions"],
    });
    expect(r.canSpend).toBe(true);
    expect(r.forbidden).toEqual(["pay_invoice"]);
    expect(r.blocked).toBe(false);
  });
  it("accepts a receive-only connection", () => {
    const r = checkMerchantPermissions({ methods: ["get_info", "get_balance", "make_invoice", "lookup_invoice", "list_transactions"] });
    expect(r).toEqual({ canSpend: false, blocked: false, missing: [], forbidden: [] });
  });
  it("blocks when invoices can't be made or looked up", () => {
    const r = checkMerchantPermissions({ methods: ["get_info", "make_invoice"] });
    expect(r.blocked).toBe(true);
    expect(r.missing).toContain("lookup_invoice");
  });
});

describe("settingsSchema", () => {
  it("validates names", () => {
    const ok = settingsSchema.safeParse({ v: 1, merchantName: "  Mama Nkechi Foods ", lang: "pcm", currency: "NGN" });
    expect(ok.success && ok.data.merchantName).toBe("Mama Nkechi Foods");
    expect(settingsSchema.safeParse({ v: 1, merchantName: "x".repeat(41), lang: "pcm", currency: "NGN" }).success).toBe(false);
    expect(settingsSchema.safeParse({ v: 1, merchantName: "<script>", lang: "pcm", currency: "NGN" }).success).toBe(false);
    expect(settingsSchema.safeParse({ v: 1, merchantName: "A", lang: "de", currency: "NGN" }).success).toBe(false);
  });
  it("maps voice languages to UI languages", () => {
    expect(uiLangFor("wo")).toBe("fr");
    expect(uiLangFor("yo")).toBe("en");
    expect(uiLangFor("pcm")).toBe("pcm");
  });
});
