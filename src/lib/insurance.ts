/**
 * 4대보험 근로자·사업주 부담금 (직장가입자, 월 보수 기준).
 * 계산 규칙은 4대사회보험 정보연계센터 모의계산과 같다 (test/fixtures-4insure-2026.json 으로 검증).
 *  - 국민연금: 기준소득월액 = 월 소득의 천원 미만 버림, 하한·상한 적용 → 보험료율의 절반씩, 10원 미만 버림
 *  - 건강보험: 보수월액 × 보험료율의 절반, 10원 미만 버림. 월 보험료 하한·상한 고시 적용
 *  - 장기요양: 건강보험료 × (장기요양보험료율 ÷ 건강보험료율), 10원 미만 버림
 *  - 고용보험: 근로자 0.9%. 사업주는 0.9% 와 고용안정·직업능력개발 요율을 따로 버림해 더한다
 *  - 산재보험은 업종별 요율이고 사업주만 내므로 계산하지 않는다
 */
import { EMPLOYER_STABILITY_PPM, EMPLOYMENT, HEALTH, PENSION, type CompanySize } from '../data/rates.ts'
import { clamp, floor10, mulPpm, PayrollInputError, pickPeriod, requireWon, toYearMonth, type MonthInput } from './common.ts'

export type { CompanySize }

export interface InsuranceInput {
  /** 월 보수 (비과세 소득 제외, 원) */
  monthlyPay: number
  /** 기준 월. 생략하면 이번 달 */
  month?: MonthInput
  /** 고용보험 사업주 요율을 정하는 기업 규모 (기본 150인 미만) */
  companySize?: CompanySize
}

export interface Share {
  employee: number
  employer: number
}

export interface InsuranceResult {
  month: string
  nationalPension: Share & { base: number; ratePercent: number }
  health: Share & { base: number; ratePercent: number }
  longTermCare: Share & { ratePercent: number }
  employment: Share & { employeeRatePercent: number; employerRatePercent: number }
  total: Share
  /** 아직 공식 발표 전이라 직전 값을 쓴 항목이 있으면 true */
  provisional: boolean
}

const COMPANY_SIZES = Object.keys(EMPLOYER_STABILITY_PPM) as CompanySize[]
const percent = (ppm: number) => ppm / 10_000

export function insurance(input: InsuranceInput): InsuranceResult {
  const pay = requireWon(input.monthlyPay, '월 보수')
  const size = input.companySize ?? 'under150'
  if (!COMPANY_SIZES.includes(size)) throw new PayrollInputError(`companySize 는 ${COMPANY_SIZES.join(', ')} 중 하나여야 합니다`)
  const month = toYearMonth(input.month)

  const p = pickPeriod(PENSION, month, '국민연금')
  const h = pickPeriod(HEALTH, month, '건강보험')
  const e = pickPeriod(EMPLOYMENT, month, '고용보험')

  // 국민연금
  const pensionBase = clamp(Math.floor(pay / 1000) * 1000, p.floor, p.ceiling)
  const pension = floor10(mulPpm(pensionBase, p.ratePpm / 2))

  // 건강보험: 근로자·사업주 각각 절반. 월 보험료 하한·상한도 절반씩 적용
  const healthHalf = clamp(mulPpm(pay, h.ratePpm / 2), h.premiumFloor / 2, h.premiumCeiling / 2)
  const health = floor10(healthHalf)
  const longTermCare = floor10(Math.floor((health * h.longTermCarePpm) / h.ratePpm))

  // 고용보험
  const unemployment = floor10(mulPpm(pay, e.unemploymentPpm))
  const stability = floor10(mulPpm(pay, EMPLOYER_STABILITY_PPM[size]))

  const employee = pension + health + longTermCare + unemployment
  const employer = pension + health + longTermCare + unemployment + stability
  return {
    month,
    nationalPension: { base: pensionBase, ratePercent: percent(p.ratePpm), employee: pension, employer: pension },
    health: { base: pay, ratePercent: percent(h.ratePpm), employee: health, employer: health },
    longTermCare: { ratePercent: percent(h.longTermCarePpm), employee: longTermCare, employer: longTermCare },
    employment: {
      employeeRatePercent: percent(e.unemploymentPpm),
      employerRatePercent: percent(e.unemploymentPpm + EMPLOYER_STABILITY_PPM[size]),
      employee: unemployment,
      employer: unemployment + stability,
    },
    total: { employee, employer },
    provisional: Boolean(p.provisional || h.provisional || e.provisional),
  }
}
