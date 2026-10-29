// 읽은 내용 확인 (F4, 화면 3): 잘못 읽었을 수 있는 칸만 짚는다.
// 기준: OCR 점수가 기준보다 낮은 글자 / 형식이 맞지 않는 값 / 메일 최근 본문에 같은 항목 금액이 두 개 이상 / 사진에서 찾지 못한 핵심 칸
import { OCR_MIN, extractFacts } from './extract.js'
import { ITEM_LABEL } from './dict.js'

const FIELD = {
  container: '컨테이너',
  route: '구간',
  scope: '서비스 범위',
  validity: '유효기간',
  shipDate: '선적 시점',
  total: '합계 금액',
  main: '금액',
  fx: '환율',
}

// side: 'a' | 'b', role에 따라 꼭 있어야 하는 칸이 다르다
export function findChecks(doc, facts, { purpose, side }) {
  const out = []
  const seenLines = new Set()
  const push = (c) => {
    if (c.line != null && seenLines.has(c.line)) return
    if (c.line != null) seenLines.add(c.line)
    out.push({ docSide: side, ...c })
  }
  const lineText = (i) => (doc.lines[i] ? doc.lines[i].text : '')

  if (doc.ocr) {
    // 1) 형식이 맞지 않는 금액
    for (const [k, it] of Object.entries(facts.items)) {
      if (it.status === 'amount' && it.malformed) {
        const tok = (String(it.raw).match(/[OoIlCS]?\d[\dOoIlCS.,\s]*\d/g) || []).pop() || ''
        push({ id: `${side}:amt:${k}`, kind: 'amount', line: it.line, label: `${ITEM_LABEL[k]} 금액`, value: tok.trim(), token: tok.trim(), reason: '숫자가 아닌 글자가 섞였거나 자리 표시가 이상해요' })
      }
    }
    if (facts.total?.malformed) {
      const s = facts.src.total
      const tok = (String(facts.total.raw).match(/[OoIlCS]?\d[\dOoIlCS.,\s]*\d/g) || []).pop() || ''
      push({ id: `${side}:amt:total`, kind: 'amount', line: s?.line, label: '합계 금액', value: tok.trim(), token: tok.trim(), reason: '숫자가 아닌 글자가 섞였거나 자리 표시가 이상해요' })
    }
    // 2) OCR 점수가 낮은 줄 (값이 들어 있는 줄만)
    const used = []
    for (const [key, s] of Object.entries(facts.src)) if (s && s.ocr) used.push({ key, line: s.line, conf: s.conf })
    for (const [k, it] of Object.entries(facts.items)) if (it.ocr && it.line != null) used.push({ key: `item:${k}`, line: it.line, conf: it.conf })
    for (const u of used) {
      if (u.conf >= OCR_MIN) continue
      const label = u.key.startsWith('item:') ? (facts.items[u.key.slice(5)]?.status === 'amount' ? `${ITEM_LABEL[u.key.slice(5)]} 금액` : '조건') : FIELD[u.key] || '읽은 글자'
      push({ id: `${side}:line:${u.line}`, kind: 'line', line: u.line, label, value: lineText(u.line).trim(), reason: '글자가 흐려서 확실히 읽지 못했어요' })
    }
    // 3) 사진·스캔에서 찾지 못한 핵심 칸
    const need = [['container', '컨테이너', "예: 40' × 1"], ['route', '구간', '예: 부산 → 로테르담']]
    if (purpose === 'reply' && side === 'a') need.push(['shipDate', '선적 시점', '예: 11월 12일 출항'])
    if ((purpose === 'renego' && side === 'b') || (purpose === 'reply' && side === 'b')) need.push(['validity', '유효기간', '예: 2026-11-30까지'])
    if (purpose !== 'reply' || side === 'b') need.push(['amount', '금액', '예: USD 1,500'])
    for (const [key, label, ph] of need) {
      const missing =
        key === 'container' ? !facts.container : key === 'route' ? !facts.pod : key === 'validity' ? !facts.validity : key === 'shipDate' ? !facts.shipDate : !(facts.total || Object.values(facts.items).some((i) => i.status === 'amount'))
      if (missing) push({ id: `${side}:miss:${key}`, kind: 'missing', field: key, line: null, label, value: '', placeholder: ph, reason: '사진에서 이 칸을 찾지 못했어요. 원본을 보고 넣어 주세요' })
    }
  } else if (doc.kind === 'eml' || doc.kind === 'paste') {
    // 메일 최근 본문에 같은 항목 금액이 두 개 이상
    for (const [k, it] of Object.entries(facts.items)) {
      if (it.alts?.length) {
        push({ id: `${side}:dup:${k}`, kind: 'line', line: it.line, label: `${ITEM_LABEL[k]} 금액`, value: lineText(it.line).trim(), reason: `최근 메일 안에 ${ITEM_LABEL[k]} 금액이 두 개 있어요 (${[it.amount, ...it.alts].map((v) => v.toLocaleString('en-US')).join(' / ')}). 맞는 줄만 남겨 주세요` })
      }
    }
  }
  return out
}

const MISS_PREFIX = { container: '컨테이너', route: '구간', shipDate: '선적 출항', validity: '유효기간', amount: '금액' }

// 고친 값을 서류 줄에 반영한 새 서류
export function applyCorrections(doc, checks, values) {
  const lines = doc.lines.map((l) => ({ ...l }))
  const extra = []
  for (const c of checks) {
    const v = values[c.id]
    if (v === undefined) continue
    const val = String(v).trim()
    if (c.kind === 'amount') {
      if (val && val !== c.token && lines[c.line]) {
        lines[c.line].text = lines[c.line].text.replace(c.token, ` ${val} `)
        lines[c.line].conf = 100
        lines[c.line].edited = true
      }
    } else if (c.kind === 'line') {
      if (lines[c.line]) {
        if (val !== lines[c.line].text.trim()) lines[c.line].edited = true
        lines[c.line].text = val
        lines[c.line].conf = 100
      }
    } else if (c.kind === 'missing' && val) {
      let text = `${MISS_PREFIX[c.field]}: ${val}`
      if (c.field === 'validity' && !/까지|valid|~/.test(val)) text = `유효기간: ${val} 까지`
      if (c.field === 'amount' && !/usd|원|krw|\$/i.test(val)) text = `금액: USD ${val}`
      if (c.field === 'container' && !/['"]|ft|피트/i.test(val)) text = `컨테이너: ${val.replace(/^(\d{2})/, "$1'")}`
      extra.push({ text, conf: 100, ocr: true, edited: true })
    }
  }
  return { ...doc, lines: [...lines, ...extra] }
}

export function refacts(doc) {
  return extractFacts(doc)
}
