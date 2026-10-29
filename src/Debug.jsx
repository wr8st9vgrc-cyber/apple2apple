import { readDocument } from './lib/read.js'

// 개발용: ?debug 로 열면 파일을 읽은 결과를 window.__a2a 에 남긴다
export default function Debug() {
  async function onFiles(e) {
    const out = []
    for (const f of e.target.files) {
      const t0 = performance.now()
      try {
        const r = await readDocument({ file: f })
        out.push({ ...r, preview: undefined, ms: Math.round(performance.now() - t0) })
      } catch (err) {
        out.push({ name: f.name, error: String(err) })
      }
    }
    window.__a2a = out
    document.title = 'done'
  }
  return <input type="file" multiple onChange={onFiles} id="dbg" />
}
