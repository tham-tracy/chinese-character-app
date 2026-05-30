export default function ResultsList({ query, characters, words, selected, onSelectChar, onSelectWord }) {
  if (!query) return null

  if (characters.length === 0 && words.length === 0) {
    return <p className="no-results">No characters or words found for “{query}”.</p>
  }

  const selChar = selected?.kind === 'char' ? selected.char : null
  const selWord = selected?.kind === 'word' ? selected.word : null

  return (
    <>
      {words.length > 0 && (
        <>
          <div className="label">
            {words.length} word{words.length > 1 ? 's' : ''} — tap one
          </div>
          <div className="chips">
            {words.map((w) => (
              <button
                key={w.word}
                className={'word-chip' + (selWord === w.word ? ' chip-active' : '')}
                onClick={() => onSelectWord(w)}
              >
                <span className="chip-char">{w.word}</span>
                <span className="chip-pinyin">{w.pinyin}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {characters.length > 0 && (
        <>
          <div className="label">
            {characters.length} character{characters.length > 1 ? 's' : ''} — tap one
          </div>
          <div className="chips">
            {characters.map((m) => (
              <button
                key={m.char + m.pinyin}
                className={'chip' + (selChar === m.char ? ' chip-active' : '')}
                onClick={() => onSelectChar(m.char)}
              >
                <span className="chip-char">{m.char}</span>
                <span className="chip-pinyin">{m.pinyin}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
