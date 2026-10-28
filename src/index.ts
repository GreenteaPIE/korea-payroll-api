import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'
import {
  OutOfRangeError,
  PayrollInputError,
  SUPPORTED_RANGE,
  checkMinimumWage,
  insurance,
  minimumWage,
  MINIMUM_WAGE_YEARS,
  netPay,
  rates,
  severancePay,
  weeklyHolidayPay,
  withholdingTax,
} from './lib/index.ts'
import { landingHtml } from './pages/landing.ts'

type Bindings = {
  /** wrangler.toml 의 [[ratelimits]]. 로컬 테스트에서는 없다. */
  RATE_LIMITER?: RateLimit
}

const VERSION = '0.1.0'

// ---------- 공통 스키마 ----------

const Won = (description: string, example: number) =>
  z.coerce.number().int().min(0).max(10_000_000_000).openapi({ description, example })

const Month = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'YYYY-MM 형식이어야 합니다')
  .optional()
  .openapi({ example: '2026-10', description: '기준 월 YYYY-MM. 생략하면 이번 달(한국 시간)' })

const CompanySizeEnum = z.enum(['under150', 'priority', 'under1000', 'over1000']).openapi({
  description: '고용보험 사업주 요율을 정하는 기업 규모. under150: 150인 미만(기본), priority: 150인 이상 우선지원대상기업, under1000: 150~999인, over1000: 1,000인 이상·국가·지자체',
})

const Family = z.coerce.number().int().min(1).max(50).optional().openapi({ example: 1, description: '공제대상가족 수 (본인·배우자 포함, 기본 1)' })
const Children = z.coerce.number().int().min(0).max(49).optional().openapi({ example: 0, description: '그중 8세 이상 20세 이하 자녀 수 (기본 0)' })
const TaxRatio = z.enum(['80', '100', '120']).optional().openapi({ description: '원천징수 비율 % (기본 100)' })

const ErrorSchema = z
  .object({ error: z.object({ code: z.enum(['INVALID_PARAMETER', 'OUT_OF_RANGE', 'NOT_FOUND', 'RATE_LIMITED', 'INTERNAL_ERROR']), message: z.string() }) })
  .openapi('Error')

const errors = {
  400: { content: { 'application/json': { schema: ErrorSchema } }, description: '잘못된 입력' },
  404: { content: { 'application/json': { schema: ErrorSchema } }, description: '요율 자료가 없는 기간' },
}

const Share = z.object({ employee: z.number(), employer: z.number() })

const InsuranceSchema = z
  .object({
    month: z.string().openapi({ example: '2026-10' }),
    nationalPension: Share.extend({ base: z.number().openapi({ description: '기준소득월액' }), ratePercent: z.number() }),
    health: Share.extend({ base: z.number().openapi({ description: '보수월액' }), ratePercent: z.number() }),
    longTermCare: Share.extend({ ratePercent: z.number().openapi({ description: '소득 대비 장기요양보험료율' }) }),
    employment: Share.extend({ employeeRatePercent: z.number(), employerRatePercent: z.number() }),
    total: Share,
    provisional: z.boolean().openapi({ description: 'true 면 아직 발표 전이라 직전 요율을 쓴 항목이 있음' }),
  })
  .openapi('Insurance')

const TaxSchema = z
  .object({
    month: z.string(),
    tableAmount: z.number().openapi({ description: '간이세액표(또는 1,000만원 초과 계산식) 금액' }),
    childCredit: z.number().openapi({ description: '8~20세 자녀 공제액' }),
    ratio: z.number(),
    incomeTax: z.number(),
    localIncomeTax: z.number(),
    total: z.number(),
  })
  .openapi('WithholdingTax')

// ---------- 라우트 ----------

const netPayRoute = createRoute({
  method: 'get',
  path: '/v1/net-pay',
  summary: '실수령액 (4대보험 + 소득세·지방소득세 공제)',
  description: 'annual(연봉) 또는 monthly(월급) 중 하나를 넣는다. nonTaxable 은 식대 같은 월 비과세 금액.',
  request: {
    query: z.object({
      annual: Won('연봉 (세전)', 40_000_000).optional(),
      monthly: Won('월 급여 (세전, 비과세 포함)', 3_333_333).optional(),
      nonTaxable: Won('월 비과세 금액 (기본 0)', 200_000).optional(),
      family: Family,
      children: Children,
      companySize: CompanySizeEnum.optional(),
      taxRatio: TaxRatio,
      month: Month,
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              month: z.string(),
              monthlyPay: z.number(),
              nonTaxable: z.number(),
              taxablePay: z.number(),
              deductions: z.object({
                nationalPension: z.number(),
                health: z.number(),
                longTermCare: z.number(),
                employment: z.number(),
                incomeTax: z.number(),
                localIncomeTax: z.number(),
                total: z.number(),
              }),
              netPay: z.number().openapi({ example: 2_960_000 }),
              annual: z.object({ gross: z.number(), net: z.number() }),
              employerCost: z.number().openapi({ description: '회사가 내는 4대보험까지 더한 월 인건비 (산재 제외)' }),
              provisional: z.boolean(),
              insurance: InsuranceSchema,
              tax: TaxSchema,
            })
            .openapi('NetPay'),
        },
      },
      description: '월 실수령액과 공제 내역',
    },
    ...errors,
  },
})

