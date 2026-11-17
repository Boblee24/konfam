"use client";
/**
 * Box voice. Recorded clips play gaplessly through Web Audio at full volume; anything missing is
 * spoken by the browser (speechSynthesis). No network TTS, ever: clips are static files the
 * service worker caches.
 *
 * Mobile browsers block sound until the user taps: call unlockAudio() from the "Enable sound" tap.
 */
import { NUMBER_CLIPS, CURRENCY_CLIP, type Segment } from "./composeAmount";
import { clipUrl, PHRASE_KEYS, planUtterances, type Utterance } from "./phrases";
import type { VoiceLang } from "../konfam";

let ctx: AudioContext | null = null;
/** url → decoded buffer, or null if the file doesn't exist / can't decode. */
const buffers = new Map<string, AudioBuffer | null>();
let queue: Promise<void> = Promise.resolve();

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Must run inside a user gesture (tap). */
export function unlockAudio(): void {
  const c = audioContext();
  if (c) {
    void c.resume().catch(() => {});
    // A 1-sample silent buffer fully unlocks iOS/Android.
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  }
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.getVoices(); // starts loading voices on Chrome
  }
}

async function load(url: string): Promise<AudioBuffer | null> {
  if (buffers.has(url)) return buffers.get(url)!;
  const c = audioContext();
  let buf: AudioBuffer | null = null;
  try {
    const res = await fetch(url);
    if (res.ok && (res.headers.get("content-type") ?? "").startsWith("audio/") && c) {
      buf = await c.decodeAudioData(await res.arrayBuffer());
    }
  } catch {
    buf = null;
  }
  buffers.set(url, buf);
  return buf;
}

/** Fetch + decode every clip this language can need, so the announce step works offline and instantly. */
export async function preloadVoice(lang: VoiceLang): Promise<{ phrases: number; numbers: number }> {
  const phraseUrls = PHRASE_KEYS.map((k) => clipUrl(lang, k));
  const numberUrls =
    lang === "fr" || lang === "wo" ? [] : [...NUMBER_CLIPS, ...Object.values(CURRENCY_CLIP)].map((w) => clipUrl("en", w));
  const results = await Promise.all([...phraseUrls, ...numberUrls].map(load));
  const ok = (from: number, to: number) => results.slice(from, to).filter(Boolean).length;
  return { phrases: ok(0, phraseUrls.length), numbers: ok(phraseUrls.length, results.length) };
}

function playClips(urls: string[]): Promise<void> {
  const c = audioContext();
  if (!c) return Promise.resolve();
  const gain = c.createGain();
  gain.gain.value = 1;
  gain.connect(c.destination);
  let t = c.currentTime + 0.05;
  let last: AudioBufferSourceNode | null = null;
  for (const url of urls) {
    const buf = buffers.get(url);
    if (!buf) continue;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(t);
    t += buf.duration;
    last = src;
  }
  if (!last) return Promise.resolve();
  const end = last;
  return new Promise((resolve) => {
    end.onended = () => resolve();
    setTimeout(resolve, (t - c.currentTime) * 1000 + 500); // never hang the queue
  });
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.slice(0, 2);
  const prefs = lang === "en-NG" ? ["en-NG", "en-GB", "en-US"] : [lang];
  for (const p of prefs) {
    const v = voices.find((x) => x.lang.replace("_", "-") === p);
    if (v) return v;
  }
  return voices.find((x) => x.lang.startsWith(prefix));
}

function sayText(text: string, lang: string): Promise<void> {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.volume = 1;
    u.rate = 0.95;
    const done = () => resolve();
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
    setTimeout(done, 2000 + text.length * 120); // some Android voices never fire onend
  });
}

async function play(plan: Utterance[]): Promise<void> {
  for (const u of plan) {
    if (u.kind === "clips") await playClips(u.urls);
    else await sayText(u.text, u.voice);
  }
}

/** Queue an announcement. Resolves when it has been spoken. */
export function speak(segments: Segment[]): Promise<void> {
  const run = async () => {
    // Clips not preloaded yet are tried now (cached by the service worker after the first time).
    await Promise.all(segments.flatMap((s) => ("clip" in s ? [load(clipUrl(s.lang, s.clip))] : [])));
    await play(planUtterances(segments, (url) => !!buffers.get(url)));
  };
  queue = queue.then(run, run);
  return queue;
}
