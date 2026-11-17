/**
 * Turn an amount into something the box can say.
 * - pcm / yo / ha / en: English number clips (Nigerian traders say amounts in English), e.g.
 *   2500 NGN → two, thousand, five, hundred, naira
 * - fr / wo: one French utterance for the browser's fr-FR voice ("2500 francs CFA").
 */
import type { VoiceLang } from "../konfam";

export type AmountCurrency = "NGN" | "XOF" | "sats";

/** A recorded clip (`/voice/<lang>/<name>.mp3`) or a sentence for speechSynthesis. */
export type Segment = { clip: string; lang: string; text: string } | { say: string; voice: string };

export const MAX_SPOKEN = 9_999_999;

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** Every English clip the number speaker can ask for (VOICE_CLIPS.md §1). */
export const NUMBER_CLIPS = [...ONES, ...TENS.filter(Boolean), "hundred", "thousand", "million"];
export const CURRENCY_CLIP: Record<AmountCurrency, string> = { NGN: "naira", XOF: "cfa", sats: "sats" };

function below1000(n: number): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) out.push(ONES[h]!, "hundred");
  if (r >= 20) {
    out.push(TENS[Math.floor(r / 10)]!);
    if (r % 10) out.push(ONES[r % 10]!);
  } else if (r) out.push(ONES[r]!);
  return out;
}

/** English words for 0…9,999,999, one word per clip. No "and" (there is no clip for it). */
export function numberWords(n: number): string[] {
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_SPOKEN) throw new RangeError("amount out of range");
  if (n === 0) return ["zero"];
  const m = Math.floor(n / 1_000_000);
  const k = Math.floor((n % 1_000_000) / 1000);
  const r = n % 1000;
  return [
    ...(m ? [...below1000(m), "million"] : []),
    ...(k ? [...below1000(k), "thousand"] : []),
    ...below1000(r),
  ];
}

const FR_CURRENCY: Record<AmountCurrency, string> = { NGN: "naira", XOF: "francs CFA", sats: "sats" };

export function composeAmount(n: number, lang: VoiceLang, currency: AmountCurrency): Segment[] {
  if (lang === "fr" || lang === "wo") {
    numberWords(n); // same range check
    // fr-FR speechSynthesis reads plain digits correctly ("2500" → "deux mille cinq cents").
    return [{ say: `${n} ${FR_CURRENCY[currency]}`, voice: "fr-FR" }];
  }
  const cur = CURRENCY_CLIP[currency];
  return [...numberWords(n), cur].map((w) => ({ clip: w, lang: "en", text: w === "cfa" ? "francs CFA" : w }));
}
