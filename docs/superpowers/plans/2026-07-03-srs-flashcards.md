# SRS Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Anki-style SM-2 flashcard study mode that introduces 5 new frequency-ranked words per day, with progress persisted in localStorage.

**Architecture:** Pure, unit-tested scheduling logic in `src/lib/srs.js` (SM-2 card transitions) and `src/lib/deck.js` (word list, daily queue, persistence). A `StudySession` component renders the card UI. `App.jsx` gains a search ↔ study view toggle with a due-count badge and owns the persisted SRS state.

**Tech Stack:** React 18 (plain JS, no TS), Vite, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-03-srs-flashcards-design.md`

**Conventions to follow:**
- Plain JS function components with default exports; hooks at the top.
- Lib modules are pure functions with a one-line header comment; tests live next to them as `*.test.js` using `describe`/`it`/`expect` from vitest.
- All styles go in `src/App.css` using the existing CSS variables (`--accent`, `--paper`, `--border`, `--muted`, `--green`).
- Run tests with `npx vitest run src/lib/<file>.test.js` (or `npm test` for all).
- Commit messages: Conventional Commits (`feat:`, `test:`), ending with the Claude co-author trailer.

---

### Task 1: SM-2 scheduler (`src/lib/srs.js`)

Pure card-state transitions. A card is
`{ status: 'new'|'learning'|'review', step, ease, interval, reps, lapses, due }`
where `due` is a local-date string `YYYY-MM-DD` and `interval` is whole days.
Time is always passed in — these functions never call `new Date()` themselves.

**Files:**
- Create: `src/lib/srs.js`
- Create: `src/lib/srs.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/srs.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/srs.test.js`
Expected: FAIL — cannot resolve `./srs.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/srs.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/srs.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/srs.js src/lib/srs.test.js
git commit -m "feat: add SM-2 spaced-repetition scheduler

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Deck, daily queue, and persistence (`src/lib/deck.js`)

Flattens `word-index.json` into a rank-ordered word list, builds today's
queue (due reviews + up to 5 new words), and load/saves a versioned
localStorage blob. `storage` is passed in (localStorage in the app, a fake
in tests).

**Files:**
- Create: `src/lib/deck.js`
- Create: `src/lib/deck.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/deck.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/deck.test.js`
Expected: FAIL — cannot resolve `./deck.js`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/deck.js`:

```js
// Deck management: rank-ordered word list, today's study queue,
// and versioned localStorage persistence.

export const STORAGE_KEY = 'ccl-srs-v1'
export const NEW_PER_DAY = 5

export function emptyState() {
  return { version: 1, cards: {}, newIntroduced: { date: null, count: 0 } }
}

export function loadState(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY))
    if (parsed?.version === 1 && typeof parsed.cards === 'object') return parsed
  } catch {
    // corrupt blob: fall through to a fresh state
  }
  return emptyState()
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// Flatten the pinyin-keyed word index into one deduplicated list,
// most frequent first.
export function buildWordList(wordIndex) {
  const seen = new Set()
  const list = []
  for (const bucket of Object.values(wordIndex)) {
    for (const entry of bucket) {
      if (!seen.has(entry.word)) {
        seen.add(entry.word)
        list.push(entry)
      }
    }
  }
  return list.sort((a, b) => a.rank - b.rank)
}

export function newRemainingToday(state, todayStr) {
  const used = state.newIntroduced.date === todayStr ? state.newIntroduced.count : 0
  return Math.max(0, NEW_PER_DAY - used)
}

export function recordNewIntroduced(state, todayStr) {
  const count = state.newIntroduced.date === todayStr ? state.newIntroduced.count + 1 : 1
  return { ...state, newIntroduced: { date: todayStr, count } }
}

// Today's queue: every studied card that is due (oldest due first, then by
// rank), plus up to the day's remaining quota of unseen words in rank order.
// Iterating the word list means stored words missing from the data are
// skipped naturally.
export function buildQueue(state, wordList, todayStr) {
  const due = []
  const fresh = []
  let freshLeft = newRemainingToday(state, todayStr)
  for (const entry of wordList) {
    const card = state.cards[entry.word]
    if (card) {
      if (card.due && card.due <= todayStr) due.push(entry)
    } else if (freshLeft > 0) {
      fresh.push(entry)
      freshLeft -= 1
    }
  }
  due.sort((a, b) => {
    const da = state.cards[a.word].due
    const db = state.cards[b.word].due
    return da < db ? -1 : da > db ? 1 : a.rank - b.rank
  })
  return { due, fresh }
}

