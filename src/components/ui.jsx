// 디자인 시스템 컴포넌트 (bundle.css의 a2a-… 클래스)
import { useEffect, useState } from 'react'

const S = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
const ICONS = {
  photo: (
    <>
      <path d="M3 7.2c0-.7.6-1.2 1.2-1.2h2.1l1.2-1.8h5l1.2 1.8h2.1c.7 0 1.2.5 1.2 1.2v7.6c0 .7-.5 1.2-1.2 1.2H4.2c-.6 0-1.2-.5-1.2-1.2V7.2Z" {...S} />
      <circle cx="10" cy="10.6" r="2.6" {...S} />
    </>
  ),
  edit: (
    <>
      <path d="M12.6 3.6l3.8 3.8-8.9 8.9H3.7v-3.8l8.9-8.9Z" {...S} />
      <path d="M10.6 5.6l3.8 3.8" {...S} />
    </>
  ),
  attach: <path d="M13.6 5.8 8 11.4c-.7.7-.7 1.7 0 2.3.6.6 1.6.6 2.3-.1l5.1-5.1c1.3-1.3 1.3-3.3 0-4.6-1.2-1.3-3.3-1.3-4.6 0L5.4 9.3c-1.8 1.8-1.8 4.7 0 6.5 1.8 1.8 4.7 1.8 6.5 0l4.1-4.1" {...S} />,
  info: (
    <>
      <circle cx="10" cy="10" r="7.25" {...S} />
      <path d="M8 7.9c0-1.1.9-1.9 2-1.9s2 .8 2 1.8c0 .9-.6 1.3-1.2 1.7-.5.3-.8.7-.8 1.3v.3" {...S} />
      <circle cx="10" cy="13.7" r=".9" fill="currentColor" />
    </>
  ),
  copy: (
    <>
      <rect x="7" y="7" width="9.5" height="9.5" rx="2" {...S} />
      <path d="M13 4.5v-.3c0-.7-.5-1.2-1.2-1.2H4.7c-.7 0-1.2.5-1.2 1.2v7.1c0 .7.5 1.2 1.2 1.2H5" {...S} />
    </>
  ),
  download: <path d="M10 3.5v8.5M6.5 8.8 10 12.3l3.5-3.5M3.8 13.5v1.8c0 .7.5 1.2 1.2 1.2h10c.7 0 1.2-.5 1.2-1.2v-1.8" {...S} />,
  check: <path d="M4.5 10.4 8.2 14 15.5 6.5" {...S} />,
  sheet: (
    <>
      <path d="M5.2 2.8h6.6l3.9 3.9v9.3c0 .7-.5 1.2-1.2 1.2H5.2c-.7 0-1.2-.5-1.2-1.2V4c0-.7.5-1.2 1.2-1.2Z" {...S} />
      <path d="M11.6 2.9v3.9h4M7 10h6M7 13h6M10 10v3" {...S} />
    </>
  ),
}

export function Icon({ name, label, className = '' }) {
  return (
    <svg className={`a2a-icon ${className}`} viewBox="0 0 20 20" aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined}>
      {ICONS[name]}
    </svg>
  )
}

export function Header({ onHome }) {
  return (
    <header className="a2a-header">
      <a
        className="a2a-logo"
        href="/"
        onClick={(e) => {
          e.preventDefault()
          onHome?.()
        }}
      >
        <img src="/a2a-mark-ink.svg" alt="" />
        애플투애플
      </a>
    </header>
  )
}

export function Fruits({ kind }) {
  const second = kind === 'ok' ? 'apple' : kind === 'cond' ? 'apple-o' : 'orange'
  return (
    <span className="a2a-fruits">
      <i className="a2a-fruit a2a-fruit--apple" aria-hidden="true" />
      <i className={`a2a-fruit a2a-fruit--${second}`} aria-hidden="true" />
    </span>
  )
}

export function Why({ text, label = '이유 보기' }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={`a2a-tip ${open ? 'is-open' : ''}`}>
      <button className="a2a-why" type="button" aria-label={label} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)} tabIndex={-1}>
        <Icon name="info" />
      </button>
      <span className="a2a-tip__bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}

export function Judge({ kind, why, label }) {
  if (kind === 'ok')
    return (
      <span className="a2a-judge a2a-judge--ok">
        <Fruits kind="ok" />
        비교 가능
      </span>
    )
  if (kind === 'cond')
    return (
      <span className="a2a-judge a2a-judge--cond">
        <Fruits kind="cond" />
        조건부
      </span>
    )
  if (kind === 'nocomp')
    return (
      <span className="a2a-judge a2a-judge--nocomp">
        <Fruits kind="nocomp" />
        비교 불가
      </span>
    )
  return (
    <span className="a2a-judge a2a-judge--na">
      {label || (kind === 'sum' ? '합계에서 비교' : '대상 아님')}
      {why ? <Why text={why} /> : null}
    </span>
  )
}

export function Keys({ items }) {
  return (
    <div className="a2a-keys">
      {items.map((it, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <span className="a2a-keys__gap" />}
          {it.key ? <span className="a2a-key">{it.key}</span> : it.icon ? <Icon name={it.icon} /> : null}
          {it.text}
        </span>
      ))}
    </div>
  )
}

export function Intro({ use, title, progress, why, keys }) {
  return (
    <div className="a2a-intro">
      {use && <span className="a2a-intro__use">{use}</span>}
      <div className="a2a-intro__line">
        <h1>{title}</h1>
        {progress && <span className="a2a-progress">{progress}</span>}
      </div>
      {why && <p className="a2a-intro__why">{why}</p>}
      {keys && <Keys items={keys} />}
    </div>
  )
}

export function Toast({ text, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="a2a-toast-wrap">
      <div className="a2a-toast" role="status">
        <Icon name="check" />
        {text}
      </div>
    </div>
  )
}

export function Loading({ title, sub }) {
  return (
    <div className="a2a-scrim">
      <div className="a2a-loading" role="status">
        <div className="a2a-spinner" aria-hidden="true" />
        <div className="a2a-loading__title">{title}</div>
        {sub && <div className="a2a-loading__sub">{sub}</div>}
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="a2a-footer">
      판정은 규칙, 계산은 코드가 해요 · 서류는 이 브라우저 안에서만 읽고, 탭을 닫으면 사라져요 · 사진 읽기: Tesseract.js (Apache-2.0)
    </footer>
  )
}

export const isComposing = (e) => e.nativeEvent?.isComposing || e.keyCode === 229
