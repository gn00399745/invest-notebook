// Vercel Serverless Function：個股自動資料
// GET /api/stock?code=2330   台股（FinMind 公開資料）
// GET /api/stock?code=SPCX   美股（Yahoo 股價＋SEC EDGAR 財報）
// 回傳研究卡可直接填入的欄位：基本資料、財報事實、技術面、籌碼面、估值、燈號建議。

const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)' };
const T = (ms = 15000) => AbortSignal.timeout(ms);
const r = (n, d = 2) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const iso = d => new Date(d).toISOString().slice(0, 10);
const daysAgo = n => iso(Date.now() - n * 864e5);

/* ---------------- 技術指標 ---------------- */
const sma = (a, n) => (a.length >= n ? a.slice(-n).reduce((s, x) => s + x, 0) / n : null);
function ema(a, n) { const k = 2 / (n + 1); let e = a[0]; const out = [e]; for (let i = 1; i < a.length; i++) { e = a[i] * k + e * (1 - k); out.push(e); } return out; }
function rsi(a, n = 14) {
  if (a.length <= n) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = a[i] - a[i - 1]; d > 0 ? (g += d) : (l -= d); }
  g /= n; l /= n;
  for (let i = n + 1; i < a.length; i++) { const d = a[i] - a[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
function technicals(bars) {
  const c = bars.map(b => b.c), v = bars.map(b => b.v), last = c[c.length - 1];
  const m20 = sma(c, 20), m60 = sma(c, 60), m120 = sma(c, 120);
  const e12 = ema(c, 12), e26 = ema(c, 26), dif = e12.map((x, i) => x - e26[i]), dea = ema(dif, 9);
  const macd = dif[dif.length - 1], signal = dea[dea.length - 1], hist = macd - signal, prevHist = dif[dif.length - 2] - dea[dea.length - 2];
  const w20 = c.slice(-20), sd = w20.length === 20 ? Math.sqrt(w20.reduce((s, x) => s + (x - m20) ** 2, 0) / 20) : null;
  const up = sd != null ? m20 + 2 * sd : null, lo = sd != null ? m20 - 2 * sd : null;
  const R = rsi(c);
  const y = c.slice(-250), hi52 = Math.max(...y), lo52 = Math.min(...y);
  const w60 = bars.slice(-60), sup = Math.min(...w60.map(b => b.l ?? b.c)), res = Math.max(...w60.map(b => b.h ?? b.c));
  const v5 = sma(v, 5), v20 = sma(v, 20), chg20 = c.length > 20 ? (last / c[c.length - 21] - 1) * 100 : null;

  let trend = '資料不足';
  if (m20 && m60) {
    if (last > m20 && m20 > m60 && (!m120 || m60 > m120)) trend = '多頭排列（股價＞20日＞60日均線），趨勢向上';
    else if (last < m20 && m20 < m60 && (!m120 || m60 < m120)) trend = '空頭排列（股價＜20日＜60日均線），趨勢向下';
    else trend = last > m60 ? '整理偏多（站在季線之上，但均線未完全多頭排列）' : '整理偏弱（跌破季線，方向未明）';
  }
  const rsiJ = R == null ? '' : R >= 70 ? '偏熱（>70），短線追高風險升高' : R <= 30 ? '偏冷（<30），可能超賣' : R >= 50 ? '中性偏強（50～70）' : '中性偏弱（30～50）';
  const macdJ = hist > 0 ? (prevHist <= 0 ? '柱狀體翻正（黃金交叉），動能轉強' : '柱狀體為正，多方動能') : (prevHist >= 0 ? '柱狀體翻負（死亡交叉），動能轉弱' : '柱狀體為負，空方動能');
  const pb = up != null ? (last - lo) / (up - lo) : null;
  const bollJ = pb == null ? '' : pb > 1 ? '突破上軌，強勢但偏離均值' : pb < 0 ? '跌破下軌，弱勢或超跌' : pb > 0.8 ? '靠近上軌' : pb < 0.2 ? '靠近下軌' : '在通道中段';
  const pos52 = (last - lo52) / (hi52 - lo52 || 1);
  const shape = pos52 > 0.9 ? `接近 52 週高點（${r(hi52)}）` : pos52 < 0.1 ? `接近 52 週低點（${r(lo52)}）` : `位於 52 週區間 ${Math.round(pos52 * 100)}% 位置`;
  const volJ = v5 && v20 ? (v5 / v20 > 1.3 ? `近 5 日量是 20 日均量的 ${r(v5 / v20, 1)} 倍，量增${chg20 >= 0 ? '價漲' : '價跌'}` : v5 / v20 < 0.7 ? '量縮，市場觀望' : '量能持平') : '';

  const score = (trend.startsWith('多頭') ? 1 : trend.startsWith('空頭') ? -1 : 0) + (hist > 0 ? 0.5 : -0.5) + (R >= 75 ? -0.5 : 0);
  return {
    last: r(last), chg20: r(chg20, 1),
    rows: [
      { read: `價 ${r(last)}｜MA20 ${r(m20)}｜MA60 ${r(m60)}${m120 ? `｜MA120 ${r(m120)}` : ''}`, judge: trend },
      { read: R == null ? '' : `RSI(14) ${r(R, 1)}`, judge: rsiJ },
      { read: `DIF ${r(macd)}｜訊號 ${r(signal)}｜柱 ${r(hist)}`, judge: macdJ },
      { read: up != null ? `上軌 ${r(up)}｜中軌 ${r(m20)}｜下軌 ${r(lo)}` : '', judge: bollJ },
      { read: `52 週 ${r(lo52)}～${r(hi52)}`, judge: shape },
      { read: `支撐 ${r(sup)}｜壓力 ${r(res)}（近 60 日低／高）`, judge: last - sup < res - last ? '較接近支撐' : '較接近壓力' },
      { read: v5 && v20 ? `5 日均量 ${Math.round(v5).toLocaleString()}｜20 日均量 ${Math.round(v20).toLocaleString()}` : '', judge: volJ },
    ],
    light: score >= 1 ? '綠' : score <= -1 ? '紅' : '黃',
    lightNote: `${trend.split('（')[0]}；RSI ${R == null ? '—' : r(R, 0)}；近 20 日 ${chg20 >= 0 ? '+' : ''}${r(chg20, 1)}%`,
  };
}

/* ---------------- 台股：FinMind ---------------- */
async function fm(dataset, id, start) {
  const tok = process.env.FINMIND_TOKEN ? `&token=${process.env.FINMIND_TOKEN}` : '';
  const u = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${encodeURIComponent(id)}&start_date=${start}${tok}`;
  const res = await fetch(u, { signal: T(), headers: UA });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.status !== 200) throw new Error(`${dataset}：${j.msg || res.status}`);
  return j.data || [];
}
const qLabel = d => { const m = +d.slice(5, 7); return `${d.slice(0, 4)}Q${Math.ceil(m / 3)}`; };

let req_debug = false;
async function taiwan(code, errors) {
  const get = (ds, start) => fm(ds, code, start).catch(e => { errors.push(e.message); return []; });
  const [info, px, inst, margin, fin, cf, bs, per, mrev, div] = await Promise.all([
    get('TaiwanStockInfo', '2000-01-01'), get('TaiwanStockPrice', daysAgo(400)),
    get('TaiwanStockInstitutionalInvestorsBuySell', daysAgo(45)), get('TaiwanStockMarginPurchaseShortSale', daysAgo(45)),
    get('TaiwanStockFinancialStatements', daysAgo(900)), get('TaiwanStockCashFlowsStatement', daysAgo(900)),
    get('TaiwanStockBalanceSheet', daysAgo(900)), get('TaiwanStockPER', daysAgo(1100)),
    get('TaiwanStockMonthRevenue', daysAgo(430)), get('TaiwanStockDividend', daysAgo(800)),
  ]);
  const out = { market: '台股', code, currency: 'TWD' };
  const inf = info.find(x => x.stock_id === code) || info[0];
  if (inf) { out.name = inf.stock_name; out.industry = inf.industry_category; out.isEtf = /ETF|ETN|受益證券/.test(inf.industry_category || '') || /^00/.test(code); }

  // 股價與技術面
  const bars = px.filter(b => b.close > 0).map(b => ({ d: b.date, c: b.close, h: b.max, l: b.min, v: b.Trading_Volume }));
  if (bars.length > 30) { out.price = r(bars[bars.length - 1].c); out.priceDate = bars[bars.length - 1].d; out.tech = technicals(bars); }

  // 財報（單季）
  const byQ = {};
  fin.forEach(x => { (byQ[x.date] = byQ[x.date] || {})[x.type] = x.value; });
  const qs = Object.keys(byQ).sort();
  const lastQ = qs[qs.length - 1];
  if (lastQ) {
    const pq = `${+lastQ.slice(0, 4) - 1}${lastQ.slice(4)}`;
    const A = byQ[lastQ], B = byQ[pq] || {};
    const rev = A.Revenue, revP = B.Revenue;
    const gm = rev && A.GrossProfit != null ? (A.GrossProfit / rev) * 100 : null;
    const gmP = revP && B.GrossProfit != null ? (B.GrossProfit / revP) * 100 : null;
    const om = rev && A.OperatingIncome != null ? (A.OperatingIncome / rev) * 100 : null;
    const omP = revP && B.OperatingIncome != null ? (B.OperatingIncome / revP) * 100 : null;
    // 現金流為年初至今累計，換算成單季：本季累計 − 上一季累計（Q1 直接用）
    const cfMap = {}; cf.forEach(x => { (cfMap[x.date] = cfMap[x.date] || {})[x.type] = x.value; });
    const single = (date, key) => {
      const cur = cfMap[date]?.[key]; if (cur == null) return null;
      if (+date.slice(5, 7) <= 3) return cur;
      const prevDate = qs[qs.indexOf(date) - 1]; const prev = cfMap[prevDate]?.[key];
      return prev == null ? null : cur - prev;
    };
    const ocfKey = Object.keys(cfMap[lastQ] || {}).find(k => /CashFlowsFromOperatingActivities|NetCashInflowFromOperatingActivities/.test(k));
    const capKey = Object.keys(cfMap[lastQ] || {}).find(k => /PropertyAndPlantAndEquipment|AcquisitionOfPropertyPlantAndEquipment/.test(k));
    const neg = x => (x == null ? null : -Math.abs(x));
    const ocf = ocfKey ? single(lastQ, ocfKey) : null, ocfP = ocfKey ? single(pq, ocfKey) : null;
    const cap = capKey ? neg(single(lastQ, capKey)) : null, capP = capKey ? neg(single(pq, capKey)) : null;
    if (req_debug) out.debug = { cfTypes: Object.keys(cfMap[lastQ] || {}), finTypes: Object.keys(A), bsSample: Object.keys(bsMap[lastQ] || {}).slice(0, 40) };
    const bsMap = {}; bs.forEach(x => { (bsMap[x.date] = bsMap[x.date] || {})[x.type] = x.value; });
    const invKey = Object.keys(bsMap[lastQ] || {}).find(k => /^Inventories$/.test(k));
    const e = n => (n == null ? '' : String(r(n / 1e8, 1)));       // 元 → 億元
    const p = n => (n == null ? '' : String(r(n, 1)));
    const src = `FinMind／公開資訊觀測站｜${qLabel(lastQ)} vs ${qLabel(pq)}`;
    out.fin = [
      { cur: e(rev), prev: e(revP), src: `億元｜${src}` },
      { cur: p(gm), prev: p(gmP), src: '毛利 ÷ 營收（自動計算）' },
      { cur: p(om), prev: p(omP), src: '營業利益 ÷ 營收（自動計算）' },
      { cur: A.EPS != null ? String(A.EPS) : '', prev: B.EPS != null ? String(B.EPS) : '', src: '元（單季）' },
      { cur: e(ocf), prev: e(ocfP), src: '億元｜單季（由累計數換算）' },
      { cur: ocf != null && cap != null ? e(ocf + cap) : '', prev: ocfP != null && capP != null ? e(ocfP + capP) : '', src: '億元｜營業現金流 − 資本支出（自動計算）' },
      { cur: cap != null ? e(-cap) : '', prev: capP != null ? e(-capP) : '', src: '億元｜購置不動產、廠房及設備' },
      { cur: invKey ? e(bsMap[lastQ][invKey]) : '', prev: invKey && bsMap[pq]?.[invKey] != null ? e(bsMap[pq][invKey]) : '', src: '億元｜季底存貨' },
    ];
    out.finQuarter = qLabel(lastQ);
    const revG = rev && revP ? (rev / revP - 1) * 100 : null;
    out.finLight = revG == null ? null : revG > 0 && gm >= gmP ? '綠' : revG < 0 && gm < gmP ? '紅' : '黃';
    out.finNote = revG == null ? '' : `營收年增 ${r(revG, 1)}%，毛利率 ${p(gmP)}% → ${p(gm)}%`;
    if (ocf != null && A.IncomeAfterTaxes != null && A.IncomeAfterTaxes > 0 && ocf < 0) out.finGap = '本季獲利為正但營業現金流為負，需確認應收帳款或存貨是否堆積。';
    // TTM EPS
    const last4 = qs.slice(-4).map(q => byQ[q].EPS).filter(x => x != null);
    if (last4.length === 4) out.epsTTM = r(last4.reduce((s, x) => s + x, 0));
  }

  // 月營收
  if (mrev.length) {
    const m = mrev.sort((a, b) => a.date.localeCompare(b.date)); const L = m[m.length - 1];
    const ly = m.find(x => x.revenue_year === L.revenue_year - 1 && x.revenue_month === L.revenue_month);
    if (ly) out.monthRev = `${L.revenue_year}/${L.revenue_month} 月營收 ${r(L.revenue / 1e8, 1)} 億元，年增 ${r((L.revenue / ly.revenue - 1) * 100, 1)}%`;
  }

  // 估值：TTM EPS × 近 3 年本益比中位數
  const pers = per.map(x => x.PER).filter(x => x > 0).sort((a, b) => a - b);
  if (pers.length) {
    const med = pers[Math.floor(pers.length / 2)], q1 = pers[Math.floor(pers.length * 0.25)], q3 = pers[Math.floor(pers.length * 0.75)];
    const curPE = per[per.length - 1]?.PER;
    out.valuation = { pe: r(curPE, 1), peMedian: r(med, 1), peLow: r(q1, 1), peHigh: r(q3, 1), dy: r(per[per.length - 1]?.dividend_yield, 2), pbr: r(per[per.length - 1]?.PBR, 2) };
    if (out.epsTTM) out.val = [
      { assume: `近四季 EPS ${out.epsTTM} 元 × 近 3 年本益比中位數 ${r(med, 1)} 倍（區間 ${r(q1, 1)}～${r(q3, 1)}）`, fair: String(r(out.epsTTM * med, 1)), note: `目前本益比 ${r(curPE, 1)} 倍（自動計算）` },
    ];
    out.valLight = curPE ? (curPE < q1 ? '綠' : curPE > q3 ? '紅' : '黃') : null;
    out.valNote = curPE ? `目前本益比 ${r(curPE, 1)} 倍，近 3 年中位數 ${r(med, 1)} 倍` : '';
  }
  if (div.length) { const d = div.sort((a, b) => a.date.localeCompare(b.date)).slice(-4); out.dividends = d.map(x => `${x.date}｜現金 ${r((x.CashEarningsDistribution || 0) + (x.CashStatutorySurplus || 0), 2)} 元`).join('；'); }

  // 籌碼
  if (inst.length) {
    const days = [...new Set(inst.map(x => x.date))].sort();
    const sumN = (names, n) => { const ds = new Set(days.slice(-n)); return inst.filter(x => ds.has(x.date) && names.includes(x.name)).reduce((s, x) => s + (x.buy - x.sell), 0) / 1000; };
    const F = ['Foreign_Investor', 'Foreign_Dealer_Self'], IT = ['Investment_Trust'], D = ['Dealer_self', 'Dealer_Hedging'];
    const z = n => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString()} 張`;
    const j = (a, b) => (Math.abs(a) < 1 && Math.abs(b) < 1 ? '買賣超不明顯' : a > 0 && b > 0 ? '短中期皆買超' : a < 0 && b < 0 ? '短中期皆賣超' : b > 0 ? '中期買超、短期轉賣' : '中期賣超、短期轉買');
    out.chip = [
      { d5: z(sumN(F, 5)), d20: z(sumN(F, 20)), judge: j(sumN(F, 5), sumN(F, 20)) },
      { d5: z(sumN(IT, 5)), d20: z(sumN(IT, 20)), judge: j(sumN(IT, 5), sumN(IT, 20)) },
      { d5: z(sumN(D, 5)), d20: z(sumN(D, 20)), judge: j(sumN(D, 5), sumN(D, 20)) },
    ];
    const f20 = sumN(F, 20) + sumN(IT, 20);
    out.chipLight = f20 > 0 ? '綠' : f20 < 0 ? '紅' : '黃';
    out.chipNote = `外資＋投信近 20 日合計 ${z(f20)}`;
  }
  if (margin.length > 5) {
    const m = margin.sort((a, b) => a.date.localeCompare(b.date)); const L = m[m.length - 1], M5 = m[Math.max(0, m.length - 6)], M20 = m[Math.max(0, m.length - 21)];
    const d = (a, b, k) => { const x = a[k] - b[k]; return `${x >= 0 ? '+' : ''}${x.toLocaleString()} 張`; };
    const mj = L.MarginPurchaseTodayBalance > M20.MarginPurchaseTodayBalance ? '融資增加，散戶槓桿上升' : '融資減少，籌碼較乾淨';
    out.chip = (out.chip || [{}, {}, {}]).concat([
      { d5: d(L, M5, 'MarginPurchaseTodayBalance'), d20: d(L, M20, 'MarginPurchaseTodayBalance'), judge: `餘額 ${L.MarginPurchaseTodayBalance.toLocaleString()} 張；${mj}` },
      { d5: d(L, M5, 'ShortSaleTodayBalance'), d20: d(L, M20, 'ShortSaleTodayBalance'), judge: `餘額 ${L.ShortSaleTodayBalance.toLocaleString()} 張` },
    ]);
  }
  return out;
}

/* ---------------- 美股：Yahoo + SEC ---------------- */
async function yahooBars(sym) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`, { signal: T(), headers: UA });
  if (!res.ok) throw new Error('Yahoo HTTP ' + res.status);
  const j = await res.json(); const R = j.chart?.result?.[0]; if (!R) throw new Error('Yahoo 查無代號');
  const q = R.indicators.quote[0];
  const bars = R.timestamp.map((t, i) => ({ d: iso(t * 1000), c: q.close[i], h: q.high[i], l: q.low[i], v: q.volume[i] })).filter(b => b.c != null);
  return { bars, name: R.meta.longName || R.meta.shortName, currency: R.meta.currency };
}
async function stooqBars(sym) {
  const res = await fetch(`https://stooq.com/q/d/l/?s=${sym.toLowerCase()}.us&i=d&d1=${daysAgo(400).replace(/-/g, '')}`, { signal: T(), headers: UA });
  if (!res.ok) throw new Error('Stooq HTTP ' + res.status);
  const lines = (await res.text()).trim().split(/\r?\n/).slice(1);
  const bars = lines.map(l => l.split(',')).map(c => ({ d: c[0], h: +c[2], l: +c[3], c: +c[4], v: +c[5] })).filter(b => b.c > 0);
  if (!bars.length) throw new Error('Stooq 查無資料');
  return { bars };
}
const SEC_UA = { 'User-Agent': process.env.SEC_USER_AGENT || 'invest-notebook research-tool (contact via github.com/gn00399745)', Accept: 'application/json' };
async function secFacts(ticker) {
  const m = await (await fetch('https://www.sec.gov/files/company_tickers.json', { signal: T(), headers: SEC_UA })).json();
  const hit = Object.values(m).find(x => x.ticker.toUpperCase() === ticker.toUpperCase());
  if (!hit) throw new Error('SEC 查無此代號');
  const cik = String(hit.cik_str).padStart(10, '0');
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { signal: T(20000), headers: SEC_UA });
  if (!res.ok) throw new Error('SEC HTTP ' + res.status);
  return { facts: (await res.json()).facts, title: hit.title };
}
function usFin(facts) {
  const g = facts['us-gaap'] || {};
  const series = (tags, unit = 'USD') => { for (const t of tags) { const u = g[t]?.units?.[unit]; if (u?.length) return u; } return null; };
  const dur = x => (new Date(x.end) - new Date(x.start)) / 864e5;
  const quarterly = s => s ? s.filter(x => x.start && dur(x) > 80 && dur(x) < 100) : [];
  const latestPair = s => {
    const q = quarterly(s).sort((a, b) => a.end.localeCompare(b.end)); if (!q.length) return {};
    const L = q[q.length - 1]; const ly = q.filter(x => Math.abs(new Date(L.end) - new Date(x.end) - 365 * 864e5) < 20 * 864e5).pop();
    return { cur: L.val, prev: ly?.val, end: L.end, form: L.form, filed: L.filed };
  };
  const ytdPair = s => {
    if (!s) return {}; const L = s.filter(x => x.start).sort((a, b) => a.end.localeCompare(b.end) || dur(b) - dur(a)).pop(); if (!L) return {};
    const ly = s.find(x => x.start && Math.abs(dur(x) - dur(L)) < 10 && Math.abs(new Date(L.end) - new Date(x.end) - 365 * 864e5) < 20 * 864e5);
    return { cur: L.val, prev: ly?.val, months: Math.round(dur(L) / 30) };
  };
  const inst = s => { if (!s) return {}; const q = s.sort((a, b) => a.end.localeCompare(b.end)); const L = q[q.length - 1]; const ly = q.filter(x => Math.abs(new Date(L.end) - new Date(x.end) - 365 * 864e5) < 20 * 864e5).pop(); return { cur: L.val, prev: ly?.val }; };
  const rev = latestPair(series(['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet']));
  const gp = latestPair(series(['GrossProfit']));
  const op = latestPair(series(['OperatingIncomeLoss']));
  const eps = latestPair(series(['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares'));
  const ocf = ytdPair(series(['NetCashProvidedByUsedInOperatingActivities']));
  const cap = ytdPair(series(['PaymentsToAcquirePropertyPlantAndEquipment']));
  const inv = inst(series(['InventoryNet']));
  const M = n => (n == null ? '' : String(r(n / 1e6, 0)));
  const pct = (a, b) => (a != null && b ? String(r((a / b) * 100, 1)) : '');
  const epsQ = quarterly(series(['EarningsPerShareDiluted', 'EarningsPerShareBasic'], 'USD/shares')).sort((a, b) => a.end.localeCompare(b.end)).slice(-4).map(x => x.val);
  const tag = rev.end ? `SEC ${rev.form}（期末 ${rev.end}）` : 'SEC';
  const fcf = (o, c) => (o != null && c != null ? M(o - c) : '');
  return {
    quarter: rev.end,
    epsTTM: epsQ.length === 4 ? r(epsQ.reduce((s, x) => s + x, 0)) : null,
    fin: [
      { cur: M(rev.cur), prev: M(rev.prev), src: `百萬美元｜${tag}` },
      { cur: pct(gp.cur, rev.cur), prev: pct(gp.prev, rev.prev), src: gp.cur == null ? '未揭露毛利' : '毛利 ÷ 營收（自動計算）' },
      { cur: pct(op.cur, rev.cur), prev: pct(op.prev, rev.prev), src: '營業利益 ÷ 營收（自動計算）' },
      { cur: eps.cur != null ? String(eps.cur) : '', prev: eps.prev != null ? String(eps.prev) : '', src: '美元，稀釋 EPS（單季）' },
      { cur: M(ocf.cur), prev: M(ocf.prev), src: `百萬美元｜年初至今 ${ocf.months || ''} 個月累計` },
      { cur: fcf(ocf.cur, cap.cur), prev: fcf(ocf.prev, cap.prev), src: '百萬美元｜營業現金流 − 資本支出（年初至今，自動計算）' },
      { cur: M(cap.cur), prev: M(cap.prev), src: `百萬美元｜年初至今 ${cap.months || ''} 個月累計` },
      { cur: M(inv.cur), prev: M(inv.prev), src: '百萬美元｜期末存貨' },
    ],
    finLight: rev.cur && rev.prev ? (rev.cur > rev.prev && (op.cur ?? 0) >= (op.prev ?? 0) ? '綠' : rev.cur < rev.prev ? '紅' : '黃') : null,
    finNote: rev.cur && rev.prev ? `營收年增 ${r((rev.cur / rev.prev - 1) * 100, 1)}%${op.cur != null ? `，營業利益率 ${pct(op.cur, rev.cur)}%` : ''}` : '',
    finGap: ocf.cur != null && cap.cur != null && ocf.cur - cap.cur < 0 ? `年初至今自由現金流約 ${M(ocf.cur - cap.cur)} 百萬美元（為負），資本支出大於營業現金流。` : '',
  };
}
async function us(code, errors) {
  const out = { market: '美股', code: code.toUpperCase(), currency: 'USD' };
  let px = null;
  try { px = await yahooBars(code); } catch (e) { errors.push(e.message); try { px = await stooqBars(code); } catch (e2) { errors.push(e2.message); } }
  if (px?.bars?.length > 30) { const b = px.bars; out.price = r(b[b.length - 1].c); out.priceDate = b[b.length - 1].d; out.tech = technicals(b); if (px.name) out.name = px.name; }
  try {
    const { facts, title } = await secFacts(code); out.name = out.name || title;
    Object.assign(out, usFin(facts)); out.finQuarter = out.quarter;
    if (out.epsTTM && out.epsTTM > 0 && out.price) out.valuation = { pe: r(out.price / out.epsTTM, 1) };
  } catch (e) { errors.push(e.message); }
  out.chipNote = '美股沒有三大法人資料，可改看機構持股（13F）與空單比率';
  return out;
}

module.exports = async (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase().replace(/\.TW$/, '');
  if (!code) { res.status(400).json({ error: '請提供 code' }); return; }
  const errors = [];
  req_debug = req.query.debug === '1';
  let out;
  try { out = /^\d{4,6}[A-Z]?$/.test(code) ? await taiwan(code, errors) : await us(code, errors); }
  catch (e) { errors.push(e.message); out = { code }; }
  out.errors = errors; out.updated = new Date().toISOString();
  const ok = out.price || out.fin;
  res.setHeader('Cache-Control', ok ? 's-maxage=21600, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(ok ? 200 : 404).send(JSON.stringify(out));
};
