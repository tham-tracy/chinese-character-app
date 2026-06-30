import StrokePanel from './StrokePanel.jsx'
import Composition from './Composition.jsx'

export default function CharacterDetail({ selected, characters, sentences, components, onSelectChar }) {
  if (!selected) {
    return (
      <div className="detail detail-empty">
        <p>
          Search a pinyin syllable (<b>shi</b>) or a whole word (<b>luyou</b>, <b>juede</b>)
          above, then tap a result to see how to write it.
        </p>
      </div>
    )
  }

  if (selected.kind === 'word') {
    return <WordDetail word={selected} sentence={sentences?.words?.[selected.word]} />
  }
  return (
    <SingleCharDetail
      char={selected.char}
      data={characters?.[selected.char]}
      sentence={sentences?.chars?.[selected.char]}
      composition={components?.[selected.char]}
      onSelectChar={onSelectChar}
    />
  )
}

// Render a sentence with every occurrence of `target` highlighted.
function Highlighted({ text, target }) {
  if (!target) return text
  const parts = text.split(target)
  return parts.flatMap((p, i) =>
    i < parts.length - 1 ? [p, <b className="hl" key={i}>{target}</b>] : [p],
  )
}

function SentenceBlock({ sentence, target }) {
  if (!sentence) return null
  return (
    <section>
      <div className="label">Example sentence</div>
      <div className="sentence">
        <div className="sentence-hanzi">
          <Highlighted text={sentence.hanzi} target={target} />
        </div>
        <div className="sentence-pinyin">{sentence.pinyin}</div>
        <div className="sentence-eng">{sentence.eng}</div>
      </div>
    </section>
  )
}

function SingleCharDetail({ char, data, sentence, composition, onSelectChar }) {
  const primary = data?.readings?.[0]
  return (
    <div className="detail">
      <div className="detail-left">
        <StrokePanel char={char} />
      </div>

      <div className="detail-right">
        <div className="detail-head">
          <span className="detail-char">{char}</span>
          <span className="detail-pinyin">{primary?.pinyin}</span>
        </div>

        {data?.readings?.map((r, i) => (
          <p className="meaning" key={i}>
            {data.readings.length > 1 && <span className="meaning-pinyin">{r.pinyin} </span>}
            {r.meanings.slice(0, 4).join('; ')}
          </p>
        ))}

        <Composition data={composition} onSelectChar={onSelectChar} />

        {data?.exampleWords?.length > 0 && (
          <section>
            <div className="label">Example words</div>
            <ul className="words">
              {data.exampleWords.map((w) => (
                <li key={w.word}>
                  <span className="word-hanzi">{w.word}</span>
                  <span className="word-pinyin">{w.pinyin}</span>
                  <span className="word-meaning">{w.meaning}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <SentenceBlock sentence={sentence} target={char} />
      </div>
    </div>
  )
}

function WordDetail({ word, sentence }) {
  const chars = [...word.word]
  return (
    <div className="word-detail">
      <div className="detail-head">
        <span className="detail-char">{word.word}</span>
        <span className="detail-pinyin">{word.pinyin}</span>
      </div>
      <p className="meaning">{word.meaning}</p>

      <SentenceBlock sentence={sentence} target={word.word} />

      <div className="label">How to write each character</div>
      <div className="stroke-row">
        {chars.map((c, i) => (
          <StrokePanel key={c + i} char={c} size={150} />
        ))}
      </div>
    </div>
  )
}
