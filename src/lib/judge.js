// 판정 (F3) · 계산 (F5). 판정은 규칙표로, 계산은 코드로 한다.
// 판정 규칙 7개 + 빈 조건 원칙 (노션 3.4 2-1 'MVP에서 만들 판정 규칙 7개')
import { ITEM_LABEL, PORT_NAME } from './dict.js'
import { containerText, scopeText } from './extract.js'

export const PURPOSES = {
  increase: { title: '인상 이유 설명', names: ['지난 견적', '새 운임'], file: '인상 이유 설명' },
  reply: { title: '견적 회신', names: ['화주 요청', '선사 운임'], file: '견적 회신' },
  renego: { title: '재협상 답변', names: ['우리 견적', '다른 포워더 견적'], file: '재협상 답변' },
}

const fmt = (n) => (n == null || isNaN(n) ? '' : Math.round(n).toLocaleString('en-US'))
const curLabel = (c) => (c === 'KRW' ? '원' : 'USD')
export const money = (n, cur) => (n == null ? '' : cur === 'KRW' ? `${fmt(n)}원` : `${fmt(n)}`)
const portText = (code) => (code ? `${PORT_NAME[code] || code}` : '')
const routeText = (f) => (f.pol || f.pod ? `${portText(f.pol || 'KRPUS')} → ${portText(f.pod) || '?'}` : '')
const dateText = (d) => (d ? d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1-$2-$3') : '')
const rangeText = (v) => (!v ? '' : v.from && v.to ? `${dateText(v.from)} ~ ${dateText(v.to)}` : v.to ? `${dateText(v.to)}까지` : `${dateText(v.from)}부터`)
const monthText = (v) => {
  const d = v?.from || v?.to
  return d ? `${+d.slice(5, 7)}월` : ''
}

// ---------------- 운임표에서 맞는 줄 고르기 ----------------
export function resolveTable(B, A) {
  if (!B.table) return B
  const rows = B.table.rows
  const row = rows.find((r) => r.pod === A.pod) || (rows.length === 1 ? rows[0] : null)
  const out = { ...B, items: { ...B.items }, tableRow: row }
  if (!row) return out
  out.pod = row.pod
  out.pol = out.pol || 'KRPUS'
  const want = A.container?.size || Object.keys(row.rates)[0]
  const rate = row.rates[want]
  const sizes = Object.keys(row.rates)
  out.container = { size: sizes.includes(want) ? want : sizes[0], qty: null, raw: '' }
  out.tableSize = want
  if (rate === 'N/A' || rate === undefined) out.items.OF = { status: 'na', raw: `${want}' 운임 없음 (${sizes.filter((s) => row.rates[s] !== 'N/A').map((s) => s + "'").join('·')}만 있음)` }
  else out.items.OF = { status: 'amount', amount: rate, currency: 'USD', raw: `${want}' ${rate}` }
  const thc = row.thc[want]
  if (typeof thc === 'number') out.items.THC = { status: 'amount', amount: thc, currency: 'USD', raw: `THC ${want}' ${thc}` }
  else if (/포함|incl/i.test(row.thcText)) out.items.THC = { status: 'included', raw: row.thcText }
  if (row.validity) {
    const m = row.validity.match(/(20\d{2}-\d{2}-\d{2})\s*~\s*(20\d{2}-\d{2}-\d{2})/)
    if (m) out.validity = { from: m[1], to: m[2], raw: row.validity }
  }
  if (/cy/i.test(row.term) || !out.scope) out.scope = { origin: 'port', dest: 'port', raw: row.term || 'CY/CY' }
  out.currency = out.currency || 'USD'
  return out
}

// ---------------- 판정 ----------------
// inputs: { [rowId]: { value: string, unknown: bool, memo } }
export function judge({ purpose, A: A0, B: B0, fee, inputs = {}, today }) {
  const A = A0
  const B = resolveTable(B0, A0)
  const rows = []
  const add = (r) => rows.push({ group: 'cond', input: null, ...r })
  const inputOf = (id) => inputs[id] || null

  // 사람이 넣은 값으로 바꾸고 다시 판정
  const settle = (row) => {
    const inp = inputOf(row.id)
    if (row.judge === 'cond' && inp) {
      if (inp.unknown) {
        row.judge = 'nocomp'
        row.reason = row.unknownReason || row.reason
        row.memo = inp.memo || ''
        row.byUser = 'unknown'
      } else if (String(inp.value || '').trim()) {
        row.judge = 'ok'
        row.byUser = 'input'
        row.userValue = String(inp.value).trim()
        row.b = row.formatInput ? row.formatInput(row.userValue) : row.userValue
      }
    }
    return row
  }

  // 1. 컨테이너
  {
    const a = A.container
    const b = B.container
    const r = { id: 'container', label: '컨테이너', a: containerText(a), b: containerText(b), aOcr: A.src?.container?.ocr, bOcr: B.src?.container?.ocr }
    if (B.items.OF?.status === 'na' && B.tableRow) {
      r.judge = 'nocomp'
      r.b = B.items.OF.raw
      r.reason = `요청한 ${A.container?.size || ''}피트 운임이 없어요`
    } else if (!a || !b) {
      r.judge = 'cond'
      r.reason = `${!a ? '기준' : '비교할 것'} 서류에서 컨테이너를 찾지 못했어요`
      r.unknownReason = '컨테이너를 확인하지 못함'
      r.input = { kind: 'text', side: a ? 'b' : 'a', placeholder: "예: 40' × 1" }
    } else if (a.size !== b.size) {
      r.judge = 'nocomp'
      r.reason = `컨테이너 규격이 달라요 (${a.size}' ↔ ${b.size}')`
    } else if (a.qty && b.qty && a.qty !== b.qty && purpose !== 'reply') {
      r.judge = 'nocomp'
      r.reason = `컨테이너 대수가 달라요`
    } else r.judge = 'ok'
    add(settle(r))
  }

  // 2. 구간
  {
    const r = { id: 'route', label: '구간', a: routeText(A), b: routeText(B), aOcr: A.src?.route?.ocr, bOcr: B.src?.route?.ocr }
    if (!A.pod || !B.pod) {
      r.judge = 'cond'
      r.reason = `${!A.pod ? '기준' : '비교할 것'} 서류에서 도착항을 찾지 못했어요`
      r.unknownReason = '구간을 확인하지 못함'
      r.input = { kind: 'text', side: A.pod ? 'b' : 'a', placeholder: '예: 부산 → 로테르담' }
    } else if (A.pod !== B.pod) {
      r.judge = 'nocomp'
      r.reason = `도착항이 달라요`
    } else r.judge = 'ok'
    add(settle(r))
  }

  // 3. 서비스 범위
  let scopeNo = false
  {
    const r = { id: 'scope', label: '서비스 범위', a: scopeText(A.scope), b: scopeText(B.scope), aOcr: A.src?.scope?.ocr, bOcr: B.src?.scope?.ocr }
    if (!A.scope || !B.scope) {
      r.judge = 'cond'
      r.reason = `${!A.scope ? '기준' : '비교할 것'} 서류에서 서비스 범위(문 앞/항구)를 찾지 못했어요`
      r.unknownReason = '서비스 범위를 확인하지 못함'
      r.input = { kind: 'text', side: A.scope ? 'b' : 'a', placeholder: '예: 항구–항구' }
    } else if (A.scope.origin !== B.scope.origin || A.scope.dest !== B.scope.dest) {
      r.judge = 'nocomp'
      const desc = (s) => (s.origin === 'door' ? '공장 문 앞부터' : s.dest === 'door' ? '문 앞까지' : '항구–항구')
      r.reason =
        purpose === 'reply'
          ? `화주는 ${desc(A.scope)}, 선사 운임은 ${desc(B.scope)}예요`
          : purpose === 'renego'
            ? `우리는 ${A.scope.origin === 'door' ? '공장 문 앞부터' : '항구부터'}, 상대는 ${B.scope.origin === 'door' ? '공장 문 앞부터' : '부산항부터'}예요`
            : `서비스 범위가 달라요 (${scopeText(A.scope)} ↔ ${scopeText(B.scope)})`
      scopeNo = true
    } else r.judge = 'ok'
    add(settle(r))
  }

  // 4. 유효기간
  {
    const r = { id: 'validity', label: '유효기간', aOcr: A.src?.validity?.ocr || A.src?.shipDate?.ocr, bOcr: B.src?.validity?.ocr }
    if (purpose === 'increase') {
      r.a = monthText(A.validity) || rangeText(A.validity)
      r.b = monthText(B.validity) || rangeText(B.validity)
      r.judge = 'na'
      r.why = '지난 견적과 새 운임은 원래 시점이 달라요. 이번엔 그 사이 바뀐 금액을 보려는 거라 판정하지 않아요.'
    } else if (purpose === 'reply') {
      r.a = A.shipDate ? `${A.shipDate.label || rangeText({ from: A.shipDate.from, to: A.shipDate.to === A.shipDate.from ? null : A.shipDate.to })} 선적` : ''
      if (A.shipDate && A.shipDate.from === A.shipDate.to) r.a = `${dateText(A.shipDate.from)} 선적`
      r.b = rangeText(B.validity)
      r.formatInput = (v) => `${v}까지 (직접 넣음)`
      if (!A.shipDate || !B.validity) {
        r.judge = 'cond'
        r.reason = `${!A.shipDate ? '화주 요청에서 선적 시점' : '선사 운임에서 유효기간'}을 찾지 못했어요`
        r.unknownReason = '유효기간을 확인하지 못함'
        r.input = { kind: 'text', side: !A.shipDate ? 'a' : 'b', placeholder: '예: 2026-11-30' }
      } else if ((B.validity.to && A.shipDate.from > B.validity.to) || (B.validity.from && A.shipDate.to < B.validity.from)) {
        r.judge = 'cond'
        r.reason = '선적 시점이 운임 유효기간 밖이에요'
        r.unknownReason = '선적 시점의 운임을 확인하지 못함 (운임 재확인 필요)'
        r.input = { kind: 'text', side: 'b', placeholder: '새 유효기간 끝 날짜, 예: 2026-11-30' }
      } else r.judge = 'ok'
    } else {
      const ref = A.docDate || today
      r.a = rangeText(A.validity)
      r.b = rangeText(B.validity)
      r.formatInput = (v) => `${v}까지 (직접 넣음)`
      if (!B.validity) {
        r.judge = 'cond'
        r.reason = '상대 견적에서 유효기간을 찾지 못했어요'
        r.unknownReason = '상대 견적의 유효기간을 확인하지 못함'
        r.input = { kind: 'text', side: 'b', placeholder: '예: 2026-11-30' }
      } else if (B.validity.to && ref && B.validity.to < ref) {
        r.judge = 'cond'
        r.reason = `상대 견적의 유효기간이 지났어요 (우리 견적일 ${dateText(ref)} 기준)`
        r.unknownReason = '상대 견적이 지금도 유효한지 확인하지 못함'
        r.input = { kind: 'text', side: 'b', placeholder: '새 유효기간 끝 날짜, 예: 2026-11-30' }
      } else r.judge = 'ok'
    }
    add(settle(r))
  }

  // 5. 통화·단위
  const unitText = (f) => (f.currency ? `${f.currency === 'KRW' ? '원화' : 'USD'}, ${f.basis === 'shipment' ? '건당' : '컨테이너당'}` : '')
  let fx = null
  {
    const r = { id: 'currency', label: '통화·단위', a: unitText(A), b: unitText(B) }
    if (purpose === 'reply') {
      r.a = '(조건 없음)'
      r.judge = 'na'
      r.why = '화주 요청에는 통화·단위가 적히지 않아서 판정하지 않아요.'
    } else if (!A.currency || !B.currency) {
      r.judge = 'cond'
      r.reason = `${!A.currency ? '기준' : '비교할 것'} 서류에서 통화를 찾지 못했어요`
      r.unknownReason = '통화를 확인하지 못함'
      r.input = { kind: 'text', side: A.currency ? 'b' : 'a', placeholder: '예: USD' }
    } else if (A.currency !== B.currency) {
      r.judge = 'cond'
      r.reason = `두 서류의 통화가 달라요${A.basis !== B.basis ? '. 단위도 달라요(건당 ↔ 컨테이너당)' : ''}`
      r.unknownReason = '환율을 확인하지 못함'
      r.input = { kind: 'number', side: 'b', placeholder: '환율 (1 USD = 몇 원)', unit: '원/USD' }
      r.formatInput = (v) => `${unitText(B)} → 1 USD = ${fmt(Number(String(v).replace(/[^\d.]/g, '')))}원 (직접 넣음)`
    } else r.judge = 'ok'
    settle(r)
    if (r.byUser === 'input') fx = Number(String(r.userValue).replace(/[^\d.]/g, ''))
    add(r)
  }

  // 6. 기타 조건
  const others = []
  for (const [k, it] of Object.entries(A.items)) if (it.status === 'excluded' && !B.items[k] && !['THC', 'BAF', 'DTHC'].includes(k)) others.push(['a', it.raw])
  for (const [k, it] of Object.entries(B.items)) if (it.status === 'excluded' && !A.items[k] && !['THC', 'BAF', 'DTHC'].includes(k)) others.push(['b', it.raw])
  const otherA = others.filter((o) => o[0] === 'a').map((o) => shortRemark(o[1])).join(' / ')
  const otherB = others.filter((o) => o[0] === 'b').map((o) => shortRemark(o[1])).join(' / ')
  add({ id: 'other', group: 'other', label: '기타 조건', a: otherA || '없음', b: otherB || '없음', judge: 'na', why: '다섯 가지 기준 밖의 조건이라 판정하지 않아요. 원문 그대로 챗봇에 넘겨요.' })

  // 7. 금액 줄
  const amountRows = buildAmountRows({ purpose, A, B, inputs, scopeNo, settle, fee })
  rows.push(...amountRows)

  // 합계 줄
  const calc = calculate({ purpose, A, B, rows, fee, fx, scopeNo })
  rows.push({
    id: 'total',
    group: 'total',
    label: calc.totalLabel,
    a: calc.aText,
    b: calc.bText,
    judge: calc.judge,
    reason: calc.reason,
    why: calc.why,
  })
  return { rows, calc, A, B }
}

function shortRemark(raw) {
  const t = String(raw || '')
  const m = t.match(/[^,/:|]*(별도|별노)[^,/|]*/)
  return (m ? m[0] : t).replace(/^\s*(비고|※)\s*:?\s*/, '').trim()
}

function itemValueText(it, cur) {
  if (!it) return '없음'
  if (it.status === 'amount') return money(it.amount, it.currency || cur)
  return { included: '포함', excluded: '별도', tariff: `표시 없음 ('${shortTariff(it.raw)}')`, tba: '금액 없음 (TBA)', na: 'N/A', unknown: '적혀 있지 않음' }[it.status] || ''
}
function shortTariff(raw) {
  const m = String(raw || '').match(/(local charges )?as per [a-z ]+/i)
  return m ? m[0].trim() : raw
}

function buildAmountRows({ purpose, A, B, inputs, scopeNo, settle, fee }) {
  const rows = []
  const addRow = (r) => rows.push(settle({ group: 'amount', input: null, ...r }))
  const curB = B.currency || A.currency
  const keys = ['OF', 'ALLIN', 'BAF', 'THC', 'DTHC', 'DOC', 'INLAND', 'FEE', 'SEAL']

  if (purpose === 'increase') {
    const aIncl = new Set(Object.entries(A.items).filter(([, v]) => v.status === 'included').map(([k]) => k))
    const aHasBreakdown = !aIncl.size && !A.items.ALLIN
    for (const k of keys) {
      if (k === 'ALLIN' || k === 'FEE' || k === 'SEAL') continue
      const a = A.items[k]
      const b = B.items[k]
      if (!a && !b) continue
      if (k === 'OF') {
        const r = { id: 'item:OF', label: '해상운임', a: aHasBreakdown && a ? money(a.amount, a.currency || A.currency) : A.items.ALLIN ? `All-in ${money(A.items.ALLIN.amount, A.currency)}` : '(합계에 포함)', b: itemValueText(b, curB), bOcr: b?.ocr, aOcr: a?.ocr }
        if (aHasBreakdown && a && b?.status === 'amount') r.judge = 'ok'
        else {
          r.judge = 'sum'
          r.why = A.items.ALLIN ? '지난 견적이 All-in 한 줄이라 합계에서 같이 비교해요.' : '지난 견적에 항목별 금액이 없어서 합계에서 같이 비교해요.'
        }
        // 같은 항목이 양쪽 다 포함 표시면 바로 비교 (예: O/F THC 포함 ↔ O/F THC 포함)
        if (a?.status === 'amount' && b?.status === 'amount') {
          const bIncl = new Set(Object.entries(B.items).filter(([, v]) => v.status === 'included').map(([kk]) => kk))
          if ([...aIncl].every((x) => bIncl.has(x)) && [...bIncl].every((x) => aIncl.has(x))) {
            r.judge = 'ok'
            r.a = money(a.amount, a.currency || A.currency) + (aIncl.size ? ` (${[...aIncl].map((x) => ITEM_LABEL[x]).join('·')} 포함)` : '')
            r.b = money(b.amount, b.currency || curB) + (bIncl.size ? ` (${[...bIncl].map((x) => ITEM_LABEL[x]).join('·')} 포함)` : '')
            r.why = null
          }
        }
        addRow(r)
        continue
      }
      const aSt = a?.status || 'none'
      const bSt = b?.status || 'none'
      const r = { id: `item:${k}`, label: ITEM_LABEL[k], a: itemValueText(a, A.currency), b: itemValueText(b, curB), aOcr: a?.ocr, bOcr: b?.ocr, key: k }
      const aIn = aSt === 'included' || aSt === 'amount'
      const bHas = bSt === 'amount' || bSt === 'included'
      if (aIn && !bHas) {
        // 규칙 1·2: 한쪽만 포함 표시, 또는 금액 없음
        r.judge = 'cond'
        r.reason = bSt === 'tba' || bSt === 'tariff' ? `지난 견적은 ${ITEM_LABEL[k]} 포함, 새 운임은 ${ITEM_LABEL[k]} 금액이 없어요` : `지난 견적은 ${ITEM_LABEL[k]} 포함, 새 운임은 ${ITEM_LABEL[k]} 포함 표시가 없어요`
        if (bSt === 'tariff' && /local charges|tariff/i.test(b?.raw || '') && k === 'THC') r.reason = '지난 견적은 THC 포함, 새 운임은 THC 포함 표시가 없어요'
        r.unknownReason = `새 운임의 ${ITEM_LABEL[k]} 금액을 확인하지 못함`
        r.input = { kind: 'number', side: 'b', placeholder: `${ITEM_LABEL[k]} 금액을 넣어 주세요`, unit: curLabel(curB) }
        r.formatInput = (v) => `${money(Number(String(v).replace(/[^\d.]/g, '')), curB)} (담당자 입력)`
        r.peer = 'a'
      } else if (!aIn && bSt === 'amount' && !b.includedInOF) {
        r.judge = 'ok'
        r.note = '지난 견적에 없던 항목이라 합계에서 빼요'
        r.exclude = true
      } else if (!aIn && !bHas) {
        if (aSt === 'none' || bSt === 'none') continue
        r.judge = 'ok'
        r.why = null
        r.note = '양쪽 다 빠져 있어요'
        r.exclude = true
      } else r.judge = 'ok'
      addRow(r)
    }
  } else if (purpose === 'reply') {
    const req = new Set(['OF', ...(A.requested || [])])
    for (const k of keys) {
      if (k === 'ALLIN' || k === 'FEE' || k === 'SEAL') continue
      const b = B.items[k]
      const asked = req.has(k)
      if (!b && !asked) continue
      const r = { id: `item:${k}`, label: ITEM_LABEL[k], a: asked ? (k === 'DTHC' ? '포함 요청' : '필요') : '', b: itemValueText(b, curB), bOcr: b?.ocr, key: k }
      if (k === 'OF' && b?.status === 'na') {
        r.judge = 'na'
        r.why = '요청한 컨테이너 운임이 없어요. 컨테이너 줄에서 판정해요.'
        r.exclude = true
      } else if (scopeNo && b?.status === 'amount') {
        r.judge = 'na'
        r.why = '서비스 범위가 달라 표에만 남기고 총액에 넣지 않아요.'
      } else if (asked && (!b || b.status === 'tba' || b.status === 'tariff' || b.status === 'unknown')) {
        r.judge = 'cond'
        r.reason = `${k === 'DTHC' ? '도착항 비용' : ITEM_LABEL[k]} 금액이 없어요`
        r.unknownReason = `${k === 'DTHC' ? '도착항 비용' : ITEM_LABEL[k]} 금액을 확인하지 못함 (별도 확인)`
        r.input = { kind: 'number', side: 'b', placeholder: `${ITEM_LABEL[k]} 금액을 넣어 주세요`, unit: curLabel(curB) }
        r.formatInput = (v) => `${money(Number(String(v).replace(/[^\d.]/g, '')), curB)} (담당자 입력)`
        r.peer = 'a'
      } else if (b?.status === 'amount') r.judge = 'ok'
      else {
        r.judge = 'na'
        r.why = '선사 운임에서 별도로 받는 항목이라 이번 견적 금액에 넣지 않아요.'
        r.exclude = true
      }
      addRow(r)
    }
    if (fee) rows.push({ id: 'fee', group: 'amount', label: '우리 수수료', a: '', b: `${fmt(Number(fee))} (서류 올리기에서 입력)`, judge: 'na', why: '담당자가 넣은 우리 수수료예요. 판정하지 않고 합계에 더해요.' })
  } else {
    // 재협상: 상대 포함 항목
    const bIncl = new Set(Object.entries(B.items).filter(([, v]) => v.status === 'included').map(([k]) => k))
    const bAmounts = Object.entries(B.items).filter(([, v]) => v.status === 'amount').map(([k]) => k)
    const aAmounts = Object.entries(A.items).filter(([, v]) => v.status === 'amount').map(([k]) => k)
    const bSingle = bAmounts.length <= 1 && aAmounts.length > 1
    const bStated = bIncl.size > 0 || Object.values(B.items).some((v) => v.status === 'excluded')
    if (bSingle && !bStated) {
      const r = {
        id: 'incl',
        label: '상대 포함 항목',
        a: aAmounts.map((k) => ITEM_LABEL[k]).join('·'),
        b: '적혀 있지 않음',
        judge: 'cond',
        reason: '상대 견적에 포함 항목이 안 적혀 있어요',
        unknownReason: '상대 견적의 포함 항목을 확인하지 못함',
        input: { kind: 'text', side: 'b', placeholder: "예: 해상운임만 / 해상운임·THC" },
        peer: 'a',
      }
      addRow(r)
    }
    for (const k of keys) {
      if (k === 'ALLIN' || k === 'SEAL') continue
      const a = A.items[k]
      const b = B.items[k]
      if (!a && !b) continue
      if (k !== 'OF' && !(a?.status === 'amount') && !(b?.status === 'amount')) continue
      const r = { id: `item:${k}`, label: ITEM_LABEL[k], a: itemValueText(a, A.currency), b: b ? itemValueText(b, curB) : '', aOcr: a?.ocr, bOcr: b?.ocr, key: k }
      if (k === 'OF' && bIncl.size && b?.status === 'amount') r.b += ` (${[...bIncl].map((x) => ITEM_LABEL[x]).join('·')} 포함)`
      if (k === 'OF' && a?.status === 'amount' && Object.entries(A.items).some(([, v]) => v.status === 'included')) r.a += ` (${Object.entries(A.items).filter(([, v]) => v.status === 'included').map(([x]) => ITEM_LABEL[x]).join('·')} 포함)`
      if (scopeNo) {
        r.judge = 'na'
        r.why = '서비스 범위가 달라 표에만 남기고 차이를 내지 않아요.'
      } else r.judge = 'ok'
      addRow(r)
    }
  }
  return rows
}

// ---------------- 계산 ----------------
function calculate({ purpose, A, B, rows, fee, fx, scopeNo }) {
  const base = A.currency || B.currency || 'USD'
  const conv = (amount, cur) => {
    if (amount == null) return null
    const c = cur || base
    if (c === base) return amount
    if (!fx) return null
    return c === 'KRW' && base === 'USD' ? amount / fx : c === 'USD' && base === 'KRW' ? amount * fx : amount
  }
  const qtyOf = (f) => (f.multiplied ? 1 : f.basis === 'shipment' ? 1 : (A.container?.qty || B.container?.qty || 1))
  const condLeft = rows.filter((r) => r.judge === 'cond')
  const nocomp = rows.filter((r) => r.judge === 'nocomp')
  const excluded = nocomp.map((r) => ({ label: r.label, reason: r.reason }))
  const out = { base, excluded, condLeft: condLeft.length, fee: purpose === 'reply' ? fee : null }
  const rowVal = (id) => {
    const r = rows.find((x) => x.id === id)
    if (r?.byUser === 'input') return Number(String(r.userValue).replace(/[^\d.]/g, ''))
    return null
  }

  if (purpose === 'increase') {
    const aIncl = Object.entries(A.items).filter(([, v]) => v.status === 'included').map(([k]) => k)
    const aTotal = (A.total?.amount ?? A.items.ALLIN?.amount ?? sumAmounts(A)) * qtyOf(A)
    let bTotal = 0
    const parts = []
    const ofB = B.items.OF
    if (ofB?.status === 'amount') {
      bTotal += conv(ofB.amount, ofB.currency || B.currency) * qtyOf(B)
      parts.push(`해상운임 ${fmt(ofB.amount)}`)
    }
    for (const k of new Set([...aIncl, ...Object.keys(A.items).filter((k) => A.items[k].status === 'amount' && k !== 'OF' && k !== 'ALLIN')])) {
      const b = B.items[k]
      const user = rowVal(`item:${k}`)
      if (user != null) {
        bTotal += conv(user, B.currency) * qtyOf(B)
        parts.push(`${ITEM_LABEL[k]} ${fmt(user)}`)
      } else if (b?.status === 'amount') {
        bTotal += conv(b.amount, b.currency || B.currency) * qtyOf(B)
        parts.push(`${ITEM_LABEL[k]} ${fmt(b.amount)}`)
      }
    }
    const basisLabel = aIncl.length ? `${aIncl.map((k) => ITEM_LABEL[k].replace(/ \(.*\)/, '')).join('·')} 포함` : ''
    out.totalLabel = basisLabel ? `합계 (${basisLabel})` : '합계'
    out.basisLabel = basisLabel
    out.a = aTotal
    out.b = bTotal || null
    out.bParts = parts.join(' + ')
    out.names = ['지난 견적', '새 운임']
    finishDiff(out, nocomp.length > 0, (x) => x.b - x.a)
    out.aText = money(aTotal, base)
    out.bText = out.b != null && condLeft.length === 0 ? `${money(out.b, base)}${parts.length > 1 ? ` (${parts.join(' + ')})` : ''}` : '계산하면 나와요'
    out.judge = nocomp.length ? 'nocomp' : condLeft.length ? 'cond-wait' : 'ok'
    if (out.diff != null) out.headline = `같은 기준${basisLabel ? `(${basisLabel})` : ''}으로 보면 ${fmtMoneyWord(Math.abs(out.diff), base)} ${out.diff > 0 ? '올랐어요' : out.diff < 0 ? '내렸어요' : '같아요'}`
  } else if (purpose === 'reply') {
    out.totalLabel = '합계'
    out.names = ['화주 요청', '선사 운임']
    const fatal = rows.some((r) => ['container', 'scope', 'route'].includes(r.id) && r.judge === 'nocomp')
    let sum = 0
    const parts = []
    for (const r of rows.filter((x) => x.group === 'amount')) {
      if (r.judge !== 'ok' || r.exclude) continue
      const v = r.byUser === 'input' ? Number(String(r.userValue).replace(/[^\d.]/g, '')) : B.items[r.key]?.amount
      if (v == null) continue
      sum += conv(v, B.items[r.key]?.currency || B.currency) * qtyOf(B)
      parts.push(`${r.label.replace(/ \(.*\)/, '')} ${fmt(v)}`)
    }
    if (fee) {
      sum += Number(fee)
      parts.push(`우리 수수료 ${fmt(fee)}`)
    }
    out.a = null
    if (fatal) {
      out.b = null
      out.judge = 'nocomp'
      out.reason = rows.find((r) => ['container', 'scope', 'route'].includes(r.id) && r.judge === 'nocomp').reason
      out.headline = rows.find((r) => r.id === 'container')?.judge === 'nocomp' ? '요청한 조건의 운임이 없어서 견적 금액은 내지 않았어요' : '서비스 범위가 달라서 총액은 내지 않았어요'
      out.aText = ''
      out.bText = '내지 않음'
    } else {
      out.b = sum
      out.bParts = parts.join(' + ')
      out.judge = condLeft.length ? 'cond-wait' : 'ok'
      out.aText = ''
      out.bText = condLeft.length ? '계산하면 나와요' : `${money(sum, base)} (${parts.join(' + ')})`
      out.headline = nocomp.length ? `확인된 금액은 ${fmtMoneyWord(sum, base)}예요. ${nocomp.length}칸은 별도 확인이 필요해요` : `견적 금액은 ${fmtMoneyWord(sum, base)}예요`
      if (nocomp.length) out.totalLabel = '합계 (확인된 것만)'
    }
  } else {
    out.totalLabel = '합계'
    out.names = ['우리 견적', '다른 포워더 견적']
    const aTotal = A.total?.amount ?? sumAmounts(A)
    const aT = aTotal != null ? conv(aTotal, A.currency) * qtyOf(A) : null
    let bT = null
    const bAm = Object.entries(B.items).filter(([, v]) => v.status === 'amount')
    if (bAm.length) bT = bAm.reduce((s, [, v]) => s + (conv(v.amount, v.currency || B.currency) ?? NaN), 0) * qtyOf(B)
    if (B.total?.amount && bAm.length <= 1) bT = conv(B.total.amount, B.total.currency || B.currency) * qtyOf(B)
    out.a = aT
    out.b = isNaN(bT) ? null : bT
    if (scopeNo) {
      out.judge = 'nocomp'
      out.reason = '서비스 범위가 달라 총액·차이를 내지 않아요 (상대 빈칸을 우리 값으로 채우지 않아요)'
      out.headline = '서비스 범위가 달라서 총액과 차이는 내지 않았어요'
      out.diff = null
    } else {
      finishDiff(out, nocomp.length > 0, (x) => x.a - x.b)
      out.judge = nocomp.length ? 'nocomp' : condLeft.length ? 'cond-wait' : 'ok'
      if (out.diff != null) out.headline = out.diff > 0 ? `같은 기준으로 보면 우리가 ${fmtMoneyWord(out.diff, base)} 비싸요` : out.diff < 0 ? `같은 기준으로 보면 우리가 ${fmtMoneyWord(-out.diff, base)} 싸요` : '같은 기준으로 보면 금액이 같아요'
    }
    out.aText = money(aT, base)
    out.bText = out.b != null && !condLeft.length ? money(out.b, base) : '계산하면 나와요'
  }
  if (out.judge === 'nocomp' && !out.headline) out.headline = '확인 못 한 칸이 있어서 차이는 내지 않았어요'
  if (out.judge === 'nocomp' && purpose !== 'reply' && out.diff == null && !scopeNo) out.headline = '확인 못 한 칸이 있어서 차이는 내지 않았어요'
  if (out.judge === 'cond-wait') out.judge = 'pending'
  return out
}

function sumAmounts(f) {
  const v = Object.values(f.items).filter((i) => i.status === 'amount')
  return v.length ? v.reduce((s, i) => s + i.amount, 0) : null
}
function finishDiff(out, blocked, fn) {
  if (blocked || out.a == null || out.b == null) {
    out.diff = null
    out.pct = null
    return
  }
  out.diff = fn(out)
  out.pct = out.a ? (out.diff / out.a) * 100 : null
}
export function fmtMoneyWord(n, cur) {
  return cur === 'KRW' ? `${fmt(n)}원` : `${fmt(n)}달러`
}
export function fmtPct(p) {
  if (p == null) return ''
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`
}
export function fmtDiff(n, cur) {
  if (n == null) return ''
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`
}
export { fmt, curLabel }
