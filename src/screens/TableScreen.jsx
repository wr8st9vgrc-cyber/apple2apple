import { useEffect, useMemo, useRef, useState } from 'react'
import { Fruits, Icon, Intro, Judge, isComposing } from '../components/ui.jsx'

function Val({ text, photo, tag }) {
  return (
    <span className="a2a-table__val">
      {text ? text : <span className="a2a-table__muted">없음</span>}
      {photo && <Icon name="photo" label="사진에서 읽은 값" />}
      {tag && <span className="a2a-tag">{tag}</span>}
    </span>
  )
}

export default function TableScreen({ purposeTitle, names, rows, condIds, inputs, setInputs, onCalc, hints = {} }) {
  const [drafts, setDrafts] = useState({})
  const [memos, setMemos] = useState({})
  const [dialog, setDialog] = useState(false)
  const inputRefs = useRef({})
  const calcBtn = useRef(null)
  const dialogBtn = useRef(null)

  const pending = condIds.filter((id) => !inputs[id])
  const doneCount = condIds.length - pending.length
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows])

  useEffect(() => {
    const first = pending[0]
    if (first && inputRefs.current[first]) inputRefs.current[first].focus()
    else calcBtn.current?.focus()
    // 화면이 열릴 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (dialog) dialogBtn.current?.focus()
  }, [dialog])

  function focusNext(afterId) {
    const order = condIds
    const idx = order.indexOf(afterId)
    const next = order.slice(idx + 1).concat(order.slice(0, idx)).find((id) => id !== afterId && !inputs[id])
    setTimeout(() => {
      if (next && inputRefs.current[next]) inputRefs.current[next].focus()
      else calcBtn.current?.focus()
    }, 0)
  }

  function commit(id) {
    const v = (drafts[id] ?? '').trim()
    if (!v) return
    setInputs((cur) => ({ ...cur, [id]: { value: v } }))
    focusNext(id)
  }
  function unknown(id) {
    setInputs((cur) => ({ ...cur, [id]: { unknown: true, memo: memos[id] || '' } }))
    focusNext(id)
  }
  function reopen(id) {
    setInputs((cur) => {
      const n = { ...cur }
      delete n[id]
      return n
    })
    setTimeout(() => inputRefs.current[id]?.focus(), 0)
  }

  const groups = [
    { title: '조건', rows: rows.filter((r) => r.group === 'cond') },
    { title: null, rows: rows.filter((r) => r.group === 'other') },
    { title: '금액', rows: rows.filter((r) => r.group === 'amount') },
    { title: null, rows: rows.filter((r) => r.group === 'total') },
  ]

  function cellFor(r, side) {
    const isCond = condIds.includes(r.id)
    const inputSide = r.input?.side || 'b'
    const text = side === 'a' ? r.a : r.b
    const photo = side === 'a' ? r.aOcr : r.bOcr
    if (r.group === 'total') return <span className={text === '계산하면 나와요' ? 'a2a-table__muted' : ''}>{text}</span>
    if (!isCond) return <Val text={text} photo={photo} />
    const inp = inputs[r.id]
    if (side !== inputSide) {
      return pending.includes(r.id) && r.peer !== false ? (
        <div className="a2a-peer">
          {text || '없음'}
          {photo && <Icon name="photo" label="사진에서 읽은 값" />}
        </div>
      ) : (
        <Val text={text} photo={photo} />
      )
    }
    if (!inp) {
      return (
        <div>
          <div className="a2a-field a2a-field--cond">
            <input
              ref={(el) => (inputRefs.current[r.id] = el)}
              value={drafts[r.id] ?? ''}
              placeholder={r.input?.placeholder || '값을 넣어 주세요'}
              aria-label={`${names[side === 'a' ? 0 : 1]} ${r.label}`}
              inputMode={r.input?.kind === 'number' ? 'decimal' : undefined}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || isComposing(e)) return
                e.preventDefault()
                if (e.shiftKey) unknown(r.id)
                else commit(r.id)
              }}
            />
            {r.input?.unit && <span className="a2a-field__unit">{r.input.unit}</span>}
          </div>
          <div className="a2a-reason">{r.reason}</div>
          {hints[r.id] && <div className="a2a-reason a2a-reason--hint">{hints[r.id]}</div>}
          <div className="a2a-cellbtns">
            <button className="a2a-btn a2a-btn--sm" type="button" onClick={() => unknown(r.id)} tabIndex={-1}>
              모르겠어요
            </button>
          </div>
        </div>
      )
    }
    if (inp.unknown) {
      return (
        <div>
          <div className="a2a-field a2a-field--nocomp">
            <input value="—" readOnly aria-label={r.label} tabIndex={-1} />
          </div>
          <div className="a2a-reason a2a-reason--nocomp">{r.reason}</div>
          <div className="a2a-memo">
            <input
              placeholder="메모 (선택, 챗봇에는 넘기지 않아요)"
              value={memos[r.id] || ''}
              onChange={(e) => {
                setMemos((m) => ({ ...m, [r.id]: e.target.value }))
                setInputs((cur) => ({ ...cur, [r.id]: { ...cur[r.id], memo: e.target.value } }))
              }}
            />
          </div>
          <button className="a2a-file__remove" type="button" onClick={() => reopen(r.id)} style={{ marginLeft: 0 }}>
            다시 넣기
          </button>
        </div>
      )
    }
    return (
      <span className="a2a-table__val">
        {text}
        <span className="a2a-tag">직접 넣음</span>
        <button className="a2a-file__remove" type="button" onClick={() => reopen(r.id)}>
          고치기
        </button>
      </span>
    )
  }

  const total = rows.find((r) => r.group === 'total')
  const okCount = rows.filter((r) => r.judge === 'ok').length
  const noCount = rows.filter((r) => r.judge === 'nocomp' && r.group !== 'total').length
  const keyAmounts = rows.filter((r) => r.group === 'amount' && (r.judge === 'ok' || r.judge === 'sum') && !r.exclude)

  return (
    <main className="a2a-main">
      <Intro
        use={purposeTitle}
        title={condIds.length ? `기준을 맞출 칸이 ${condIds.length}개 있어요` : '기준을 맞출 칸이 없어요'}
        progress={condIds.length ? `${Math.min(doneCount + 1, condIds.length)} / ${condIds.length}` : null}
        why={condIds.length ? '두 서류의 기준이 같아야 차이를 바르게 계산할 수 있어요' : '두 서류의 기준이 맞아서 바로 계산할 수 있어요'}
        keys={
          condIds.length
            ? [
                { key: 'Enter', text: '넣고 다음으로' },
                { key: 'Shift+Enter', text: '모르겠어요' },
              ]
            : [{ key: 'Enter', text: '계산하기' }]
        }
      />
      <table className="a2a-table">
        <colgroup>
          <col style={{ width: '18%' }} />
          <col style={{ width: '29%' }} />
          <col style={{ width: '31%' }} />
          <col style={{ width: '22%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>항목</th>
            <th>
              {names[0]}
              <span className="a2a-tag">기준</span>
            </th>
            <th>
              {names[1]}
              <span className="a2a-tag">비교할 것</span>
            </th>
            <th>판정</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => (
            <FragmentRows key={gi} title={g.title}>
              {g.rows.map((r) => {
                const active = pending.includes(r.id)
                return (
                  <tr key={r.id} className={`${active ? 'a2a-table__active' : ''} ${r.group === 'total' ? 'a2a-table__total' : ''}`}>
                    <td>
                      {r.label}
                      {r.group === 'other' && <span className="a2a-table__sub">원문 그대로</span>}
                      {r.note && <span className="a2a-table__sub">{r.note}</span>}
                    </td>
                    <td>{cellFor(r, 'a')}</td>
                    <td>{cellFor(r, 'b')}</td>
                    <td>
                      {r.group === 'total' ? (
                        r.judge === 'nocomp' ? (
                          <Judge kind="nocomp" />
                        ) : null
                      ) : (
                        <Judge kind={active ? 'cond' : r.judge} why={r.why} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </FragmentRows>
          ))}
        </tbody>
      </table>
      <div className="a2a-actions">
        {pending.length > 0 && <span className="a2a-actions__why">맞출 칸을 다 채우면 계산할 수 있어요</span>}
        <button ref={calcBtn} className="a2a-btn a2a-btn--primary" type="button" disabled={pending.length > 0} onClick={() => setDialog(true)}>
          계산하기
        </button>
      </div>

      {dialog && (
        <div
          className="a2a-scrim"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDialog(false)
          }}
        >
          <div className="a2a-dialog" role="dialog" aria-labelledby="dlg-t">
            <h2 id="dlg-t">이대로 계산할까요?</h2>
            <div>
              <p className="a2a-dialog__label">비교 대상</p>
              <div className="a2a-pair">
                {names[0]}
                <span className="a2a-tag">기준</span>↔ {names[1]}
                <span className="a2a-tag">비교할 것</span>
              </div>
            </div>
            <div>
              <p className="a2a-dialog__label">계산에 들어갈 주요 금액</p>
              {total?.a && total.a !== '계산하면 나와요' && (
                <div className="a2a-kv">
                  {names[0]} · {total.label}
                  <span className="a2a-kv__val">{total.a}</span>
                </div>
              )}
              {keyAmounts.map((r) => (
                <div key={r.id} className="a2a-kv">
                  {names[1]} · {r.label}
                  {r.byUser === 'input' && <span className="a2a-tag">직접 넣음</span>}
                  <span className="a2a-kv__val">
                    {r.b}
                    {r.bOcr && <Icon name="photo" label="사진에서 읽은 값" />}
                  </span>
                </div>
              ))}
              {rowById.fee && (
                <div className="a2a-kv">
                  우리 수수료
                  <span className="a2a-kv__val">{rowById.fee.b.replace(/ \(.*\)/, '')}</span>
                </div>
              )}
              {rowById.currency?.byUser === 'input' && (
                <div className="a2a-kv">
                  환율<span className="a2a-tag">직접 넣음</span>
                  <span className="a2a-kv__val">
                    {Number(String(rowById.currency.userValue).replace(/[^\d.]/g, '')).toLocaleString('en-US')}
                    <small>원/USD</small>
                  </span>
                </div>
              )}
            </div>
            <div className="a2a-count">
              <span>
                <Fruits kind="ok" />
                비교 가능 {okCount}칸
              </span>
              <span>
                <Fruits kind="nocomp" />
                비교 불가 {noCount}칸 (계산 제외)
              </span>
            </div>
            <div className="a2a-dialog__actions">
              <div className="a2a-keys">
                <span className="a2a-key">Enter</span>누르면 바로 계산해요
              </div>
              <button className="a2a-btn" type="button" onClick={() => setDialog(false)}>
                취소
              </button>
              <button
                ref={dialogBtn}
                className="a2a-btn a2a-btn--primary"
                type="button"
                onClick={() => {
                  setDialog(false)
                  onCalc(memos)
                }}
              >
                계산하기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function FragmentRows({ title, children }) {
  return (
    <>
      {title && (
        <tr className="a2a-table__group">
          <td colSpan={4}>{title}</td>
        </tr>
      )}
      {children}
    </>
  )
}
