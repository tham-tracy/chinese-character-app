import { describe, it, expect } from 'vitest'
import { parseQuery } from './pinyin.js'

describe('parseQuery', () => {
  it('parses a toneless syllable with no tone', () => {
    expect(parseQuery('shi')).toEqual({ key: 'shi', tone: 0 })
  })

  it('reads a tone from a trailing digit', () => {
    expect(parseQuery('shi4')).toEqual({ key: 'shi', tone: 4 })
    expect(parseQuery('shi2')).toEqual({ key: 'shi', tone: 2 })
  })

  it('reads a tone from a diacritic mark', () => {
    expect(parseQuery('shì')).toEqual({ key: 'shi', tone: 4 })
    expect(parseQuery('hǎo')).toEqual({ key: 'hao', tone: 3 })
  })

  it('treats neutral tone (5) as no tone filter', () => {
    expect(parseQuery('de5')).toEqual({ key: 'de', tone: 0 })
  })

  it('collapses ü, v and u: to u', () => {
    expect(parseQuery('lü3').key).toBe('lu')
    expect(parseQuery('lv3').key).toBe('lu')
    expect(parseQuery('lu:3').key).toBe('lu')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(parseQuery('  SHI4 ')).toEqual({ key: 'shi', tone: 4 })
  })

  it('returns an empty key for empty input', () => {
    expect(parseQuery('')).toEqual({ key: '', tone: 0 })
    expect(parseQuery('   ')).toEqual({ key: '', tone: 0 })
  })
})
