// Build example sentences from the OPUS Tatoeba cmn-en aligned corpus.
//
// The Tatoeba Chinese is mostly Traditional, so we convert it to Simplified
// using a character map derived from CC-CEDICT (which lists both forms). For
// each common character and word we pick the SHORTEST sentence that contains
// it (shorter = easier for a learner), generate pinyin with pinyin-pro, and
// emit:
//
//   src/data/sentences.json  { chars: { 字: {hanzi,pinyin,eng} }, words: {…} }
//
// Run after build-data.mjs (needs characters.json + word-index.json).

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pinyin } from 'pinyin-pro'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const MIN_LEN = 3 // simplified character count (excl. nothing special)
const MAX_LEN = 22 // keep sentences short and learner-friendly

// --- Traditional -> Simplified character map (from CC-CEDICT) --------------

console.log('Building Traditional→Simplified map...')
const cedict = readFileSync(join(ROOT, 'data/raw/cedict.txt'), 'utf8')
const LINE_RE = /^(\S+)\s+(\S+)\s+\[[^\]]+\]\s+\/.+\/\s*$/
const t2s = new Map()
for (const line of cedict.split('\n')) {
  if (!line || line.startsWith('#')) continue
  const m = line.match(LINE_RE)
  if (!m) continue
  const trad = [...m[1]]
  const simp = [...m[2]]
  if (trad.length !== simp.length) continue
  for (let i = 0; i < trad.length; i++) {
    if (!t2s.has(trad[i])) t2s.set(trad[i], simp[i])
  }
}
const toSimplified = (s) => [...s].map((c) => t2s.get(c) || c).join('')

// --- targets: which characters and words need a sentence ------------------

const characters = JSON.parse(readFileSync(join(ROOT, 'src/data/characters.json'), 'utf8'))
const wordIndex = JSON.parse(readFileSync(join(ROOT, 'src/data/word-index.json'), 'utf8'))
const charSet = new Set(Object.keys(characters))
const wordSet = new Set()
for (const bucket of Object.values(wordIndex)) {
  for (const w of bucket) wordSet.add(w.word)
}
console.log(`Targets: ${charSet.size} characters, ${wordSet.size} words.`)

// --- read & normalize the corpus ------------------------------------------

console.log('Reading Tatoeba corpus...')
const cmnLines = readFileSync(join(ROOT, 'data/raw/Tatoeba.cmn-en.cmn'), 'utf8').split('\n')
const enLines = readFileSync(join(ROOT, 'data/raw/Tatoeba.cmn-en.en'), 'utf8').split('\n')

const seen = new Set()
const pairs = [] // { simp, eng, len }
for (let i = 0; i < cmnLines.length; i++) {
  const eng = (enLines[i] || '').trim()
  const simp = toSimplified(cmnLines[i].trim())
  if (!simp || !eng) continue
  const len = [...simp].length
  if (len < MIN_LEN || len > MAX_LEN) continue
  if (seen.has(simp)) continue
  seen.add(simp)
  pairs.push({ simp, eng, len })
}
pairs.sort((a, b) => a.len - b.len) // shortest first
console.log(`Usable sentence pairs: ${pairs.length}.`)

// --- index sentences by the characters they contain -----------------------

const byChar = new Map() // char -> [pair, ...] in length order
for (const p of pairs) {
  for (const ch of new Set(p.simp)) {
    if (!byChar.has(ch)) byChar.set(ch, [])
    byChar.get(ch).push(p)
  }
}

// pinyin is cached per sentence (a sentence may serve several entries)
const pyCache = new Map()
const toPinyin = (simp) => {
  if (!pyCache.has(simp)) {
    const raw = pinyin(simp, { toneType: 'symbol', type: 'string', nonZh: 'consecutive' })
    // Drop the space pinyin-pro inserts before CJK/ASCII punctuation.
    pyCache.set(simp, raw.replace(/\s+([。，！？、；：．,.!?;:])/g, '$1').trim())
  }
  return pyCache.get(simp)
}

// --- assign sentences ------------------------------------------------------

const chars = {}
for (const ch of charSet) {
  const p = byChar.get(ch)?.[0] // shortest containing it
  if (p) chars[ch] = { hanzi: p.simp, pinyin: toPinyin(p.simp), eng: p.eng }
}

const words = {}
for (const w of wordSet) {
  const first = [...w][0]
  const candidates = byChar.get(first)
  if (!candidates) continue
  const p = candidates.find((c) => c.simp.includes(w)) // shortest containing the word
  if (p) words[w] = { hanzi: p.simp, pinyin: toPinyin(p.simp), eng: p.eng }
}

writeFileSync(join(ROOT, 'src/data/sentences.json'), JSON.stringify({ chars, words }))
console.log(
  `Wrote sentences for ${Object.keys(chars).length} characters and ${
    Object.keys(words).length
  } words to src/data/sentences.json.`,
)
