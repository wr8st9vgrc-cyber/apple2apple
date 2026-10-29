// 서류 읽기 (F2). 모두 브라우저 안에서만 처리하고 밖으로 보내지 않는다.
// 결과: { name, kind, lines:[{text, conf, ocr}], ocr, attachments, date, preview, note }

const VENDOR = '/vendor'

// ---------------- 메일: 가장 최근 본문만 ----------------
const QUOTE_MARKERS = [
  /^-{2,}\s*Original Message\s*-{2,}/i,
  /^-{2,}\s*원본 메시지\s*-{2,}/,
  /^보낸 사람\s*:/,
  /^From\s*:/i,
  /^On .+wrote:\s*$/i,
  /님이 작성:\s*$/,
  /^>/,
]

export function latestBody(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let seenContent = false
  for (const line of lines) {
    const t = line.trim()
    if (seenContent && QUOTE_MARKERS.some((re) => re.test(t))) break
    if (t) seenContent = true
    out.push(line)
  }
  return out.join('\n').trim()
}

function textLines(text, extra = {}) {
  return String(text)
    .split('\n')
    .map((t) => t.replace(/\s+$/, ''))
    .filter((t) => t.trim())
    .map((t) => ({ text: t, conf: 100, ocr: false, ...extra }))
}

// ---------------- 엑셀 ----------------
async function readXlsx(file) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const lines = []
  wb.eachSheet((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = []
      row.eachCell({ includeEmpty: false }, (cell) => {
        let v = cell.value
        if (v && typeof v === 'object') {
          if ('result' in v) v = v.result
          else if ('richText' in v) v = v.richText.map((r) => r.text).join('')
          else if (v instanceof Date) v = v.toISOString().slice(0, 10)
          else if ('text' in v) v = v.text
        }
        if (v === null || v === undefined || v === '') return
        cells.push(String(v).trim())
      })
      // 병합 셀이 같은 값을 되풀이하면 하나만 둔다
      const uniq = cells.filter((c, i) => c !== cells[i - 1])
      if (uniq.length) lines.push({ text: uniq.join(' | '), conf: 100, ocr: false })
    })
  })
  return { kind: 'xlsx', lines }
}

// ---------------- PDF ----------------
let pdfjsPromise
async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${VENDOR}/pdfjs/pdf.worker.min.mjs`
      return m
    })
  }
  return pdfjsPromise
}

function groupItemsToLines(items) {
  const rows = []
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue
    const x = it.transform[4]
    const y = it.transform[5]
    const h = Math.abs(it.transform[3]) || 10
    let row = rows.find((r) => Math.abs(r.y - y) < h * 0.5)
    if (!row) {
      row = { y, h, items: [] }
      rows.push(row)
    }
    row.items.push({ x, w: it.width, str: it.str })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x)
    let s = ''
    let lastEnd = null
    for (const it of r.items) {
      if (lastEnd !== null) {
        const gap = it.x - lastEnd
        s += gap > r.h * 1.2 ? ' | ' : gap > r.h * 0.15 ? ' ' : ''
      }
      s += it.str
      lastEnd = it.x + it.w
    }
    return s.trim()
  })
}

async function readPdf(file, onStage) {
  const lib = await pdfjs()
  const doc = await lib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${VENDOR}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${VENDOR}/pdfjs/standard_fonts/`,
  }).promise
  const lines = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    for (const t of groupItemsToLines(tc.items)) lines.push({ text: t, conf: 100, ocr: false })
  }
  if (lines.join('').length > 20) return { kind: 'pdf-text', lines }

  // 꺼낼 글자가 없으면 스캔본: 페이지를 그림으로 그려 OCR
  onStage?.('ocr')
  const out = []
  let preview = null
  for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 2.2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vp.width)
    canvas.height = Math.round(vp.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
    if (!preview) preview = canvas.toDataURL('image/jpeg', 0.8)
    const prepared = prepareForOcr(canvas, { deskew: true })
    out.push(...(await ocrPasses([prepared.big])))
  }
  return { kind: 'pdf-scan', lines: out, ocr: true, preview }
}

// ---------------- 사진 ----------------
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => reject(new Error('사진을 열 수 없어요'))
    img.src = url
  })
}

