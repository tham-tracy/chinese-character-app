import { describe, it, expect } from 'vitest'
import { search, searchWords } from './search.js'

// Small fixture index mirroring the real pinyin-index shape, intentionally
// out of rank order to prove the bucket is returned most-common-first.
const index = {
  shi: [
    { char: '市', pinyin: 'shì', tone: 4, rank: 10 },
    { char: '十', pinyin: 'shí', tone: 2, rank: 50 },
    { char: '是', pinyin: 'shì', tone: 4, rank: 523 },
  ],
}

describe('search', () => {
  it('returns all matches for a toneless query, most-common-first', () => {
    const r = search('shi', index)
    expect(r.map((m) => m.char)).toEqual(['市', '十', '是'])
  })

  it('filters by tone when a tone is given', () => {
    const r = search('shì', index)
    expect(r.map((m) => m.char)).toEqual(['市', '是'])
  })

  it('filters by tone given as a digit', () => {
    const r = search('shi2', index)
    expect(r.map((m) => m.char)).toEqual(['十'])
  })

  it('returns an empty array for an unknown syllable', () => {
    expect(search('zzz', index)).toEqual([])
  })

  it('returns an empty array for empty input', () => {
    expect(search('', index)).toEqual([])
  })

  it('respects the result limit', () => {
    expect(search('shi', index, 2)).toHaveLength(2)
  })
})

const wordIndex = {
  luyou: [{ word: '旅游', pinyin: 'lǚyóu', meaning: 'trip; journey', rank: 220 }],
  juede: [{ word: '觉得', pinyin: 'juéde', meaning: 'to feel', rank: 222 }],
}

describe('searchWords', () => {
  it('matches a multi-syllable word by concatenated pinyin', () => {
    expect(searchWords('luyou', wordIndex).map((w) => w.word)).toEqual(['旅游'])
  })

  it('ignores tone marks and digits in the query', () => {
    expect(searchWords('jué de', wordIndex).map((w) => w.word)).toEqual(['觉得'])
    expect(searchWords('jue2de5', wordIndex).map((w) => w.word)).toEqual(['觉得'])
  })

  it('returns empty for an unknown word', () => {
    expect(searchWords('zzz', wordIndex)).toEqual([])
  })
})
