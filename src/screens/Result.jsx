import { useEffect, useRef, useState } from 'react'
import { Fruits, Icon, Toast } from '../components/ui.jsx'
import { fmt, fmtPct } from '../lib/judge.js'
import { downloadExcel, safeFilename } from '../lib/excel.js'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export default function Result({ purpose, purposeTitle, names, rows, calc, block, onRestart }) {
  const [filename, setFilename] = useState(`${purposeTitle}_애플투애플_${today()}`)
  const [toast, setToast] = useState(null)
  const copyBtn = useRef(null)
  const unit = calc.base === 'KRW' ? '원' : 'USD'

  useEffect(() => {
    copyBtn.current?.focus()
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(block)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = block
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setToast('복사 완료!')
  }

  const photoA = rows.find((r) => r.group === 'amount' && r.aOcr) || rows.find((r) => r.id === 'item:OF' && r.aOcr)
  const nocomp = rows.filter((r) => r.judge === 'nocomp' && r.group !== 'total')

  return (
    <main className="a2a-main">
      <div className="a2a-card a2a-result">
        <p className="a2a-result__label">계산 결과 · {purposeTitle}</p>
        <h2>{calc.headline}</h2>
        <div className="a2a-result__row">
          {purpose !== 'reply' && (
            <>
              <div className="a2a-amount">
                <span className="a2a-amount__label">{names[0]}</span>
                <span className="a2a-amount__value">
                  {calc.a != null ? fmt(calc.a) : '—'}
                  <small>{unit}</small>
                  {photoA && <Icon name="photo" label="사진에서 읽은 값" />}
                </span>
                <span className="a2a-amount__sub">&nbsp;</span>
              </div>
              <span className="a2a-result__arrow" aria-hidden="true">
                {purpose === 'renego' ? '↔' : '→'}
              </span>
              <div className="a2a-amount">
                <span className="a2a-amount__label">{names[1]}</span>
                <span className="a2a-amount__value">
                  {calc.b != null ? fmt(calc.b) : '—'}
                  <small>{unit}</small>
                </span>
                <span className="a2a-amount__sub">{calc.bParts && calc.bParts.includes('+') ? calc.bParts : ' '}</span>
              </div>
            </>
          )}
          {purpose === 'reply' && (
            <div className="a2a-amount">
              <span className="a2a-amount__label">견적 금액{nocomp.length && calc.b != null ? ' (확인된 것만)' : ''}</span>
              <span className="a2a-amount__value">
                {calc.b != null ? fmt(calc.b) : '—'}
                <small>{unit}</small>
              </span>
              <span className="a2a-amount__sub">{calc.bParts || ' '}</span>
            </div>
          )}
          {purpose !== 'reply' && (
            <div className="a2a-diff">
              <span className="a2a-amount__label">{purpose === 'renego' ? '차이 (우리 − 상대)' : '차이'}</span>
              <span className="a2a-amount__value">
                {calc.diff != null ? (
                  <>
                    {calc.diff > 0 ? '+' : calc.diff < 0 ? '−' : ''}
                    {fmt(Math.abs(calc.diff))}
                    <small>
                      {unit} ({fmtPct(calc.pct)})
                    </small>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
          )}
        </div>
        <div className="a2a-result__out">
          <b>계산에서 뺀 칸</b>
          {nocomp.length
            ? nocomp.map((r) => (
                <span key={r.id} className="a2a-out-chip">
                  <Fruits kind="nocomp" />
                  {r.label} · {r.reason}
                </span>
              ))
            : '없어요'}
        </div>
      </div>

      <div className="a2a-card a2a-download">
        <span className="a2a-file__icon">
          <Icon name="sheet" />
        </span>
        <div className="a2a-download__meta">
          <span className="a2a-download__label">정렬된 표 엑셀 파일</span>
          <div className="a2a-filename">
            <input value={filename} aria-label="파일 이름" onChange={(e) => setFilename(e.target.value)} />
            <span className="a2a-filename__ext">.xlsx</span>
            <Icon name="edit" />
          </div>
          <span className="a2a-download__label">시트1 '정렬된 표' · 시트2 '판정·계산'</span>
        </div>
        <button className="a2a-btn" type="button" onClick={() => downloadExcel({ purpose, names, rows, calc, filename: safeFilename(filename) })}>
          <Icon name="download" />
          엑셀 다운로드
        </button>
      </div>

      <div className="a2a-block">
        <div className="a2a-block__head">
          <span className="a2a-block__title">챗봇용 블록 · {purposeTitle}</span>
          <span className="a2a-block__desc">정렬된 표 · 판정 · 계산 결과 · 프롬프트</span>
          <button ref={copyBtn} className="a2a-btn a2a-btn--primary a2a-btn--sm" type="button" onClick={copy}>
            <Icon name="copy" />
            복사
          </button>
        </div>
        <pre className="a2a-block__body">{block}</pre>
      </div>

      <ul className="a2a-guide">
        <li>쓰던 챗봇에 이 블록을 그대로 붙여 넣으면 메일 초안과 담당자 메모를 따로 받아요. 챗봇 설정에서 '대화 내용을 학습에 사용'을 꺼 두면 더 안전해요.</li>
        <li>내려받은 엑셀은 이 PC에 남아요. 회사 PC 관리 규칙에 따라 보관해 주세요.</li>
      </ul>
      <div className="a2a-actions">
        <button className="a2a-btn" type="button" onClick={onRestart}>
          처음으로
        </button>
      </div>
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </main>
  )
}
