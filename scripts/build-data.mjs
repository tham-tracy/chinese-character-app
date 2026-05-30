// Build-time data pipeline.
//
// Reads the raw CC-CEDICT dump (data/raw/cedict.txt), selects the ~3,000 most
// common single characters (ranked by how many dictionary words they appear in,
// a reliable free proxy for frequency), and emits two compact JSON files the
// app loads at runtime:
//
//   src/data/pinyin-index.json  toneless syllable -> [{ char, pinyin, tone, rank }]
//   src/data/characters.json    char -> { rank, readings[], exampleWords[] }
//
// Run with:  npm run build:data

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const MAX_CHARS = 3000
const MAX_EXAMPLE_WORDS = 6
const MAX_WORDS = 14000

// --- tone-mark conversion -------------------------------------------------

const TONE_MARKS = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

// Convert a single CC-CEDICT numbered syllable ("shi4", "lu:3", "hao3", "de5")
// into tone-marked pinyin ("shì", "lǚ", "hǎo", "de").
export function syllableToToneMarks(syllable) {
  const m = syllable.match(/^([a-zA-Zü:]+)([1-5])?$/)
  if (!m) return syllable
  let base = m[1].toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü')
  const tone = m[2] ? Number(m[2]) : 0
  if (tone === 0 || tone === 5) return base

  // Tone placement: a or e take it; "ou" -> o; otherwise the last vowel.
  let target
  if (base.includes('a')) target = 'a'
  else if (base.includes('e')) target = 'e'
  else if (base.includes('ou')) target = 'o'
  else {
    const vowels = [...base].filter((c) => 'aeiouü'.includes(c))
    target = vowels[vowels.length - 1]
  }
  if (!target) return base
  return base.replace(target, TONE_MARKS[target][tone])
}

// A whole word's pinyin: "shi4 fou3" -> "shìfǒu"
function wordToToneMarks(raw) {
  return raw.trim().split(/\s+/).map(syllableToToneMarks).join('')
}

function toneOf(syllable) {
  const m = syllable.match(/([1-5])$/)
  if (!m) return 0
  const t = Number(m[1])
  return t === 5 ? 0 : t
}

// Toneless, diacritic-free index/search key. ü, v and u: all collapse to "u"
// so a learner typing "lu", "lv" or "lü" all land on the same bucket.
export function syllableKey(syllable) {
  return syllable
    .toLowerCase()
    .replace(/u:/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/v/g, 'u')
    .replace(/[1-5]/g, '')
    .replace(/[^a-z]/g, '')
}

// --- parse CC-CEDICT ------------------------------------------------------

const LINE_RE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/

function isCjk(str) {
  const cps = [...str]
  if (cps.length !== 1) return false
  const cp = cps[0].codePointAt(0)
  return cp >= 0x4e00 && cp <= 0x9fff
}

function cleanDefs(defBlock) {
  return defBlock
    .split('/')
    .map((d) => d.trim())
    .filter(Boolean)
}

console.log('Reading CC-CEDICT...')
const raw = readFileSync(join(ROOT, 'data/raw/cedict.txt'), 'utf8')
const lines = raw.split('\n')

const entries = [] // { simp, pinyinRaw, defs }
for (const line of lines) {
  if (!line || line.startsWith('#')) continue
  const m = line.match(LINE_RE)
  if (!m) continue
  const [, , simp, pinyinRaw, defBlock] = m
  entries.push({ simp, pinyinRaw, defs: cleanDefs(defBlock) })
}
console.log(`Parsed ${entries.length} entries.`)

// --- real usage frequencies from the jieba dictionary ---------------------
// Format per line: "token frequency pos". We only need token -> frequency,
// covering both single characters and multi-character words.

console.log('Reading jieba frequencies...')
const jiebaRaw = readFileSync(join(ROOT, 'data/raw/jieba-dict.txt'), 'utf8')
const freqOf = new Map()
for (const line of jiebaRaw.split('\n')) {
  if (!line) continue
  const parts = line.split(/\s+/)
  const token = parts[0]
  const f = Number(parts[1]) || 0
  if (f > (freqOf.get(token) || 0)) freqOf.set(token, f)
}
const freq = (token) => freqOf.get(token) || 0

// --- collect single-character entries (their readings) --------------------

