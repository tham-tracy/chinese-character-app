import { useEffect, useMemo, useState } from 'react'
import pinyinIndex from './data/pinyin-index.json'
import { search, searchWords } from './lib/search.js'
import SearchBar from './components/SearchBar.jsx'
import ResultsList from './components/ResultsList.jsx'
import CharacterDetail from './components/CharacterDetail.jsx'

export default function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
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

  function handleSearch(value) {
    setQuery(value)
    setSelected(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chinese Character Learner</h1>
        <p className="tagline">Type pinyin → pick a character or word → learn to write it</p>
      </header>

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
    </div>
  )
}
