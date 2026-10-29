import { useCallback, useMemo, useState } from 'react'
import { Footer, Header, Loading } from './components/ui.jsx'
import Start from './screens/Start.jsx'
import Upload from './screens/Upload.jsx'
import ReadCheck from './screens/ReadCheck.jsx'
import TableScreen from './screens/TableScreen.jsx'
import Result from './screens/Result.jsx'
import { readDocument, warmUpOcr } from './lib/read.js'
import { extractFacts } from './lib/extract.js'
import { findChecks, applyCorrections } from './lib/checks.js'
import { judge, PURPOSES } from './lib/judge.js'
import { buildBlock } from './lib/block.js'
import { EXAMPLES } from './examples.js'

function mergeDocs(list) {
  if (list.length === 1) return list[0]
  return {
    name: list.map((d) => d.name).join(' + '),
    kind: list.map((d) => d.kind).join('+'),
    lines: list.flatMap((d) => d.lines),
    ocr: list.some((d) => d.ocr),
    attachments: list.flatMap((d) => d.attachments || []),
    date: list.find((d) => d.date)?.date || null,
    preview: list.find((d) => d.preview)?.preview || null,
  }
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function App() {
  const [screen, setScreen] = useState('start')
  const [purpose, setPurpose] = useState('increase')
  const [example, setExample] = useState(null)
  const [names, setNames] = useState(PURPOSES.increase.names)
  const [slots, setSlots] = useState({ a: [], b: [] })
  const [fee, setFee] = useState('')
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const [docs, setDocs] = useState(null)
  const [checks, setChecks] = useState([])
  const [checkValues, setCheckValues] = useState({})
  const [facts, setFacts] = useState(null)
  const [condIds, setCondIds] = useState([])
  const [inputs, setInputs] = useState({})
  const [final, setFinal] = useState(null)

  const title = PURPOSES[purpose].title

  const reset = useCallback(() => {
    setScreen('start')
    setSlots({ a: [], b: [] })
    setFee('')
    setDocs(null)
    setChecks([])
    setCheckValues({})
    setFacts(null)
    setInputs({})
    setFinal(null)
    setError('')
    setExample(null)
    window.scrollTo(0, 0)
  }, [])

  async function pick(id, useExample) {
    setPurpose(id)
    setNames(PURPOSES[id].names)
    setSlots({ a: [], b: [] })
    setFee('')
    setError('')
    setInputs({})
    setCheckValues({})
    setExample(useExample ? id : null)
    warmUpOcr()
    if (useExample) {
      setLoading({ title: '예시 서류를 불러오고 있어요' })
      try {
        const ex = EXAMPLES[id]
        const load = async (f) => {
          const res = await fetch(f.url)
          const blob = await res.blob()
          return { id: Math.random(), file: new File([blob], f.name, { type: blob.type }), name: f.name, kind: f.kind, attachments: [] }
        }
        setSlots({ a: await Promise.all(ex.a.map(load)), b: await Promise.all(ex.b.map(load)) })
        if (ex.fee) setFee(String(ex.fee))
      } catch {
        setError('예시 서류를 불러오지 못했어요. 새로고침 후 다시 해 주세요')
      }
      setLoading(null)
    }
    setScreen('upload')
    window.scrollTo(0, 0)
  }

  function enterTable(A, B) {
    const base = judge({ purpose, A, B, fee: Number(fee) || 0, inputs: {}, today: todayIso() })
    setCondIds(base.rows.filter((r) => r.judge === 'cond').map((r) => r.id))
    setInputs({})
    setFacts({ a: A, b: B })
    setScreen('table')
    window.scrollTo(0, 0)
  }

  async function readAll() {
    setError('')
    const hasPhoto = [...slots.a, ...slots.b].some((e) => e.kind === 'image' || e.kind === 'pdf')
    setLoading({ title: '서류를 읽고 있어요', sub: hasPhoto ? '사진은 조금 더 걸려요' : null })
    try {
      const read = async (entries) => mergeDocs(await Promise.all(entries.map((en) => readDocument(en))))
      const a = await read(slots.a)
      const b = await read(slots.b)
      const d = { a, b }
      setDocs(d)
      const A = extractFacts(a)
      const B = extractFacts(b)
      const ch = [...findChecks(a, A, { purpose, side: 'a' }), ...findChecks(b, B, { purpose, side: 'b' })]
      setChecks(ch)
      setCheckValues({})
      setLoading(null)
      if (ch.length) {
        setScreen('check')
        window.scrollTo(0, 0)
      } else enterTable(A, B)
    } catch (err) {
      console.error(err)
      setLoading(null)
      setError(`서류를 읽지 못했어요: ${err.message || err}`)
    }
  }

  function afterCheck() {
    const a = applyCorrections(docs.a, checks.filter((c) => c.docSide === 'a'), checkValues)
    const b = applyCorrections(docs.b, checks.filter((c) => c.docSide === 'b'), checkValues)
    enterTable(extractFacts(a), extractFacts(b))
  }

  const live = useMemo(() => {
    if (!facts) return null
    return judge({ purpose, A: facts.a, B: facts.b, fee: Number(fee) || 0, inputs, today: todayIso() })
  }, [facts, inputs, purpose, fee])

  function calculate(memos) {
    const withMemo = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, memo: memos?.[k] || v.memo || '' }]))
    const r = judge({ purpose, A: facts.a, B: facts.b, fee: Number(fee) || 0, inputs: withMemo, today: todayIso() })
    const block = buildBlock({ purpose, names, rows: r.rows, calc: r.calc })
    setFinal({ ...r, block })
    setScreen('result')
    window.scrollTo(0, 0)
  }

  const ex = example ? EXAMPLES[example] : null

  return (
    <div className="a2a-page">
      <Header onHome={reset} />
      {screen === 'start' && <Start onPick={pick} />}
      {screen === 'upload' && (
        <Upload
          purposeTitle={title}
          names={names}
          setNames={setNames}
          slots={slots}
          setSlots={setSlots}
          fee={fee}
          setFee={setFee}
          showFee={purpose === 'reply'}
          onNext={readAll}
          error={error}
          exampleNote={ex ? ex.note : null}
        />
      )}
      {screen === 'check' && docs && (
        <ReadCheck purposeTitle={title} names={names} docs={docs} checks={checks} values={checkValues} setValues={setCheckValues} onNext={afterCheck} hints={ex ? hintFor(ex.checkHints, checks) : {}} />
      )}
      {screen === 'table' && live && (
        <TableScreen purposeTitle={title} names={names} rows={live.rows} condIds={condIds} inputs={inputs} setInputs={setInputs} onCalc={calculate} hints={ex ? ex.tableHints : {}} />
      )}
      {screen === 'result' && final && <Result purpose={purpose} purposeTitle={title} names={names} rows={final.rows} calc={final.calc} block={final.block} onRestart={reset} />}
      <Footer />
      {loading && <Loading title={loading.title} sub={loading.sub} />}
    </div>
  )
}

function hintFor(map = {}, checks) {
  const out = {}
  for (const c of checks) {
    const key = c.kind === 'missing' ? `${c.docSide}:miss:${c.field}` : c.kind === 'amount' ? `${c.docSide}:amount` : `${c.docSide}:line`
    if (map[key]) out[c.id] = map[key]
  }
  return out
}
