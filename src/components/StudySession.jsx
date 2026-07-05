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
