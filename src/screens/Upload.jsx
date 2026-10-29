import { useRef, useState } from 'react'
import Scale from '../components/Scale.jsx'
import { Icon, Intro, isComposing } from '../components/ui.jsx'
import { fileKind } from '../lib/read.js'

const KIND_TAG = { eml: '메일 파일', xlsx: '엑셀', pdf: 'PDF', image: '사진' }
let nextId = 1

async function emlAttachments(file) {
  try {
    const PostalMime = (await import('postal-mime')).default
    const mail = await PostalMime.parse(await file.arrayBuffer())
    return (mail.attachments || []).filter((a) => a.filename).map((a) => a.filename)
  } catch {
    return []
  }
}

function Slot({ side, name, onRename, entries, setEntries, example }) {
  const [editing, setEditing] = useState(false)
  const [over, setOver] = useState(false)
  const [warn, setWarn] = useState('')
  const inputRef = useRef(null)

  async function addFiles(list) {
    setWarn('')
    const add = []
    for (const f of list) {
      const k = fileKind(f)
      if (k === 'msg') {
        setWarn('Outlook 메일(.msg)은 아직 못 읽어요. eml로 저장하거나 본문을 붙여 넣어 주세요')
        continue
      }
      if (k === 'heic') {
        setWarn('아이폰 사진(HEIC)은 JPG로 바꿔서 올려 주세요 (사진 앱에서 공유 → 파일로 저장하면 JPG로 받을 수 있어요)')
        continue
      }
      if (k === 'unknown') {
        setWarn(`'${f.name}'은 읽을 수 없는 형식이에요. 엑셀·PDF·사진·메일 파일(.eml)을 올려 주세요`)
        continue
      }
      const atts = k === 'eml' ? await emlAttachments(f) : []
      add.push({ id: nextId++, file: f, name: f.name, kind: k, attachments: atts })
    }
    if (add.length) setEntries((cur) => [...cur, ...add])
  }

  function onPaste(e) {
    const files = [...(e.clipboardData?.files || [])]
    if (files.length) {
      e.preventDefault()
      addFiles(files)
      return
    }
    const text = e.clipboardData?.getData('text/plain')
    if (text && text.trim()) {
      e.preventDefault()
      setEntries((cur) => [...cur, { id: nextId++, pasted: text, name: '붙여 넣은 글', kind: 'paste', attachments: [] }])
    }
  }

  const filled = entries.length > 0
  const attCount = entries.reduce((s, e) => s + (e.attachments?.length || 0), 0)
  const hasAttachmentFile = entries.length > 1

  return (
    <div className="a2a-slot">
      <div className="a2a-slot__name">
        {editing ? (
          <>
            <input
              autoFocus
              value={name}
              aria-label="칸 이름"
              onChange={(e) => onRename(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isComposing(e)) setEditing(false)
              }}
            />
            <span className="a2a-slot__hint">고친 이름이 표·엑셀·블록에 그대로 들어가요. 회사명·사람 이름은 쓰지 마세요</span>
          </>
        ) : (
          <>
            {name}
            <span className="a2a-tag">{side === 'a' ? '기준' : '비교할 것'}</span>
            <button className="a2a-why" type="button" aria-label="칸 이름 고치기" onClick={() => setEditing(true)}>
              <Icon name="edit" />
            </button>
          </>
        )}
      </div>
      <div
        className={`a2a-drop ${filled ? 'a2a-drop--filled' : ''} ${over ? 'is-over' : ''}`}
        tabIndex={0}
        role="button"
        aria-label={`${name} 칸: 파일을 끌어 놓거나 눌러서 고르고, Ctrl+V로 메일 본문을 붙여 넣을 수 있어요`}
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          addFiles([...e.dataTransfer.files])
        }}
        onClick={(e) => {
          if (e.target.closest('button')) return
          if (!filled) inputRef.current?.click()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget && !filled) inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".xlsx,.pdf,.eml,.msg,.jpg,.jpeg,.png,.webp,.heic,image/*"
          onChange={(e) => {
            addFiles([...e.target.files])
            e.target.value = ''
          }}
        />
        {!filled ? (
          <>
            <span className="a2a-drop__title">파일을 끌어 놓아 주세요</span>
            <span className="a2a-drop__sub">엑셀 · PDF · 사진 · 메일 파일(.eml)</span>
            <button className="a2a-btn a2a-btn--sm" type="button" onClick={() => inputRef.current?.click()} style={{ marginTop: 8 }}>
              파일 선택
            </button>
            <span className="a2a-slot__hint" style={{ marginTop: 8 }}>
              칸을 누르고 Ctrl+V로 메일 본문을 붙여 넣을 수도 있어요
            </span>
          </>
        ) : (
          <div className="a2a-slot__files">
            {entries.map((en) =>
              en.kind === 'paste' ? (
                <div key={en.id} className="a2a-file" style={{ alignItems: 'flex-start' }}>
                  <span className="a2a-file__meta" style={{ flex: 1 }}>
                    <span className="a2a-tag">붙여 넣은 글</span>
                    <p className="a2a-paste">{en.pasted.trim()}</p>
                    <span className="a2a-file__note">가장 최근 메일 본문만 읽어요</span>
                  </span>
                  <button className="a2a-file__remove" type="button" onClick={() => setEntries((c) => c.filter((x) => x.id !== en.id))}>
                    빼기
                  </button>
                </div>
              ) : (
                <div key={en.id} className="a2a-file">
                  <span className="a2a-file__icon">
                    <Icon name={en.kind === 'eml' ? 'attach' : en.kind === 'image' ? 'photo' : 'sheet'} />
                  </span>
                  <span className="a2a-file__meta">
                    <span className="a2a-tag">{KIND_TAG[en.kind]}</span>
                    <span className="a2a-file__name">{en.name}</span>
                    {en.kind === 'eml' && <span className="a2a-file__note">가장 최근 메일 본문만 읽어요</span>}
                    {en.kind === 'image' && <span className="a2a-file__note">사진은 읽는 데 조금 더 걸려요</span>}
                  </span>
                  <button className="a2a-file__remove" type="button" onClick={() => setEntries((c) => c.filter((x) => x.id !== en.id))}>
                    빼기
                  </button>
                </div>
              ),
            )}
            {attCount > 0 && !hasAttachmentFile && (
              <div className="a2a-notice">
                <Icon name="attach" />첨부 {attCount}개는 따로 끌어 놓아 주세요
              </div>
            )}
            <button className="a2a-btn a2a-btn--sm a2a-drop__add" type="button" onClick={() => inputRef.current?.click()}>
              파일 더 넣기
            </button>
          </div>
        )}
      </div>
      {warn && <div className="a2a-notice a2a-notice--warn">{warn}</div>}
      {example && <span className="a2a-hint-ex">{example}</span>}
    </div>
  )
}

