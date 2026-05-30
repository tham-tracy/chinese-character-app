import { useEffect, useRef, useState } from 'react'
import HanziWriter from 'hanzi-writer'

// Renders a character with Hanzi Writer and exposes Animate / Practice actions.
// Stroke-order data is fetched on demand by Hanzi Writer (from its CDN by
// default), so a character not in the dataset is reported gracefully.
export default function StrokePanel({ char, size = 200 }) {
  const containerRef = useRef(null)
  const writerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | missing

  useEffect(() => {
    if (!char || !containerRef.current) return

    setStatus('loading')
    containerRef.current.innerHTML = ''
    writerRef.current = null

    const writer = HanziWriter.create(containerRef.current, char, {
      width: size,
      height: size,
      padding: 5,
      showOutline: true,
      strokeColor: '#c0392b',
      radicalColor: '#d98880',
      delayBetweenStrokes: 180,
      charDataLoader: (c, onComplete) => {
        HanziWriter.loadCharacterData(c)
          .then((data) => {
            setStatus('ready')
            onComplete(data)
          })
          .catch(() => setStatus('missing'))
      },
    })
    writerRef.current = writer

    return () => {
      writerRef.current = null
    }
  }, [char])

  function animate() {
    writerRef.current?.animateCharacter()
  }

  function practice() {
    if (!writerRef.current) return
    writerRef.current.quiz({
      onComplete: () => {},
    })
  }

  return (
    <div className="stroke-panel">
      <div className="stroke-box" style={{ width: size, height: size }}>
        <div ref={containerRef} className="stroke-target" />
        {status === 'loading' && <div className="stroke-msg">Loading strokes…</div>}
        {status === 'missing' && (
          <div className="stroke-msg">Stroke data unavailable for this character.</div>
        )}
      </div>
      <div className="stroke-actions">
        <button onClick={animate} disabled={status !== 'ready'}>
          ▶ Animate
        </button>
        <button className="practice" onClick={practice} disabled={status !== 'ready'}>
          ✍ Practice
        </button>
      </div>
    </div>
  )
}
