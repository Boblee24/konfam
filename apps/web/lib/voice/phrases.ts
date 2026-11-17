/**
 * Phrase templates per voice language. Each phrase is a recorded clip `/voice/<lang>/<key>.mp3`
 * (VOICE_CLIPS.md) with a text fallback for speechSynthesis until the clips exist.
 * Yoruba and Hausa have no reliable browser voice, so their fallback is English; Wolof falls back to French.
 */
import type { VoiceLang } from "../konfam";
import { composeAmount, type AmountCurrency, type Segment } from "./composeAmount";

export const PHRASE_KEYS = ["received", "landed", "not_found", "amount_differs", "bank_alert", "ready"] as const;
export type PhraseKey = (typeof PHRASE_KEYS)[number];

const EN: Record<PhraseKey, string> = {
  received: "You have received",
  landed: "It has landed! Konfam.",
  not_found: "No money arrived for this one. Do not release the goods.",
  amount_differs: "The money that landed is not complete. Check it well.",
  bank_alert: "This is a bank alert. Check your bank app yourself. Never release goods on a screenshot.",
  ready: "Konfam is ready.",
};

const FR: Record<PhraseKey, string> = {
  received: "Vous avez reçu",
  landed: "C'est arrivé ! Konfam.",
  not_found: "Aucun argent n'est arrivé pour ce paiement. Ne livrez pas la marchandise.",
  amount_differs: "Le montant reçu n'est pas complet. Vérifiez bien.",
  bank_alert: "C'est une alerte bancaire. Vérifiez vous-même votre application bancaire. Ne livrez jamais sur une capture d'écran.",
  ready: "Konfam est prêt.",
};

const PCM: Record<PhraseKey, string> = {
  received: "You don receive",
  landed: "E don land! Konfam.",
  not_found: "No money don land for this one. No release goods.",
  amount_differs: "The money wey land no complete. Check am well.",
  bank_alert: "Na bank alert be this. Check your bank app yourself. No release goods on screenshot.",
  ready: "Konfam don ready.",
};

/** Text used when the clip is missing, and the speechSynthesis voice for it. */
export const FALLBACK: Record<VoiceLang, { text: Record<PhraseKey, string>; voice: string }> = {
  pcm: { text: PCM, voice: "en-NG" },
  en: { text: EN, voice: "en-NG" },
  yo: { text: EN, voice: "en-NG" },
  ha: { text: EN, voice: "en-NG" },
  fr: { text: FR, voice: "fr-FR" },
  wo: { text: FR, voice: "fr-FR" },
};

/** Big words on the green screen. Yoruba/Hausa/Wolof wording: to be checked by a native speaker. */
export const PAID_TITLE: Record<VoiceLang, string> = {
  pcm: "E DON LAND",
  en: "MONEY LANDED",
  yo: "Ó TI WỌLÉ",
  ha: "AN BIYA",
  fr: "PAIEMENT REÇU",
  wo: "XAALIS BI AGSI NA",
};

export function phrase(lang: VoiceLang, key: PhraseKey): Segment {
  return { clip: key, lang, text: FALLBACK[lang].text[key] };
}

/** "You don receive · two thousand naira · E don land! Konfam." */
export function paidAnnouncement(lang: VoiceLang, amount: number, currency: AmountCurrency): Segment[] {
  return [phrase(lang, "received"), ...composeAmount(amount, lang, currency), phrase(lang, "landed")];
}

/** speechSynthesis voice for a clip's fallback text. English number clips use the Nigerian English voice. */
export function fallbackVoice(clipLang: string): string {
  if (clipLang === "en") return "en-NG";
  return FALLBACK[clipLang as VoiceLang]?.voice ?? "en-NG";
}

export type Utterance = { kind: "clips"; urls: string[] } | { kind: "tts"; text: string; voice: string };

/**
 * Plan playback: runs of clips that are all available play gaplessly; a run with ANY missing clip is
 * spoken as one sentence instead (mixing recorded words with a robot voice mid-number sounds broken).
 * Adjacent sentences in the same voice are merged.
 */
export function planUtterances(segments: Segment[], has: (url: string) => boolean): Utterance[] {
  const out: Utterance[] = [];
  const push = (u: Utterance) => {
    const last = out.at(-1);
    if (u.kind === "tts" && last?.kind === "tts" && last.voice === u.voice) last.text = `${last.text} ${u.text}`;
    else if (u.kind === "clips" && last?.kind === "clips") last.urls.push(...u.urls);
    else out.push(u);
  };
  // Group consecutive clip segments of the same clip language.
  let i = 0;
  while (i < segments.length) {
    const s = segments[i]!;
    if ("say" in s) {
      push({ kind: "tts", text: s.say, voice: s.voice });
      i++;
      continue;
    }
    const run: Array<Extract<Segment, { clip: string }>> = [];
    while (i < segments.length) {
      const x = segments[i]!;
      if ("say" in x || x.lang !== s.lang) break;
      run.push(x);
      i++;
    }
    const urls = run.map((x) => clipUrl(x.lang, x.clip));
    if (urls.every(has)) push({ kind: "clips", urls });
    else push({ kind: "tts", text: run.map((x) => x.text).join(" "), voice: fallbackVoice(s.lang) });
  }
  return out;
}

export function clipUrl(lang: string, clip: string): string {
  return `/voice/${lang}/${clip}.mp3`;
}
