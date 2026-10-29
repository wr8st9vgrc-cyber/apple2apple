// OCR·PDF 엔진 파일을 우리 배포 주소(public/vendor)에 같이 올린다. 외부 CDN이 막혀도 돌게.
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const nm = (p) => resolve('node_modules', p)
const out = (p) => resolve('public/vendor', p)

mkdirSync(out('tesseract/core'), { recursive: true })
mkdirSync(out('tesseract/lang'), { recursive: true })
mkdirSync(out('pdfjs'), { recursive: true })

cpSync(nm('tesseract.js/dist/worker.min.js'), out('tesseract/worker.min.js'))
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  cpSync(nm(`tesseract.js-core/${f}`), out(`tesseract/core/${f}`))
}
cpSync(nm('@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz'), out('tesseract/lang/kor.traineddata.gz'))
cpSync(nm('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), out('tesseract/lang/eng.traineddata.gz'))

cpSync(nm('pdfjs-dist/build/pdf.worker.min.mjs'), out('pdfjs/pdf.worker.min.mjs'))
cpSync(nm('pdfjs-dist/cmaps'), out('pdfjs/cmaps'), { recursive: true })
if (existsSync(nm('pdfjs-dist/standard_fonts'))) cpSync(nm('pdfjs-dist/standard_fonts'), out('pdfjs/standard_fonts'), { recursive: true })
console.log('vendor files copied')
