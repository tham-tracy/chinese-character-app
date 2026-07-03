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
    if (
      parsed?.version === 1 &&
      parsed.cards && typeof parsed.cards === 'object' &&
      parsed.newIntroduced && typeof parsed.newIntroduced === 'object'
    ) return parsed
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