const insuranceRoute = createRoute({
  method: 'get',
  path: '/v1/insurance',
  summary: '4대보험 근로자·사업주 부담금',
  request: { query: z.object({ pay: Won('월 보수 (비과세 제외)', 3_000_000), companySize: CompanySizeEnum.optional(), month: Month }) },
  responses: { 200: { content: { 'application/json': { schema: InsuranceSchema } }, description: '국민연금·건강·장기요양·고용보험' }, ...errors },
})

const taxRoute = createRoute({
  method: 'get',
  path: '/v1/tax',
  summary: '근로소득 간이세액 (매달 원천징수 소득세·지방소득세)',
  request: { query: z.object({ pay: Won('월 급여 (비과세 제외)', 3_000_000), family: Family, children: Children, ratio: TaxRatio, month: Month }) },
  responses: { 200: { content: { 'application/json': { schema: TaxSchema } }, description: '소득세법 시행령 별표2 기준' }, ...errors },
})

const minimumWageRoute = createRoute({
  method: 'get',
  path: '/v1/minimum-wage',
  summary: '연도별 최저임금',
  request: { query: z.object({ year: z.coerce.number().int().optional().openapi({ example: 2027, description: '생략하면 올해' }) }) },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z
            .object({
              year: z.number(),
              hourly: z.number().openapi({ example: 10_700 }),
              daily: z.number(),
              monthly: z.number().openapi({ example: 2_236_300 }),
              monthlyHours: z.number(),
              annual: z.number(),
              source: z.string(),
              years: z.array(z.number()),
            })
            .openapi('MinimumWage'),
        },
      },
      description: '시급, 일급(8시간), 월급(209시간)',
    },
    ...errors,
  },
})

const minimumWageCheckRoute = createRoute({
  method: 'get',
  path: '/v1/minimum-wage/check',
  summary: '월급이 최저임금 이상인지 확인',
  request: {
    query: z.object({
      pay: Won('최저임금에 산입되는 월 임금', 2_100_000),
      weeklyHours: z.coerce.number().min(0).max(168).optional().openapi({ example: 40, description: '주 소정근로시간 (기본 40)' }),
      year: z.coerce.number().int().optional().openapi({ example: 2026 }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            year: z.number(),
            monthlyHours: z.number(),
            hourlyEquivalent: z.number(),
            minimumHourly: z.number(),
            minimumMonthly: z.number(),
            ok: z.boolean(),
            shortfall: z.number(),
          }),
        },
      },
      description: '시간당 환산액과 부족분',
    },
    ...errors,
  },
})

const weeklyHolidayRoute = createRoute({
  method: 'get',
  path: '/v1/weekly-holiday-pay',
  summary: '주휴수당',
  request: {
    query: z.object({
      hourly: Won('시급', 10_320),
      weeklyHours: z.coerce.number().min(0).max(168).openapi({ example: 20, description: '주 소정근로시간 (15시간 이상이어야 받는다)' }),
    }),
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ eligible: z.boolean(), hours: z.number(), pay: z.number() }) } }, description: '주휴시간과 금액' },
    ...errors,
  },
})

const severanceRoute = createRoute({
  method: 'get',
  path: '/v1/severance',
  summary: '퇴직금',
  request: {
    query: z.object({
      start: z.string().openapi({ example: '2023-11-01', description: '입사일 YYYY-MM-DD' }),
      end: z.string().openapi({ example: '2026-11-01', description: '퇴직일 YYYY-MM-DD (마지막 근무일의 다음 날)' }),
      wages: Won('퇴직 전 3개월 임금 총액 (세전)', 9_000_000),
      bonus: Won('퇴직 전 1년 상여금 총액', 0).optional(),
      leavePay: Won('퇴직 전 1년 연차수당', 0).optional(),
      ordinaryDaily: z.coerce.number().min(0).optional().openapi({ description: '1일 통상임금 (평균임금보다 크면 이 값을 쓴다)' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            eligible: z.boolean(),
            serviceDays: z.number(),
            periodStart: z.string(),
            periodDays: z.number(),
            wageBase: z.number(),
            averageDailyWage: z.number(),
            appliedDailyWage: z.number(),
            amount: z.number(),
          }),
        },
      },
      description: '1일 평균임금 × 30 × 재직일수 ÷ 365',
    },
    ...errors,
  },
})

const ratesRoute = createRoute({
  method: 'get',
  path: '/v1/rates',
  summary: '그 달에 적용되는 요율과 기준 금액 (출처 포함)',
  request: { query: z.object({ month: Month }) },
  responses: { 200: { content: { 'application/json': { schema: z.record(z.string(), z.unknown()) } }, description: '요율' }, ...errors },
})