export function countDue(state, todayStr) {
  return Object.values(state.cards).filter((c) => c.due && c.due <= todayStr).length
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/deck.test.js`
Expected: all tests PASS. Also run `npm test` to confirm nothing else broke.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deck.js src/lib/deck.test.js
git commit -m "feat: add deck queue building and localStorage persistence

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Study UI and app integration

The `StudySession` component plus the search ↔ study toggle in `App.jsx`.
The project has no component-test setup, so this task is verified manually
in the dev server (Task 4 has the full checklist).

Session behavior:
- The queue is built once when the component mounts (due cards first, then
  new). Grading updates the persisted state but does not rebuild the queue.
- A card graded **Again** is pushed to the end of the current queue.
- The summary counts each card once, when it leaves the queue (any grade
  except Again): cards that were new this session count as "learned",
  the rest as "reviewed".
- Leaving the study view (e.g. tapping a character to see its strokes)
  unmounts the session; progress is already saved per grade, and reopening
  Study rebuilds the queue from saved state.

**Files:**
- Create: `src/components/StudySession.jsx`
- Modify: `src/App.jsx` (view toggle, SRS state ownership, badge)
- Modify: `src/App.css` (append study styles)

- [ ] **Step 1: Create the StudySession component**

Create `src/components/StudySession.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { gradeCard, newCard, toDateStr } from '../lib/srs.js'
import { buildQueue, recordNewIntroduced } from '../lib/deck.js'

const GRADES = [
  { grade: 'again', label: 'Again', key: '1' },
  { grade: 'hard', label: 'Hard', key: '2' },
  { grade: 'good', label: 'Good', key: '3' },
  { grade: 'easy', label: 'Easy', key: '4' },
]
const KEY_TO_GRADE = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }

