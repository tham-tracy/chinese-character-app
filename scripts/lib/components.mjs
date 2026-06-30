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
