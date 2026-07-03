import { describe, it, expect } from 'vitest'
import { newCard, gradeCard, addDays, toDateStr } from './srs.js'

const NOW = new Date('2026-07-03T10:00:00')

describe('toDateStr / addDays', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toDateStr(NOW)).toBe('2026-07-03')
  })

  it('adds days, crossing month boundaries', () => {
    expect(addDays(NOW, 1)).toBe('2026-07-04')
    expect(addDays(NOW, 30)).toBe('2026-08-02')
  })
})

describe('gradeCard: new/learning cards', () => {
  it('good on a new card schedules it 1 day out', () => {
    const c = gradeCard(newCard(), 'good', NOW)
    expect(c.status).toBe('learning')
    expect(c.step).toBe(1)
    expect(c.interval).toBe(1)
    expect(c.due).toBe('2026-07-04')
    expect(c.reps).toBe(1)
  })

  it('good on the last learning step graduates to review at 3 days', () => {
    const step1 = gradeCard(newCard(), 'good', NOW)
    const c = gradeCard(step1, 'good', NOW)
    expect(c.status).toBe('review')
    expect(c.interval).toBe(3)
    expect(c.due).toBe('2026-07-06')
  })

  it('again sends a learning card back to the first step', () => {
    const step1 = gradeCard(newCard(), 'good', NOW)
    const c = gradeCard(step1, 'again', NOW)
    expect(c.status).toBe('learning')
    expect(c.step).toBe(0)
    expect(c.due).toBe('2026-07-04')
  })

  it('hard repeats the current step', () => {
    const step1 = gradeCard(newCard(), 'good', NOW)
    const c = gradeCard(step1, 'hard', NOW)
    expect(c.step).toBe(1)
    expect(c.due).toBe('2026-07-06') // step 1 = 3 days
  })

  it('easy graduates immediately at 4 days', () => {
    const c = gradeCard(newCard(), 'easy', NOW)
    expect(c.status).toBe('review')
    expect(c.interval).toBe(4)
    expect(c.due).toBe('2026-07-07')
  })
})

describe('gradeCard: review cards', () => {
  const review = {
    status: 'review', step: 0, ease: 2.5, interval: 10,
    reps: 5, lapses: 0, due: '2026-07-03',
  }

  it('good multiplies the interval by ease', () => {
    const c = gradeCard(review, 'good', NOW)
    expect(c.interval).toBe(25)
    expect(c.due).toBe(addDays(NOW, 25))
    expect(c.ease).toBe(2.5)
  })

  it('hard grows the interval by 1.2x and lowers ease', () => {
    const c = gradeCard(review, 'hard', NOW)
    expect(c.interval).toBe(12)
    expect(c.ease).toBeCloseTo(2.35)
  })

  it('easy applies the bonus multiplier and raises ease', () => {
    const c = gradeCard(review, 'easy', NOW)
    expect(c.interval).toBe(Math.round(10 * 2.5 * 1.3))
    expect(c.ease).toBeCloseTo(2.65)
  })

  it('again lapses: back to learning at 1 day, ease down, lapse counted', () => {
    const c = gradeCard(review, 'again', NOW)
    expect(c.status).toBe('learning')
    expect(c.step).toBe(0)
    expect(c.interval).toBe(1)
    expect(c.lapses).toBe(1)
    expect(c.ease).toBeCloseTo(2.3)
  })

  it('ease never drops below 1.3', () => {
    const c = gradeCard({ ...review, ease: 1.35 }, 'again', NOW)
    expect(c.ease).toBe(1.3)
  })

  it('a successful review always grows the interval by at least 1 day', () => {
    const c = gradeCard({ ...review, interval: 1, ease: 1.3 }, 'hard', NOW)
    expect(c.interval).toBeGreaterThanOrEqual(2)
  })

  it('increments reps on every grade', () => {
    expect(gradeCard(review, 'good', NOW).reps).toBe(6)
  })

  it('does not mutate the input card', () => {
    const before = { ...review }
    gradeCard(review, 'good', NOW)
    expect(review).toEqual(before)
  })
})
