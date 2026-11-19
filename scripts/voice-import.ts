/**
 * pnpm voice:import
 * Turns raw phone recordings into the box's voice pack.
 *
 *   voice-raw/en/two.m4a        → apps/web/public/voice/en/two.mp3
 *   voice-raw/pcm/landed.m4a    → apps/web/public/voice/pcm/landed.mp3
 *
 * Each file is trimmed (silence at both ends), loudness-normalised, mono 22.05 kHz, 48 kbps MP3
 * (VOICE_CLIPS.md). Uses the ffmpeg binary from the ffmpeg-static devDependency: nothing to install.
 * Any clip that is still missing is spoken by the phone's own voice (speechSynthesis) at runtime.
 *
 * voice-raw/ is gitignored: raw recordings stay on your laptop. Only the converted MP3s are committed.
 * Flags: --force (re-convert files that already exist).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { CURRENCY_CLIP, NUMBER_CLIPS } from "../apps/web/lib/voice/composeAmount";
import { PHRASE_KEYS } from "../apps/web/lib/voice/phrases";

const RAW = "voice-raw";
const OUT = path.join("apps", "web", "public", "voice");
const INPUT_EXT = [".m4a", ".mp3", ".wav", ".ogg", ".opus", ".aac", ".caf", ".mp4", ".webm", ".amr", ".3gp"];
const FILTER =
  "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm";
const force = process.argv.includes("--force");

/** What each folder should contain. en = numbers + currency words; the others = the 6 phrases. */
const EXPECTED: Record<string, { clips: string[]; required: boolean }> = {
  en: { clips: [...NUMBER_CLIPS, ...Object.values(CURRENCY_CLIP)], required: true },
  pcm: { clips: [...PHRASE_KEYS], required: true },
  yo: { clips: [...PHRASE_KEYS], required: true },
  ha: { clips: [...PHRASE_KEYS], required: false },
  wo: { clips: [...PHRASE_KEYS], required: false },
  fr: { clips: [...PHRASE_KEYS], required: false },
};

if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error("✗ ffmpeg-static binary not found. Run: pnpm install (it downloads ffmpeg on install).");
  process.exit(1);
}

for (const lang of ["en", "pcm", "yo"]) mkdirSync(path.join(RAW, lang), { recursive: true });

/** Map clip name → raw file. Case-insensitive; tolerates spaces/dashes ("Not Found.m4a" → not_found). */
function rawFiles(lang: string): { byClip: Map<string, string>; unknown: string[] } {
  const dir = path.join(RAW, lang);
  const byClip = new Map<string, string>();
  const unknown: string[] = [];
  if (!existsSync(dir)) return { byClip, unknown };
  const want = new Set(EXPECTED[lang]!.clips);
  for (const f of readdirSync(dir)) {
    const ext = path.extname(f).toLowerCase();
    if (!INPUT_EXT.includes(ext)) continue;
    const clip = path.basename(f, path.extname(f)).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (want.has(clip)) byClip.set(clip, path.join(dir, f));
    else unknown.push(f);
  }
  return { byClip, unknown };
}

function convert(input: string, output: string): boolean {
  const r = spawnSync(
    ffmpegPath as unknown as string,
    ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-af", FILTER, "-ac", "1", "-ar", "22050", "-b:a", "48k", output],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(`  ✗ ${input}: ${(r.stderr || "ffmpeg failed").trim().split("\n").at(-1)}`);
    return false;
  }
  return true;
}

let converted = 0;
let failed = 0;
const report: string[] = [];

for (const [lang, spec] of Object.entries(EXPECTED)) {
  const { byClip, unknown } = rawFiles(lang);
  const outDir = path.join(OUT, lang);
  if (byClip.size > 0) mkdirSync(outDir, { recursive: true });

  for (const [clip, input] of byClip) {
    const output = path.join(outDir, `${clip}.mp3`);
    if (!force && existsSync(output) && statSync(output).mtimeMs >= statSync(input).mtimeMs) continue;
    if (convert(input, output)) converted++;
    else failed++;
  }

  const have = spec.clips.filter((c) => existsSync(path.join(outDir, `${c}.mp3`)));
  const missing = spec.clips.filter((c) => !have.includes(c));
  const kb = have.reduce((a, c) => a + statSync(path.join(outDir, `${c}.mp3`)).size, 0) / 1024;
  if (!spec.required && have.length === 0 && unknown.length === 0) {
    report.push(`  ${lang.padEnd(4)} (optional) none: phone voice is used`);
    continue;
  }
  const mark = missing.length === 0 ? "✓" : "•";
  report.push(`${mark} ${lang.padEnd(4)} ${have.length}/${spec.clips.length} clips, ${kb.toFixed(0)} KB`);
  if (missing.length) report.push(`      missing (phone voice fills in): ${missing.join(", ")}`);
  if (unknown.length) report.push(`      ignored (name not in VOICE_CLIPS.md): ${unknown.join(", ")}`);
}

console.log(`\nVoice import: ${converted} converted${failed ? `, ${failed} failed` : ""}${force ? " (--force)" : ""}\n`);
console.log(report.join("\n"));
console.log(`\nRaw files go in ${RAW}/<lang>/ (gitignored). Output: ${OUT}/<lang>/*.mp3 (commit these).`);
console.log("Check on the phone: /settings → Test the voice.\n");
if (failed) process.exit(1);