const charReadings = new Map() // char -> [{ pinyinRaw, defs }]
for (const e of entries) {
  if (!isCjk(e.simp)) continue
  if (!charReadings.has(e.simp)) charReadings.set(e.simp, [])
  charReadings.get(e.simp).push({ pinyinRaw: e.pinyinRaw, defs: e.defs })
}

// --- select the top N characters by real frequency ------------------------

const selected = [...charReadings.keys()]
  .sort((a, b) => freq(b) - freq(a))
  .slice(0, MAX_CHARS)

const rankOf = new Map()
selected.forEach((ch, i) => rankOf.set(ch, i))
const selectedSet = new Set(selected)
console.log(`Selected ${selected.length} characters.`)

// --- example words: multi-char entries containing each selected char ------

const exampleWords = new Map() // char -> [{ word, pinyin, meaning }]
const wordEntries = entries.filter((e) => [...e.simp].length > 1 && [...e.simp].length <= 4)
// Most common words first, by real usage frequency.
wordEntries.sort((a, b) => freq(b.simp) - freq(a.simp))

for (const e of wordEntries) {
  for (const ch of new Set(e.simp)) {
    if (!selectedSet.has(ch)) continue
    const list = exampleWords.get(ch) || []
    if (list.length >= MAX_EXAMPLE_WORDS) continue
    if (list.some((w) => w.word === e.simp)) continue
    list.push({
      word: e.simp,
      pinyin: wordToToneMarks(e.pinyinRaw),
      meaning: e.defs.slice(0, 2).join('; '),
    })
    exampleWords.set(ch, list)
  }
}

// --- assemble output ------------------------------------------------------

const characters = {}
const pinyinIndex = {}

for (const ch of selected) {
  const rank = rankOf.get(ch)
  const readings = charReadings.get(ch).map((r) => ({
    pinyin: wordToToneMarks(r.pinyinRaw),
    tone: toneOf(r.pinyinRaw.trim().split(/\s+/)[0]),
    meanings: r.defs,
  }))

  characters[ch] = {
    rank,
    readings,
    exampleWords: exampleWords.get(ch) || [],
  }

  // Index every reading under its toneless syllable key.
  const seenKeys = new Set()
  for (const r of charReadings.get(ch)) {
    const firstSyll = r.pinyinRaw.trim().split(/\s+/)[0]
    const key = syllableKey(firstSyll)
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)
    if (!pinyinIndex[key]) pinyinIndex[key] = []
    pinyinIndex[key].push({
      char: ch,
      pinyin: syllableToToneMarks(firstSyll),
      tone: toneOf(firstSyll),
      rank,
    })
  }
}

// Sort each syllable bucket most-common-first.
for (const key of Object.keys(pinyinIndex)) {
  pinyinIndex[key].sort((a, b) => a.rank - b.rank)
}

// --- word index: concatenated toneless pinyin -> common words -------------
// e.g. "luyou" -> 旅游, "juede" -> 觉得. wordEntries is already sorted
// most-common-first, so insertion order doubles as the rank.

const wordIndex = {}
let wordCount = 0
for (const e of wordEntries) {
  if (wordCount >= MAX_WORDS) break
  if (freq(e.simp) <= 0) break // sorted desc; nothing real left
  if (![...e.simp].every(isCjk)) continue
  const key = e.pinyinRaw.trim().split(/\s+/).map(syllableKey).join('')
  if (!key) continue
  if (!wordIndex[key]) wordIndex[key] = []
  if (wordIndex[key].some((w) => w.word === e.simp)) continue
  wordIndex[key].push({
    word: e.simp,
    pinyin: wordToToneMarks(e.pinyinRaw),
    meaning: e.defs.slice(0, 2).join('; '),
    rank: wordCount,
  })
  wordCount++
}

const outDir = join(ROOT, 'src/data')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'characters.json'), JSON.stringify(characters))
writeFileSync(join(outDir, 'pinyin-index.json'), JSON.stringify(pinyinIndex))
writeFileSync(join(outDir, 'word-index.json'), JSON.stringify(wordIndex))

console.log(
  `Wrote ${Object.keys(characters).length} characters, ${
    Object.keys(pinyinIndex).length
  } syllable keys, and ${wordCount} words (${
    Object.keys(wordIndex).length
  } word keys) to src/data/.`,
)