export default function StudySession({ srsState, onStateChange, wordList, onSelectChar }) {
  // Built once at mount; grading advances the queue without rebuilding it.
  const [session] = useState(() => {
    const { due, fresh } = buildQueue(srsState, wordList, toDateStr(new Date()))
    return { items: [...due, ...fresh], freshWords: new Set(fresh.map((w) => w.word)) }
  })
  const [queue, setQueue] = useState(session.items)
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState({ reviewed: 0, learned: 0 })

  const current = queue[0]

  function handleGrade(grade) {
    if (!current || !flipped) return
    const now = new Date()
    const existing = srsState.cards[current.word]
    const card = gradeCard(existing ?? newCard(), grade, now)
    let next = { ...srsState, cards: { ...srsState.cards, [current.word]: card } }
    if (!existing) next = recordNewIntroduced(next, toDateStr(now))
    onStateChange(next)

    if (grade === 'again') {
      // Failed cards come back at the end of this session.
      setQueue((q) => [...q.slice(1), current])
    } else {
      setStats((s) =>
        session.freshWords.has(current.word)
          ? { ...s, learned: s.learned + 1 }
          : { ...s, reviewed: s.reviewed + 1 },
      )
      setQueue((q) => q.slice(1))
    }
    setFlipped(false)
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === ' ') {
        e.preventDefault()
        if (current) setFlipped((f) => !f)
      } else if (flipped && KEY_TO_GRADE[e.key]) {
        handleGrade(KEY_TO_GRADE[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!current) {
    const studied = stats.reviewed + stats.learned
    return (
      <div className="study study-done">
        <p className="study-done-title">🎉 Done for today!</p>
        {studied > 0 ? (
          <p>
            {stats.reviewed} reviewed · {stats.learned} new words learned.
          </p>
        ) : (
          <p>No cards due. Come back tomorrow for new words.</p>
        )}
      </div>
    )
  }

  return (
    <div className="study">
      <div className="study-progress">
        {queue.length} card{queue.length === 1 ? '' : 's'} left
        {session.freshWords.has(current.word) && <span className="study-new-tag">new</span>}
      </div>

      <div
        className="card"
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Card answer' : 'Show answer'}
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="card-hanzi">
          {flipped
            ? [...current.word].map((c, i) => (
                <button
                  key={c + i}
                  className="card-char"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectChar(c)
                  }}
                  aria-label={`Show details for ${c}`}
                >
                  {c}
                </button>
              ))
            : current.word}
        </div>
        {flipped && (
          <div className="card-back">
            <div className="card-pinyin">{current.pinyin}</div>
            <div className="card-meaning">{current.meaning}</div>
          </div>
        )}
      </div>

      {flipped ? (
        <div className="grade-row">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              className={`grade-btn grade-${g.grade}`}
              onClick={() => handleGrade(g.grade)}
            >
              {g.label}
              <span className="grade-key">{g.key}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="show-answer" onClick={() => setFlipped(true)}>
          Show answer <span className="grade-key">space</span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire the study view into App.jsx**

Replace the full contents of `src/App.jsx` with:

```jsx
import { useEffect, useMemo, useState } from 'react'
import pinyinIndex from './data/pinyin-index.json'
import { search, searchWords } from './lib/search.js'
import { toDateStr } from './lib/srs.js'
import {
  buildWordList, countDue, loadState, newRemainingToday, saveState,
} from './lib/deck.js'
import SearchBar from './components/SearchBar.jsx'
import ResultsList from './components/ResultsList.jsx'
import CharacterDetail from './components/CharacterDetail.jsx'
import StudySession from './components/StudySession.jsx'

export default function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('search')
  const [srsState, setSrsState] = useState(() => loadState(localStorage))
  // Large datasets load lazily after first paint.
  const [characters, setCharacters] = useState(null)
  const [wordIndex, setWordIndex] = useState({})
  const [sentences, setSentences] = useState(null)
  const [components, setComponents] = useState(null)

  useEffect(() => {
    import('./data/characters.json').then((m) => setCharacters(m.default))
    import('./data/word-index.json').then((m) => setWordIndex(m.default))
    import('./data/sentences.json').then((m) => setSentences(m.default))
    import('./data/components.json').then((m) => setComponents(m.default))
  }, [])

  const results = useMemo(
    () => ({
      characters: search(query, pinyinIndex),
      words: searchWords(query, wordIndex),
    }),
    [query, wordIndex],
  )

  const wordList = useMemo(() => buildWordList(wordIndex), [wordIndex])

  const today = toDateStr(new Date())
  const dueCount = countDue(srsState, today)
  const newRemaining = wordList.length ? newRemainingToday(srsState, today) : 0

  function updateSrsState(next) {
    setSrsState(next)
    saveState(localStorage, next)
  }

  function handleSearch(value) {
    setQuery(value)
    setSelected(null)
  }

  function showCharDetail(char) {
    setSelected({ kind: 'char', char })
    setView('search')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chinese Character Learner</h1>
        <p className="tagline">Type pinyin → pick a character or word → learn to write it</p>
      </header>

      <nav className="view-nav">
        <button
          className={view === 'search' ? 'active' : ''}
          onClick={() => setView('search')}
        >
          Search
        </button>
        <button
          className={view === 'study' ? 'active' : ''}
          onClick={() => setView('study')}
        >
          Study
          {dueCount + newRemaining > 0 && (
            <span className="study-badge">
              {dueCount > 0 && `${dueCount} due`}
              {dueCount > 0 && newRemaining > 0 && ' · '}
              {newRemaining > 0 && `${newRemaining} new`}
            </span>
          )}
        </button>
      </nav>

      {view === 'study' ? (
        wordList.length > 0 ? (
          <StudySession
            key={today}
            srsState={srsState}
            onStateChange={updateSrsState}
            wordList={wordList}
            onSelectChar={showCharDetail}
          />
        ) : (
          <p className="study-loading">Loading words…</p>
        )
      ) : (
        <>
          <SearchBar onSearch={handleSearch} />

          <ResultsList
            query={query.trim()}
            characters={results.characters}
            words={results.words}
            selected={selected}
            onSelectChar={(char) => setSelected({ kind: 'char', char })}
            onSelectWord={(w) => setSelected({ kind: 'word', ...w })}
          />

          <CharacterDetail
            selected={selected}
            characters={characters}
            sentences={sentences}
            components={components}
            onSelectChar={(char) => setSelected({ kind: 'char', char })}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Append study styles to App.css**

Append to `src/App.css`:

```css
/* View nav */
.view-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.view-nav button {
  padding: 8px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--paper);
  color: var(--ink);
  font-size: 15px;
  cursor: pointer;
}

.view-nav button.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.study-badge {
  margin-left: 8px;
  font-size: 12px;
  color: var(--accent);
}

/* Study session */
.study {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 20px 0 40px;
}

.study-progress {
  font-size: 13px;
  color: var(--muted);
}

.study-new-tag {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.card {
  width: 100%;
  max-width: 440px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px 20px;
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
}

.card-hanzi {
  font-size: 56px;
  line-height: 1.2;
}

.card-char {
  border: none;
  background: none;
  font-size: 56px;
  line-height: 1.2;
  padding: 0 2px;
  cursor: pointer;
  color: var(--ink);
}

.card-char:hover {
  color: var(--accent);
}

.card-back {
  text-align: center;
}

.card-pinyin {
  font-size: 22px;
  color: var(--accent);
  margin-bottom: 6px;
}

.card-meaning {
  font-size: 15px;
  color: var(--ink);
}

.show-answer {
  padding: 12px 28px;
  border: none;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  cursor: pointer;
}

.grade-row {
  display: flex;
  gap: 8px;
}

.grade-btn {
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--paper);
  font-size: 14px;
  cursor: pointer;
}

.grade-again { color: var(--accent); border-color: var(--accent); }
.grade-good { color: var(--green); border-color: var(--green); }

.grade-key {
  display: block;
  font-size: 10px;
  color: var(--muted);
  margin-top: 2px;
}

.study-done {
  text-align: center;
  color: var(--muted);
}

.study-done-title {
  font-size: 22px;
  color: var(--ink);
}

.study-loading {
  color: var(--muted);
}
```

- [ ] **Step 4: Smoke-test in the dev server**

Run: `npm run dev`, open the printed URL.
Check: Study tab shows "5 new"; opening it shows the first card (一个);
Space flips; grading Good advances; the badge decreases after each new card.

- [ ] **Step 5: Run all tests and the production build**

Run: `npm test && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/StudySession.jsx src/App.jsx src/App.css
git commit -m "feat: add SRS flashcard study view

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: End-to-end verification

Manual walkthrough of the spec's behaviors in a real browser session,
including persistence and the day-rollover path (simulated by editing
the stored blob).

**Files:** none (verification only; fix and amend if anything fails).

- [ ] **Step 1: Fresh-deck session**

With `npm run dev` running, open the app in a private/incognito window
(guarantees empty localStorage) and verify:

1. Study tab badge reads "5 new".
2. The five cards are, in order: 一个, 中国, 我们, 他们, 自己 (top-5 frequency ranks).
3. Space flips; keys 1–4 grade; clicking the card flips it too.
4. Grade one card **Again** → it reappears at the end of the session and the
   summary still counts it once.
5. After the fifth card, the done screen shows "5 new words learned";
   the badge shows nothing.
6. On the card back, click a character → app switches to the search view
   with that character's stroke/composition detail.

- [ ] **Step 2: Persistence and quota**

1. Reload the page → badge stays empty (no double quota) and the Study view
   shows "done for today".
2. In DevTools → Application → Local Storage, confirm the `ccl-srs-v1` blob
   has 5 cards and `newIntroduced: { date: <today>, count: 5 }`.
3. Set the blob's value to the string `garbage`, reload → app loads a fresh
   deck without crashing (5 new available again). Restore by studying or
   clearing as desired.

- [ ] **Step 3: Simulated next day**

In the DevTools console, backdate the saved state to yesterday, then reload:

```js
const s = JSON.parse(localStorage.getItem('ccl-srs-v1'))
for (const c of Object.values(s.cards)) c.due = '2020-01-01'
s.newIntroduced.date = '2020-01-01'
localStorage.setItem('ccl-srs-v1', JSON.stringify(s))
```

Verify the badge now reads "5 due · 5 new" and a session serves the 5 due
cards first, then 5 new ones.

- [ ] **Step 4: Push and confirm deployment**

```bash
git push origin main
gh run watch
```

Expected: the "Deploy to GitHub Pages" workflow succeeds. Open the live
site and repeat the fresh-deck check from Step 1 (private window).
