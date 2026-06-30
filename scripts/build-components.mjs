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

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildEntry } from './lib/components.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

console.log('Reading characters.json...')
const characters = JSON.parse(readFileSync(join(ROOT, 'src/data/characters.json'), 'utf8'))

console.log('Reading Make Me a Hanzi dictionary...')
const dictPath = join(ROOT, 'data/raw/dictionary.txt')
if (!existsSync(dictPath)) {
  console.error(
    'Missing data/raw/dictionary.txt.\n' +
      'Download it from https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt',
  )
  process.exit(1)
}
const raw = readFileSync(dictPath, 'utf8')
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
