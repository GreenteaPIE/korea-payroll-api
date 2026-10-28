import { describe, expect, it } from 'vitest'
import fixtures from './fixtures-4insure-2026.json'
import { insurance, OutOfRangeError, PayrollInputError, type CompanySize } from '../src/lib/index.ts'

/** 4대사회보험 정보연계센터 모의계산의 기업 규모 코드 */
const SIZE: Record<string, CompanySize> = { A: 'under150', B: 'priority', C: 'under1000', D: 'over1000' }

describe('4대사회보험 정보연계센터 모의계산과 같은 결과 (2026년 10월, 96건)', () => {
  for (const r of fixtures.results) {
    it(`월 ${r.salAmt.toLocaleString()}원, 규모 ${r.size}`, () => {
      const got = insurance({ monthlyPay: r.salAmt, month: '2026-10', companySize: SIZE[r.size] })
      expect(got.nationalPension.base).toBe(r.npsSalAmt)
      expect(got.nationalPension.employee).toBe(r.npsWrkrAmt)
      expect(got.nationalPension.employer).toBe(r.npsBizprAmt)
      expect(got.employment.employee).toBe(r.epiWrkrAmt)
      expect(got.employment.employer).toBe(r.epiBizprAmt)

      if (r.salAmt > r.nhiUpprAmt) {
        // 상한에 걸리는 월 1억 2,772만원 초과만 다르다. 모의계산은 보수월액을 자른 뒤 곱해 4,591,730원,
        // 고시(보건복지부고시 제2025-222호)는 월 보험료 상한 9,183,480원이라 절반인 4,591,740원이다. 고시를 따른다.
        expect(got.health.employee).toBe(9_183_480 / 2)
        expect(got.health.employee - r.nhiWrkrAmt).toBe(10)
      } else {
        expect(got.health.employee).toBe(r.nhiWrkrAmt)
        expect(got.health.employer).toBe(r.nhiBizprAmt)
        expect(got.longTermCare.employee).toBe(r.nhiLngtCnvlWrkrAmt)
        expect(got.longTermCare.employer).toBe(r.nhiLngtCnvlBizprAmt)
      }
    })
  }
})

describe('기간별 요율', () => {
  it('국민연금 상·하한은 7월에 바뀐다', () => {
    expect(insurance({ monthlyPay: 7_000_000, month: '2026-06' }).nationalPension.base).toBe(6_370_000)
    expect(insurance({ monthlyPay: 7_000_000, month: '2026-07' }).nationalPension.base).toBe(6_590_000)
    expect(insurance({ monthlyPay: 100_000, month: '2025-06' }).nationalPension.base).toBe(390_000)
  })

  it('국민연금 요율: 2025년 9%, 2026년 9.5%, 2027년 10%', () => {
    const pay = 3_000_000
    expect(insurance({ monthlyPay: pay, month: '2025-12' }).nationalPension.employee).toBe(135_000)
    expect(insurance({ monthlyPay: pay, month: '2026-01' }).nationalPension.employee).toBe(142_500)
    expect(insurance({ monthlyPay: pay, month: '2027-01' }).nationalPension.employee).toBe(150_000)
  })

  it('2025년 건강보험 3.545%, 장기요양은 건강보험료 × 0.9182/7.09', () => {
    const r = insurance({ monthlyPay: 3_000_000, month: '2025-05' })
    expect(r.health.employee).toBe(106_350)
    expect(r.longTermCare.employee).toBe(13_770) // 106,350 × 0.9182 ÷ 7.09 = 13,773.0 → 10원 미만 버림
  })

  it('2027년은 장기요양 요율이 아직 발표 전이라 provisional', () => {
    expect(insurance({ monthlyPay: 3_000_000, month: '2027-03' }).provisional).toBe(true)
    expect(insurance({ monthlyPay: 3_000_000, month: '2026-03' }).provisional).toBe(false)
  })

  it('지원 기간 밖은 OutOfRangeError', () => {
    expect(() => insurance({ monthlyPay: 3_000_000, month: '2023-12' })).toThrow(OutOfRangeError)
    expect(() => insurance({ monthlyPay: 3_000_000, month: '2028-01' })).toThrow(OutOfRangeError)
  })

  it('잘못된 입력은 PayrollInputError', () => {
    expect(() => insurance({ monthlyPay: -1 })).toThrow(PayrollInputError)
    expect(() => insurance({ monthlyPay: 1.5 })).toThrow(PayrollInputError)
    expect(() => insurance({ monthlyPay: 1000, month: '2026-13' })).toThrow(PayrollInputError)
    // @ts-expect-error 없는 규모
    expect(() => insurance({ monthlyPay: 1000, companySize: 'huge' })).toThrow(PayrollInputError)
  })

  it('합계는 항목의 합', () => {
    const r = insurance({ monthlyPay: 3_456_789, month: '2026-10', companySize: 'under1000' })
    expect(r.total.employee).toBe(r.nationalPension.employee + r.health.employee + r.longTermCare.employee + r.employment.employee)
    expect(r.total.employer).toBe(r.nationalPension.employer + r.health.employer + r.longTermCare.employer + r.employment.employer)
  })
})
