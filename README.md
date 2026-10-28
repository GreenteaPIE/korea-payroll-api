# 💰 Korea Payroll API

[![Test & Deploy](https://github.com/GreenteaPIE/korea-payroll-api/actions/workflows/deploy.yml/badge.svg)](https://github.com/GreenteaPIE/korea-payroll-api/actions/workflows/deploy.yml)
[![npm](https://img.shields.io/npm/v/korea-payroll)](https://www.npmjs.com/package/korea-payroll)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

대한민국 급여 계산 Open API & 라이브러리입니다. **연봉 실수령액, 4대보험, 근로소득 간이세액, 최저임금, 주휴수당, 퇴직금**을 API 키 없이 JSON 으로 받을 수 있어요.

- 🌐 계산기: https://korea-payroll-api.greenteapie2023.workers.dev
- 📖 API 문서: https://korea-payroll-api.greenteapie2023.workers.dev/docs
- 📦 npm: `npm install korea-payroll`

## 무엇이 다른가요

- **법령 원문 그대로**: 근로소득 간이세액표는 법제처의 소득세법 시행령 [별표 2] PDF 에서 646개 구간을 그대로 옮겼어요 (`npm run tax-table`). 표를 흉내 낸 공식이 아니라 표 자체예요.
- **공식 계산기와 대조**: 4대보험은 4대사회보험 정보연계센터 모의계산의 결과 96건과 같은지 테스트해요. 10원 미만 버림, 국민연금 천원 미만 버림, 고용보험 사업주분을 항목별로 버림하는 것까지 같아요.
- **기간별 요율**: 국민연금은 7월마다 바뀌는 상·하한까지, 건강보험은 해마다 바뀌는 월 보험료 상·하한 고시까지 넣었어요. 아직 발표 전인 값은 `provisional: true` 로 알려 줘요.

## API

| 경로 | 설명 |
|---|---|
| `GET /v1/net-pay?annual=40000000&nonTaxable=200000` | 실수령액과 공제 내역 (`monthly=` 로 월급도 가능) |
| `GET /v1/insurance?pay=3000000&companySize=under150` | 4대보험 근로자·사업주 부담금 |
| `GET /v1/tax?pay=3000000&family=3&children=1&ratio=100` | 근로소득 간이세액 (소득세·지방소득세) |
| `GET /v1/minimum-wage?year=2027` | 최저임금 (시급·일급·월 209시간) |
| `GET /v1/minimum-wage/check?pay=2100000&weeklyHours=40` | 월급이 최저임금 이상인지 |
| `GET /v1/weekly-holiday-pay?hourly=10320&weeklyHours=20` | 주휴수당 |
| `GET /v1/severance?start=2023-11-01&end=2026-11-01&wages=9000000` | 퇴직금 |
| `GET /v1/rates?month=2026-10` | 그 달의 요율과 출처 |

모든 계산은 `month=YYYY-MM` 으로 기준 월을 정할 수 있고, 생략하면 이번 달(한국 시간)이에요.

```bash
curl "https://korea-payroll-api.greenteapie2023.workers.dev/v1/net-pay?annual=40000000&nonTaxable=200000&month=2026-10"
```

```json
{
  "month": "2026-10",
  "monthlyPay": 3333333,
  "taxablePay": 3133333,
  "deductions": {
    "nationalPension": 148810,
    "health": 112640,
    "longTermCare": 14800,
    "employment": 28190,
    "incomeTax": 84620,
    "localIncomeTax": 8460,
    "total": 397520
  },
  "netPay": 2935813,
  "annual": { "gross": 39999996, "net": 35229756 },
  "employerCost": 3645603,
  "provisional": false
}
```

오류는 `{ "error": { "code", "message" } }` 형식이에요. 잘못된 입력은 400, 요율 자료가 없는 기간은 404, 분당 120회를 넘으면 429 예요.

## 라이브러리

```ts
import { netPay, insurance, withholdingTax, minimumWage, severancePay } from 'korea-payroll'

netPay({ annualSalary: 40_000_000, nonTaxable: 200_000, month: '2026-10' }).netPay // 2935813
insurance({ monthlyPay: 2_000_000, month: '2026-10' }).health.employee // 71900
withholdingTax({ monthlyPay: 3_000_000, family: 3, children: 1 }).incomeTax
minimumWage(2027).hourly // 10700
severancePay({ startDate: '2023-11-01', endDate: '2026-11-01', wages3Months: 9_000_000 }).amount
```

## 계산 기준

| 항목 | 기준 |
|---|---|
| 국민연금 | 기준소득월액(천원 미만 버림, 하한·상한 적용) × 요율의 절반. 2025년 9%, 2026년 9.5%, 2027년 10% |
| 건강보험 | 보수월액 × 요율의 절반, 월 보험료 하한·상한 고시 적용. 2026·2027년 7.19% |
| 장기요양 | 건강보험료 × 장기요양보험료율 ÷ 건강보험료율. 2026년 소득 대비 0.9448% |
| 고용보험 | 근로자 0.9%. 사업주는 0.9% + 기업 규모별 0.25~0.85% (산재보험은 업종별이라 제외) |
| 소득세 | 소득세법 시행령 [별표 2] 간이세액표. 월 1,000만원 초과는 별표의 계산식. 8~20세 자녀 공제는 2026년 3월부터 1명 20,830원 |
| 지방소득세 | 소득세의 10% |
| 반올림 | 보험료·세금 모두 10원 미만 버림 |

- 비과세 소득(식대 등)은 4대보험과 세금 계산에서 빠져요.
- 실수령액은 매달 원천징수 기준이에요. 연말정산 결과에 따라 1년 세금은 달라질 수 있어요.
- 건강보험 상한(월 1억 2,772만원 초과)에서는 모의계산과 10원 차이가 나요. 모의계산은 보수월액을 자른 뒤 곱하고, 고시는 월 보험료(9,183,480원)를 상한으로 정하는데, 이 API 는 고시를 따라요.

### 지원 기간

- 4대보험: 2024년 1월 ~ 2027년 12월 (2027년 장기요양 요율과 건강보험 상·하한은 발표 전이라 2026년 값, `provisional: true`)
- 간이세액: 2024년 3월 ~ 2027년 12월 (그 전은 다른 표라 지원하지 않아요)
- 최저임금: 2024 ~ 2027년

### 출처

- 소득세법 시행령 [별표 2] 근로소득 간이세액표 <개정 2024. 2. 29.>, <개정 2026. 2. 27.> (법제처 국가법령정보센터, `sources/`)
- 「월별 건강보험료액의 상한과 하한에 관한 고시」 보건복지부고시 제2023-267호, 제2024-289호, 제2025-222호
- 국민연금공단 기준소득월액 상·하한 공고, 국민연금법 개정(2026년부터 매년 0.5%p 인상)
- 장기요양위원회 의결 (2026년 0.9448%), 건강보험정책심의위원회 (2027년 7.19% 동결)
- 고용노동부 최저임금 고시, 최저임금위원회 의결 (2027년 10,700원)
- 4대사회보험 정보연계센터 보험료 모의계산 (`test/fixtures-4insure-2026.json`)

## 개발

```bash
npm install
npm test          # 153개 테스트
npm run dev       # http://localhost:8787
npm run tax-table -- sources/소득세법시행령-별표2-2026-02-27.pdf   # 간이세액표가 개정되면 (pdftotext 필요)
```

요율이 바뀌면 `src/data/rates.ts` 에 기간을 하나 더하고 출처를 적어 주세요.

## 함께 쓰면 좋은 API

- [Korea Holidays API](https://github.com/GreenteaPIE/korea-holidays-api): 공휴일·영업일·연차 계산

## License

MIT
