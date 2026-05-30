# Chinese Character Learner — Design

**Date:** 2026-05-30
**Status:** Approved (design phase)

## Summary

A web app for learning Chinese characters. The user types a pinyin syllable; the
app returns every common character that matches, sorted most-common-first. Selecting
a character shows its English meaning, common example words, an example sentence
(with pinyin and translation), and an animated stroke-order panel with a practice
mode where the user draws the character and each stroke is checked.

## Goals

- Type pinyin (tone optional) → see all matching characters.
- For a selected character: English meaning, example words, one example sentence.
- Show animated stroke order, and let the user practice writing it.
- Fast, free to host, works offline. No backend, no API keys.

## Non-Goals (v1)

- Full 120k-entry dictionary. v1 is scoped to the **~3,000 most common characters**
  (HSK + everyday-frequency set). The character set can be expanded later.
- Traditional-character input (data is Simplified-first; Traditional may render but is
  not a search target in v1).
- User accounts, progress tracking, spaced repetition, or saved decks.
- Sentence-level lookup or full handwriting OCR.

## Platform & Stack

- **Frontend:** React + Vite (fully client-side single-page app).
- **Stroke order / practice:** [Hanzi Writer](https://hanziwriter.org/) (renders SVG
  stroke animation and quiz/practice mode), backed by Make Me a Hanzi stroke data.
- **Pinyin generation:** `pinyin-pro` (npm) for converting Chinese text to tone-marked
  pinyin at build time.
- **Testing:** Vitest for unit tests of the search/pinyin logic.
- **Hosting:** Static deploy (GitHub Pages / Netlify) — the build output is plain files.

## Data Sources (all free / open)

- **CC-CEDICT** — Simplified character, pinyin, English definitions, and multi-character
  entries used to derive example words.
- **Tatoeba** — Mandarin sentences with linked English translations, for example sentences.
- **Make Me a Hanzi / Hanzi Writer data** — per-character stroke-order data.

## Data Pipeline (build-time, run once → produces bundled JSON)

Scripts under `scripts/` transform raw datasets into compact JSON shipped with the app.
Raw downloads live in `data/raw/` (gitignored); generated JSON lives in `src/data/`.

1. **Build the common-character set.** Take a frequency/HSK list and keep the top ~3,000
   Simplified single characters. This set gates everything downstream.

2. **Pinyin index (CC-CEDICT).** For each character in the set, record:
   - tone-marked pinyin (CC-CEDICT stores tone numbers like `shi4`; convert to `shì`),
   - English meaning(s),
   - a few example words: common multi-character CC-CEDICT entries that contain the
     character (each with its own pinyin + gloss),
   - a frequency rank (for sort order).

   Produce a lookup keyed by **normalized (toneless) pinyin syllable** →
   list of character entries. Example: `"shi" → [是, 十, 时, 事, ...]`.

3. **Example sentences (Tatoeba).** For each character, pick one Mandarin sentence
   containing it that has an English translation. Generate the sentence's pinyin with
   `pinyin-pro`. Store as `char → { hanzi, pinyin, english }`. Characters without a good
   sentence simply have none.

4. **Stroke data.** Bundle Hanzi Writer stroke-order data for the characters in the set
   so animation and practice work offline.

**Output files (in `src/data/`):**

- `pinyin-index.json` — toneless syllable → array of `{ char, pinyin, tone, rank }`.
- `characters.json` — char → `{ pinyin, tone, meanings[], exampleWords[] }`.
- `sentences.json` — char → `{ hanzi, pinyin, english }` (optional per char).
- Stroke data bundled via Hanzi Writer's data package for the scoped set.

(If total size warrants it, character detail and stroke data can be lazy-loaded per
character rather than all up front. Decision deferred to the implementation plan based
on measured bundle size.)

## Runtime Architecture

**Components**

- `SearchBar` — pinyin input field + search action.
- `ResultsList` — clickable character chips (char + tone-marked pinyin), most-common first.
- `CharacterDetail` — meaning, example words, example sentence.
- `StrokePanel` — wraps Hanzi Writer; **Animate** (play stroke order) and **Practice**
  (user draws, each stroke validated) buttons.

**Library modules**

- `lib/pinyin.js` — input normalization (lowercase; accept `shi`, `shi4`, or `shì`;
  extract optional tone) and tone-number → tone-mark conversion.
- `lib/search.js` — given a normalized query, look up matches in `pinyin-index.json`,
  optionally filter by tone, sort by frequency rank.

## Data Flow

1. On startup, the app loads `pinyin-index.json`.
2. User types pinyin → `lib/pinyin.js` normalizes it (tone optional) →
   `lib/search.js` returns matches, tone-filtered if a tone was given, sorted
   most-common-first.
3. `ResultsList` renders the matching character chips.
4. User taps a chip → `CharacterDetail` reads `characters.json` + `sentences.json` for
   that character; `StrokePanel` initializes Hanzi Writer for it.
5. **Animate** plays the stroke order; **Practice** starts quiz mode and checks strokes.

## Layout

Approved mockup: a search bar on top; a horizontal row of matching-character chips
below it; then a two-column detail area — left column is the stroke-writing panel
(grid box + Animate/Practice buttons), right column is the large character, tone-marked
pinyin, English meaning, example words, and the example sentence.

## Error / Edge Cases

- **No matches** → friendly "No characters found for '<input>'" message.
- **Character missing stroke data** → render the character statically with a small note
  (rare within the common set).
- **No example sentence** → hide the sentence section for that character.
- **Empty / whitespace input** → no search performed.

## Testing

Unit tests (Vitest) focused on the pure logic:

- Normalization: `shi`, `shi4`, and `shì` all resolve to syllable `shi` (with tone where given).
- Search: `"shi"` returns the expected set of characters; results are frequency-ordered.
- Tone filtering: `"shì"` returns only fourth-tone matches.
- Tone conversion: `shi4` → `shì`, `lu:3` / `lv3` → `lǚ`, neutral tone handled.

## Open Questions / Deferred

- Whether to lazy-load per-character detail + stroke data vs. bundle all up front —
  decided in the implementation plan based on measured bundle size.
