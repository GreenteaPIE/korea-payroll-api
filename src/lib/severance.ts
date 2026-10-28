/**
 * 퇴직금 (근로자퇴직급여 보장법): 1일 평균임금 × 30 × 재직일수 ÷ 365.
 * 평균임금 = 퇴직 전 3개월 임금 총액(+ 연간 상여금·연차수당의 3/12) ÷ 그 3개월의 일수.
 * 평균임금이 1일 통상임금보다 적으면 통상임금을 쓴다. 1년 이상 일해야 받을 수 있다.
 */
import { PayrollInputError, requireWon } from './common.ts'

export interface SeveranceInput {
  /** 입사일 YYYY-MM-DD */
  startDate: string
  /** 퇴직일 YYYY-MM-DD: 마지막으로 일한 날의 다음 날 (고용노동부 계산기와 같은 기준) */
  endDate: string
  /** 퇴직일 전 3개월 동안 받은 임금 총액 (세전) */
  wages3Months: number
  /** 퇴직 전 1년간 받은 상여금 총액 */
  annualBonus?: number
  /** 퇴직 전 1년간 받은 연차수당 */
  annualLeaveAllowance?: number
  /** 1일 통상임금 (평균임금보다 많으면 이 값을 쓴다) */
  ordinaryDailyWage?: number
}

export interface SeveranceResult {
  eligible: boolean
  serviceDays: number
  /** 평균임금 계산 기간 (퇴직일 전 3개월) */
  periodStart: string
  periodDays: number
  /** 3개월 임금 총액 + 상여금·연차수당의 3/12 */
  wageBase: number
  /** 1일 평균임금 (소수 둘째 자리 반올림, 표시용) */
  averageDailyWage: number
  /** 계산에 쓴 1일 임금 (평균임금과 통상임금 중 큰 값, 표시용) */
  appliedDailyWage: number
  amount: number
}

const DAY = 86_400_000

function parse(date: string, name: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN
  if (!m || Number.isNaN(t) || new Date(t).getUTCDate() !== Number(m[3])) throw new PayrollInputError(`${name}은(는) YYYY-MM-DD 형식이어야 합니다: ${date}`)
  return t
}

/** 같은 날짜의 3개월 전. 그 날짜가 없으면(예: 5월 31일 → 2월) 그 달의 마지막 날 */
function threeMonthsBefore(t: number): number {
  const d = new Date(t)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() - 3
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay))
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export function severancePay(input: SeveranceInput): SeveranceResult {
  const start = parse(input.startDate, '입사일')
  const end = parse(input.endDate, '퇴직일')
  if (end <= start) throw new PayrollInputError('퇴직일은 입사일보다 뒤여야 합니다')
  const wages = requireWon(input.wages3Months, '3개월 임금 총액')
  const bonus = requireWon(input.annualBonus ?? 0, '연간 상여금')
  const leave = requireWon(input.annualLeaveAllowance ?? 0, '연차수당')
  const ordinary = input.ordinaryDailyWage ?? 0
  if (!Number.isFinite(ordinary) || ordinary < 0) throw new PayrollInputError('1일 통상임금은 0 이상이어야 합니다')

  const serviceDays = Math.round((end - start) / DAY)
  const periodStart = Math.max(threeMonthsBefore(end), start)
  const periodDays = Math.round((end - periodStart) / DAY)
  // 상여금·연차수당은 3/12 만 넣는다
  const wageBase = wages + (bonus * 3) / 12 + (leave * 3) / 12
  const average = wageBase / periodDays
  const applied = Math.max(average, ordinary)
  const eligible = serviceDays >= 365
  const amount = eligible ? Math.floor((applied * 30 * serviceDays) / 365) : 0
  const round2 = (n: number) => Math.round(n * 100) / 100
  return {
    eligible,
    serviceDays,
    periodStart: iso(periodStart),
    periodDays,
    wageBase: Math.floor(wageBase),
    averageDailyWage: round2(average),
    appliedDailyWage: round2(applied),
    amount,
  }
}