// ---------- 앱 ----------

const app = new OpenAPIHono<{ Bindings: Bindings }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join('.') || 'query'}: ${i.message}`).join(', ')
      return c.json({ error: { code: 'INVALID_PARAMETER' as const, message } }, 400)
    }
  },
})

app.use('*', cors())

app.use('*', async (c, next) => {
  const limiter = c.env?.RATE_LIMITER
  if (limiter) {
    const { success } = await limiter.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' })
    if (!success) {
      c.header('Retry-After', '60')
      return c.json({ error: { code: 'RATE_LIMITED', message: '요청이 너무 많습니다. 1분 뒤에 다시 시도해 주세요' } }, 429)
    }
  }
  await next()
})

app.use('/v1/*', async (c, next) => {
  await next()
  // 기준 월을 정하면 결과가 바뀌지 않는다. 생략하면 달이 바뀔 수 있어 짧게 둔다
  if (c.res.status === 200 && !c.res.headers.has('Cache-Control')) {
    c.header('Cache-Control', `public, max-age=${c.req.query('month') || c.req.query('year') ? 86_400 : 600}`)
  }
})

const thisYear = () => Number(new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 4))

app.openapi(netPayRoute, (c) => {
  const q = c.req.valid('query')
  return c.json(
    netPay({
      annualSalary: q.annual,
      monthlyPay: q.monthly,
      nonTaxable: q.nonTaxable,
      family: q.family,
      children: q.children,
      companySize: q.companySize,
      taxRatio: q.taxRatio ? (Number(q.taxRatio) as 80 | 100 | 120) : undefined,
      month: q.month,
    }),
    200,
  )
})

app.openapi(insuranceRoute, (c) => {
  const q = c.req.valid('query')
  return c.json(insurance({ monthlyPay: q.pay, companySize: q.companySize, month: q.month }), 200)
})

app.openapi(taxRoute, (c) => {
  const q = c.req.valid('query')
  const ratio = q.ratio ? (Number(q.ratio) as 80 | 100 | 120) : undefined
  return c.json(withholdingTax({ monthlyPay: q.pay, family: q.family, children: q.children, ratio, month: q.month }), 200)
})

app.openapi(minimumWageRoute, (c) => {
  const year = c.req.valid('query').year ?? thisYear()
  return c.json({ ...minimumWage(year), years: MINIMUM_WAGE_YEARS }, 200)
})

app.openapi(minimumWageCheckRoute, (c) => {
  const q = c.req.valid('query')
  return c.json(checkMinimumWage({ monthlyPay: q.pay, weeklyHours: q.weeklyHours, year: q.year ?? thisYear() }), 200)
})

app.openapi(weeklyHolidayRoute, (c) => {
  const q = c.req.valid('query')
  return c.json(weeklyHolidayPay({ hourlyWage: q.hourly, weeklyHours: q.weeklyHours }), 200)
})

app.openapi(severanceRoute, (c) => {
  const q = c.req.valid('query')
  return c.json(
    severancePay({
      startDate: q.start,
      endDate: q.end,
      wages3Months: q.wages,
      annualBonus: q.bonus,
      annualLeaveAllowance: q.leavePay,
      ordinaryDailyWage: q.ordinaryDaily,
    }),
    200,
  )
})

app.openapi(ratesRoute, (c) => c.json(rates(c.req.valid('query').month) as unknown as Record<string, unknown>, 200))

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Korea Payroll API',
    version: VERSION,
    description: '대한민국 급여 계산 Open API — 연봉 실수령액·4대보험·근로소득 간이세액·최저임금·주휴수당·퇴직금. API 키 없이 JSON 으로 바로 사용',
  },
})
app.get('/docs', swaggerUI({ url: '/openapi.json' }))

app.get('/', (c) => {
  if (c.req.header('Accept')?.includes('text/html')) {
    c.header('Cache-Control', 'public, max-age=3600')
    return c.html(landingHtml(thisYear()))
  }
  return c.json({
    name: 'Korea Payroll API',
    version: VERSION,
    docs: '/docs',
    openapi: '/openapi.json',
    supported: SUPPORTED_RANGE,
    endpoints: ['/v1/net-pay', '/v1/insurance', '/v1/tax', '/v1/minimum-wage', '/v1/minimum-wage/check', '/v1/weekly-holiday-pay', '/v1/severance', '/v1/rates'],
  })
})

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: `${c.req.path} 경로가 없습니다. /docs 를 참고하세요` } }, 404))

app.onError((err, c) => {
  if (err instanceof OutOfRangeError) return c.json({ error: { code: 'OUT_OF_RANGE', message: err.message } }, 404)
  if (err instanceof PayrollInputError) return c.json({ error: { code: 'INVALID_PARAMETER', message: err.message } }, 400)
  console.error(err)
  return c.json({ error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' } }, 500)
})

export default app
