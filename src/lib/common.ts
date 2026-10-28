import { SUPPORTED_UNTIL, type Period } from '../data/rates.ts'

/** 잘못된 입력. API 에서는 400 으로 바뀐다 */
export class PayrollInputError extends Error {
  override name = 'PayrollInputError'
}

/** 요율이 없는 기간. API 에서는 404 로 바뀐다 */
export class OutOfRangeError extends Error {
  override name = 'OutOfRangeError'
}

/** 'YYYY-MM', 'YYYY-MM-DD' 또는 Date. 생략하면 이번 달(한국 시간) */
export type MonthInput = string | Date

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function toYearMonth(input?: MonthInput): string {
  if (input === undefined) input = new Date()
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) throw new PayrollInputError('올바른 날짜가 아닙니다')
    return new Date(input.getTime() + KST_OFFSET_MS).toISOString().slice(0, 7)
  }
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(input.trim())
  const month = m ? Number(m[2]) : 0
  if (!m || month < 1 || month > 12) throw new PayrollInputError(`YYYY-MM 형식이어야 합니다: ${input}`)
  return `${m[1]}-${m[2]}`
}

/** from 이후 ~ 지원 범위 안인지 확인한다 */
export function ensureSupported(yearMonth: string, from: string, what: string): void {
  if (yearMonth < from || yearMonth > SUPPORTED_UNTIL) {
    throw new OutOfRangeError(`${what}은(는) ${from} ~ ${SUPPORTED_UNTIL} 기간만 계산할 수 있습니다 (요청: ${yearMonth})`)
  }
}

/** 해당 월에 적용되는 마지막 기간 */
export function pickPeriod<T extends Period>(periods: readonly T[], yearMonth: string, what: string): T {
  let found: T | undefined
  for (const p of periods) if (p.from <= yearMonth) found = p
  if (!found) throw new OutOfRangeError(`${yearMonth} 의 ${what} 자료가 없습니다 (${periods[0]?.from} 부터 지원)`)
  ensureSupported(yearMonth, periods[0]!.from, what)
  return found
}

/** amount × ppm / 1,000,000 의 원 미만 버림. 정수 연산이라 소수 오차가 없다 */
export const mulPpm = (amount: number, ppm: number): number => Math.floor((amount * ppm) / 1_000_000)

/** 10원 미만 버림 (보험료·세금의 '원 단위 절사') */
export const floor10 = (won: number): number => Math.floor(won / 10) * 10

export const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max)

export function requireWon(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new PayrollInputError(`${name}은(는) 0 이상의 정수(원)여야 합니다: ${value}`)
  }
  if (value > 10_000_000_000) throw new PayrollInputError(`${name}이(가) 너무 큽니다: ${value}`)
  return value
}

export function requireInt(value: number, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new PayrollInputError(`${name}은(는) ${min}~${max} 사이의 정수여야 합니다: ${value}`)
  }
  return value
}