export default function Upload({ purposeTitle, names, setNames, slots, setSlots, fee, setFee, showFee, onNext, error, exampleNote }) {
  const ready = slots.a.length > 0 && slots.b.length > 0
  return (
    <main className="a2a-main">
      <Intro use={purposeTitle} title="비교할 서류를 올려 주세요" why="기준 칸과 비교할 것 칸에 서류를 하나씩 올리면 저울이 수평이 돼요" />
      {exampleNote && <div className="a2a-notice">{exampleNote}</div>}
      <div className="a2a-upload">
        <div className="a2a-scale-wrap">
          <Scale left={slots.a.length > 0} right={slots.b.length > 0} />
        </div>
        <div className="a2a-slots">
          <Slot side="a" name={names[0]} onRename={(v) => setNames([v, names[1]])} entries={slots.a} setEntries={(f) => setSlots((s) => ({ ...s, a: typeof f === 'function' ? f(s.a) : f }))} />
          <Slot side="b" name={names[1]} onRename={(v) => setNames([names[0], v])} entries={slots.b} setEntries={(f) => setSlots((s) => ({ ...s, b: typeof f === 'function' ? f(s.b) : f }))} />
        </div>
        {showFee && (
          <div className="a2a-fee">
            <label htmlFor="fee">우리 수수료</label>
            <div className="a2a-field">
              <input id="fee" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ''))} placeholder="예: 50" />
              <span className="a2a-field__unit">USD</span>
            </div>
            <span className="a2a-slot__hint">견적 금액에 더해요. 화주에게는 따로 밝히지 않아요</span>
          </div>
        )}
      </div>
      {error && <div className="a2a-error">{error}</div>}
      <div className="a2a-actions">
        {!ready && <span className="a2a-actions__why">두 칸을 다 채우면 다음으로 갈 수 있어요</span>}
        <button className="a2a-btn a2a-btn--primary" type="button" disabled={!ready} onClick={onNext}>
          다음
        </button>
      </div>
    </main>
  )
}
