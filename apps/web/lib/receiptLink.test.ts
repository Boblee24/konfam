import { describe, expect, it } from "vitest";
import { receiptPathFromScan } from "./receiptLink";

const O = "http://localhost:3000";
const P = "eyJldmVudCI6eyJpZCI6ImFiYyJ9fQ";

describe("receiptPathFromScan", () => {
  it("keeps only the fragment of a /r link, from any origin", () => {
    expect(receiptPathFromScan(`${O}/r#${P}`, O)).toBe(`/r#${P}`);
    expect(receiptPathFromScan(`http://192.168.1.5:3000/r#${P}`, O)).toBe(`/r#${P}`);
  });
  it("rejects anything that isn't a receipt link", () => {
    expect(receiptPathFromScan("lnbc1...", O)).toBeNull();
    expect(receiptPathFromScan(`${O}/box#${P}`, O)).toBeNull();
    expect(receiptPathFromScan(`${O}/r#<script>`, O)).toBeNull();
    expect(receiptPathFromScan(`${O}/r`, O)).toBeNull();
    expect(receiptPathFromScan("javascript:alert(1)//r#aaaaaaaaaaaaaaaaaaaa", O)).toBeNull();
  });
});
