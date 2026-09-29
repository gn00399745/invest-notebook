// Vercel Serverless Function：從 FRED（聖路易聯準銀行）抓取總經指標，免 API 金鑰
// GET /api/macro → { updated, data: { key: { latest, prev, date, prevDate, source } } }

const SERIES = ['CPIAUCSL', 'CPILFESL', 'PPIFIS', 'PCEPILFE', 'PAYEMS', 'UNRATE', 'ICSA', 'FEDFUNDS', 'DFEDTARL', 'DFEDTARU', 'DGS10', 'DEXTAUS'];

async function fetchSeries(id, start) {
  const key = process.env.FRED_API_KEY;
  const ctrl = AbortSignal.timeout(20000);
  if (key) {
    // FRED 官方 API（需免費金鑰，伺服器端最穩定）
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&observation_start=${start}`;
    const r = await fetch(url, { signal: ctrl });
    if (!r.ok) throw new Error(`${id} HTTP ${r.status}`);
    const j = await r.json();
    return j.observations.map(o => ({ d: o.date, v: parseFloat(o.value) })).filter(o => Number.isFinite(o.v));
  }
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, { signal: ctrl, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; invest-notebook/1.0)', Accept: 'text/csv,*/*' } });
  if (!r.ok) throw new Error(`${id} HTTP ${r.status}`);
  const lines = (await r.text()).trim().split(/\r?\n/).slice(1);
  return lines.map(l => l.split(',')).map(([d, v]) => ({ d, v: parseFloat(v) })).filter(o => o.d && Number.isFinite(o.v));
}

const yoy = (arr, i) => (i - 12 >= 0 ? (arr[i].v / arr[i - 12].v - 1) * 100 : null);
const r2 = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

function yoyPair(s) {
  const n = s.length - 1;
  return { latest: r2(yoy(s, n)), prev: r2(yoy(s, n - 1)), date: s[n].d, prevDate: s[n - 1].d };
}
function lastPair(s, d = 2) {
  const n = s.length - 1;
  return { latest: r2(s[n].v, d), prev: r2(s[n - 1].v, d), date: s[n].d, prevDate: s[n - 1].d };
}

module.exports = async (req, res) => {
  const start = new Date(Date.now() - 460 * 864e5).toISOString().slice(0, 10);
  const results = await Promise.allSettled(SERIES.map(id => fetchSeries(id, start)));
  const S = {}; const errors = [];
  results.forEach((r, i) => (r.status === 'fulfilled' && r.value.length > 1 ? (S[SERIES[i]] = r.value) : errors.push(`${SERIES[i]}: ${r.reason?.name || ''} ${r.reason?.message || 'empty'} ${r.reason?.cause?.code || ''}`.trim())));

  const data = {};
  const safe = (key, fn) => { try { data[key] = fn(); } catch (e) { errors.push(key); } };

  safe('cpi', () => {
    const h = yoyPair(S.CPIAUCSL), c = yoyPair(S.CPILFESL);
    return { ...h, core: c.latest, corePrev: c.prev, unit: '% 年增', source: 'FRED CPIAUCSL / CPILFESL' };
  });
  safe('ppi', () => ({ ...yoyPair(S.PPIFIS), unit: '% 年增', source: 'FRED PPIFIS（最終需求）' }));
  safe('pce', () => ({ ...yoyPair(S.PCEPILFE), unit: '% 年增', source: 'FRED PCEPILFE' }));
  safe('nfp', () => {
    const s = S.PAYEMS, n = s.length - 1;
    return { latest: Math.round(s[n].v - s[n - 1].v), prev: Math.round(s[n - 1].v - s[n - 2].v), date: s[n].d, prevDate: s[n - 1].d, unit: '千人（月增）', source: 'FRED PAYEMS' };
  });
  safe('unrate', () => ({ ...lastPair(S.UNRATE, 1), unit: '%', source: 'FRED UNRATE' }));
  safe('claims', () => {
    const p = lastPair(S.ICSA, 0);
    return { ...p, latest: Math.round(p.latest / 1000), prev: Math.round(p.prev / 1000), unit: '千人（週）', source: 'FRED ICSA' };
  });
  safe('ffr', () => {
    const lo = S.DFEDTARL, hi = S.DFEDTARU, n = hi.length - 1;
    // 前值 = 上一次調整前的目標區間
    let j = n; while (j > 0 && hi[j].v === hi[n].v) j--;
    const eff = S.FEDFUNDS ? S.FEDFUNDS[S.FEDFUNDS.length - 1].v : null;
    return {
      latest: hi[n].v, prev: hi[j].v, date: hi[n].d, prevDate: hi[j].d,
      label: `${lo[lo.length - 1].v.toFixed(2)}–${hi[n].v.toFixed(2)}%`, effective: eff,
      unit: '% 目標區間上限', source: 'FRED DFEDTARL / DFEDTARU',
    };
  });
  safe('us10y', () => ({ ...lastPair(S.DGS10, 2), unit: '%', source: 'FRED DGS10' }));
  safe('usdtwd', () => ({ ...lastPair(S.DEXTAUS, 2), unit: '新台幣／美元', source: 'FRED DEXTAUS（週更新，約落後一週）' }));

  const ok = Object.keys(data).length >= 5;
  res.setHeader('Cache-Control', ok ? 's-maxage=21600, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), mode: process.env.FRED_API_KEY ? 'api' : 'csv', data, errors }));
};
