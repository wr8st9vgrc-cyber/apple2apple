// 읽은 글자에서 조건·금액을 꺼낸다 (F3 정렬 · 표기 맞추기의 앞 단계).
// 규칙과 사전만 쓰고, 계산·판정은 하지 않는다.
import { ITEMS, PORTS, INCLUDED, EXCLUDED, PER_TARIFF, TBA, NA, DOOR } from './dict.js'

export const OCR_MIN = 70 // OCR 의심 칸 기준 점수 (2단계에서 보정)

// ---------------- 글자 다듬기 ----------------
// OCR이 한글 글자 사이에 넣는 빈칸을 없앤다: '가 온 테 라' → '가온테라'
export function tidy(s) {
  let t = String(s || '').normalize('NFC')
  // 한 글자짜리 한글이 빈칸을 두고 이어지면 한 낱말로 붙인다 ('서 류 비 등' → '서류비등', '서류비 등'은 그대로)
  const toks = t.split(/( +)/)
  const out = []
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i]
    if (/^[가-힣]$/.test(tok) && / +/.test(toks[i + 1] || '') && /^[가-힣]$/.test(toks[i + 2] || '')) {
      let w = tok
      while (/ +/.test(toks[i + 1] || '') && /^[가-힣]$/.test(toks[i + 2] || '')) {
        w += toks[i + 2]
        i += 2
      }
      out.push(w)
    } else out.push(tok)
  }
  t = out.join('')
  t = t.replace(/[‘’`´＇]/g, "'").replace(/[“”]/g, '"').replace(/[–—‒−]/g, '-').replace(/[×✕]/g, '×')
  return t
}
const compact = (s) => tidy(s).toLowerCase().replace(/[\s()[\]{}.,:;|·_]/g, '')

// ---------------- 날짜 ----------------
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => (y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null)

export function findDates(line, defaultYear = 2026) {
  const s = tidy(line)
  const out = []
  let m
  const re1 = /(20\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/g
  while ((m = re1.exec(s))) out.push({ d: iso(+m[1], +m[2], +m[3]), i: m.index, len: m[0].length })
  // '~ 11-30' 처럼 연도 없이 이어지는 날짜
  const re2 = /~\s*(\d{1,2})\s*[-./]\s*(\d{1,2})(?![\d])/g
  while ((m = re2.exec(s))) {
    if (out.some((o) => m.index >= o.i && m.index < o.i + o.len)) continue
    const y = out.length ? +out[out.length - 1].d.slice(0, 4) : defaultYear
    out.push({ d: iso(y, +m[1], +m[2]), i: m.index, len: m[0].length })
  }
  // 'Oct 1 - Oct 31, 2026', 'Oct 31, 2026'
  const re3 = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*,?\s*(20\d{2}))?/gi
  const eng = []
  while ((m = re3.exec(s))) eng.push({ mo: MON[m[1].toLowerCase()], day: +m[2], y: m[3] ? +m[3] : null, i: m.index, len: m[0].length })
  const yEng = eng.find((e) => e.y)?.y || defaultYear
  for (const e of eng) out.push({ d: iso(e.y || yEng, e.mo, e.day), i: e.i, len: e.len })
  // '11월 3일', '2026년 11월 3일'
  const re4 = /(?:(20\d{2})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g
  while ((m = re4.exec(s))) out.push({ d: iso(m[1] ? +m[1] : defaultYear, +m[2], +m[3]), i: m.index, len: m[0].length })
  return out.filter((o) => o.d).sort((a, b) => a.i - b.i)
}

// '11월 둘째 주' → 그 주 일~토
const WEEK = { 첫째: 1, 첫: 1, 둘째: 2, 셋째: 3, 넷째: 4, 다섯째: 5 }
function weekOfMonth(line, year = 2026) {
  const m = tidy(line).match(/(\d{1,2})\s*월\s*(첫째|첫|둘째|셋째|넷째|다섯째)\s*주/)
  if (!m) return null
  const mo = +m[1]
  const first = new Date(Date.UTC(year, mo - 1, 1))
  const start = new Date(first)
  start.setUTCDate(1 + (WEEK[m[2]] - 1) * 7 - first.getUTCDay())
  if (start.getUTCMonth() !== mo - 1) start.setUTCDate(1)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const f = (d) => d.toISOString().slice(0, 10)
  return { from: f(start), to: f(end), raw: m[0], label: `${mo}월 ${m[2]} 주` }
}

// ---------------- 금액 ----------------
function stripNoise(s) {
  return s
    .replace(/(20\d{2})\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}/g, ' ')
    .replace(/~\s*\d{1,2}\s*[-./]\s*\d{1,2}/g, ' ')
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}\s*,?\s*)?20\d{2}\b/gi, ' ')
    .replace(/20\d{2}\s*년/g, ' ')
    .replace(/\b\d{2,4}-\d{3,4}-\d{4}\b/g, ' ') // 전화
    .replace(/\b[A-Z]{1,3}-\d{4}-\d{2,4}\b/gi, ' ') // 문서 번호
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/p\.\s*\d\/\d/gi, ' ')
    .replace(/\b(20|40|45)\s*(?:'|"|ft|피트|hc)\s*(?:hc)?/gi, ' ') // 컨테이너 규격
    .replace(/(?:[x×*]\s*\d{1,2}|\d{1,2}\s*대)(?!\d)/gi, ' ') // 수량
    .replace(/\(\s*\+?\d+(\.\d+)?%\s*\)|\d+(\.\d+)?%/g, ' ')
    .replace(/\d+\s*(?:days?|일|plt|kg|pallets?)\b/gi, ' ')
}

export function normCurrency(s) {
  return s.replace(/\bu\s?s\s?[dbpo]\b|\bu\s?s\s?d|\busd|\bus\$/gi, ' USD ').replace(/₩|\bkrw\b/gi, ' KRW ')
}

// 숫자 하나를 읽고, OCR로 잘못 읽었을 수 있는 모양이면 malformed를 붙인다
function parseNumberToken(tok) {
  let malformed = false
  let t = tok.trim()
  if (/[OoIlCS]/.test(t)) {
    malformed = true
    t = t.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/[CS]/g, '')
  }
  t = t.replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    malformed = true // 쉼표 자리에 점
    t = t.replace(/\./g, '')
  } else if (/^\d+\.\d{4,}$/.test(t)) {
    malformed = true
    t = t.replace(/\./g, '')
  }
  if (/,/.test(t) && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) malformed = true
  t = t.replace(/,/g, '')
  const v = Number(t)
  if (!isFinite(v)) return null
  return { value: v, malformed }
}

export function findAmounts(line) {
  let s = normCurrency(stripNoise(tidy(line)))
  // 'U S D 1 8 0 0' → 1800, '1 500' → 1500
  s = s.replace(/\b(\d)((?: \d){2,})\b/g, (m) => m.replace(/ /g, ''))
  s = s.replace(/\b(\d{1,3})((?: \d{3})+)\b/g, (m) => m.replace(/ /g, ','))
  const out = []
  const re = /(USD|KRW|\$)?[\s|]*([OoIlCS]?\d[\dOoIl.,]*\d|\d)\s*(원|USD|KRW)?/g
  let m
  while ((m = re.exec(s))) {
    const p = parseNumberToken(m[2])
    if (!p) continue
    let cur = m[1] || m[3] || null
    if (cur === '$') cur = 'USD'
    if (cur === '원') cur = 'KRW'
    out.push({ ...p, currency: cur, raw: m[0].trim(), i: m.index })
  }
  return out.filter((a) => a.value >= 10 || a.currency)
}

// ---------------- 항목·항구 찾기 ----------------
export function findItems(line) {
  const c = compact(line)
  let masked = c
  const out = []
  for (const it of ITEMS) {
    for (const w of it.words) {
      const ww = w.replace(/\s/g, '')
      let idx = masked.indexOf(ww)
      if (ww === 'doc' && idx >= 0 && /docu/.test(masked.slice(idx, idx + 5))) idx = -1
      if (ww === 'freight' && idx >= 0 && /freightquotation|freightforward/.test(masked.slice(idx))) idx = -1
      if (idx >= 0) {
        out.push({ key: it.key, i: idx })
        masked = masked.slice(0, idx) + '#'.repeat(ww.length) + masked.slice(idx + ww.length)
        break
      }
    }
  }
  return out.sort((a, b) => a.i - b.i)
}

export function findPorts(line) {
  const low = tidy(line).toLowerCase()
  const c = low.replace(/\s+/g, '')
  const out = []
  for (const p of PORTS) {
    let best = -1
    for (const w of p.words) {
      let idx
      if (w.length <= 3) {
        const m = low.match(new RegExp(`(^|[^a-z])${w}([^a-z]|$)`))
        idx = m ? m.index : -1
        if (idx >= 0) idx = c.indexOf(w, Math.max(0, idx - 3))
      } else {
        idx = c.indexOf(w)
        if (idx < 0 && w.length >= 8 && /^[a-z]+$/.test(w)) idx = c.indexOf(w.slice(0, 7))
      }
      if (idx >= 0 && (best < 0 || idx < best)) best = idx
    }
    if (best >= 0) out.push({ code: p.code, i: best })
  }
  return out.sort((a, b) => a.i - b.i)
}

// 줄에서 항목 이름이 나온 자리부터 자른다 (항목 앞의 숫자는 그 항목 금액이 아니다)
function sliceFromItem(line, key) {
  const it = ITEMS.find((x) => x.key === key)
  const t = tidy(line)
  let best = -1
  for (const w of it.words) {
    const re = new RegExp(w.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('\\s*'), 'i')
    const m = t.match(re)
    if (m && (best < 0 || m.index < best)) best = m.index
  }
  return best >= 0 ? t.slice(best) : t
}

// ---------------- 컨테이너 ----------------
export function findContainer(line) {
  const s = tidy(line)
  const re = /\b(20|40|45)\s*(?:'|"|ft|피트|ft\.)?\s*(hc|HC|하이큐브)?\s*(?:(?:[x×*X]\s*(\d{1,2}))|(\d{1,2})\s*대)?/g
  let m
  while ((m = re.exec(s))) {
    const hasMark = /['"]|ft|피트|hc/i.test(m[0]) || m[4]
    if (!hasMark) continue
    const size = m[1] + (m[2] ? 'HC' : '')
    let qty = m[3] ? +m[3] : m[4] ? +m[4] : null
    if (qty && qty > 20) qty = null
    return { size, qty, raw: m[0].trim() }
  }
  return null
}
export const containerText = (c) => (c ? `${c.size === '40HC' ? "40'HC" : c.size + "'"}${c.qty ? ` × ${c.qty}` : ''}` : '')

// ---------------- 서비스 범위 ----------------
function findScope(lines) {
  let origin = null
  let dest = null
  let raw = ''
  for (const l of lines) {
    const t = tidy(l.text)
    const low = t.toLowerCase()
    if (/door\s*-\s*cy|공장\s*상차|상차부터|공장.*→.*항/i.test(t)) {
      origin = 'door'
      dest = dest || 'port'
      raw = raw || t
    }
    if (/cy\s*-\s*door|문\s*앞까지|공장\s*문\s*앞|도착지\s*공장|to\s*door|door\s*delivery/i.test(t)) {
      dest = 'door'
      raw = raw || t
    }
    if (/\bcy\b|cy\s*[-/]\s*cy|port\s*\(?cy\)?|항구|부산항|\bport\b/i.test(low) && !/door/i.test(low)) {
      origin = origin || 'port'
      if (!/문\s*앞/.test(t)) dest = dest || 'port'
      raw = raw || t
    }
  }
  if (!origin && !dest) return null
  return { origin: origin || 'port', dest: dest || 'port', raw }
}
export const scopeText = (s) => (!s ? '' : s.origin === 'door' && s.dest === 'port' ? '공장(문 앞) → 항구' : s.dest === 'door' ? (s.origin === 'door' ? '문 앞 → 문 앞' : '항구 → 문 앞') : '항구–항구')

// ---------------- 표(운임표) ----------------
function splitCells(text) {
  return tidy(text).split(/\s*\|\s*/).map((c) => c.trim())
}
function parseRateTable(lines) {
  for (let h = 0; h < lines.length; h++) {
    const head = splitCells(lines[h].text)
    if (head.length < 3) continue
    const lower = head.map((c) => c.toLowerCase())
    const podCol = lower.findIndex((c) => /^pod\b|^도착항/.test(c))
    if (podCol < 0) continue
    const sizeCols = {}
    const thcCols = {}
    let ofCol = -1
    let thcCol = -1
    let eqCol = -1
    let validCol = -1
    let termCol = -1
    let remarkCol = -1
    lower.forEach((c, i) => {
      const sz = c.match(/^(?:(thc)\s*)?(20|40|45)\s*'?\s*(hc)?$/)
      if (sz) {
        const key = sz[2] + (sz[3] ? 'HC' : '')
        if (sz[1]) thcCols[key] = i
        else sizeCols[key] = i
      } else if (/^o\/f|^ocean freight|^해상운임/.test(c)) ofCol = i
      else if (/^thc$/.test(c)) thcCol = i
      else if (/^equipment|^컨테이너|^cntr/.test(c)) eqCol = i
      else if (/^valid|^유효/.test(c)) validCol = i
      else if (/^term|^조건/.test(c)) termCol = i
      else if (/^remark|^비고/.test(c)) remarkCol = i
    })
    if (!Object.keys(sizeCols).length && ofCol < 0) continue
    const rows = []
    for (let r = h + 1; r < lines.length; r++) {
      const cells = splitCells(lines[r].text)
      if (cells.length < 3) continue
      const ports = findPorts(cells[podCol] || '')
      const pod = ports.find((p) => p.code !== 'KRPUS')
      if (!pod) continue
      const rates = {}
      const num = (v) => {
        if (v === undefined) return undefined
        if (NA.test(v) || /^-$/.test(v)) return 'N/A'
        const a = findAmounts(v)[0]
        return a ? a.value : v ? v : undefined
      }
      for (const [k, i] of Object.entries(sizeCols)) rates[k] = num(cells[i])
      if (ofCol >= 0) {
        const eq = eqCol >= 0 ? findContainer(cells[eqCol]) : null
        rates[eq ? eq.size : '40'] = num(cells[ofCol])
      }
      const thc = {}
      for (const [k, i] of Object.entries(thcCols)) thc[k] = num(cells[i])
      rows.push({
        pod: pod.code,
        rates,
        thc,
        thcText: thcCol >= 0 ? cells[thcCol] : '',
        term: termCol >= 0 ? cells[termCol] : '',
        validity: validCol >= 0 ? cells[validCol] : '',
        remark: remarkCol >= 0 ? cells[remarkCol] : '',
        line: r,
      })
    }
    if (rows.length) return { header: h, rows, sizes: Object.keys(sizeCols) }
  }
  return null
}

// ---------------- 한 줄 해석 ----------------
function statusOf(seg) {
  if (TBA.test(seg)) return 'tba'
  if (PER_TARIFF.test(seg)) return 'tariff'
  if (NA.test(seg)) return 'na'
  if (EXCLUDED.test(seg)) return 'excluded'
  if (INCLUDED.test(seg)) return 'included'
  return null
}

// '기본운임(O/F)·유류할증료(BAF) 포함, 터미널 조작료(THC)·서류비 별도' 같은 조건 문장
function readConditionClauses(text) {
  const res = []
  const t = tidy(text)
  const re = /(포함|별도|별노|불포함|incl\.?|excl\.?|included|excluded|as per (?:local )?tariff|as per monthly notice)/gi
  let last = 0
  let m
  while ((m = re.exec(t))) {
    const marker = m[1].toLowerCase()
    if (/^\s*여부/.test(t.slice(m.index + m[0].length))) {
      last = m.index + m[0].length
      continue
    }
    const before = t.slice(last, m.index)
    const segStart = Math.max(before.lastIndexOf(','), before.lastIndexOf('/'), before.lastIndexOf('|'), before.lastIndexOf(':'), before.lastIndexOf('('))
    const seg = before.slice(segStart + 1)
    let items = findItems(seg)
    let st = statusOf(marker)
    if (/^incl/.test(marker) || /^excl/.test(marker)) {
      // 'O/F incl. THC' → 뒤쪽 항목, 'THC excl.' → 앞쪽 항목
      const after = t.slice(m.index + m[0].length).split(/[,/|;)]/)[0]
      const afterItems = findItems(after)
      if (afterItems.length && /^incl/.test(marker)) items = afterItems
      else if (!items.length) items = afterItems
    }
    for (const it of items) res.push({ key: it.key, status: st })
    last = m.index + m[0].length
  }
  return res
}

// ---------------- 서류 하나 → 사실 ----------------
export function extractFacts(doc, opts = {}) {
  const lines = (doc.lines || []).map((l, i) => ({ ...l, text: tidy(l.text), idx: i }))
  const year = 2026
  const facts = {
    container: null,
    pol: null,
    pod: null,
    route: '',
    scope: null,
    validity: null,
    shipDate: null,
    docDate: doc.date ? new Date(doc.date).toISOString().slice(0, 10) : null,
    currency: null,
    basis: null,
    fx: null,
    items: {},
    total: null,
    main: null,
    table: null,
    requested: new Set(),
    other: [],
    src: {},
    ocr: !!doc.ocr,
    kind: doc.kind,
    attachments: doc.attachments || [],
    multiplied: false,
  }
  const src = (key, l) => {
    if (!facts.src[key]) facts.src[key] = { line: l.idx, conf: l.conf ?? 100, ocr: !!l.ocr, text: l.text }
  }
  const setItem = (key, val, l) => {
    const cur = facts.items[key]
    // 금액이 있는 정보가 상태보다 우선, 먼저 읽은 금액 유지
    if (cur && cur.status === 'amount' && val.status !== 'amount') return
    if (cur && cur.status === 'amount' && val.status === 'amount') {
      if (cur.amount !== val.amount) cur.alts = [...(cur.alts || []), val.amount]
      return
    }
    if (cur && cur.status === 'included' && val.status !== 'amount') return
    facts.items[key] = { ...val, line: l.idx, conf: l.conf ?? 100, ocr: !!l.ocr }
  }

  // 표
  facts.table = parseRateTable(lines)
  const tableLines = new Set(facts.table ? [facts.table.header, ...facts.table.rows.map((r) => r.line)] : [])

  const currencyCount = { USD: 0, KRW: 0 }
  let pendingItem = null

  for (const l of lines) {
    const t = l.text
    const low = t.toLowerCase()
    if (tableLines.has(l.idx)) continue

    // 날짜
    const dates = findDates(t, year)
    const validityLine = /유효|valid|validity|applicable|effective/i.test(t) || (/까지/.test(t) && !/화물|준비|선적|출항|보내|도착/.test(t))
    if (validityLine && dates.length) {
      if (!facts.validity) {
        facts.validity = dates.length >= 2 ? { from: dates[0].d, to: dates[dates.length - 1].d, raw: t } : /from|effective|부터/i.test(t) ? { from: dates[0].d, to: null, raw: t } : { from: null, to: dates[0].d, raw: t }
        src('validity', l)
      }
    } else if (/견적일|date|일자|요청일|issued/i.test(t) && dates.length && !facts.docDate) {
      facts.docDate = dates[0].d
    }
    if (/선적|출항|etd|shipment|부킹/i.test(t)) {
      const wk = weekOfMonth(t, year)
      if (wk && !facts.shipDate) {
        facts.shipDate = wk
        src('shipDate', l)
      } else if (dates.length && !facts.shipDate) {
        facts.shipDate = { from: dates[0].d, to: dates[0].d, raw: t }
        src('shipDate', l)
      }
    }

    // 환율
    if (/환율|환을|적용\s*환|exchange|ex\.?\s*rate|1\s*usd\s*=/i.test(t)) {
      const after = t.includes('=') ? t.slice(t.indexOf('=') + 1) : t
      const a = findAmounts(after).find((x) => x.value >= 100)
      if (a && !facts.fx) {
        facts.fx = a.value
        src('fx', l)
        if (a.malformed) facts.src.fx.malformed = true
      }
      for (const c of readConditionClauses(t)) if (c.key !== 'OF' && c.key !== 'ALLIN') setItem(c.key, { status: c.status, raw: t }, l)
      continue
    }

    // 컨테이너
    const cont = findContainer(t)
    if (cont && /컨테이너|cntr|container|equipment|물량|대 기준|ft|×|x\s*\d/i.test(t)) {
      if (!facts.container || (!facts.container.qty && cont.qty)) {
        facts.container = cont
        delete facts.src.container
        src('container', l)
      }
    } else if (cont && !facts.container && /per\s*\d|\/\s*\d/.test(t) === false) {
      facts.container = cont
      src('container', l)
    }
    if (/×\s*\d|x\s*\d/i.test(t) && findItems(t).length && /\/\s*컨|컨테이너\s*×|per\s*cntr\s*×/i.test(t)) facts.multiplied = true

    // 항구
    const ports = findPorts(t)
    if (ports.length && /구간|route|pol|pod|→|->|부산|busan|\//i.test(t)) {
      for (const p of ports) {
        if (p.code === 'KRPUS') facts.pol = facts.pol || 'KRPUS'
        else if (!facts.pod) {
          facts.pod = p.code
          facts.route = t
          src('route', l)
        }
      }
    }

    // 통화·단위
    if (/건당|per shipment|per bl\b|\/\s*bl\b|per b\/l/i.test(t) && findItems(t).some((i) => i.key === 'OF')) facts.basis = 'shipment'
    if (/건당/.test(t) && !facts.basis) facts.basis = 'shipment'
    if (/\/\s*40|per\s*40|per container|컨테이너당|\/\s*cntr|per cntr|\/\s*컨/i.test(t)) facts.basis = facts.basis || 'container'

    // 조건 문장 (포함·별도·as per)
    const clauses = readConditionClauses(t)
    for (const c of clauses) {
      if (c.key === 'OF' || c.key === 'ALLIN') continue
      setItem(c.key, { status: c.status, raw: t }, l)
    }

    // 금액
    const items = findItems(t)
    const amounts = findAmounts(t)
    for (const a of amounts) if (a.currency) currencyCount[a.currency === 'USD' ? 'USD' : 'KRW']++
    if (/\(\s*원\s*\)|금액\s*\(?원|원화|krw/i.test(t)) currencyCount.KRW += 2
    const isTotal = /합계|total|sum\b|총액/i.test(t)
    const primary = items[0]
    const lineStatus = statusOf(t.replace(/\(([^)]*)(포함|incl)[^)]*\)/gi, ''))

    if (isTotal && amounts.length) {
      const a = [...amounts].reverse().find((x) => x.currency) || amounts[amounts.length - 1]
      if (!facts.total) {
        facts.total = { amount: a.value, currency: a.currency, malformed: a.malformed, raw: t }
        src('total', l)
      }
      continue
    }
    const afterAmounts = primary ? findAmounts(sliceFromItem(t, primary.key)) : []
    // 금액이 항목 이름보다 앞에 있으면(예: 'USD 1,980 (해상운임·THC 포함)') 통화가 붙은 금액만 쓴다
    if (primary && !afterAmounts.length) {
      const cur = amounts.filter((x) => x.currency)
      if (cur.length) afterAmounts.push(cur[cur.length - 1])
    }
    if (primary) {
      if (afterAmounts.length) {
        const a = [...afterAmounts].reverse().find((x) => x.currency) || afterAmounts[afterAmounts.length - 1]
        afterAmounts.picked = a
        setItem(primary.key, { status: 'amount', amount: a.value, currency: a.currency, malformed: a.malformed, raw: t }, l)
        // 'O/F USD 1,760, THC excl.' 처럼 한 줄에 여러 항목이 있으면 다른 항목 상태도 읽는다 (조건 문장에서 처리)
        pendingItem = null
      } else if (lineStatus && lineStatus !== 'included') {
        setItem(primary.key, { status: lineStatus, raw: t }, l)
        pendingItem = null
      } else if (t.replace(/[^a-z가-힣]/gi, '').length < 24) {
        pendingItem = { key: primary.key, l, ttl: 2 }
      }
    } else if (amounts.length) {
      const a = amounts.find((x) => x.currency) || null
      if (a && pendingItem) {
        setItem(pendingItem.key, { status: 'amount', amount: a.value, currency: a.currency, malformed: a.malformed, raw: `${pendingItem.l.text} ${t}` }, l)
        pendingItem = null
      } else if (a && !facts.main) {
        facts.main = { amount: a.value, currency: a.currency, malformed: a.malformed, raw: t }
        src('main', l)
      }
    } else if (pendingItem && --pendingItem.ttl <= 0) pendingItem = null

    // 요청 (견적 회신의 화주 요청)
    if (/(도착항|도착지|목적지)\s*비용|dthc/i.test(t) && /포함|까지/.test(t)) facts.requested.add('DTHC')
  }

  if (!facts.pod) {
    for (const l of lines) {
      if (tableLines.has(l.idx)) continue
      const p = findPorts(l.text).find((x) => x.code !== 'KRPUS')
      if (p) {
        facts.pod = p.code
        facts.route = l.text
        src('route', l)
        break
      }
    }
  }
  if (!facts.pol && facts.pod && lines.some((l) => findPorts(l.text).some((p) => p.code === 'KRPUS'))) facts.pol = 'KRPUS'

  // 표에서 읽은 항목·통화
  if (facts.table) {
    const head = lines.slice(0, facts.table.header + 1).map((l) => l.text).join(' ')
    if (/usd/i.test(head) || facts.table.rows.length) currencyCount.USD++
  }
  const amtCur = Object.values(facts.items).map((i) => i.currency).concat([facts.total?.currency, facts.main?.currency]).filter(Boolean)
  for (const c of amtCur) currencyCount[c]++
  facts.currency = currencyCount.KRW > currencyCount.USD ? 'KRW' : currencyCount.USD > 0 ? 'USD' : null
  facts.scope = findScope(lines.filter((l) => !tableLines.has(l.idx)))
  if (!facts.scope && facts.table?.rows.some((r) => /cy/i.test(r.term))) facts.scope = { origin: 'port', dest: 'port', raw: 'CY/CY' }
  if (facts.scope) {
    const l = lines.find((x) => x.text === facts.scope.raw)
    if (l) src('scope', l)
  }

  // 한 줄짜리 견적(사진의 큰 금액)은 해상운임으로 본다
  if (!facts.items.OF && !facts.items.ALLIN && facts.main && opts.mainIsFreight !== false) {
    facts.items.OF = { status: 'amount', amount: facts.main.amount, currency: facts.main.currency, malformed: facts.main.malformed, raw: facts.main.raw, line: facts.src.main?.line, conf: facts.src.main?.conf, ocr: facts.src.main?.ocr }
  }
  if (!facts.total) {
    const allin = facts.items.ALLIN?.amount
    if (allin) facts.total = { amount: allin, currency: facts.items.ALLIN.currency, raw: facts.items.ALLIN.raw }
  }
  // 대수가 2대 이상이고 항목 금액을 더한 값이 합계와 같으면, 금액은 이미 대수만큼 곱해진 줄 금액이다
  const sumItems = Object.values(facts.items).filter((i) => i.status === 'amount').reduce((s, i) => s + i.amount, 0)
  if (facts.container?.qty > 1 && facts.total && Math.abs(sumItems - facts.total.amount) < 1) facts.multiplied = true
  if (facts.basis === 'shipment') facts.multiplied = true
  if (!facts.basis) facts.basis = 'container'
  return facts
}
