import { describe, expect, it } from 'vitest'
import { OutOfRangeError, PayrollInputError, taxTableAmount, withholdingTax } from '../src/lib/index.ts'
import { TAX_AT_10000, TAX_TABLE } from '../src/data/withholding-table.ts'

// 소득세법 시행령 [별표 2] <개정 2026. 2. 27.> PDF 에서 손으로 옮긴 행 (공제대상가족 1~11명)
const ROWS: Record<number, number[]> = {
  1_500_000: [8_920, 4_420, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  2_000_000: [19_520, 14_750, 6_600, 3_220, 0, 0, 0, 0, 0, 0, 0],
  2_500_000: [35_600, 28_600, 16_530, 13_150, 9_780, 6_400, 3_030, 0, 0, 0, 0],
  3_000_000: [74_350, 56_850, 31_940, 26_690, 21_440, 17_100, 13_730, 10_350, 6_980, 3_600, 0],
  4_000_000: [195_960, 167_950, 109_590, 91_670, 78_550, 65_420, 52_300, 39_170, 33_570, 28_320, 23_070],
  5_000_000: [335_470, 306_710, 237_850, 219_100, 200_350, 181_600, 162_850, 144_100, 125_350, 106_600, 87_850],
  7_000_000: [732_700, 684_290, 557_350, 527_350, 497_350, 471_470, 452_720, 433_970, 415_220, 396_470, 377_720],
  9_999_999: [1_503_990, 1_428_170, 1_198_650, 1_168_650, 1_138_650, 1_108_650, 1_078_650, 1_048_650, 1_018_650, 988_650, 958_650],
}

describe('간이세액표 금액', () => {
  for (const [pay, amounts] of Object.entries(ROWS)) {
    it(`월 ${Number(pay).toLocaleString()}원`, () => {
      amounts.forEach((amount, i) => expect(taxTableAmount(Number(pay), i + 1)).toBe(amount))
    })
  }

  it('구간의 끝(미만)은 같은 행, 다음 천원부터 다음 행', () => {
    expect(taxTableAmount(3_019_999)).toBe(74_350)
    expect(taxTableAmount(3_020_000)).not.toBe(74_350)
  })

  it('770천원 미만은 0원', () => {
    expect(taxTableAmount(769_999)).toBe(0)
    expect(taxTableAmount(0)).toBe(0)
  })

  it('월 1,000만원은 표의 10,000천원 행', () => {
    expect(taxTableAmount(10_000_000, 1)).toBe(1_507_400)
    expect(taxTableAmount(10_000_000, 3)).toBe(1_200_840)
  })

  it('1,000만원 초과는 별표 2 계산식', () => {
    // 1,507,400 + 25,000 + (2,345,678 × 98% × 35% = 804,567.5) = 2,336,967 → 10원 미만 버림
    expect(taxTableAmount(12_345_678, 1)).toBe(2_336_960)
    // 1,431,570 + 1,397,000 + 6,000,000 × 98% × 38% (2,234,400)
    expect(taxTableAmount(20_000_000, 2)).toBe(5_062_970)
    // 1,507,400 + 6,610,600 + 1,000,000 × 98% × 40% (392,000)
    expect(taxTableAmount(29_000_000, 1)).toBe(8_510_000)
    // 1,507,400 + 13,394,600 + 5,000,000 × 42%
    expect(taxTableAmount(50_000_000, 1)).toBe(17_002_000)
    // 1,507,400 + 31,034,600 + 13,000,000 × 45%
    expect(taxTableAmount(100_000_000, 1)).toBe(38_392_000)
  })

  it('공제대상가족 11명 초과는 비고 4 의 방식', () => {
    // 4,000천원: 11명 23,070, 10명 28,320 → 12명 = 23,070 - 5,250
    expect(taxTableAmount(4_000_000, 12)).toBe(17_820)
    expect(taxTableAmount(4_000_000, 20)).toBe(0)
  })

  it('표 데이터: 646개 구간이 770~10,000천원을 빈틈없이 덮는다', () => {
    expect(TAX_TABLE).toHaveLength(646)
    expect(TAX_TABLE[0]![0]).toBe(770)
    expect(TAX_TABLE.at(-1)![1]).toBe(10_000)
    for (let i = 1; i < TAX_TABLE.length; i++) expect(TAX_TABLE[i]![0]).toBe(TAX_TABLE[i - 1]![1])
    expect(TAX_AT_10000).toHaveLength(11)
  })
})

describe('원천징수 세액', () => {
  it('지방소득세는 소득세의 10%', () => {
    const r = withholdingTax({ monthlyPay: 3_000_000, month: '2026-10' })
    expect(r.incomeTax).toBe(74_350)
    expect(r.localIncomeTax).toBe(7_430)
    expect(r.total).toBe(81_780)
  })

  it('8~20세 자녀 공제는 2026년 3월부터 커졌다', () => {
    const pay = 4_000_000
    expect(withholdingTax({ monthlyPay: pay, family: 3, children: 1, month: '2026-02' }).incomeTax).toBe(109_590 - 12_500)
    expect(withholdingTax({ monthlyPay: pay, family: 3, children: 1, month: '2026-03' }).incomeTax).toBe(109_590 - 20_830)
    expect(withholdingTax({ monthlyPay: pay, family: 4, children: 2, month: '2026-10' }).incomeTax).toBe(91_670 - 45_830)
    // 3명: 45,830 + 33,330 = 79,160 원 공제. 표 금액 78,550 원보다 커서 0원
    expect(withholdingTax({ monthlyPay: pay, family: 5, children: 3, month: '2026-10' }).incomeTax).toBe(0)
    expect(withholdingTax({ monthlyPay: 5_000_000, family: 5, children: 3, month: '2026-10' }).incomeTax).toBe(200_350 - 79_160)
  })

  it('자녀 공제가 세액보다 크면 0원', () => {
    expect(withholdingTax({ monthlyPay: 2_000_000, family: 3, children: 2, month: '2026-10' }).incomeTax).toBe(0)
  })

  it('원천징수 비율 80% · 120%', () => {
    expect(withholdingTax({ monthlyPay: 3_000_000, ratio: 80, month: '2026-10' }).incomeTax).toBe(59_480)
    expect(withholdingTax({ monthlyPay: 3_000_000, ratio: 120, month: '2026-10' }).incomeTax).toBe(89_220)
  })

  it('2024년 3월 전은 다른 표라 지원하지 않는다', () => {
    expect(() => withholdingTax({ monthlyPay: 3_000_000, month: '2024-02' })).toThrow(OutOfRangeError)
    expect(withholdingTax({ monthlyPay: 3_000_000, month: '2024-03' }).incomeTax).toBe(74_350)
  })

  it('잘못된 입력', () => {
    expect(() => withholdingTax({ monthlyPay: 3_000_000, family: 0 })).toThrow(PayrollInputError)
    expect(() => withholdingTax({ monthlyPay: 3_000_000, family: 2, children: 2 })).toThrow(PayrollInputError)
    // @ts-expect-error 없는 비율
    expect(() => withholdingTax({ monthlyPay: 3_000_000, ratio: 90 })).toThrow(PayrollInputError)
  })
})
