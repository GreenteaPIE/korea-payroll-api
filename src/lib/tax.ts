/**
 * 근로소득 간이세액 (매달 원천징수하는 소득세와 지방소득세).
 * 월급여 1,000만원까지는 소득세법 시행령 [별표 2] 표의 금액을 그대로 쓰고,
 * 그보다 많으면 별표 2 의 계산식을 따른다.
 */
import { CHILD_CREDIT, TAX_TABLE_FROM } from '../data/rates.ts'
import { TAX_AT_10000, TAX_TABLE } from '../data/withholding-table.ts'
import { ensureSupported, floor10, PayrollInputError, pickPeriod, requireInt, requireWon, toYearMonth, type MonthInput } from './common.ts'

export interface WithholdingInput {
  /** 월 급여 (비과세·학자금 제외, 원) */
  monthlyPay: number
  /** 공제대상가족 수. 본인과 배우자도 각각 1명 (기본 1) */
  family?: number
  /** 공제대상가족 중 8세 이상 20세 이하 자녀 수 (기본 0) */
  children?: number
  /** 원천징수 비율: 80, 100, 120 중 근로자가 고른 값 (기본 100) */
  ratio?: 80 | 100 | 120
  month?: MonthInput
}

export interface WithholdingResult {
  month: string
  /** 간이세액표(또는 계산식) 금액 */
  tableAmount: number
  /** 8~20세 자녀 공제액 */
  childCredit: number
  ratio: number
  incomeTax: number
  /** 지방소득세 = 소득세의 10% */
  localIncomeTax: number
  total: number
}

/** 공제대상가족 수별 금액. 11명을 넘으면 별표 2 비고 4 의 방식으로 줄인다 */
function byFamily(amounts: readonly number[], family: number, offset: number): number {
  if (family <= 11) return amounts[offset + family - 1]!
  const t10 = amounts[offset + 9]!
  const t11 = amounts[offset + 10]!
  return Math.max(0, t11 - (t10 - t11) * (family - 11))
}

/** 월급여 1,000만원 초과분에 더하는 세액 (별표 2 계산식) */
function above10Million(pay: number): number {
  const over = (limit: number) => pay - limit
  if (pay <= 14_000_000) return 25_000 + Math.floor((over(10_000_000) * 343) / 1000) // 98% × 35%
  if (pay <= 28_000_000) return 1_397_000 + Math.floor((over(14_000_000) * 3724) / 10_000) // 98% × 38%
  if (pay <= 30_000_000) return 6_610_600 + Math.floor((over(28_000_000) * 392) / 1000) // 98% × 40%
  if (pay <= 45_000_000) return 7_394_600 + Math.floor((over(30_000_000) * 40) / 100)
  if (pay <= 87_000_000) return 13_394_600 + Math.floor((over(45_000_000) * 42) / 100)
  return 31_034_600 + Math.floor((over(87_000_000) * 45) / 100)
}

/** 간이세액표 금액 (자녀 공제·비율 적용 전) */
export function taxTableAmount(monthlyPay: number, family = 1): number {
  const pay = requireWon(monthlyPay, '월 급여')
  requireInt(family, '공제대상가족 수', 1, 50)
  if (pay < 770_000) return 0
  if (pay < 10_000_000) {
    const thousand = Math.floor(pay / 1000)
    let lo = 0
    let hi = TAX_TABLE.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (TAX_TABLE[mid]![0]! <= thousand) lo = mid
      else hi = mid - 1
    }
    return byFamily(TAX_TABLE[lo]!, family, 2)
  }
  const base = byFamily(TAX_AT_10000, family, 0)
  return pay === 10_000_000 ? base : floor10(base + above10Million(pay))
}

export function childCredit(children: number, month: string): number {
  if (children === 0) return 0
  const c = pickPeriod(CHILD_CREDIT, month, '자녀 세액공제')
  if (children === 1) return c.one
  return c.two + c.perExtra * (children - 2)
}

export function withholdingTax(input: WithholdingInput): WithholdingResult {
  const family = requireInt(input.family ?? 1, '공제대상가족 수', 1, 50)
  const children = requireInt(input.children ?? 0, '8~20세 자녀 수', 0, family - 1)
  const ratio = input.ratio ?? 100
  if (![80, 100, 120].includes(ratio)) throw new PayrollInputError('원천징수 비율은 80, 100, 120 중 하나여야 합니다')
  const month = toYearMonth(input.month)
  ensureSupported(month, TAX_TABLE_FROM, '근로소득 간이세액')

  const tableAmount = taxTableAmount(input.monthlyPay, family)
  const credit = childCredit(children, month)
  const afterCredit = Math.max(0, tableAmount - credit)
  const incomeTax = floor10((afterCredit * ratio) / 100)
  const localIncomeTax = floor10(incomeTax / 10)
  return { month, tableAmount, childCredit: credit, ratio, incomeTax, localIncomeTax, total: incomeTax + localIncomeTax }
}
