// Character and word search: pinyin query -> ranked matches.

import { parseQuery } from './pinyin.js'

// `index` is the character pinyin-index: { syllableKey: [{ char, pinyin, tone, rank }] }
// Buckets are pre-sorted most-common-first by the build script.
export function search(query, index, limit = 60) {
  const { key, tone } = parseQuery(query)
  if (!key) return []

  let matches = index[key] || []
  if (tone >= 1 && tone <= 4) {
    matches = matches.filter((m) => m.tone === tone)
  }
  return matches.slice(0, limit)
}

// `wordIndex` is keyed by the concatenated toneless pinyin of a whole word,
// e.g. "luyou" -> [{ word, pinyin, meaning, rank }]. Tone is ignored for words.
export function searchWords(query, wordIndex, limit = 30) {
  const { key } = parseQuery(query)
  if (!key) return []
  return (wordIndex[key] || []).slice(0, limit)
}
