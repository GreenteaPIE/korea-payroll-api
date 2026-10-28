import { describe, expect, it } from 'vitest'
import * as entry from '../src/index.ts'

const app = entry.default

const get = async (path: string, headers: Record<string, string> = {}) => {
  const res = await app.request(path, { headers })
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text()
  return { res, body: body as any }
}

describe('API', () => {
  it('Worker 진입 파일은 default 하나만 내보낸다 (다른 export 가 있으면 Workers 런타임이 뜨지 않는다)', () => {
    expect(Object.keys(entry)).toEqual(['default'])
  })

  it('/v1/net-pay: 연봉으로 실수령액', async () => {
    const { res, body } = await get('/v1/net-pay?annual=40000000&nonTaxable=200000&month=2026-10')
    expect(res.status).toBe(200)
    expect(body.monthlyPay).toBe(3_333_333)
    expect(body.deductions.nationalPension).toBe(148_810)
    expect(body.netPay).toBe(body.monthlyPay - body.deductions.total)
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400')
  })

  it('/v1/net-pay: 월급, 부양가족·자녀·비율', async () => {
    const { res, body } = await get('/v1/net-pay?monthly=5000000&family=3&children=1&taxRatio=120&month=2026-10')
    expect(res.status).toBe(200)
    expect(body.tax.childCredit).toBe(20_830)
    expect(body.tax.ratio).toBe(120)
  })

  it('/v1/net-pay: annual 과 monthly 를 함께 주면 400', async () => {
    const { res, body } = await get('/v1/net-pay?annual=1&monthly=1')
    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_PARAMETER')
  })

  it('/v1/insurance: 기업 규모별 고용보험', async () => {
    const { body } = await get('/v1/insurance?pay=2000000&companySize=over1000&month=2026-10')
    expect(body.employment).toMatchObject({ employee: 18_000, employer: 35_000 })
    expect(body.health.employee).toBe(71_900)
    expect(body.longTermCare.employee).toBe(9_440)
  })

  it('/v1/insurance: 잘못된 금액은 400, 지원 기간 밖은 404', async () => {
    expect((await get('/v1/insurance?pay=-5')).res.status).toBe(400)
    expect((await get('/v1/insurance?pay=abc')).res.status).toBe(400)
    const { res, body } = await get('/v1/insurance?pay=3000000&month=2020-01')
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('OUT_OF_RANGE')
  })

  it('/v1/tax', async () => {
    const { body } = await get('/v1/tax?pay=3000000&month=2026-10')
    expect(body).toMatchObject({ incomeTax: 74_350, localIncomeTax: 7_430 })
    expect((await get('/v1/tax?pay=3000000&ratio=90')).res.status).toBe(400)
  })

  it('/v1/minimum-wage', async () => {
    const { body } = await get('/v1/minimum-wage?year=2027')
    expect(body).toMatchObject({ hourly: 10_700, monthly: 2_236_300 })
    expect(body.years).toContain(2026)
    expect((await get('/v1/minimum-wage?year=2010')).res.status).toBe(404)
  })

  it('/v1/minimum-wage/check', async () => {
    const { body } = await get('/v1/minimum-wage/check?pay=2100000&year=2026')
    expect(body).toMatchObject({ ok: false, shortfall: 56_880 })
  })

  it('/v1/weekly-holiday-pay', async () => {
    const { body } = await get('/v1/weekly-holiday-pay?hourly=10320&weeklyHours=20')
    expect(body).toEqual({ eligible: true, hours: 4, pay: 41_280 })
  })

  it('/v1/severance', async () => {
    const { res, body } = await get('/v1/severance?start=2023-11-01&end=2026-11-01&wages=9000000')
    expect(res.status).toBe(200)
    expect(body.eligible).toBe(true)
    expect(body.serviceDays).toBe(1096)
    expect((await get('/v1/severance?start=2023-02-30&end=2026-11-01&wages=1')).res.status).toBe(400)
  })

  it('/v1/rates', async () => {
    const { body } = await get('/v1/rates?month=2026-10')
    expect(body.nationalPension.ratePercent).toBe(9.5)
    expect(body.health.source).toContain('제2025-222호')
  })

  it('/openapi.json 과 /docs', async () => {
    const { body } = await get('/openapi.json')
    expect(Object.keys(body.paths)).toContain('/v1/net-pay')
    expect((await get('/docs')).res.status).toBe(200)
  })

  it('브라우저로 / 를 열면 계산기, 아니면 JSON 안내', async () => {
    const html = await get('/', { Accept: 'text/html' })
    expect(html.body).toContain('연봉 실수령액 계산기')
    expect(html.body).toContain('연봉별 실수령액')
    const json = await get('/')
    expect(json.body.endpoints).toContain('/v1/net-pay')
  })

  it('없는 경로는 404 JSON', async () => {
    const { res, body } = await get('/v1/nope')
    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
