/** 최저임금, 주휴수당, 월 소정근로시간 */
import { MINIMUM_WAGE } from '../data/rates.ts'
import { OutOfRangeError, PayrollInputError, requireWon } from './common.ts'

export const MINIMUM_WAGE_YEARS = Object.keys(MINIMUM_WAGE).map(Number)

export interface MinimumWage {
  year: number
  hourly: number
  /** 하루 8시간 */
  daily: number
  /** 주 40시간 + 주휴 8시간 기준 월 209시간 */
  monthly: number
  monthlyHours: number
  annual: number
  source: string
}

export function minimumWage(year: number): MinimumWage {
  const data = MINIMUM_WAGE[year]
  if (!data) throw new OutOfRangeError(`${year}년 최저임금 자료가 없습니다 (${MINIMUM_WAGE_YEARS.join(', ')} 지원)`)
  const monthly = data.hourly * 209
  return { year, hourly: data.hourly, daily: data.hourly * 8, monthly, monthlyHours: 209, annual: monthly * 12, source: data.source }
}

function requireHours(weeklyHours: number): number {
  if (!Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > 168) {
    throw new PayrollInputError(`주 소정근로시간은 0~168 사이여야 합니다: ${weeklyHours}`)
  }
  return weeklyHours
}

/** 주휴시간: 주 15시간 이상이면 (주 소정근로시간 ÷ 40) × 8, 최대 8시간 */
export function weeklyHolidayHours(weeklyHours: number): number {
  requireHours(weeklyHours)
  return weeklyHours < 15 ? 0 : (Math.min(weeklyHours, 40) / 40) * 8
}

export interface WeeklyHolidayPay {
  eligible: boolean
  hours: number
  pay: number
}

export function weeklyHolidayPay(input: { hourlyWage: number; weeklyHours: number }): WeeklyHolidayPay {
  const hourly = requireWon(input.hourlyWage, '시급')
  const hours = weeklyHolidayHours(input.weeklyHours)
  return { eligible: hours > 0, hours, pay: Math.floor(hourly * hours) }
}

/** 월 소정근로시간(유급): (주 소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12, 반올림. 주 40시간이면 209 */
export function monthlyPaidHours(weeklyHours: number): number {
  return Math.round((requireHours(weeklyHours) + weeklyHolidayHours(weeklyHours)) * (365 / 7 / 12))
}

export interface MinimumWageCheck {
  year: number
  monthlyHours: number
  /** 월급을 시간당으로 환산한 금액 (원 미만 버림) */
  hourlyEquivalent: number
  minimumHourly: number
  /** 그 근무시간에 맞는 최저 월급 */
  minimumMonthly: number
  ok: boolean
  /** 모자란 월 금액 (괜찮으면 0) */
  shortfall: number
}

/** 월급이 최저임금 이상인지 (최저임금에 산입되는 월 임금을 넣는다) */
export function checkMinimumWage(input: { monthlyPay: number; weeklyHours?: number; year: number }): MinimumWageCheck {
  const pay = requireWon(input.monthlyPay, '월급')
  const hours = monthlyPaidHours(input.weeklyHours ?? 40)
  if (hours === 0) throw new PayrollInputError('근로시간이 0 이면 비교할 수 없습니다')
  const { hourly } = minimumWage(input.year)
  const minimumMonthly = hourly * hours
  return {
    year: input.year,
    monthlyHours: hours,
    hourlyEquivalent: Math.floor(pay / hours),
    minimumHourly: hourly,
    minimumMonthly,
    ok: pay >= minimumMonthly,
    shortfall: Math.max(0, minimumMonthly - pay),
  }
}
