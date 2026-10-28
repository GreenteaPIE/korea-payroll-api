import { describe, expect, it } from 'vitest'
import {
  checkMinimumWage,
  minimumWage,
  monthlyPaidHours,
  netPay,
  OutOfRangeError,
  PayrollInputError,
  rates,
  severancePay,
  taxTableAmount,
  weeklyHolidayPay,
} from '../src/lib/index.ts'

describe('최저임금', () => {
  it('연도별 시급과 월 209시간 환산액', () => {
    expect(minimumWage(2026)).toMatchObject({ hourly: 10_320, monthly: 2_156_880, daily: 82_560 })
    expect(minimumWage(2027)).toMatchObject({ hourly: 10_700, monthly: 2_236_300 })
    expect(minimumWage(2025).hourly).toBe(10_030)
    expect(() => minimumWage(2030)).toThrow(OutOfRangeError)
  })

  it('월급이 최저임금 이상인지', () => {
    expect(checkMinimumWage({ monthlyPay: 2_156_880, year: 2026 })).toMatchObject({ ok: true, shortfall: 0, monthlyHours: 209 })
    expect(checkMinimumWage({ monthlyPay: 2_100_000, year: 2026 })).toMatchObject({ ok: false, shortfall: 56_880, hourlyEquivalent: 10_047 })
  })
})

describe('주휴수당·월 소정근로시간', () => {
  it('주 15시간 미만이면 주휴수당이 없다', () => {
    expect(weeklyHolidayPay({ hourlyWage: 10_320, weeklyHours: 14 })).toEqual({ eligible: false, hours: 0, pay: 0 })
  })

  it('주 20시간: 4시간분, 주 40시간 이상: 8시간분', () => {
    expect(weeklyHolidayPay({ hourlyWage: 10_320, weeklyHours: 20 })).toEqual({ eligible: true, hours: 4, pay: 41_280 })
    expect(weeklyHolidayPay({ hourlyWage: 10_320, weeklyHours: 52 })).toEqual({ eligible: true, hours: 8, pay: 82_560 })
  })

  it('주 40시간이면 월 209시간, 주 20시간이면 104시간', () => {
    expect(monthlyPaidHours(40)).toBe(209)
    expect(monthlyPaidHours(20)).toBe(104)
    expect(monthlyPaidHours(10)).toBe(43)
  })
})

describe('퇴직금', () => {
  it('3년 근무, 3개월 900만원', () => {
    const r = severancePay({ startDate: '2023-11-01', endDate: '2026-11-01', wages3Months: 9_000_000 })
    expect(r.serviceDays).toBe(1096)
    expect(r.periodStart).toBe('2026-08-01')
    expect(r.periodDays).toBe(92)
    // 9,000,000 / 92 = 97,826.086... × 30 × 1096 / 365
    expect(r.amount).toBe(Math.floor(((9_000_000 / 92) * 30 * 1096) / 365))
    expect(r.eligible).toBe(true)
  })

  it('상여금·연차수당은 3/12 만 들어간다', () => {
    const r = severancePay({ startDate: '2024-01-02', endDate: '2026-01-02', wages3Months: 9_000_000, annualBonus: 4_000_000, annualLeaveAllowance: 1_200_000 })
    expect(r.wageBase).toBe(9_000_000 + 1_000_000 + 300_000)
  })

  it('1년 미만이면 받을 수 없다', () => {
    expect(severancePay({ startDate: '2026-01-01', endDate: '2026-12-31', wages3Months: 9_000_000 })).toMatchObject({ eligible: false, amount: 0 })
  })

  it('통상임금이 평균임금보다 크면 통상임금으로', () => {
    const r = severancePay({ startDate: '2024-01-01', endDate: '2026-01-01', wages3Months: 6_000_000, ordinaryDailyWage: 100_000 })
    expect(r.appliedDailyWage).toBe(100_000)
  })

  it('5월 31일 퇴직이면 3개월 전은 2월의 마지막 날', () => {
    expect(severancePay({ startDate: '2020-01-01', endDate: '2026-05-31', wages3Months: 9_000_000 }).periodStart).toBe('2026-02-28')
  })

  it('잘못된 날짜', () => {
    expect(() => severancePay({ startDate: '2026-02-30', endDate: '2027-01-01', wages3Months: 1 })).toThrow(PayrollInputError)
    expect(() => severancePay({ startDate: '2027-01-01', endDate: '2026-01-01', wages3Months: 1 })).toThrow(PayrollInputError)
  })
})

describe('실수령액', () => {
  it('연봉 4,000만원, 비과세 20만원, 2026년 10월', () => {
    const r = netPay({ annualSalary: 40_000_000, nonTaxable: 200_000, month: '2026-10' })
    expect(r.monthlyPay).toBe(3_333_333)
    expect(r.taxablePay).toBe(3_133_333)
    // 4대보험은 비과세를 뺀 3,133,333원 기준, 모두 10원 미만 버림
    expect(r.deductions.nationalPension).toBe(148_810) // 3,133,000 × 4.75% = 148,817.5
    expect(r.deductions.health).toBe(112_640) // 3,133,333 × 3.595% = 112,643.3
    expect(r.deductions.longTermCare).toBe(14_800) // 112,640 × 0.9448 ÷ 7.19 = 14,801.4
    expect(r.deductions.employment).toBe(28_190) // 3,133,333 × 0.9% = 28,199.99
    expect(r.deductions.incomeTax).toBe(taxTableAmount(3_133_333, 1))
    expect(r.deductions.localIncomeTax).toBe(Math.floor(r.deductions.incomeTax / 100) * 10)
    expect(r.netPay).toBe(r.monthlyPay - r.deductions.total)
    expect(r.annual.net).toBe(r.netPay * 12)
  })

  it('monthlyPay 와 annualSalary 는 둘 중 하나만', () => {
    expect(() => netPay({})).toThrow(PayrollInputError)
    expect(() => netPay({ monthlyPay: 1, annualSalary: 12 })).toThrow(PayrollInputError)
  })

  it('비과세가 급여보다 크면 과세 대상은 0', () => {
    const r = netPay({ monthlyPay: 100_000, nonTaxable: 200_000, month: '2026-10' })
    expect(r.taxablePay).toBe(0)
  })
})

describe('요율 조회', () => {
  it('2026년 10월', () => {
    const r = rates('2026-10')
    expect(r.nationalPension).toMatchObject({ ratePercent: 9.5, floor: 410_000, ceiling: 6_590_000 })
    expect(r.health).toMatchObject({ ratePercent: 7.19, longTermCarePercent: 0.9448 })
    expect(r.minimumWage?.hourly).toBe(10_320)
    expect(r.childCredit?.one).toBe(20_830)
  })
})
