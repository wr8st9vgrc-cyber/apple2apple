// 챗봇용 블록 (F6): 정렬된 표·판정·계산 결과·프롬프트를 글 한 덩어리로.
// 노션 3.4 2-2 예시를 틀로 쓴다. 판정에 따라 규칙 줄이 붙는다.
import { PURPOSES, fmtMoneyWord, fmtPct, fmt } from './judge.js'

const JUDGE_TEXT = {
  ok: '🍎🍎 비교 가능',
  cond: '🍎🍏 조건부',
  nocomp: '🍎🍊 비교 불가',
  na: '대상 아님',
  sum: '합계에서 비교',
}

export function judgeText(r) {
  let t = JUDGE_TEXT[r.judge] || ''
  if (r.byUser === 'input') t += ' (조건부 → 값 입력)'
  if (r.byUser === 'unknown') t = '🍎🍊 비교 불가 (조건부 → 모르겠어요)'
  if (r.judge === 'na' && r.id === 'validity') t = '대상 아님(이번 비교 대상)'
  return t
}

export function buildBlock({ purpose, names, rows, calc }) {
  const P = PURPOSES[purpose]
  const [nA, nB] = names
  const L = []
  const nocomp = rows.filter((r) => r.judge === 'nocomp' && r.group !== 'total')
  const basis = calc.basisLabel ? `'${calc.basisLabel}'` : '같은'

  L.push('■ 할 일')
  L.push('아래 표와 계산 결과를 보고 두 가지를 따로 써 주세요.')
  L.push(
    purpose === 'increase'
      ? '1) 화주에게 보낼 운임 변동 안내 메일'
      : purpose === 'reply'
        ? '1) 화주에게 보낼 견적 회신 메일'
        : '1) 화주에게 보낼 재협상 답변 메일',
  )
  L.push('2) 담당자만 볼 메모')
  L.push('')
  L.push('■ 규칙')
  L.push("- 금액은 '계산 결과'의 숫자만 쓰세요. 새로 계산하지 마세요.")
  if (purpose === 'increase') {
    if (calc.diff != null) L.push(`- 비교는 ${basis} 기준으로만 말하세요.`)
    L.push('- 메일의 인상 이유는 표에 있는 차이(항목·기준)로만 설명하세요.')
    L.push('  표에 없는 원인은 쓰지 말고 "세부 요인은 선사 확인 후 안내드리겠습니다"로 쓰세요.')
    L.push(`- ${nB} 금액은 우리 원가이니 메일에 쓰지 마세요.`)
  } else if (purpose === 'reply') {
    L.push("- 화주에게는 '계산 결과'의 합계만 견적 금액으로 쓰세요. 선사 운임(우리 원가)과 우리 수수료는 따로 밝히지 마세요.")
    L.push('- 표에 없는 비용이나 조건을 지어내지 마세요.')
  } else {
    L.push('- 상대 견적이 더 싸다거나 비싸다고 단정하지 말고, 표에 있는 차이(범위·포함 항목·금액)로만 말하세요.')
    L.push('- 메일에서 값을 깎겠다고 약속하지 마세요. 조정 여부는 담당자가 정해요.')
  }
  L.push("- 표에 없는 원인을 짐작했다면 메모에만 '추정'으로 적고, 어디에 확인할지 함께 적으세요.")
  L.push('  메모 내용은 메일에 넣지 마세요.')
  if (nocomp.length) {
    if (purpose === 'increase') L.push('- 🍎🍊 비교 불가 칸이 있으니 인상·인하를 단정하지 말고, 사유를 보고 "확인 후 안내드리겠습니다"로 쓰세요.')
    else if (purpose === 'reply') L.push('- 🍎🍊 비교 불가 칸은 금액을 쓰지 말고, 사유를 보고 "별도 확인 후 안내드리겠습니다"로 쓰세요.')
    else L.push('- 🍎🍊 비교 불가 칸이 있으니 총액을 맞대지 말고, 상대 견적에서 확인할 것(범위·포함 항목·유효기간)을 정중히 물어보세요.')
  }
  if (calc.judge === 'nocomp' && calc.diff == null && purpose !== 'reply') L.push('- 차이 금액은 내지 않았어요. 차이를 짐작해서 쓰지 마세요.')
  L.push('')
  L.push('■ 출력 형식')
  L.push('- 메일: 제목 한 줄과 본문을 코드 블록 하나에 담아 주세요.')
  L.push('- 메모: 코드 블록 밖에 글머리표로 써 주세요.')
  L.push('')
  L.push('■ 정렬된 표')
  L.push(`항목 | ${nA} | ${nB} | 판정`)
  for (const r of rows) {
    const a = r.a || '-'
    const b = r.b || '-'
    L.push(`${r.label} | ${a} | ${b} | ${r.group === 'total' && !JUDGE_TEXT[r.judge] ? '' : judgeText(r)}`.replace(/ \| $/, ''))
  }
  L.push('')
  L.push('■ 판정 요약')
  const condDone = rows.filter((r) => r.byUser === 'input')
  const flagged = rows.filter((r) => r.byUser || (r.judge === 'nocomp' && r.group !== 'total'))
  L.push(`- 맞출 칸 ${rows.filter((r) => r.byUser).length}개${condDone.length ? `: ${condDone.map((r) => r.label).join(', ')}는 담당자가 값을 넣어 🍎🍎 비교 가능` : ''}`)
  if (nocomp.length) for (const r of nocomp) L.push(`- 🍎🍊 ${r.label}: ${r.reason || ''}`)
  else L.push('- 🍎🍊 비교 불가 칸: 없음')
  if (rows.find((r) => r.id === 'validity' && r.judge === 'na')) L.push(`- 유효기간(${rows.find((r) => r.id === 'validity').a || '-'} ↔ ${rows.find((r) => r.id === 'validity').b || '-'}) 차이는 이번 비교 대상이라 판정하지 않음`)
  void flagged
  L.push('')
  L.push('■ 계산 결과')
  if (purpose === 'reply') {
    if (calc.b != null) {
      L.push(`- 견적 금액${nocomp.length ? '(확인된 것만)' : ''}: ${fmt(calc.b)} ${calc.base === 'KRW' ? '원' : 'USD'}${calc.bParts ? ` (${calc.bParts})` : ''}`)
    } else L.push(`- 견적 금액: 내지 않음 (${calc.reason || '확인 못 한 칸이 있음'})`)
    if (nocomp.length) L.push(`- 별도 확인: ${nocomp.map((r) => r.label).join(', ')}`)
  } else {
    if (calc.diff != null) {
      const sign = calc.diff > 0 ? '+' : calc.diff < 0 ? '-' : ''
      L.push(`- 합계: ${nA} ${fmt(calc.a)} → ${nB} ${fmt(calc.b)} ${calc.base === 'KRW' ? '원' : 'USD'}`)
      L.push(`- 합계 차이: ${sign}${fmt(Math.abs(calc.diff))} ${calc.base === 'KRW' ? '원' : 'USD'} (${fmtPct(calc.pct)})${purpose === 'renego' ? ` → ${calc.diff > 0 ? '우리가 비쌈' : calc.diff < 0 ? '우리가 쌈' : '같음'}` : ''}`)
    } else {
      L.push(`- 합계 차이: 내지 않음 (${calc.reason || '확인 못 한 칸이 있음'})`)
    }
    if (purpose === 'increase' && rows.find((r) => r.id === 'item:OF')?.judge === 'sum') L.push(`- 항목별 차이: ${nA}에 내역이 없어 합계로만 비교`)
  }
  return L.join('\n')
}

export function headlineFor(purpose, calc) {
  if (calc.headline) return calc.headline
  return PURPOSES[purpose].title
}
export { fmtMoneyWord }
