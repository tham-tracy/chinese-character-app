# Character Composition Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "How it's built" section to the single-character detail view that shows a character's components and labels which carries the sound and which carries the meaning, with clickable drill-down into in-app components.

**Architecture:** A new build script reads the Make Me a Hanzi dictionary and emits `src/data/components.json` (per-character decomposition + sound/meaning breakdown). The app lazy-loads it like the other data files and renders a new `Composition` component inside the single-character detail. The pure build transform lives in a side-effect-free module so it can be unit-tested.

**Tech Stack:** Node ESM build scripts, React + Vite, Vitest. Data from Make Me a Hanzi (`dictionary.txt`).

**Reference spec:** `docs/superpowers/specs/2026-06-30-character-composition-design.md`

---

## File Structure

- **Create** `scripts/lib/components.mjs` — pure transform: `resolveComponent()` and `buildEntry()`. No top-level I/O (so it's importable in tests). This is *why* the logic is split out from the script: `build-data.mjs` runs the pipeline on import, so its functions can't be imported without side effects; we avoid that here.
- **Create** `scripts/lib/components.test.js` — Vitest unit tests for the pure transform.
- **Create** `scripts/build-components.mjs` — thin I/O wrapper: read `data/raw/dictionary.txt` + `src/data/characters.json`, map each character through `buildEntry()`, write `src/data/components.json`.
- **Create** `src/data/components.json` — generated artifact (committed, like the other `src/data/*.json`).
- **Create** `src/components/Composition.jsx` — renders the breakdown section.
- **Modify** `package.json` — add `build:components` script; chain it into `build:data`.
- **Modify** `src/App.jsx` — lazy-load `components.json`, pass to `CharacterDetail`.
- **Modify** `src/components/CharacterDetail.jsx` — thread `components` + `onSelectChar` into `SingleCharDetail`, render `Composition`.
- **Modify** `src/App.css` — styles for `.composition`, `.comp-chip`, `.comp-tag`.
- **Modify** `README.md` — document the new raw source + rebuild step.

---

## Task 1: Pure build transform (`resolveComponent` + `buildEntry`)

**Files:**
- Create: `scripts/lib/components.mjs`
- Test: `scripts/lib/components.test.js`

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/components.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { resolveComponent, buildEntry } from './components.mjs'

// Minimal stand-ins for the real data files.
const charactersLookup = {
  '女': { readings: [{ pinyin: 'nǚ', meanings: ['woman', 'female', 'daughter'] }] },
  '马': { readings: [{ pinyin: 'mǎ', meanings: ['horse'] }] },
  '子': { readings: [{ pinyin: 'zǐ', meanings: ['child', 'son'] }] },
  '妈': { readings: [{ pinyin: 'mā', meanings: ['mother'] }] },
  '好': { readings: [{ pinyin: 'hǎo', meanings: ['good'] }] },
  '山': { readings: [{ pinyin: 'shān', meanings: ['mountain'] }] },
}
const mmahByChar = {
  '氵': { pinyin: ['shuǐ'], definition: 'water radical' },
}

describe('resolveComponent', () => {
  it('resolves an in-app character from charactersLookup with inApp: true', () => {
    expect(resolveComponent('女', charactersLookup, mmahByChar)).toEqual({
      char: '女',
      pinyin: 'nǚ',
      meaning: 'woman; female',
      inApp: true,
    })
  })

  it('falls back to Make Me a Hanzi data with inApp: false', () => {
    expect(resolveComponent('氵', charactersLookup, mmahByChar)).toEqual({
      char: '氵',
      pinyin: 'shuǐ',
      meaning: 'water radical',
      inApp: false,
    })
  })

  it('returns null for IDC symbols and the ？ placeholder', () => {
    expect(resolveComponent('⿰', charactersLookup, mmahByChar)).toBeNull()
    expect(resolveComponent('？', charactersLookup, mmahByChar)).toBeNull()
  })

  it('returns null for an unresolvable component', () => {
    expect(resolveComponent('𰻞', charactersLookup, mmahByChar)).toBeNull()
  })
})

describe('buildEntry', () => {
  it('builds semantic + phonetic for a pictophonetic record', () => {
    const record = {
      character: '妈',
      decomposition: '⿰女马',
      etymology: { type: 'pictophonetic', hint: 'woman', semantic: '女', phonetic: '马' },
    }
    expect(buildEntry(record, charactersLookup, mmahByChar)).toEqual({
      type: 'pictophonetic',
      decomposition: '⿰女马',
      hint: 'woman',
      semantic: { char: '女', pinyin: 'nǚ', meaning: 'woman; female', inApp: true },
      phonetic: { char: '马', pinyin: 'mǎ', meaning: 'horse', inApp: true },
    })
  })

  it('builds a components array for an ideographic record', () => {
    const record = {
      character: '好',
      decomposition: '⿰女子',
      etymology: { type: 'ideographic', hint: 'A woman 女 with a son 子' },
    }
    expect(buildEntry(record, charactersLookup, mmahByChar)).toEqual({
      type: 'ideographic',
      decomposition: '⿰女子',
      hint: 'A woman 女 with a son 子',
      components: [
        { char: '女', pinyin: 'nǚ', meaning: 'woman; female', inApp: true },
        { char: '子', pinyin: 'zǐ', meaning: 'child; son', inApp: true },
      ],
    })
  })

  it('omits the character itself from an atomic pictographic record', () => {
    const record = {
      character: '山',
      decomposition: '山',
      etymology: { type: 'pictographic', hint: 'Mountain with three peaks' },
    }
    expect(buildEntry(record, charactersLookup, mmahByChar)).toEqual({
      type: 'pictographic',
      decomposition: '山',
      hint: 'Mountain with three peaks',
    })
  })

  it('returns null when there is no etymology', () => {
    expect(buildEntry({ character: '某', decomposition: '⿱甘木' }, charactersLookup, mmahByChar))
      .toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/lib/components.test.js`
Expected: FAIL — `Failed to resolve import "./components.mjs"` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/components.mjs`:

```js
// Pure transform for building src/data/components.json from the Make Me a Hanzi
// dictionary. No top-level I/O so it can be imported in unit tests; the file
// reading/writing lives in scripts/build-components.mjs.

// Ideographic Description Characters and the unknown-component placeholder are
// structural markers in a decomposition string, not real components.
const NON_COMPONENT = new Set([...'⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻？'])

// Resolve one component character to display-ready fields, or null if it can't
// be shown. Prefers the app's own curated data (and marks it clickable via
// inApp: true); falls back to Make Me a Hanzi's own pinyin/definition.
export function resolveComponent(char, charactersLookup, mmahByChar) {
  if (!char || NON_COMPONENT.has(char)) return null

  const inAppEntry = charactersLookup[char]
  if (inAppEntry) {
    const reading = inAppEntry.readings?.[0]
    return {
      char,
      pinyin: reading?.pinyin ?? '',
      meaning: (reading?.meanings ?? []).slice(0, 2).join('; '),
      inApp: true,
    }
  }

  const mmah = mmahByChar[char]
  if (mmah) {
    return {
      char,
      pinyin: (mmah.pinyin && mmah.pinyin[0]) || '',
      meaning: mmah.definition || '',
      inApp: false,
    }
  }

  return null
}

// Build a components.json entry from a Make Me a Hanzi record, or null if there
// is nothing usable to show.
export function buildEntry(record, charactersLookup, mmahByChar) {
  const etymology = record.etymology
  if (!etymology) return null

  const type = etymology.type
  const decomposition = record.decomposition || ''
  const entry = { type, decomposition }
  if (etymology.hint) entry.hint = etymology.hint

  if (type === 'pictophonetic') {
    const semantic = resolveComponent(etymology.semantic, charactersLookup, mmahByChar)
    const phonetic = resolveComponent(etymology.phonetic, charactersLookup, mmahByChar)
    if (!semantic && !phonetic) return null
    if (semantic) entry.semantic = semantic
    if (phonetic) entry.phonetic = phonetic
    return entry
  }

  // ideographic / pictographic: resolve the decomposition parts, dropping the
  // structural markers and the character itself (atomic pictographs decompose
  // to themselves).
  const seen = new Set()
  const components = []
  for (const ch of decomposition) {
    if (ch === record.character) continue
    if (seen.has(ch)) continue
    const resolved = resolveComponent(ch, charactersLookup, mmahByChar)
    if (!resolved) continue
    seen.add(ch)
    components.push(resolved)
  }
  if (components.length) entry.components = components

  // Nothing to say at all -> skip the character entirely.
  if (!entry.hint && !entry.components) return null
  return entry
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/lib/components.test.js`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/components.mjs scripts/lib/components.test.js
git commit -m "feat: add pure transform for character composition data"
```

---

## Task 2: Build script + generate `components.json`

**Files:**
- Create: `scripts/build-components.mjs`
- Create: `src/data/components.json` (generated)
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write the build script**

Create `scripts/build-components.mjs`:

```js
// Build-time pipeline for character composition.
//
// Reads the Make Me a Hanzi dictionary (data/raw/dictionary.txt, one JSON
// object per line) and the app's own character set (src/data/characters.json),
// and emits:
//
//   src/data/components.json   char -> { type, decomposition, hint?,
//                                        semantic?, phonetic?, components?[] }
//
// Only characters in the app's set with usable etymology are included.
//
// Run with:  npm run build:components

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildEntry } from './lib/components.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

console.log('Reading characters.json...')
const characters = JSON.parse(readFileSync(join(ROOT, 'src/data/characters.json'), 'utf8'))

console.log('Reading Make Me a Hanzi dictionary...')
const raw = readFileSync(join(ROOT, 'data/raw/dictionary.txt'), 'utf8')
const mmahByChar = {}
for (const line of raw.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed) continue
  const record = JSON.parse(trimmed)
  mmahByChar[record.character] = record
}
console.log(`Parsed ${Object.keys(mmahByChar).length} dictionary records.`)

const components = {}
for (const char of Object.keys(characters)) {
  const record = mmahByChar[char]
  if (!record) continue
  const entry = buildEntry(record, characters, mmahByChar)
  if (entry) components[char] = entry
}

const outDir = join(ROOT, 'src/data')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'components.json'), JSON.stringify(components))

console.log(
  `Wrote composition data for ${Object.keys(components).length} of ` +
    `${Object.keys(characters).length} characters to src/data/components.json.`,
)
```

- [ ] **Step 2: Add the npm scripts**

In `package.json`, modify the `scripts` block so `build:data` chains the new script, and add a standalone `build:components`:

```json
    "build:data": "node scripts/build-data.mjs && node scripts/build-sentences.mjs && node scripts/build-components.mjs",
    "build:sentences": "node scripts/build-sentences.mjs",
    "build:components": "node scripts/build-components.mjs"
```

- [ ] **Step 3: Download the raw source and generate the data**

```bash
curl -L -o data/raw/dictionary.txt \
  https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt
npm run build:components
```

Expected output: `Wrote composition data for NNNN of 3000 characters to src/data/components.json.` (NNNN should be in the low thousands — most characters have etymology).

- [ ] **Step 4: Spot-check the output**

Run:

```bash
node -e "const c=require('./src/data/components.json'); console.log(JSON.stringify(c['妈'],null,2)); console.log(JSON.stringify(c['好'],null,2)); console.log(JSON.stringify(c['山'],null,2));"
```

Expected: 妈 has `type: "pictophonetic"` with `semantic`/`phonetic`; 好 has `components`; 山 has a `hint`. (Exact hints/types come from the dictionary — confirm the *shapes* match the spec, not exact strings.)

- [ ] **Step 5: Document the raw source in the README**

In `README.md`, under "Rebuilding the data", add Make Me a Hanzi to the bulleted list of raw sources to download:

```markdown
#   - Make Me a Hanzi: https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt
#                (save as data/raw/dictionary.txt)
```

And add `components.json` to the sentence describing what gets written:

> This selects the ~3,000 most common characters and ~14,000 most common words and
> writes `characters.json`, `pinyin-index.json`, `word-index.json`, `sentences.json`,
> and `components.json`.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-components.mjs package.json src/data/components.json README.md
git commit -m "feat: generate character composition data from Make Me a Hanzi"
```

---

## Task 3: `Composition` component + styles

**Files:**
- Create: `src/components/Composition.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Write the component**

Create `src/components/Composition.jsx`:

```jsx
// Renders the "How it's built" breakdown for a single character.
// `data` is one entry from components.json; `onSelectChar(char)` drills into a
// component that exists in the app (inApp: true).

function Chip({ comp, tag, onSelectChar }) {
  const inner = (
    <>
      <span className="comp-char">{comp.char}</span>
      {tag && <span className="comp-tag">{tag}</span>}
      <span className="comp-pinyin">{comp.pinyin}</span>
      <span className="comp-meaning">{comp.meaning}</span>
    </>
  )
  if (comp.inApp && onSelectChar) {
    return (
      <button type="button" className="comp-chip comp-chip-link" onClick={() => onSelectChar(comp.char)}>
        {inner}
      </button>
    )
  }
  return <div className="comp-chip">{inner}</div>
}

export default function Composition({ data, onSelectChar }) {
  if (!data) return null

  if (data.type === 'pictophonetic') {
    return (
      <section className="composition">
        <div className="label">How it's built</div>
        <div className="comp-row">
          {data.semantic && <Chip comp={data.semantic} tag="meaning" onSelectChar={onSelectChar} />}
          {data.phonetic && <Chip comp={data.phonetic} tag="sound" onSelectChar={onSelectChar} />}
        </div>
        {data.semantic && data.phonetic && (
          <p className="comp-note">
            A sound-meaning compound: {data.semantic.char} gives the meaning, {data.phonetic.char} gives the sound.
          </p>
        )}
        {data.hint && <p className="comp-note">{data.hint}</p>}
      </section>
    )
  }

  // ideographic / pictographic
  return (
    <section className="composition">
      <div className="label">How it's built</div>
      {data.components?.length > 0 && (
        <div className="comp-row">
          {data.components.map((comp) => (
            <Chip key={comp.char} comp={comp} onSelectChar={onSelectChar} />
          ))}
        </div>
      )}
      {data.hint && <p className="comp-note">{data.hint}</p>}
    </section>
  )
}
```

- [ ] **Step 2: Add the styles**

In `src/App.css`, append (uses the existing `--accent`, `--muted`, `--border`, `--paper` variables):

```css
/* Character composition ("How it's built") */
.comp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.comp-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--paper);
  text-align: left;
  font: inherit;
  color: inherit;
  min-width: 120px;
}