function toCanvas(src, w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

function grayData(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const g = new Float32Array(width * height)
  for (let i = 0; i < g.length; i++) g[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114
  return { g, width, height }
}

// 기울기 찾기: 작은 흑백 그림을 돌려 가며 가로줄이 가장 또렷한 각도를 고른다
function findSkew(canvas) {
  const scale = 500 / Math.max(canvas.width, canvas.height)
  const small = toCanvas(canvas, canvas.width * scale, canvas.height * scale)
  const { g, width, height } = grayData(small)
  let mean = 0
  for (const v of g) mean += v
  mean /= g.length
  const pts = []
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (g[y * width + x] < mean - 40) pts.push([x - width / 2, y - height / 2])
  if (pts.length < 50) return 0
  let best = 0
  let bestScore = -1
  for (let a = -15; a <= 15; a += 0.5) {
    const r = (a * Math.PI) / 180
    const s = Math.sin(r)
    const c = Math.cos(r)
    const bins = new Float32Array(height * 2)
    for (const [x, y] of pts) {
      const yy = Math.round(x * s + y * c + height)
      if (yy >= 0 && yy < bins.length) bins[yy]++
    }
    let sum = 0
    let sq = 0
    for (const b of bins) {
      sum += b
      sq += b * b
    }
    const score = sq / bins.length - (sum / bins.length) ** 2
    if (score > bestScore) {
      bestScore = score
      best = a
    }
  }
  return best
}

function rotateCanvas(canvas, deg) {
  if (!deg) return canvas
  const c = document.createElement('canvas')
  c.width = canvas.width
  c.height = canvas.height
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((-deg * Math.PI) / 180)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return c
}

// 그림자·종이색을 지우고(흐린 배경으로 나누기) 흑백으로
function normalize(canvas) {
  const w = canvas.width
  const h = canvas.height
  const blurC = toCanvas(toCanvas(canvas, Math.max(8, w / 24), Math.max(8, h / 24)), w, h)
  const a = grayData(canvas)
  const b = grayData(blurC)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let i = 0; i < a.g.length; i++) {
    let v = (a.g[i] / Math.max(1, b.g[i])) * 255
    v = Math.max(0, Math.min(255, (v - 60) * 1.35))
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return out
}

// 표 선 지우기 + 잡티 지우기: 표 칸 테두리가 있으면 OCR이 줄을 통째로 놓친다
function cleanForOcr(canvas) {
  const w = canvas.width
  const h = canvas.height
  const { g } = grayData(canvas)
  const bin = new Uint8Array(w * h)
  for (let i = 0; i < bin.length; i++) bin[i] = g[i] < 150 ? 1 : 0
  const kill = new Uint8Array(w * h)
  const minH = Math.max(80, Math.round(w * 0.08))
  const minV = Math.max(60, Math.round(h * 0.035))
  for (let y = 0; y < h; y++) {
    let run = 0
    for (let x = 0; x <= w; x++) {
      const on = x < w && bin[y * w + x]
      if (on) run++
      else {
        if (run >= minH) for (let k = x - run; k < x; k++) kill[y * w + k] = 1
        run = 0
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let run = 0
    for (let y = 0; y <= h; y++) {
      const on = y < h && bin[y * w + x]
      if (on) run++
      else {
        if (run >= minV) for (let k = y - run; k < y; k++) kill[k * w + x] = 1
        run = 0
      }
    }
  }
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = bin[i] && !kill[i]
      // 선 바로 옆 1px도 지운다
      if (v && ((x > 0 && kill[i - 1]) || (x < w - 1 && kill[i + 1]) || (y > 0 && kill[i - w]) || (y < h - 1 && kill[i + w]))) v = 0
      // 잡티: 둘레 8칸 중 검은 점이 1개 이하면 지운다
      if (v && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const n = bin[i - 1] + bin[i + 1] + bin[i - w] + bin[i + w] + bin[i - w - 1] + bin[i - w + 1] + bin[i + w - 1] + bin[i + w + 1]
        if (n <= 1) v = 0
      }
      const c = v ? 0 : 255
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

export function prepareForOcr(source, { deskew = true, bigScale = 1.5, smallScale = null } = {}) {
  let base = source
  const maxSide = 2400
  const s0 = Math.min(1, maxSide / Math.max(source.width, source.height))
  if (s0 < 1) base = toCanvas(source, source.width * s0, source.height * s0)
  const angle = deskew ? findSkew(base) : 0
  const straight = rotateCanvas(base, angle)
  const norm = normalize(straight)
  const bigRaw = bigScale === 1 ? norm : toCanvas(norm, norm.width * bigScale, norm.height * bigScale)
  const big = cleanForOcr(bigRaw)
  const small = smallScale ? toCanvas(norm, norm.width * smallScale, norm.height * smallScale) : null
  return { big, small, angle }
}

let workerPromise
async function ocrWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker(['kor', 'eng'], 1, {
        workerPath: `${VENDOR}/tesseract/worker.min.js`,
        corePath: `${VENDOR}/tesseract/core`,
        langPath: `${VENDOR}/tesseract/lang`,
        gzip: true,
      }),
    )
  }
  return workerPromise
}

export function warmUpOcr() {
  ocrWorker().catch(() => {})
}

async function ocrPasses(canvases) {
  const worker = await ocrWorker()
  const lines = []
  for (const c of canvases) {
    if (!c) continue
    const { data } = await worker.recognize(c, {}, { text: true, blocks: true })
    for (const block of data.blocks || []) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          const words = (line.words || []).map((w) => ({ text: w.text, conf: w.confidence }))
          const text = words.map((w) => w.text).join(' ').trim()
          if (!text) continue
          const conf = words.length ? words.reduce((s, w) => s + w.conf, 0) / words.length : 0
          lines.push({ text, conf, words, ocr: true })
        }
      }
    }
  }
  return lines
}

