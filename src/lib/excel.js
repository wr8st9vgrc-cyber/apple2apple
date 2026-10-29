// 정렬된 표 엑셀 내려받기 (ExcelJS). 서식: 제목행 굵게+회색, 첫 행·첫 열 고정, 천 단위 쉼표, 판정별 연한 배경색.
import { judgeText } from './block.js'
import { PURPOSES } from './judge.js'

const FILL = { ok: 'FFFFFFFF', cond: 'FFFFF1D6', nocomp: 'FFECEEF1', na: 'FFF7F5F1', sum: 'FFF7F5F1' }

function asNumber(text) {
  const m = String(text || '').match(/^\s*([\d,]+(?:\.\d+)?)\s*(원)?\s*$/)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

export async function downloadExcel({ purpose, names, rows, calc, filename }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = '애플투애플'
  const head = (ws) => {
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E7E7' } }
      c.alignment = { vertical: 'middle' }
    })
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  }

  const s1 = wb.addWorksheet('정렬된 표')
  s1.columns = [
    { header: '항목', width: 18 },
    { header: names[0], width: 34 },
    { header: names[1], width: 40 },
    { header: '판정', width: 30 },
  ]
  for (const r of rows) {
    const a = asNumber(r.a)
    const b = asNumber(r.b)
    const row = s1.addRow([r.label, a ?? (r.a || ''), b ?? (r.b || ''), r.group === 'total' ? '' : judgeText(r)])
    for (const i of [2, 3]) {
      const c = row.getCell(i)
      if (typeof c.value === 'number') {
        c.numFmt = '#,##0'
        c.alignment = { horizontal: 'right' }
      }
    }
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[r.judge] || 'FFFFFFFF' } }
    if (r.group === 'total') row.font = { bold: true }
  }
  head(s1)

  const s2 = wb.addWorksheet('판정·계산')
  s2.columns = [
    { header: '항목', width: 18 },
    { header: '판정', width: 30 },
    { header: '사유', width: 52 },
    { header: '담당자 메모', width: 30 },
  ]
  for (const r of rows) {
    const row = s2.addRow([r.label, r.group === 'total' ? '' : judgeText(r), r.reason || r.why || r.note || '', r.memo || ''])
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[r.judge] || 'FFFFFFFF' } }
  }
  s2.addRow([])
  const cur = calc.base === 'KRW' ? '원' : 'USD'
  if (purpose === 'reply') s2.addRow(['견적 금액', calc.b != null ? calc.b : '내지 않음', cur])
  else {
    s2.addRow([`${names[0]} 합계`, calc.a ?? '', cur])
    s2.addRow([`${names[1]} 합계`, calc.b ?? '', cur])
    s2.addRow(['차이', calc.diff ?? '내지 않음', calc.diff != null ? `${cur} (${calc.pct > 0 ? '+' : ''}${calc.pct?.toFixed(1)}%)` : ''])
  }
  s2.addRow(['계산에서 뺀 칸', calc.excluded.length ? calc.excluded.map((e) => `${e.label}: ${e.reason || ''}`).join(' / ') : '없음'])
  s2.addRow(['용도', PURPOSES[purpose].title])
  s2.addRow(['만든 날짜', new Date().toISOString().slice(0, 10)])
  s2.eachRow((row, i) => {
    if (i === 1) return
    row.eachCell((c) => {
      if (typeof c.value === 'number') {
        c.numFmt = '#,##0'
        c.alignment = { horizontal: 'right' }
      }
    })
  })
  head(s2)

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function safeFilename(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim() || '애플투애플'
}
