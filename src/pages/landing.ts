// 소개 페이지: 실수령액 계산기 + 연봉별 실수령액 표 + API 사용법
import { netPay, rates } from '../lib/index.ts'

export const SITE_URL = 'https://korea-payroll-api.greenteapie2023.workers.dev'
export const GITHUB_URL = 'https://github.com/GreenteaPIE/korea-payroll-api'
export const NPM_URL = 'https://www.npmjs.com/package/korea-payroll'
const HOLIDAYS_URL = 'https://korea-holidays-api.greenteapie2023.workers.dev'

const won = (n: number) => n.toLocaleString('ko-KR')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
  :root {
    --bg: #f6f7f5; --surface: #ffffff; --text: #1b1d1c; --muted: #6a706c; --border: #e1e4e0;
    --accent: #13795b; --accent-soft: #e4f2ec; --minus: #b4262f; --code-bg: #f0f2ef;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #101211; --surface: #1a1d1b; --text: #eff2ef; --muted: #a0a7a2; --border: #2c312e;
      --accent: #4cc596; --accent-soft: #15291f; --minus: #ff7b83; --code-bg: #222624; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.6;
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", "Noto Sans KR", sans-serif; }
  main { max-width: 900px; margin: 0 auto; padding: 44px 16px 80px; }
  h1 { font-size: clamp(28px, 6vw, 40px); margin: 0 0 8px; letter-spacing: -0.02em; line-height: 1.25; }
  h2 { font-size: 21px; margin: 52px 0 12px; letter-spacing: -0.01em; }
  p { margin: 0 0 12px; }
  a { color: var(--accent); }
  .lead { color: var(--muted); font-size: 17px; max-width: 46em; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13.5px; }
  pre { background: var(--code-bg); border-radius: 10px; padding: 14px 16px; overflow-x: auto; margin: 0 0 12px; }
  :focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 0; }
  .chip { font-size: 13px; padding: 3px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 600; text-decoration: none; }

  .calc { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; margin-top: 28px; }
  .fields { display: grid; gap: 14px; align-content: start; }
  .field { display: grid; gap: 6px; align-content: start; }
  .field label { font-weight: 700; font-size: 14px; }
  .field .hint { color: var(--muted); font-size: 12.5px; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  input, select { font: inherit; width: 100%; min-height: 44px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px;
    background: var(--surface); color: var(--text); }
  .money { position: relative; }
  .money input { padding-right: 44px; text-align: right; font-size: 18px; font-weight: 700; }
  .money span { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .seg button { font: inherit; font-size: 14px; border: 0; padding: 6px 14px; background: var(--surface); color: var(--muted); cursor: pointer; }
  .seg button[aria-pressed="true"] { background: var(--accent); color: #fff; }
  .result { display: grid; gap: 4px; align-content: start; }
  .net-label { color: var(--muted); font-size: 14px; }
  .net { font-size: clamp(34px, 7vw, 46px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; }
  .net-sub { color: var(--muted); font-size: 14px; margin-bottom: 12px; }
  .lines { width: 100%; border-collapse: collapse; font-size: 15px; }
  .lines td { padding: 7px 0; border-top: 1px solid var(--border); }
  .lines td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .lines .minus td:last-child { color: var(--minus); }
  .lines .sum td { font-weight: 800; }
  .note { color: var(--muted); font-size: 12.5px; margin-top: 10px; }
  .error { color: var(--minus); font-weight: 600; }

  .table-wrap { overflow-x: auto; }
  table.salary { width: 100%; border-collapse: collapse; font-size: 14.5px; font-variant-numeric: tabular-nums; }
  table.salary th, table.salary td { padding: 9px 10px; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; }
  table.salary th:first-child, table.salary td:first-child { text-align: left; }
  table.salary thead th { color: var(--muted); font-weight: 600; font-size: 13px; }
  table.salary td.net-cell { font-weight: 800; color: var(--accent); }
  .endpoints { display: grid; gap: 10px; }
  .endpoints div { display: grid; grid-template-columns: 220px 1fr; gap: 12px; align-items: baseline; }
  .endpoints code { font-weight: 700; }
  .rates { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .rates .card { padding: 16px; }
  .rates b { display: block; font-size: 22px; }
  .rates small { color: var(--muted); }
  footer { margin-top: 56px; color: var(--muted); font-size: 14px; display: flex; flex-wrap: wrap; gap: 6px 18px; }
  @media (max-width: 720px) {
    .calc { grid-template-columns: 1fr; }
    .endpoints div { grid-template-columns: 1fr; gap: 2px; }
  }
`

const SALARIES = [24, 30, 36, 40, 45, 50, 60, 70, 80, 100, 120].map((m) => m * 1_000_000)

export function landingHtml(year: number): string {
  const month = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 7)
  const r = rates(month)
  const rows = SALARIES.map((annual) => {
    const n = netPay({ annualSalary: annual, nonTaxable: 200_000, month })
    const ins = n.deductions.nationalPension + n.deductions.health + n.deductions.longTermCare + n.deductions.employment
    const tax = n.deductions.incomeTax + n.deductions.localIncomeTax
    return `<tr><td>${won(annual / 10_000)}만원</td><td>${won(n.monthlyPay)}</td><td>${won(ins)}</td><td>${won(tax)}</td><td class="net-cell">${won(n.netPay)}</td></tr>`
  }).join('')

  const title = `${year} 연봉 실수령액 계산기 & 급여 계산 Open API`
  const description = `${year}년 4대보험 요율과 근로소득 간이세액표로 연봉 실수령액을 계산합니다. 4대보험·소득세·최저임금·주휴수당·퇴직금을 API 키 없이 JSON 으로 쓸 수 있는 무료 Open API`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Korea Payroll API',
    url: SITE_URL,
    applicationCategory: 'FinanceApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    description,
  }

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="keywords" content="연봉 실수령액, 실수령액 계산기, 4대보험 계산, 간이세액표, 최저임금, 주휴수당, 퇴직금 계산, 급여 API, payroll api korea">
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Korea Payroll API">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE_URL}/">
<meta name="theme-color" content="#13795b">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💰</text></svg>">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
<style>${CSS}</style>
</head>
<body>
<main>
  <h1>연봉 실수령액 계산기</h1>
  <p class="lead">${year}년 4대보험 요율과 근로소득 간이세액표(2026. 2. 27. 개정)로 매달 통장에 들어오는 금액을 계산해요.
  같은 계산을 <a href="/docs">API</a> 로도 쓸 수 있어요. 키 없이 무료예요.</p>

  <section class="card calc" aria-label="실수령액 계산기">
    <form class="fields" id="calc" onsubmit="return false">
      <div class="field">
        <label for="amount">급여 <span class="seg" role="group" aria-label="연봉 또는 월급">
          <button type="button" data-mode="annual" aria-pressed="true">연봉</button><button type="button" data-mode="monthly" aria-pressed="false">월급</button>
        </span></label>
        <div class="money"><input id="amount" inputmode="numeric" autocomplete="off" value="40,000,000" aria-describedby="amount-hint"><span>원</span></div>
        <span class="hint" id="amount-hint">세전, 비과세 포함 금액</span>
      </div>
      <div class="field">
        <label for="nonTaxable">월 비과세 (식대 등)</label>
        <div class="money"><input id="nonTaxable" inputmode="numeric" autocomplete="off" value="200,000"><span>원</span></div>
      </div>
      <div class="row2">
        <div class="field">
          <label for="family">부양가족 수</label>
          <select id="family">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}">${n}명${n === 1 ? ' (본인만)' : ''}</option>`).join('')}</select>
          <span class="hint">본인·배우자 포함</span>
        </div>
        <div class="field">
          <label for="children">8~20세 자녀</label>
          <select id="children">${[0, 1, 2, 3, 4].map((n) => `<option value="${n}">${n}명</option>`).join('')}</select>
        </div>
      </div>
      <div class="field">
        <label for="month">기준 월</label>
        <input id="month" type="month" value="${month}" min="2024-03" max="2027-12">
      </div>
    </form>
    <div class="result" aria-live="polite">
      <span class="net-label">월 실수령액</span>
      <div class="net" id="net">-</div>
      <div class="net-sub" id="net-sub"></div>
      <table class="lines" id="lines"></table>
      <p class="note" id="note">회사가 매달 원천징수하는 금액 기준이에요. 연말정산 결과에 따라 실제 1년 세금은 달라질 수 있어요.</p>
    </div>
  </section>

  <h2>${year}년 연봉별 실수령액</h2>
  <p>비과세 식대 월 20만원, 부양가족 1명(본인), ${month} 기준.</p>
  <div class="card table-wrap">
    <table class="salary">
      <thead><tr><th scope="col">연봉</th><th scope="col">월 급여</th><th scope="col">4대보험</th><th scope="col">소득세·지방세</th><th scope="col">월 실수령액</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <h2>${month} 적용 요율</h2>
  <div class="rates">
    <div class="card"><small>국민연금 (근로자)</small><b>${r.nationalPension.ratePercent / 2}%</b><small>기준소득월액 ${won(r.nationalPension.floor)}~${won(r.nationalPension.ceiling)}원</small></div>
    <div class="card"><small>건강보험 (근로자)</small><b>${Math.round((r.health.ratePercent / 2) * 10000) / 10000}%</b><small>장기요양 소득 대비 ${r.health.longTermCarePercent}%</small></div>
    <div class="card"><small>고용보험 (근로자)</small><b>${r.employment.employeePercent}%</b><small>실업급여</small></div>
    <div class="card"><small>최저임금</small><b>${r.minimumWage ? won(r.minimumWage.hourly) + '원' : '-'}</b><small>월 209시간 ${r.minimumWage ? won(r.minimumWage.hourly * 209) + '원' : ''}</small></div>
  </div>
  <p class="note">출처: 국민연금공단 공고, 「월별 건강보험료액의 상한과 하한에 관한 고시」, 소득세법 시행령 [별표 2], 고용노동부 최저임금 고시. 결과는 4대사회보험 정보연계센터 모의계산과 대조해 테스트해요.</p>

  <h2>API</h2>
  <p>API 키 없이 GET 요청으로 JSON 을 받아요. 금액은 모두 원 단위 정수예요.</p>
  <pre><code>curl "${SITE_URL}/v1/net-pay?annual=40000000&nonTaxable=200000&month=2026-10"</code></pre>
  <div class="card endpoints">
    <div><code>/v1/net-pay</code><span>연봉·월급 → 실수령액과 공제 내역</span></div>
    <div><code>/v1/insurance</code><span>4대보험 근로자·사업주 부담금 (기업 규모별 고용보험)</span></div>
    <div><code>/v1/tax</code><span>근로소득 간이세액 (부양가족·자녀·80/120% 선택)</span></div>
    <div><code>/v1/minimum-wage</code><span>연도별 최저임금 (시급·일급·월급)</span></div>
    <div><code>/v1/minimum-wage/check</code><span>내 월급이 최저임금 이상인지</span></div>
    <div><code>/v1/weekly-holiday-pay</code><span>주휴수당</span></div>
    <div><code>/v1/severance</code><span>퇴직금 (평균임금·통상임금 비교)</span></div>
    <div><code>/v1/rates</code><span>그 달의 요율과 출처</span></div>
  </div>
  <p style="margin-top:12px">자세한 파라미터는 <a href="/docs">API 문서</a>, 자바스크립트에서는 npm 패키지로 바로 쓸 수 있어요.</p>
  <pre><code>npm install korea-payroll

import { netPay } from 'korea-payroll'
netPay({ annualSalary: 40_000_000, nonTaxable: 200_000 }).netPay</code></pre>

  <footer>
    <a href="${GITHUB_URL}">GitHub</a>
    <a href="${NPM_URL}">npm</a>
    <a href="/docs">API 문서</a>
    <a href="${HOLIDAYS_URL}">Korea Holidays API</a>
    <span>MIT License</span>
  </footer>
</main>
<script>
(() => {
  const $ = (id) => document.getElementById(id)
  const won = (n) => n.toLocaleString('ko-KR')
  const digits = (s) => Number(String(s).replace(/[^0-9]/g, '')) || 0
  let mode = 'annual'

  // 금액 칸은 쉼표를 넣어 보여 준다
  for (const id of ['amount', 'nonTaxable']) {
    $(id).addEventListener('input', (e) => {
      const n = digits(e.target.value)
      e.target.value = n ? won(n) : ''
      schedule()
    })
  }
  for (const id of ['family', 'children', 'month']) $(id).addEventListener('change', schedule)
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode === mode) return
    const n = digits($('amount').value)
    mode = b.dataset.mode
    $('amount').value = won(mode === 'monthly' ? Math.floor(n / 12) : n * 12)
    document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    schedule()
  }))

  let timer
  function schedule() { clearTimeout(timer); timer = setTimeout(calc, 250) }

  async function calc() {
    const amount = digits($('amount').value)
    const family = Number($('family').value)
    const children = Math.min(Number($('children').value), family - 1)
    if (Number($('children').value) !== children) $('children').value = children
    if (!amount) { $('net').textContent = '-'; $('lines').innerHTML = ''; return }
    const q = new URLSearchParams({ [mode]: amount, nonTaxable: digits($('nonTaxable').value), family, children, month: $('month').value })
    try {
      const res = await fetch('/v1/net-pay?' + q)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error?.message || '계산하지 못했어요')
      $('net').textContent = won(d.netPay) + '원'
      $('net-sub').textContent = '연 ' + won(d.annual.net) + '원, 공제 합계 월 ' + won(d.deductions.total) + '원'
      const line = (name, v, cls) => '<tr class="' + (cls || '') + '"><td>' + name + '</td><td>' + (cls === 'minus' ? '-' : '') + won(v) + '원</td></tr>'
      $('lines').innerHTML =
        line('월 급여', d.monthlyPay) +
        line('국민연금', d.deductions.nationalPension, 'minus') +
        line('건강보험', d.deductions.health, 'minus') +
        line('장기요양보험', d.deductions.longTermCare, 'minus') +
        line('고용보험', d.deductions.employment, 'minus') +
        line('소득세', d.deductions.incomeTax, 'minus') +
        line('지방소득세', d.deductions.localIncomeTax, 'minus') +
        '<tr class="sum"><td>실수령액</td><td>' + won(d.netPay) + '원</td></tr>'
      $('note').textContent = (d.provisional ? '아직 발표 전인 요율은 직전 값으로 계산했어요. ' : '') +
        '회사가 매달 원천징수하는 금액 기준이에요. 연말정산 결과에 따라 실제 1년 세금은 달라질 수 있어요.'
      history.replaceState(null, '', '?' + q)
    } catch (err) {
      $('net').innerHTML = '<span class="error">' + err.message + '</span>'
      $('lines').innerHTML = ''
    }
  }

  // 주소에 저장된 값으로 시작 (공유 링크)
  const p = new URLSearchParams(location.search)
  if (p.has('monthly')) { mode = 'monthly'; document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mode === 'monthly'))) }
  const start = p.get('annual') || p.get('monthly')
  if (start) $('amount').value = won(digits(start))
  if (p.has('nonTaxable')) $('nonTaxable').value = won(digits(p.get('nonTaxable')))
  if (p.has('family')) $('family').value = p.get('family')
  if (p.has('children')) $('children').value = p.get('children')
  if (p.has('month')) $('month').value = p.get('month')
  calc()
})()
</script>
</body>
</html>`
}
