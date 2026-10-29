import { useEffect, useRef, useState } from 'react'
import { Icon, Intro, isComposing } from '../components/ui.jsx'

export default function ReadCheck({ purposeTitle, names, docs, checks, values, setValues, onNext, hints = {} }) {
  const [cur, setCur] = useState(0)
  const refs = useRef([])
  const nextBtn = useRef(null)

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  const item = checks[Math.min(cur, checks.length - 1)]
  const doc = item ? docs[item.docSide] : null
  const docName = item ? names[item.docSide === 'a' ? 0 : 1] : ''

  function go(i) {
    if (i >= checks.length) {
      setCur(checks.length)
      nextBtn.current?.focus()
    } else {
      setCur(i)
      refs.current[i]?.focus()
    }
  }

  return (
    <main className="a2a-main">
      <Intro
        use={purposeTitle}
        title={`잘못 읽었을 수 있는 칸이 ${checks.length}개 있어요`}
        progress={`${Math.min(cur + 1, checks.length)} / ${checks.length}`}
        why="표로 정리하기 전에, 원본을 보고 짚은 칸만 확인해 주세요. 서류 전체를 볼 필요는 없어요"
        keys={[{ key: 'Enter', text: '고치거나 그대로 두고 다음으로' }]}
      />
      <div className="a2a-readcheck">
        <div className="a2a-original">
          <p className="a2a-original__label">
            <Icon name={doc?.preview ? 'photo' : 'attach'} />
            원본 · {docName}
          </p>
          {doc?.preview ? <img src={doc.preview} alt={`${docName} 원본`} /> : <pre>{(doc?.lines || []).map((l) => l.text).join('\n')}</pre>}
        </div>
        <div className="a2a-checks">
          {checks.map((c, i) => (
            <div key={c.id} className={`a2a-check ${i < cur ? 'is-done' : ''}`}>
              <div className="a2a-check__head">
                <span className={`a2a-step ${i === cur ? '' : 'a2a-step--idle'}`}>{i + 1}</span>
                {names[c.docSide === 'a' ? 0 : 1]} · {c.label}
              </div>
              <div className="a2a-field">
                <input
                  ref={(el) => (refs.current[i] = el)}
                  value={values[c.id] ?? c.value}
                  placeholder={c.placeholder || ''}
                  aria-label={`${c.label} 고치기`}
                  onFocus={() => setCur(i)}
                  onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isComposing(e)) {
                      e.preventDefault()
                      setValues((v) => ({ ...v, [c.id]: v[c.id] ?? c.value }))
                      go(i + 1)
                    }
                  }}
                />
              </div>
              <div className="a2a-reason a2a-reason--plain" style={{ color: 'var(--ink)' }}>
                {c.reason}
              </div>
              {hints[c.id] && <div className="a2a-reason a2a-reason--hint">{hints[c.id]}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="a2a-actions">
        <button ref={nextBtn} className="a2a-btn a2a-btn--primary" type="button" onClick={onNext}>
          다음
        </button>
      </div>
    </main>
  )
}