.comp-chip-link {
  cursor: pointer;
}

.comp-chip-link:hover,
.comp-chip-link:focus-visible {
  border-color: var(--accent);
  outline: none;
}

.comp-char {
  font-size: 28px;
  line-height: 1;
}

.comp-tag {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.comp-pinyin {
  color: var(--accent);
  font-size: 14px;
}

.comp-meaning {
  color: var(--muted);
  font-size: 13px;
}

.comp-note {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Composition.jsx src/App.css
git commit -m "feat: add Composition component and styles"
```

---

## Task 4: Wire composition data into the app

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/CharacterDetail.jsx`

- [ ] **Step 1: Lazy-load `components.json` in `App.jsx`**

In `src/App.jsx`, add a state hook and a load in the existing `useEffect`, then pass it to `CharacterDetail`.

Add to the state declarations (after `sentences`):

```jsx
  const [components, setComponents] = useState(null)
```

Add to the `useEffect` body (alongside the other imports):

```jsx
    import('./data/components.json').then((m) => setComponents(m.default))
```

Change the `CharacterDetail` render to pass `components` and a selection callback:

```jsx
      <CharacterDetail
        selected={selected}
        characters={characters}
        sentences={sentences}
        components={components}
        onSelectChar={(char) => setSelected({ kind: 'char', char })}
      />
```

- [ ] **Step 2: Thread the props through `CharacterDetail.jsx`**

In `src/components/CharacterDetail.jsx`:

Add the import at the top:

```jsx
import Composition from './Composition.jsx'
```

Update the top-level component signature and the `SingleCharDetail` call to pass the new props:

```jsx
export default function CharacterDetail({ selected, characters, sentences, components, onSelectChar }) {
```

In the same function, replace the single-char return branch with:

```jsx
  return (
    <SingleCharDetail
      char={selected.char}
      data={characters?.[selected.char]}
      sentence={sentences?.chars?.[selected.char]}
      composition={components?.[selected.char]}
      onSelectChar={onSelectChar}
    />
  )
```

Update the `SingleCharDetail` signature and render the `Composition` section between the meanings and the example words:

```jsx
function SingleCharDetail({ char, data, sentence, composition, onSelectChar }) {
```

Insert this directly after the `data?.readings?.map(...)` block and before the `{data?.exampleWords?.length > 0 && (` block:

```jsx
        <Composition data={composition} onSelectChar={onSelectChar} />
```

- [ ] **Step 3: Run the dev server and verify manually**

Run: `npm run dev`

In the browser:
- Search `ma`, open 妈 → confirm a "How it's built" section shows 女 tagged **meaning** and 马 tagged **sound**, with the sound-meaning note.
- Click the 马 chip → the detail switches to 马.
- Search `hao`, open 好 → confirm component chips (no sound/meaning tags) plus the hint sentence.
- Search `shan`, open 山 → confirm just the hint line (no chips), section still renders cleanly.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — existing tests plus the new `components.test.js` all green.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/CharacterDetail.jsx
git commit -m "feat: show character composition in single-character detail"
```

---

## Task 5: Production build + verification screenshot

**Files:**
- (No source changes; verification only.)

- [ ] **Step 1: Verify the production build succeeds**

Run: `npm run build`
Expected: build completes with no errors; `dist/` is produced.

- [ ] **Step 2: Capture a verification screenshot**

With the dev server (or `npm run preview`) running, open 妈's detail and save a screenshot as `verify-composition.png` in the repo root, matching the existing `verify-*.png` convention.

- [ ] **Step 3: Commit**

```bash
git add verify-composition.png
git commit -m "test: add composition verification screenshot"
```

---

## Self-Review Notes

- **Spec coverage:** §1 data/build → Tasks 1–2; §2 data shape → Tasks 1–2 (`buildEntry` output matches the documented shape, incl. `inApp`); §3 UI → Tasks 3–4 (pictophonetic chips with sound/meaning tags, ideographic/pictographic chips, clickable in-app components, placement between meanings and example words, lazy-load wiring, CSS); §4 testing → Task 1 (pure-function tests) + Tasks 4–5 (manual verification, screenshot).
- **Type consistency:** component object shape `{ char, pinyin, meaning, inApp }` is identical across `resolveComponent`, `buildEntry`, the JSON, and `Composition.jsx`. Entry fields (`type`, `decomposition`, `hint`, `semantic`, `phonetic`, `components`) are consistent between the build module and the renderer.
- **No placeholders:** every code/command step contains concrete content.
