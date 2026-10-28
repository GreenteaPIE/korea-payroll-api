/**
 * 소득세법 시행령 [별표 2] 근로소득 간이세액표 PDF(법제처) → src/data/withholding-table.ts
 *
 *   npm run tax-table -- sources/소득세법시행령-별표2-2026-02-27.pdf
 *
 * pdftotext(poppler-utils)가 필요하다. 표를 다시 계산하지 않고 법령에 실린 금액을 그대로 옮기며,
 * 구간이 끊기거나 금액이 거꾸로 가면 멈춘다.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const pdf = process.argv[2]
if (!pdf) {
  console.error('사용법: npm run tax-table -- <별표2 PDF 경로>')
  process.exit(1)
}

const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' })

const ROW = /^\s*([\d,]+)\s+([\d,]+)\s+(.+?)\s*$/
const AT_10000 = /^\s*10,000천원\s+((?:[\d,]+\s*){11})$/
const CELL = /^(?:-|[\d,]+)$/
const num = (s: string) => (s === '-' ? 0 : Number(s.replaceAll(',', '')))

const rows: number[][] = []
let at10000: number[] | null = null
for (const line of text.split('\n')) {
  const top = AT_10000.exec(line)
  if (top) {
    at10000 = top[1]!.trim().split(/\s+/).map(num)
    continue
  }
  const m = ROW.exec(line)
  if (!m) continue
  const cells = m[3]!.split(/\s+/)
  if (cells.length !== 11 || !cells.every((c) => CELL.test(c))) continue
  rows.push([num(m[1]!), num(m[2]!), ...cells.map(num)])
}

// ---------- 검사 ----------
const problems: string[] = []
if (rows[0]?.[0] !== 770 || rows.at(-1)?.[1] !== 10000) problems.push(`범위가 770~10,000천원이 아님: ${rows[0]?.[0]}~${rows.at(-1)?.[1]}`)
for (let i = 1; i < rows.length; i++) {
  const [a, b] = [rows[i - 1]!, rows[i]!]
  if (a[1] !== b[0]) problems.push(`구간이 끊김: ${a[0]}~${a[1]} 다음 ${b[0]}~${b[1]}`)
  for (let c = 2; c < 13; c++) if (b[c]! < a[c]!) problems.push(`월급이 늘었는데 세액이 줄어듦: ${b[0]}천원 가족 ${c - 1}명`)
}
for (const r of rows) for (let c = 3; c < 13; c++) if (r[c]! > r[c - 1]!) problems.push(`가족이 늘었는데 세액이 늘어남: ${r[0]}천원 가족 ${c - 1}명`)
if (!at10000 || at10000.length !== 11) problems.push('10,000천원 행을 읽지 못함')
if (problems.length) {
  console.error(problems.slice(0, 20).join('\n'))
  process.exit(1)
}

const title = /\[별표 2\]\s*<([^>]+)>/.exec(text)?.[1] ?? ''
const body = rows.map((r) => `  [${r.join(', ')}],`).join('\n')
writeFileSync(
  'src/data/withholding-table.ts',
  `// 자동 생성 파일: npm run tax-table -- ${pdf}
// 출처: 소득세법 시행령 [별표 2] 근로소득 간이세액표 <${title}> (법제처 국가법령정보센터)
// 각 행: [월급여 이상(천원), 미만(천원), 공제대상가족 1명 ~ 11명 세액(원)]

export const TAX_TABLE: readonly (readonly number[])[] = [
${body}
]

/** 월급여 10,000천원인 경우의 세액 (공제대상가족 1명 ~ 11명) */
export const TAX_AT_10000: readonly number[] = [${at10000!.join(', ')}]
`,
)
console.log(`${rows.length}개 구간을 src/data/withholding-table.ts 에 썼습니다 (${title})`)
