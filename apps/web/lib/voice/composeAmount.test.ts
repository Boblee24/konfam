import { describe, expect, it } from "vitest";
import { composeAmount, MAX_SPOKEN, NUMBER_CLIPS, numberWords } from "./composeAmount";

/** Independent parser: English words back to a number. */
function parse(words: string[]): number {
  const small: Record<string, number> = {};
  ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"].forEach((w, i) => (small[w] = i));
  ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"].forEach((w, i) => (small[w] = (i + 2) * 10));
  let total = 0;
  let cur = 0;
  for (const w of words) {
    if (w in small) cur += small[w]!;
    else if (w === "hundred") cur *= 100;
    else if (w === "thousand") {
      total += cur * 1000;
      cur = 0;
    } else if (w === "million") {
      total += cur * 1_000_000;
      cur = 0;
    }
    else throw new Error(`unknown word ${w}`);
  }
  return total + cur;
}

describe("numberWords", () => {
  it("speaks common market amounts", () => {
    expect(numberWords(0)).toEqual(["zero"]);
    expect(numberWords(15)).toEqual(["fifteen"]);
    expect(numberWords(40)).toEqual(["forty"]);
    expect(numberWords(2500)).toEqual(["two", "thousand", "five", "hundred"]);
    expect(numberWords(2600)).toEqual(["two", "thousand", "six", "hundred"]);
    expect(numberWords(50_000)).toEqual(["fifty", "thousand"]);
    expect(numberWords(1_000_001)).toEqual(["one", "million", "one"]);
    expect(numberWords(9_999_999)).toEqual(["nine", "million", "nine", "hundred", "ninety", "nine", "thousand", "nine", "hundred", "ninety", "nine"]);
  });

  // Words are built per 3-digit group, so: every amount up to 99,999 (all group shapes), plus a
  // stride-101 sweep over the whole 0…9,999,999 range (all million/thousand combinations). The full
  // 10M loop also passes but takes ~50 s: run it with KONFAM_FULL_RANGE=1.
  it("round-trips 0 to 9,999,999 using only recorded clips", () => {
    const clips = new Set(NUMBER_CLIPS);
    const check = (n: number) => {
      const w = numberWords(n);
      if (parse(w) !== n) throw new Error(`${n} → ${w.join(" ")}`);
      for (const x of w) if (!clips.has(x)) throw new Error(`no clip for ${x}`);
    };
    if (process.env.KONFAM_FULL_RANGE === "1") {
      for (let n = 0; n <= MAX_SPOKEN; n++) check(n);
      return;
    }
    for (let n = 0; n <= 99_999; n++) check(n);
    for (let n = 0; n <= MAX_SPOKEN; n += 101) check(n);
    check(MAX_SPOKEN);
  }, 120_000);

  it("rejects out-of-range and non-integer amounts", () => {
    expect(() => numberWords(-1)).toThrow();
    expect(() => numberWords(10_000_000)).toThrow();
    expect(() => numberWords(1.5)).toThrow();
  });
});

describe("composeAmount", () => {
  it("uses English clips + currency for pcm/yo/ha/en", () => {
    const s = composeAmount(2000, "pcm", "NGN");
    expect(s.map((x) => ("clip" in x ? x.clip : x.say))).toEqual(["two", "thousand", "naira"]);
    expect(composeAmount(1000, "yo", "XOF").at(-1)).toMatchObject({ clip: "cfa", lang: "en" });
  });
  it("uses one French utterance for fr/wo", () => {
    expect(composeAmount(1000, "wo", "XOF")).toEqual([{ say: "1000 francs CFA", voice: "fr-FR" }]);
    expect(composeAmount(2500, "fr", "NGN")).toEqual([{ say: "2500 naira", voice: "fr-FR" }]);
  });
});
