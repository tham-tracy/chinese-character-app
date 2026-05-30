// Pinyin input parsing for search.
//
// Users may type a syllable toneless ("shi"), with a tone number ("shi4"),
// or with a tone mark ("shì"). We turn any of those into:
//   { key, tone }
// where `key` is the toneless, diacritic-free bucket used by the pinyin index
// and `tone` is 1-4 if the user specified one, or 0 if they didn't.

// Marked vowel -> [base letter, tone number]
const MARKED_VOWELS = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['u', 1], ǘ: ['u', 2], ǚ: ['u', 3], ǜ: ['u', 4],
}

// Toneless, diacritic-free key. ü, v and "u:" all collapse to "u" so that
// "lu", "lv" and "lü" land in the same bucket. Must match the key logic in
// scripts/build-data.mjs.
function toKey(text) {
  let out = ''
  for (const ch of text) {
    if (MARKED_VOWELS[ch]) out += MARKED_VOWELS[ch][0]
    else out += ch
  }
  return out
    .toLowerCase()
    .replace(/u:/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '')
}

export function parseQuery(raw) {
  if (!raw) return { key: '', tone: 0 }
  const s = raw.trim().toLowerCase()
  if (!s) return { key: '', tone: 0 }

  let tone = 0

  // Tone from a trailing digit, e.g. "shi4" or "lu:3".
  const digit = s.match(/([1-5])\s*$/)
  if (digit) {
    const t = Number(digit[1])
    tone = t === 5 ? 0 : t
  } else {
    // Tone from a diacritic mark anywhere in the string.
    for (const ch of s) {
      if (MARKED_VOWELS[ch]) {
        tone = MARKED_VOWELS[ch][1]
        break
      }
    }
  }

  return { key: toKey(s), tone }
}
