import { describe, it, expect } from 'vitest'
import {
  STORAGE_KEY, NEW_PER_DAY, emptyState, loadState, saveState,
  buildWordList, buildQueue, countDue, newRemainingToday, recordNewIntroduced,
} from './deck.js'

const TODAY = '2026-07-03'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
  }
}

// Mirrors the real word-index shape: pinyin key -> bucket of entries.
const wordIndex = {
  yige: [{ word: '一个', pinyin: 'yīge', meaning: 'a; an', rank: 0 }],
  zhongguo: [{ word: '中国', pinyin: 'zhōngguó', meaning: 'China', rank: 1 }],
  women: [{ word: '我们', pinyin: 'wǒmen', meaning: 'we', rank: 2 }],
  tamen: [
    { word: '他们', pinyin: 'tāmen', meaning: 'they', rank: 3 },
    { word: '它们', pinyin: 'tāmen', meaning: 'they (things)', rank: 324 },
  ],
  ziji: [{ word: '自己', pinyin: 'zìjǐ', meaning: 'oneself', rank: 4 }],
  shenme: [{ word: '什么', pinyin: 'shénme', meaning: 'what', rank: 5 }],
}
const wordList = buildWordList(wordIndex)

function reviewCard(due) {
  return { status: 'review', step: 0, ease: 2.5, interval: 3, reps: 3, lapses: 0, due }
}

describe('buildWordList', () => {
  it('flattens the index sorted by frequency rank', () => {
    expect(wordList.map((w) => w.word)).toEqual(
      ['一个', '中国', '我们', '他们', '自己', '什么', '它们'],
    )
  })

  it('deduplicates repeated words', () => {
    const dup = { a: [{ word: '一个', pinyin: 'yīge', meaning: 'a', rank: 0 }],
                  b: [{ word: '一个', pinyin: 'yīge', meaning: 'a', rank: 0 }] }
    expect(buildWordList(dup)).toHaveLength(1)
  })
})

describe('loadState / saveState', () => {
  it('returns a fresh state when storage is empty', () => {
    expect(loadState(fakeStorage())).toEqual(emptyState())
  })

  it('returns a fresh state on corrupt JSON', () => {
    expect(loadState(fakeStorage({ [STORAGE_KEY]: 'not json{' }))).toEqual(emptyState())
  })

  it('returns a fresh state on an unknown version', () => {
    const blob = JSON.stringify({ version: 99, cards: {} })
    expect(loadState(fakeStorage({ [STORAGE_KEY]: blob }))).toEqual(emptyState())
  })

  it('returns a fresh state when cards is null', () => {
    const blob = JSON.stringify({ version: 1, cards: null, newIntroduced: { date: null, count: 0 } })
    expect(loadState(fakeStorage({ [STORAGE_KEY]: blob }))).toEqual(emptyState())
  })

  it('returns a fresh state when newIntroduced is missing', () => {
    const blob = JSON.stringify({ version: 1, cards: {} })
    expect(loadState(fakeStorage({ [STORAGE_KEY]: blob }))).toEqual(emptyState())
  })

  it('round-trips state through storage', () => {
    const storage = fakeStorage()
    const state = { ...emptyState(), cards: { '一个': reviewCard(TODAY) } }
    saveState(storage, state)
    expect(loadState(storage)).toEqual(state)
  })
})

describe('buildQueue', () => {
  it('gives 5 new words in rank order for a fresh deck', () => {
    const { due, fresh } = buildQueue(emptyState(), wordList, TODAY)
    expect(due).toEqual([])
    expect(fresh.map((w) => w.word)).toEqual(['一个', '中国', '我们', '他们', '自己'])
  })

  it('subtracts words already introduced today from the new-card quota', () => {
    const state = { ...emptyState(), newIntroduced: { date: TODAY, count: 3 } }
    const { fresh } = buildQueue(state, wordList, TODAY)
    expect(fresh).toHaveLength(NEW_PER_DAY - 3)
  })

  it('resets the quota on a new day', () => {
    const state = { ...emptyState(), newIntroduced: { date: '2026-07-02', count: 5 } }
    const { fresh } = buildQueue(state, wordList, TODAY)
    expect(fresh).toHaveLength(5)
  })

  it('includes due and overdue cards but not future ones, oldest due first', () => {
    const state = {
      ...emptyState(),
      cards: {
        '一个': reviewCard('2026-07-04'),  // future: excluded
        '中国': reviewCard(TODAY),          // due today
        '我们': reviewCard('2026-07-01'),  // overdue: first
      },
    }
    const { due, fresh } = buildQueue(state, wordList, TODAY)
    expect(due.map((w) => w.word)).toEqual(['我们', '中国'])
    // studied words never reappear as new
    expect(fresh.map((w) => w.word)).toEqual(['他们', '自己', '什么', '它们'])
  })

  it('skips stored words that are no longer in the word data', () => {
    const state = { ...emptyState(), cards: { '废词': reviewCard(TODAY) } }
    const { due } = buildQueue(state, wordList, TODAY)
    expect(due).toEqual([])
  })
})

describe('countDue', () => {
  it('counts only due and overdue cards', () => {
    const state = {
      ...emptyState(),
      cards: {
        '一个': reviewCard('2026-07-01'),
        '中国': reviewCard(TODAY),
        '我们': reviewCard('2026-08-01'),
      },
    }
    expect(countDue(state, TODAY)).toBe(2)
  })
})

describe('newRemainingToday / recordNewIntroduced', () => {
  it('starts each day with the full quota', () => {
    expect(newRemainingToday(emptyState(), TODAY)).toBe(NEW_PER_DAY)
  })

  it('increments within the same day and resets on a new day', () => {
    let state = recordNewIntroduced(emptyState(), TODAY)
    state = recordNewIntroduced(state, TODAY)
    expect(state.newIntroduced).toEqual({ date: TODAY, count: 2 })
    expect(newRemainingToday(state, TODAY)).toBe(NEW_PER_DAY - 2)

    state = recordNewIntroduced(state, '2026-07-04')
    expect(state.newIntroduced).toEqual({ date: '2026-07-04', count: 1 })
  })
})
