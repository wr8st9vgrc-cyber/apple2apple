import { PURPOSES } from '../lib/judge.js'

const PAIRS = {
  increase: '지난 견적 ↔ 새 운임',
  reply: '화주 요청 ↔ 선사 운임',
  renego: '우리 견적 ↔ 다른 포워더 견적',
}

export default function Start({ onPick }) {
  return (
    <>
      <section className="a2a-hero">
        <img src="/a2a-mark-white.svg" alt="" />
        <h1>챗봇에 넣기 전에, 사과는 사과끼리.</h1>
        <p>두 서류의 기준을 맞추고, 비교해도 되는지 먼저 판정해요</p>
      </section>
      <main className="a2a-main a2a-start-main">
        <div className="a2a-start">
          {Object.entries(PURPOSES).map(([id, p]) => (
            <div
              key={id}
              className="a2a-card a2a-card--link a2a-usecase"
              tabIndex={0}
              role="button"
              onClick={() => onPick(id, false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target === e.currentTarget) onPick(id, false)
              }}
            >
              <h3 className="a2a-usecase__title">
                {p.title}
                <span aria-hidden="true">→</span>
              </h3>
              <p className="a2a-usecase__pair">{PAIRS[id]}</p>
              {id === 'increase' && <p className="a2a-usecase__scene">“1,800달러와 1,700달러, 같은 사과일까?”</p>}
              <button
                className="a2a-btn a2a-btn--sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onPick(id, true)
                }}
              >
                예시로 해 보기
              </button>
            </div>
          ))}
        </div>
        <p className="a2a-start-note">예시 서류의 회사·사람 이름과 숫자는 모두 가상이에요</p>
      </main>
    </>
  )
}
