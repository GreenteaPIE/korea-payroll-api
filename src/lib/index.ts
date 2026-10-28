/**
 * korea-payroll: 대한민국 급여 계산 라이브러리.
 * 4대보험·근로소득 간이세액·실수령액·최저임금·주휴수당·퇴직금. 금액은 모두 원(정수)이다.
 * 기준 월(month)은 'YYYY-MM' 또는 Date 이며, 생략하면 이번 달(한국 시간)이다.
 */
import { CHILD_CREDIT, EMPLOYER_STABILITY_PPM, EMPLOYMENT, HEALTH, MINIMUM_WAGE, PENSION, SUPPORTED_UNTIL, TAX_TABLE_FROM } from '../data/rates.ts'
import { pickPeriod, toYearMonth, type MonthInput } from './common.ts'

export { OutOfRangeError, PayrollInputError, type MonthInput } from './common.ts'
export { insurance, type CompanySize, type InsuranceInput, type InsuranceResult, type Share } from './insurance.ts'
export { childCredit, taxTableAmount, withholdingTax, type WithholdingInput, type WithholdingResult } from './tax.ts'
export { netPay, type NetPayInput, type NetPayResult } from './net-pay.ts'
export {
  MINIMUM_WAGE_YEARS,
  checkMinimumWage,
  minimumWage,
  monthlyPaidHours,
  weeklyHolidayHours,
  weeklyHolidayPay,
  type MinimumWage,
  type MinimumWageCheck,
  type WeeklyHolidayPay,
} from './wage.ts'
export { severancePay, type SeveranceInput, type SeveranceResult } from './severance.ts'

/** 지원 기간: 4대보험은 PENSION 첫 달부터, 간이세액은 2024-03 부터 */
export const SUPPORTED_RANGE = { insuranceFrom: '2024-01', taxFrom: TAX_TABLE_FROM, until: SUPPORTED_UNTIL }

export interface Rates {
  month: string
  nationalPension: { ratePercent: number; floor: number; ceiling: number; source: string }
  health: { ratePercent: number; longTermCarePercent: number; premiumFloor: number; premiumCeiling: number; source: string }
  employment: { employeePercent: number; employerStabilityPercent: Record<string, number>; source: string }
  minimumWage: { hourly: number; source: string } | null
  childCredit: { one: number; two: number; perExtra: number; source: string } | null
  provisional: boolean
}

/** 그 달에 적용되는 요율과 기준 금액 (출처 포함) */
export function rates(month?: MonthInput): Rates {
  const ym = toYearMonth(month)
  const p = pickPeriod(PENSION, ym, '국민연금')
  const h = pickPeriod(HEALTH, ym, '건강보험')
  const e = pickPeriod(EMPLOYMENT, ym, '고용보험')
  const c = ym >= TAX_TABLE_FROM ? pickPeriod(CHILD_CREDIT, ym, '자녀 세액공제') : null
  const mw = MINIMUM_WAGE[Number(ym.slice(0, 4))] ?? null
  const pct = (ppm: number) => ppm / 10_000
  return {
    month: ym,
    nationalPension: { ratePercent: pct(p.ratePpm), floor: p.floor, ceiling: p.ceiling, source: p.source },
    health: {
      ratePercent: pct(h.ratePpm),
      longTermCarePercent: pct(h.longTermCarePpm),
      premiumFloor: h.premiumFloor,
      premiumCeiling: h.premiumCeiling,
      source: h.source,
    },
    employment: {
      employeePercent: pct(e.unemploymentPpm),
      employerStabilityPercent: Object.fromEntries(Object.entries(EMPLOYER_STABILITY_PPM).map(([k, v]) => [k, pct(v)])),
      source: e.source,
    },
    minimumWage: mw,
    childCredit: c && { one: c.one, two: c.two, perExtra: c.perExtra, source: c.source },
    provisional: Boolean(p.provisional || h.provisional),
  }
}
