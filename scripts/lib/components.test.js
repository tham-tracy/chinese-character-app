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
