# Character Composition Breakdown — Design

**Date:** 2026-06-30
**Status:** Approved, ready for implementation plan

## Goal

Help users understand *why* a Chinese character looks the way it does, instead of
memorizing it as an arbitrary shape. Most characters are **phono-semantic
compounds** (形声字): one part hints at the *meaning* (the semantic radical) and
another part hints at the *sound* (the phonetic component).

Example: 妈 (mā, "mom") = 女 ("woman" → meaning) + 马 (mǎ → sound).

The feature adds a "How it's built" section to the single-character detail view
that shows a character's components and labels which one carries the sound and
which carries the meaning, adapting gracefully for characters that aren't
phono-semantic compounds.

## Scope decisions

- **What to convey:** Sound + meaning breakdown (which component gives the sound,
  which gives the meaning).
- **Non-phono-semantic characters:** Show what's available and adapt the label.
  Pictophonetic characters show sound + meaning; ideographic/pictographic
  characters show their components plus an etymology hint (no sound part);
  characters with no usable data omit the section entirely.
- **Components are clickable:** Tapping a component that exists in the app's
  dataset drills into that component's own detail (reuses existing selection).
- **Placement:** Single-character detail only. The word view stays focused on the
  word; drilling into a character is one tap away.

## 1. Data source & build

**New raw source:** `data/raw/dictionary.txt` — the Make Me a Hanzi dictionary
(one JSON object per line). This is the same project that supplies the app's
stroke data. Download URL documented in the README alongside the other raw
sources:
`https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt`

Each line looks like:

```json
{"character":"妈","pinyin":["mā"],"decomposition":"⿰女马","radical":"女",
 "etymology":{"type":"pictophonetic","hint":"woman","phonetic":"马","semantic":"女"}}
```

**New build script:** `scripts/build-components.mjs`

- Reads the ~3,000 characters from `src/data/characters.json` (the canonical set).
- For each, finds its Make Me a Hanzi entry and extracts `decomposition`,
  `radical`, and `etymology`.
- Resolves every referenced component character (`semantic`, `phonetic`, and the
  parts inside `decomposition`) into `{ char, pinyin, meaning, inApp }`:
  - **First choice:** look it up in `characters.json` — uses the app's curated
    pinyin/meaning and marks `inApp: true` (clickable in-app character).
  - **Fallback:** use Make Me a Hanzi's own `pinyin[0]` + `definition` for that
    component, with `inApp: false`. Covers radicals like 氵 艹 that aren't
    standalone entries in the 3,000-character set.
- Filters out non-character decomposition tokens: the Ideographic Description
  Characters (⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿹ ⿺ ⿻) and the `？` placeholder.
- Components that cannot be resolved anywhere are dropped (never shown blank).
- Writes `src/data/components.json`.
- Characters with no usable etymology are omitted from the output file.

**Build wiring (`package.json`):** `build:components` runs `build-components.mjs`
standalone; `build:data` runs it after the existing data + sentence scripts.

To keep build logic testable, the pure transform lives in an importable function
`buildEntry(makemeahanziRecord, charactersLookup)`; the script is a thin I/O
wrapper (read files → map records → write JSON).

## 2. Data shape — `src/data/components.json`

Keyed by character. Each component is resolved to display-ready fields plus an
`inApp` flag.

```json
{
  "妈": {
    "type": "pictophonetic",
    "decomposition": "⿰女马",
    "hint": "woman",
    "semantic": { "char": "女", "pinyin": "nǚ", "meaning": "woman; female", "inApp": true },
    "phonetic": { "char": "马", "pinyin": "mǎ", "meaning": "horse", "inApp": true }
  },
  "好": {
    "type": "ideographic",
    "decomposition": "⿰女子",
    "hint": "A woman 女 with a son 子",
    "components": [
      { "char": "女", "pinyin": "nǚ", "meaning": "woman; female", "inApp": true },
      { "char": "子", "pinyin": "zǐ", "meaning": "child; son", "inApp": true }
    ]
  },
  "山": { "type": "pictographic", "decomposition": "山", "hint": "Mountain with three peaks" }
}
```

Rules by `type`:

- **pictophonetic** → `semantic` + `phonetic` objects (the sound/meaning split).
  `hint` optional.
- **ideographic / pictographic** → `components` array (resolved decomposition
  parts), plus `hint`. Single-part pictographs may have an empty or omitted
  `components`.
- **no usable etymology** → character omitted from the file (UI skips the
  section).

## 3. UI — "How it's built" section

A new section renders in `SingleCharDetail` (in `CharacterDetail.jsx`), between
the meanings and the example words, only when `components[char]` exists.

**New component:** `src/components/Composition.jsx` — receives the composition
entry plus an `onSelectChar` callback. Renders one of three layouts by `type`:

**Pictophonetic** (headline case):

```
How it's built
┌─────────────────┐   ┌─────────────────┐
│  女   meaning   │   │  马    sound     │
│  nǚ             │ + │  mǎ              │
│  woman; female  │   │  horse           │
└─────────────────┘   └─────────────────┘
A sound-meaning compound: 女 gives the meaning, 马 gives the sound.
```

Two labeled chips — one tagged **meaning**, one tagged **sound**. The optional
`hint` becomes a plain sentence beneath.

**Ideographic / pictographic:**

```
How it's built
[ 女 nǚ · woman ]  [ 子 zǐ · child ]
A woman 女 with a son 子.       ← the hint
```

Component chips (no sound/meaning tags), with the `hint` sentence. Pure
pictographs with no parts show just the hint line.

**Interactivity:** Each chip whose component has `inApp: true` is a `<button>`
that calls `onSelectChar(char)` → drills into that character's detail (reusing
`setSelected`). Components with `inApp: false` (radicals like 氵) render as
static, non-clickable chips.

**Wiring:** `App.jsx` lazy-loads `components.json` into state (matching the
existing pattern for `characters.json` / `sentences.json`) and passes it to
`CharacterDetail`, which threads it plus
`onSelectChar={(char) => setSelected({ kind: 'char', char })}` into
`SingleCharDetail`.

**Styling:** New CSS in `App.css` for `.composition`, `.comp-chip`, and
`.comp-tag` (the sound/meaning labels), following the existing visual language
(`.label` headers, `.word-*` rows). Clickable chips get hover/focus affordance.

## 4. Testing

Following the existing `vitest` setup (`src/lib/*.test.js`):

- **Build-logic unit tests** for the pure `buildEntry` transform:
  - IDC symbols and `？` placeholders are stripped from decomposition parts.
  - A pictophonetic record yields `semantic` + `phonetic`; an ideographic record
    yields `components`.
  - Component resolution prefers `characters.json`, falls back to Make Me a Hanzi,
    and sets `inApp` correctly.
  - Unresolvable components are dropped.
- **Manual verification:** Run the dev server and confirm 妈 (pictophonetic), 好
  (ideographic), and 山 (pictographic) render correctly, and that clicking 女
  drills in. Save a verification screenshot consistent with the repo's existing
  `verify-*.png` convention.

No tests for React rendering itself, consistent with the current codebase (tests
cover `lib/` logic only, not components).
