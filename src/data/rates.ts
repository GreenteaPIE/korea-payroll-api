/**
 * 연도·기간별 요율과 기준 금액. 요율은 ppm(백만분율, 1% = 10,000)으로 적어 소수 오차 없이 계산한다.
 * 각 항목은 from(YYYY-MM)부터 다음 항목 전까지 적용된다. provisional 은 아직 공식 발표 전이라
 * 직전 값을 그대로 쓰고 있다는 뜻이다.
 */

export interface Period {
  /** 적용 시작 월 (YYYY-MM) */
  from: string
  source: string
  provisional?: boolean
}

/** 국민연금: 보험료율, 기준소득월액 하한·상한 (상·하한은 매년 7월 바뀐다) */
export interface PensionPeriod extends Period {
  ratePpm: number
  floor: number
  ceiling: number
}

export const PENSION: readonly PensionPeriod[] = [
  { from: '2023-07', ratePpm: 90_000, floor: 370_000, ceiling: 5_900_000, source: '보건복지부 고시 (2023.7~2024.6 기준소득월액)' },
  { from: '2024-07', ratePpm: 90_000, floor: 390_000, ceiling: 6_170_000, source: '보건복지부 고시 (2024.7~2025.6 기준소득월액)' },
  { from: '2025-07', ratePpm: 90_000, floor: 400_000, ceiling: 6_370_000, source: '보건복지부 고시 (2025.7~2026.6 기준소득월액)' },
  // 2025년 국민연금법 개정: 2026년부터 매년 0.5%p 올라 2033년 13%
  { from: '2026-01', ratePpm: 95_000, floor: 400_000, ceiling: 6_370_000, source: '국민연금법 개정 (2026년 9.5%)' },
  { from: '2026-07', ratePpm: 95_000, floor: 410_000, ceiling: 6_590_000, source: '국민연금공단 공고 (2026.7~2027.6 기준소득월액 41만~659만원)' },
  { from: '2027-01', ratePpm: 100_000, floor: 410_000, ceiling: 6_590_000, source: '국민연금법 개정 (2027년 10%)' },
]

/**
 * 건강보험: 보험료율, 장기요양보험료율(소득 대비), 월 보수월액보험료 하한·상한(근로자+사용자 합계).
 * 상·하한은 「월별 건강보험료액의 상한과 하한에 관한 고시」(보건복지부).
 */
export interface HealthPeriod extends Period {
  ratePpm: number
  longTermCarePpm: number
  premiumFloor: number
  premiumCeiling: number
}

export const HEALTH: readonly HealthPeriod[] = [
  { from: '2024-01', ratePpm: 70_900, longTermCarePpm: 9_182, premiumFloor: 19_780, premiumCeiling: 8_481_420, source: '건강보험료율 7.09%, 장기요양 0.9182%, 보건복지부고시 제2023-267호' },
  { from: '2025-01', ratePpm: 70_900, longTermCarePpm: 9_182, premiumFloor: 19_780, premiumCeiling: 9_008_340, source: '건강보험료율 7.09% 동결, 장기요양 0.9182%, 보건복지부고시 제2024-289호' },
  { from: '2026-01', ratePpm: 71_900, longTermCarePpm: 9_448, premiumFloor: 20_160, premiumCeiling: 9_183_480, source: '건강보험료율 7.19%, 장기요양 0.9448% (제6차 장기요양위원회), 보건복지부고시 제2025-222호' },
  {
    from: '2027-01',
    ratePpm: 71_900,
    longTermCarePpm: 9_448,
    premiumFloor: 20_160,
    premiumCeiling: 9_183_480,
    provisional: true,
    source: '건강보험료율 7.19% 동결 (2026.9.8 건강보험정책심의위원회). 장기요양보험료율과 상·하한은 발표 전이라 2026년 값',
  },
]

/** 고용보험: 근로자 실업급여 요율과 사업주 고용안정·직업능력개발 요율(기업 규모별) */
export interface EmploymentPeriod extends Period {
  unemploymentPpm: number
}

export const EMPLOYMENT: readonly EmploymentPeriod[] = [
  { from: '2022-07', unemploymentPpm: 9_000, source: '고용보험료율 고시 (실업급여 1.8%, 근로자·사업주 각 0.9%)' },
]

export type CompanySize = 'under150' | 'priority' | 'under1000' | 'over1000'

/** 사업주만 내는 고용안정·직업능력개발사업 보험료율 */
export const EMPLOYER_STABILITY_PPM: Record<CompanySize, number> = {
  under150: 2_500, // 150인 미만 0.25%
  priority: 4_500, // 150인 이상 우선지원대상기업 0.45%
  under1000: 6_500, // 150인 이상 1,000인 미만 0.65%
  over1000: 8_500, // 1,000인 이상, 국가·지방자치단체 0.85%
}

/** 최저임금 (시간급, 원) */
export const MINIMUM_WAGE: Readonly<Record<number, { hourly: number; source: string }>> = {
  2024: { hourly: 9_860, source: '고용노동부 고시 (2024년 적용 최저임금)' },
  2025: { hourly: 10_030, source: '고용노동부 고시 (2025년 적용 최저임금)' },
  2026: { hourly: 10_320, source: '고용노동부 고시 (2026년 적용 최저임금)' },
  2027: { hourly: 10_700, source: '최저임금위원회 의결 (2026.7.14)' },
}

/** 8세 이상 20세 이하 자녀 세액 공제 (간이세액표 비고 3) */
export interface ChildCreditPeriod extends Period {
  one: number
  two: number
  perExtra: number
}

export const CHILD_CREDIT: readonly ChildCreditPeriod[] = [
  { from: '2024-03', one: 12_500, two: 29_160, perExtra: 25_000, source: '소득세법 시행령 별표2 <개정 2024. 2. 29.>' },
  { from: '2026-03', one: 20_830, two: 45_830, perExtra: 33_330, source: '소득세법 시행령 별표2 <개정 2026. 2. 27.>' },
]

/** 간이세액표를 쓸 수 있는 첫 달. 그 전은 다른 표(2023년 개정)라 지원하지 않는다 */
export const TAX_TABLE_FROM = '2024-03'

/** 지원 범위의 마지막 달. 그 뒤는 요율이 발표되면 늘린다 */
export const SUPPORTED_UNTIL = '2027-12'
