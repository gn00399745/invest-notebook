// Vercel Serverless Function：抓取總經指標（免金鑰官方來源為主，FRED 金鑰為選配）
// 來源：BLS（CPI、PPI、非農、失業率）、紐約聯準銀行（聯邦基金利率）、美國財政部（10 年期殖利率）、
//       臺灣銀行（美元兌新台幣）；若設定 FRED_API_KEY，另補核心 PCE、初領失業金與任何缺漏項目。
// GET /api/macro → { updated, data: { key: { latest, prev, date, prevDate, unit, source } }, errors }

const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)' };
const T = () => AbortSignal.timeout(15000);
const r2 = (n, d = 1) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const ym = d => d.slice(0, 7);

/* ---------- 各來源 ---------- */
async function bls() {
  const y = new Date().getUTCFullYear();
  const r = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
    method: 'POST', signal: T(), headers: { ...UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesid: ['CUUR0000SA0', 'CUUR0000SA0L1E', 'WPUFD4', 'CES0000000001', 'LNS14000000'], startyear: String(y - 2), endyear: String(y) }),
  });
  if (!r.ok) throw new Error('BLS HTTP ' + r.status);
  const j = await r.json();
  if (j.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS ' + (j.message || []).join(' '));
  const out = {};
  j.Results.series.forEach(s => {
    out[s.seriesID] = s.data.filter(o => /^M(0[1-9]|1[0-2])$/.test(o.period) && o.value !== '-')
      .map(o => ({ d: `${o.year}-${o.period.slice(1)}-01`, v: parseFloat(o.value) }))
      .sort((a, b) => a.d.localeCompare(b.d));
  });
  return out;
}
async function nyfed() {
  const r = await fetch('https://markets.newyorkfed.org/api/rates/unsecured/effr/last/400.json', { signal: T(), headers: UA });
  if (!r.ok) throw new Error('NY Fed HTTP ' + r.status);
  const rows = (await r.json()).refRates.map(o => ({ d: o.effectiveDate, eff: o.percentRate, lo: o.targetRateFrom, hi: o.targetRateTo }))
    .sort((a, b) => a.d.localeCompare(b.d));
  if (rows.length < 2) throw new Error('NY Fed 無資料');
  return rows;
}
async function treasury() {
  const y = new Date().getUTCFullYear();
  const get = async yr => {
    const u = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${yr}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${yr}&page&_format=csv`;
    const r = await fetch(u, { signal: T(), headers: UA });
    if (!r.ok) throw new Error('Treasury HTTP ' + r.status);
    const lines = (await r.text()).trim().split(/\r?\n/);
    const head = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const col = head.indexOf('10 Yr');
    if (col < 0) throw new Error('Treasury 格式變更');
    return lines.slice(1).map(l => l.split(',')).map(c => {
      const [m, d, yy] = c[0].replace(/"/g, '').split('/');
      return { d: `${yy}-${m}-${d}`, v: parseFloat(c[col]) };
    }).filter(o => Number.isFinite(o.v));
  };
  let rows = await get(y);
  if (rows.length < 2) rows = rows.concat(await get(y - 1));
  return rows.sort((a, b) => a.d.localeCompare(b.d));
}
async function bot() {
  const r = await fetch('https://rate.bot.com.tw/xrt/flcsv/0/L3M/USD', { signal: T(), headers: UA });
  if (!r.ok) throw new Error('臺灣銀行 HTTP ' + r.status);
  const lines = (await r.text()).replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',').map(h => h.trim());
  const spot = head.map((h, i) => (h === '即期' ? i : -1)).filter(i => i >= 0).slice(0, 2); // 買入即期、賣出即期
  if (spot.length < 2) throw new Error('臺灣銀行格式變更');
  return lines.slice(1).map(l => l.split(',')).map(c => {
    const m = c.join(',').match(/(20\d{2})\/?(\d{2})\/?(\d{2})/);
    const v = (parseFloat(c[spot[0]]) + parseFloat(c[spot[1]])) / 2;
    return { d: m ? `${m[1]}-${m[2]}-${m[3]}` : '', v };
  }).filter(o => o.d && Number.isFinite(o.v)).sort((a, b) => a.d.localeCompare(b.d));
}
async function fxFallback() {
  // 備援：fawazahmed0 公開匯率（jsDelivr CDN，免金鑰）
  const get = async tag => {
    const r = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/usd.json`, { signal: T(), headers: UA });
    if (!r.ok) throw new Error('FX HTTP ' + r.status);
    const j = await r.json(); return { d: j.date, v: j.usd.twd };
  };
  const a = await get('latest');
  const prevDay = new Date(new Date(a.d).getTime() - 864e5).toISOString().slice(0, 10);
  const b = await get(prevDay).catch(() => null);
  return b ? [b, a] : [a, a];
}
async function fred(id) {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error('未設定 FRED_API_KEY');
  const start = new Date(Date.now() - 460 * 864e5).toISOString().slice(0, 10);
  const r = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&observation_start=${start}`, { signal: T() });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  return (await r.json()).observations.map(o => ({ d: o.date, v: parseFloat(o.value) })).filter(o => Number.isFinite(o.v));
}

/* ---------- 計算 ---------- */
function yoyPair(s) {
  const n = s.length - 1;
  const find = (i) => { const t = s[i].d; const ly = `${+t.slice(0, 4) - 1}${t.slice(4)}`; const b = s.find(o => o.d === ly); return b ? (s[i].v / b.v - 1) * 100 : null; };
  return { latest: r2(find(n)), prev: r2(find(n - 1)), date: ym(s[n].d), prevDate: ym(s[n - 1].d) };
}
const last2 = (s, d, monthly) => {
  const n = s.length - 1, f = monthly ? ym : x => x;
  return { latest: r2(s[n].v, d), prev: r2(s[n - 1].v, d), date: f(s[n].d), prevDate: f(s[n - 1].d) };
};

module.exports = async (req, res) => {
  const [B, N, TR, BOT] = await Promise.allSettled([bls(), nyfed(), treasury(), bot()]);
  const errors = [];
  [['BLS', B], ['NY Fed', N], ['美國財政部', TR], ['臺灣銀行', BOT]].forEach(([n, p]) => p.status === 'rejected' && errors.push(`${n}：${p.reason?.message || p.reason}`));
  const data = {};
  const hasKey = !!process.env.FRED_API_KEY;

  // 以免金鑰來源計算；失敗且有 FRED 金鑰時改用 FRED
  const tryFill = async (key, primary, fredFallback) => {
    try { const v = primary(); if (v) { data[key] = v; return; } } catch (e) { /* fallthrough */ }
    if (hasKey && fredFallback) { try { data[key] = await fredFallback(); } catch (e) { errors.push(`${key}：${e.message}`); } }
  };
  const b = B.value || {};
  await Promise.all([
    tryFill('cpi', () => b.CUUR0000SA0 && { ...yoyPair(b.CUUR0000SA0), core: yoyPair(b.CUUR0000SA0L1E).latest, corePrev: yoyPair(b.CUUR0000SA0L1E).prev, unit: '% 年增', source: 'BLS 消費者物價指數' },
      async () => { const h = yoyPair(await fred('CPIAUCSL')), c = yoyPair(await fred('CPILFESL')); return { ...h, core: c.latest, corePrev: c.prev, unit: '% 年增', source: 'FRED CPIAUCSL' }; }),
    tryFill('ppi', () => b.WPUFD4 && { ...yoyPair(b.WPUFD4), unit: '% 年增', source: 'BLS PPI 最終需求' },
      async () => ({ ...yoyPair(await fred('PPIFIS')), unit: '% 年增', source: 'FRED PPIFIS' })),
    tryFill('nfp', () => { const s = b.CES0000000001; if (!s) return null; const n = s.length - 1;
      return { latest: Math.round(s[n].v - s[n - 1].v), prev: Math.round(s[n - 1].v - s[n - 2].v), date: ym(s[n].d), prevDate: ym(s[n - 1].d), unit: '千人（月增）', source: 'BLS 非農就業' }; },
      async () => { const s = await fred('PAYEMS'), n = s.length - 1; return { latest: Math.round(s[n].v - s[n - 1].v), prev: Math.round(s[n - 1].v - s[n - 2].v), date: ym(s[n].d), prevDate: ym(s[n - 1].d), unit: '千人（月增）', source: 'FRED PAYEMS' }; }),
    tryFill('unrate', () => b.LNS14000000 && { ...last2(b.LNS14000000, 1, true), unit: '%', source: 'BLS 失業率' },
      async () => ({ ...last2(await fred('UNRATE'), 1, true), unit: '%', source: 'FRED UNRATE' })),
    tryFill('ffr', () => { const s = N.value; if (!s) return null; const n = s.length - 1;
      let j = n; while (j > 0 && s[j].hi === s[n].hi) j--;
      return { latest: s[n].hi, prev: s[j].hi, date: s[n].d, prevDate: s[j].d, label: `${s[n].lo.toFixed(2)}–${s[n].hi.toFixed(2)}%`, effective: s[n].eff, unit: '% 目標上限', source: '紐約聯準銀行 EFFR' }; }),
    tryFill('us10y', () => TR.value && { ...last2(TR.value, 2), unit: '%', source: '美國財政部殖利率曲線' },
      async () => ({ ...last2(await fred('DGS10'), 2), unit: '%', source: 'FRED DGS10' })),
    (async () => {
      if (BOT.value) { data.usdtwd = { ...last2(BOT.value, 3), unit: '新台幣／美元', source: '臺灣銀行即期買賣中價' }; return; }
      try { data.usdtwd = { ...last2(await fxFallback(), 3), unit: '新台幣／美元', source: '國際匯率中價（jsDelivr currency-api）' }; errors.splice(errors.findIndex(e => e.startsWith('臺灣銀行')), 1); }
      catch (e) { if (hasKey) data.usdtwd = { ...last2(await fred('DEXTAUS'), 2), unit: '新台幣／美元', source: 'FRED DEXTAUS' }; else errors.push('匯率備援：' + e.message); }
    })(),
    tryFill('pce', () => null, async () => ({ ...yoyPair(await fred('PCEPILFE')), unit: '% 年增', source: 'FRED PCEPILFE' })),
    tryFill('claims', () => null, async () => { const p = last2(await fred('ICSA'), 0); return { ...p, latest: Math.round(p.latest / 1000), prev: Math.round(p.prev / 1000), unit: '千人（週）', source: 'FRED ICSA' }; }),
  ]);

  const ok = Object.keys(data).length >= 4;
  res.setHeader('Cache-Control', ok ? 's-maxage=21600, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), fredKey: hasKey, data, errors }));
};
