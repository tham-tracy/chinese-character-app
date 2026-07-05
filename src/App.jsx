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
