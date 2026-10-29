// 양팔저울 (디자인 시스템 Scale). 기둥은 고정, 막대는 받침점 둘레로 회전, 접시는 막대 끝을 따라 위아래로만.
import P from '../assets/scaleParts.js'

const PIVOT = { x: 770, y: 315 }
const ENDS = { left: 428, right: 1107 }

function panOffset(x, deg) {
  const r = (deg * Math.PI) / 180
  const dx = x - PIVOT.x
  return { x: dx * Math.cos(r) - dx, y: dx * Math.sin(r) }
}

export default function Scale({ left, right, leftLabel = '기준', rightLabel = '비교할 것' }) {
  const deg = left && !right ? -5 : right && !left ? 5 : 0
  const l = panOffset(ENDS.left, deg)
  const r = panOffset(ENDS.right, deg)
  const ready = left && right
  const label = ready ? '양팔저울: 두 접시에 사과가 올라가 수평이에요. 준비 완료' : left ? '양팔저울: 기준 접시에 사과가 올라가 기울었어요' : right ? '양팔저울: 비교할 것 접시에 사과가 올라가 기울었어요' : '양팔저울: 두 접시가 비어 있어요'
  return (
    <svg className="a2a-scale" viewBox="250 118 1040 680" role="img" aria-label={label}>
      <path className="part" fillRule="evenodd" d={P.post} />
      <path className="part beam" fillRule="evenodd" style={{ transform: `rotate(${deg}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }} d={P.beam} />
      <g className="pan" style={{ transform: `translate(${l.x}px, ${l.y}px)` }}>
        <path className="part" fillRule="evenodd" d={P.panL} />
        {left && <path className="apple" transform={P.appleL} d={P.apple} />}
        <text className="label" x="428" y="720" textAnchor="middle">
          {leftLabel}
        </text>
      </g>
      <g className="pan" style={{ transform: `translate(${r.x}px, ${r.y}px)` }}>
        <path className="part" fillRule="evenodd" d={P.panR} />
        {right && <path className="apple" transform={P.appleR} d={P.apple} />}
        <text className="label" x="1107" y="720" textAnchor="middle">
          {rightLabel}
        </text>
      </g>
      {ready && (
        <>
          <rect className="ready" x="680" y="128" width="180" height="52" rx="26" />
          <text className="ready-text" x="770" y="162" textAnchor="middle">
            준비 완료!
          </text>
        </>
      )}
    </svg>
  )
}
