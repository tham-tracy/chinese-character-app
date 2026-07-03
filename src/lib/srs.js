// SM-2 spaced-repetition scheduling (simplified, as in classic Anki).
// Pure functions: "now" is always passed in, never read from the clock here.

export const LEARNING_STEPS_DAYS = [1, 3]
export const GRADUATING_INTERVAL = 3
export const EASY_INTERVAL = 4
export const MIN_EASE = 1.3
export const HARD_MULTIPLIER = 1.2
export const EASY_BONUS = 1.3

// Local date as YYYY-MM-DD (string compare works for ordering).
export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

export function newCard() {
  return { status: 'new', step: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: null }
}

// grade: 'again' | 'hard' | 'good' | 'easy'. Returns a new card object.
export function gradeCard(card, grade, now) {
  const c = { ...card, reps: card.reps + 1 }

  if (c.status === 'new' || c.status === 'learning') {
    if (grade === 'easy') {
      c.status = 'review'
      c.interval = EASY_INTERVAL
    } else if (grade === 'good' && c.step + 1 >= LEARNING_STEPS_DAYS.length) {
      c.status = 'review'
      c.interval = GRADUATING_INTERVAL
    } else {
      c.status = 'learning'
      if (grade === 'again') {
        c.step = 0
        c.interval = LEARNING_STEPS_DAYS[0]
      } else if (grade === 'good') {
        c.interval = LEARNING_STEPS_DAYS[c.step]
        c.step = c.step + 1
      } else {
        // 'hard' repeats the current step
        c.interval = LEARNING_STEPS_DAYS[c.step]
      }
    }
    c.due = addDays(now, c.interval)
    return c
  }

  // Review card
  if (grade === 'again') {
    c.lapses = card.lapses + 1
    c.ease = Math.max(MIN_EASE, card.ease - 0.2)
    c.status = 'learning'
    c.step = 0
    c.interval = LEARNING_STEPS_DAYS[0]
  } else if (grade === 'hard') {
    c.ease = Math.max(MIN_EASE, card.ease - 0.15)
    c.interval = Math.max(card.interval + 1, Math.round(card.interval * HARD_MULTIPLIER))
  } else if (grade === 'good') {
    c.interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease))
  } else {
    c.ease = card.ease + 0.15
    c.interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease * EASY_BONUS))
  }
  c.due = addDays(now, c.interval)
  return c
}
