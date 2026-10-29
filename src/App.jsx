const PURPOSES = [
  { id: 'increase', title: '인상 이유 설명', desc: '지난 견적 ↔ 새 운임' },
  { id: 'reply', title: '견적 회신', desc: '화주 요청 ↔ 선사 운임' },
  { id: 'renego', title: '재협상 답변', desc: '우리 견적 ↔ 다른 포워더 견적' },
]

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <span className="brand">애플투애플</span>
      </header>

      <main className="main">
        <h1 className="title">무엇을 비교할까요?</h1>
        <div className="purposes">
          {PURPOSES.map((p) => (
            <button key={p.id} className="card" type="button" disabled>
              <span className="card-title">{p.title}</span>
              <span className="card-desc">{p.desc}</span>
            </button>
          ))}
        </div>
        <p className="note">화면을 만드는 중이에요.</p>
      </main>

      <footer className="footer">
        판정은 규칙, 계산은 코드가 해요 · 사진 읽기: Tesseract.js (Apache-2.0)
      </footer>
    </div>
  )
}
