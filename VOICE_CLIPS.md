# Konfam voice clips: recording guide (about 40 minutes)

Your own voice beats AI voice for Pidgin and Yoruba, and it costs ₦0. Record these on your phone today while Session 0 runs.

## How to record
- Quiet room, phone 20 cm from your mouth, the same energy every time: clear and a bit loud, like a market announcer.
- **One file per clip**, named **exactly** as listed, e.g. `two.m4a`. Leave half a second of silence at the start and end.
- Copy the files to the laptop, into **`voice-raw/<lang>/`** (`voice-raw/en/two.m4a`, `voice-raw/pcm/landed.m4a`, …).
  Any phone format works (.m4a from iPhone, .opus/.ogg WhatsApp voice notes, .mp3, .wav). Names are
  case-insensitive, and spaces become underscores ("Not Found.m4a" → `not_found`).
- Run **`pnpm voice:import`**. It trims the silence, normalises loudness and writes small MP3s to
  `apps/web/public/voice/<lang>/` (no ffmpeg install needed: it uses the `ffmpeg-static` package).
  It prints which clips are still missing; the phone's own voice fills in for those, so nothing breaks.
- `voice-raw/` is gitignored (your raw voice stays on your laptop). Commit `apps/web/public/voice/`.
- Check on the phone: /settings → **Test the voice** shows how many clips it found.

## 1. Numbers: English (used for Pidgin, Yoruba, Hausa and English), 32 clips → `voice-raw/en/`
`zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen`
`twenty thirty forty fifty sixty seventy eighty ninety`
`hundred thousand million`
`point` (optional)

## 2. Currency words, 3 clips → `voice-raw/en/`
`naira` · `sats` · `cfa` (say "francs CFA")

## 3. Pidgin phrases (`pcm`) → `voice-raw/pcm/`
| File | Say (adjust to sound natural) |
|---|---|
| `received.mp3` | "You don receive…" |
| `landed.mp3` | "E don land! Konfam." |
| `not_found.mp3` | "No money don land for this one. No release goods." |
| `amount_differs.mp3` | "The money wey land no complete. Check am well." |
| `bank_alert.mp3` | "Na bank alert be this. Check your bank app yourself. No release goods on screenshot." |
| `ready.mp3` | "Konfam don ready." |

## 4. Yoruba phrases (`yo`) → `voice-raw/yo/`
Say these naturally in your own Yoruba. Only the meaning matters; amounts will still be spoken with the English number clips.
| File | Meaning |
|---|---|
| `received.mp3` | "Money has entered…" |
| `landed.mp3` | "It has arrived! Konfam." |
| `not_found.mp3` | "No money arrived for this one. Don't release the goods." |
| `amount_differs.mp3` | "The money that arrived is not complete. Check it well." |
| `bank_alert.mp3` | "This is a bank alert. Check your bank app yourself. Don't release goods on a screenshot." |
| `ready.mp3` | "Konfam is ready." |

## 5. Hausa (`ha`), optional
Ask a Hausa-speaking friend to record the same 6 phrases. Or generate them once with Spitch TTS (`language="ha"`, part of the $1 free credit), then save them as files. Don't call TTS live in the demo.

## 6. Wolof (`wo`), optional but strong for the Senegalese judges
If you know any Wolof speaker, send them the 6 meanings above on WhatsApp and ask for voice notes (WhatsApp `.opus` works: put them in `voice-raw/wo/` and run `pnpm voice:import`). Amounts for `wo` and `fr` are spoken in French by the browser.

## 7. French (`fr`)
Nothing to record. The browser's French voice (`fr-FR`) speaks phrases and amounts. If you want, record the 6 phrases in French for a better sound.

**Done when:** `pnpm voice:import` shows ✓ for `en` (34 clips; `point` is not used) and ✓ for `pcm` and `yo` (6 each). Tell Session A: "voice clips are in".
