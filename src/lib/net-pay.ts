/** 실수령액: 월 급여에서 4대보험 근로자 부담금과 원천징수 세금을 뺀 금액 */
import { PayrollInputError, requireWon } from './common.ts'
import { insurance, type CompanySize, type InsuranceResult } from './insurance.ts'
import { withholdingTax, type WithholdingResult } from './tax.ts'

export interface NetPayInput {
  /** 월 급여 (세전, 비과세 포함). annualSalary 와 둘 중 하나 */
  monthlyPay?: number
  /** 연봉 (세전). 12로 나눈 금액을 월 급여로 쓴다 */
  annualSalary?: number
  /** 월 비과세 금액 (예: 식대 20만원). 기본 0 */
  nonTaxable?: number
  family?: number
  children?: number
  companySize?: CompanySize
  taxRatio?: 80 | 100 | 120
  month?: string | Date
}

export interface NetPayResult {
  month: string
  monthlyPay: number
  nonTaxable: number
  /** 4대보험과 세금을 매기는 금액 (월 급여 - 비과세) */
  taxablePay: number
  deductions: {
    nationalPension: number
    health: number
    longTermCare: number
    employment: number
    incomeTax: number
    localIncomeTax: number
    total: number
  }
  netPay: number
  annual: { gross: number; net: number }
  /** 회사가 내는 4대보험까지 더한 월 인건비 (산재보험 제외) */
  employerCost: number
  provisional: boolean
  insurance: InsuranceResult
  tax: WithholdingResult
}

export function netPay(input: NetPayInput): NetPayResult {
  if ((input.monthlyPay === undefined) === (input.annualSalary === undefined)) {
    throw new PayrollInputError('monthlyPay 와 annualSalary 중 하나만 넣어 주세요')
  }
  const monthlyPay =
    input.monthlyPay !== undefined ? requireWon(input.monthlyPay, '월 급여') : Math.floor(requireWon(input.annualSalary!, '연봉') / 12)
  const nonTaxable = requireWon(input.nonTaxable ?? 0, '비과세 금액')
  const taxablePay = Math.max(0, monthlyPay - nonTaxable)

  const ins = insurance({ monthlyPay: taxablePay, month: input.month, companySize: input.companySize })
  const tax = withholdingTax({
    monthlyPay: taxablePay,
    family: input.family,
    children: input.children,
    ratio: input.taxRatio,
    month: ins.month,
  })
  const deductions = {
    nationalPension: ins.nationalPension.employee,
    health: ins.health.employee,
    longTermCare: ins.longTermCare.employee,
    employment: ins.employment.employee,
    incomeTax: tax.incomeTax,
    localIncomeTax: tax.localIncomeTax,
    total: ins.total.employee + tax.total,
  }
  const net = monthlyPay - deductions.total
  return {
    month: ins.month,
    monthlyPay,
    nonTaxable,
    taxablePay,
    deductions,
    netPay: net,
    annual: { gross: monthlyPay * 12, net: net * 12 },
    employerCost: monthlyPay + ins.total.employer,
    provisional: ins.provisional,
    insurance: ins,
    tax,
  }
}