async function readImage(file, onStage) {
  onStage?.('ocr')
  const { img, url } = await loadImage(file)
  const canvas = toCanvas(img, img.naturalWidth, img.naturalHeight)
  const preview = toCanvas(img, Math.min(1400, img.naturalWidth), (img.naturalHeight * Math.min(1400, img.naturalWidth)) / img.naturalWidth).toDataURL('image/jpeg', 0.85)
  URL.revokeObjectURL(url)
  // 작은 글씨용(크게)과 큰 글씨용(작게) 두 번 읽어 합친다
  const prepared = prepareForOcr(canvas, { deskew: true, bigScale: 1.5, smallScale: 0.35 })
  const lines = await ocrPasses([prepared.big, prepared.small])
  return { kind: 'image', lines, ocr: true, preview }
}

// ---------------- 메일 ----------------
async function readEml(file) {
  const PostalMime = (await import('postal-mime')).default
  const email = await PostalMime.parse(await file.arrayBuffer())
  let body = email.text
  if (!body && email.html) {
    const d = new DOMParser().parseFromString(email.html, 'text/html')
    body = d.body.innerText
  }
  const latest = latestBody(body || '')
  const attachments = (email.attachments || []).filter((a) => a.disposition !== 'inline' || a.filename).map((a) => ({ filename: a.filename || '첨부 파일' }))
  return {
    kind: 'eml',
    lines: textLines(latest),
    attachments,
    date: email.date ? new Date(email.date) : null,
    subject: email.subject || '',
    fullText: body || '',
  }
}

// ---------------- 진입점 ----------------
export function fileKind(file) {
  const n = (file.name || '').toLowerCase()
  if (n.endsWith('.msg')) return 'msg'
  if (n.endsWith('.eml')) return 'eml'
  if (n.endsWith('.xlsx')) return 'xlsx'
  if (n.endsWith('.pdf')) return 'pdf'
  if (/\.(jpe?g|png|webp|bmp|gif)$/.test(n) || (file.type || '').startsWith('image/')) return 'image'
  if (/\.(heic|heif)$/.test(n)) return 'heic'
  return 'unknown'
}

export async function readDocument(entry, onStage) {
  if (entry.pasted) {
    return { name: '붙여 넣은 글', kind: 'paste', lines: textLines(latestBody(entry.pasted)), ocr: false, attachments: [] }
  }
  const file = entry.file
  const k = fileKind(file)
  let r
  if (k === 'xlsx') r = await readXlsx(file)
  else if (k === 'pdf') r = await readPdf(file, onStage)
  else if (k === 'image') r = await readImage(file, onStage)
  else if (k === 'eml') r = await readEml(file)
  else throw new Error('읽을 수 없는 형식이에요')
  return { name: file.name, ocr: false, attachments: [], ...r }
}
