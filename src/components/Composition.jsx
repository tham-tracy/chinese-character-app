// Renders the "How it's built" breakdown for a single character.
// `data` is one entry from components.json; `onSelectChar(char)` drills into a
// component that exists in the app (inApp: true).

function Chip({ comp, tag, onSelectChar }) {
  const inner = (
    <>
      <span className="comp-char">{comp.char}</span>
      {tag && <span className="comp-tag">{tag}</span>}
      {comp.pinyin && <span className="comp-pinyin">{comp.pinyin}</span>}
      {comp.meaning && <span className="comp-meaning">{comp.meaning}</span>}
    </>
  )
  if (comp.inApp && onSelectChar) {
    return (
      <button
        type="button"
        className="comp-chip comp-chip-link"
        aria-label={`View character ${comp.char}`}
        onClick={() => onSelectChar(comp.char)}
      >
        {inner}
      </button>
    )
  }
  return <div className="comp-chip">{inner}</div>
}

export default function Composition({ data, onSelectChar }) {
  if (!data) return null

  if (data.type === 'pictophonetic') {
    return (
      <section className="composition">
        <div className="label">How it's built</div>
        <div className="comp-row">
          {data.semantic && <Chip comp={data.semantic} tag="meaning" onSelectChar={onSelectChar} />}
          {data.phonetic && <Chip comp={data.phonetic} tag="sound" onSelectChar={onSelectChar} />}
        </div>
        {data.semantic && data.phonetic && (
          <p className="comp-note">
            A sound-meaning compound: {data.semantic.char} gives the meaning, {data.phonetic.char} gives the sound.
          </p>
        )}
        {data.hint && <p className="comp-note">{data.hint}</p>}
      </section>
    )
  }

  // ideographic / pictographic
  return (
    <section className="composition">
      <div className="label">How it's built</div>
      {data.components?.length > 0 && (
        <div className="comp-row">
          {data.components.map((comp) => (
            <Chip key={comp.char} comp={comp} onSelectChar={onSelectChar} />
          ))}
        </div>
      )}
      {data.hint && <p className="comp-note">{data.hint}</p>}
    </section>
  )
}
