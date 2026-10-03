// Vercel Serverless Function：百年景氣循環（美國 NBER）× 股市 × GDP × 失業率
// GET /api/cycles → { recessions:[...], expansions:[...], spx:[[YYYY-MM, close]], gdpY:[[year, %]], unrate:[[YYYY-MM, %]], stats }
'use strict';

// 美國國家經濟研究局（NBER）認定的景氣高峰與谷底（月）
const NBER = [
  ['1920-01', '1921-07', '一戰後通縮蕭條'], ['1923-05', '1924-07', '1923–24 衰退'], ['1926-10', '1927-11', '1926–27 衰退'],
  ['1929-08', '1933-03', '經濟大蕭條'], ['1937-05', '1938-06', '1937 二次衰退'], ['1945-02', '1945-10', '二戰結束復員'],
  ['1948-11', '1949-10', '戰後通縮'], ['1953-07', '1954-05', '韓戰後衰退'], ['1957-08', '1958-04', '1958 艾森豪衰退'],
  ['1960-04', '1961-02', '1960–61 衰退'], ['1969-12', '1970-11', '越戰通膨緊縮'], ['1973-11', '1975-03', '第一次石油危機'],
  ['1980-01', '1980-07', '第二次石油危機'], ['1981-07', '1982-11', '伏克爾升息'], ['1990-07', '1991-03', '波灣戰爭・儲貸危機'],
  ['2001-03', '2001-11', '網路泡沫・911'], ['2007-12', '2009-06', '全球金融海嘯'], ['2020-02', '2020-04', '新冠疫情'],
];
const BOOM = { '1921-07': '咆哮的 20 年代', '1933-03': '新政復甦', '1938-06': '二戰軍需擴張', '1949-10': '戰後黃金年代', '1961-02': '甘迺迪－詹森繁榮', '1975-03': '70 年代後段', '1982-11': '雷根繁榮', '1991-03': '網路科技長景氣', '2001-11': '房市榮景', '2009-06': '史上最長擴張', '2020-04': '疫後與 AI 擴張' };
const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)' };
const ym = d => d.toISOString().slice(0, 7);
const mAdd = (s, k) => { const [y, m] = s.split('-').map(Number), t = y * 12 + m - 1 + k; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const mDiff = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
const r1 = n => n == null || !isFinite(n) ? null : Math.round(n * 10) / 10;
async function fred(id) {
  const key = process.env.FRED_API_KEY;
  if (key) { const j = await (await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json`, { signal: AbortSignal.timeout(20000) })).json(); return (j.observations || []).map(o => [o.date, parseFloat(o.value)]).filter(x => isFinite(x[1])); }
  const t = await (await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { signal: AbortSignal.timeout(20000) })).text();
  return t.trim().split('\n').slice(1).map(l => l.split(',')).map(([d, v]) => [d, parseFloat(v)]).filter(x => isFinite(x[1]));
}

module.exports = async (req, res) => {
  const errors = [];
  const safe = (label, p) => p.catch(e => { errors.push(`${label}：${e.message}`); return null; });
  const [spxJ, gdpA, gdpQ, un] = await Promise.all([
    safe('標普 500', fetch(`https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${Math.floor(Date.UTC(1927, 0, 1) / 1000)}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`, { headers: UA, signal: AbortSignal.timeout(25000) }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })),
    safe('年度 GDP', fred('A191RL1A225NBEA')), safe('季度 GDP', fred('GDPC1')), safe('失業率', fred('UNRATE')),
  ]);
  // 標普 500：每月收盤與每月最低收盤
  const mClose = {}, mLow = {};
  if (spxJ) { const R = spxJ.chart.result[0], c = R.indicators.quote[0].close; R.timestamp.forEach((t, i) => { if (c[i] == null) return; const k = ym(new Date(t * 1000)); mClose[k] = c[i]; mLow[k] = Math.min(mLow[k] ?? Infinity, c[i]); }); }
  const months = Object.keys(mClose).sort(), at = k => { let v = null; for (const m of months) { if (m > k) break; v = mClose[m]; } return v; };
  const gq = (gdpQ || []).map(([d, v]) => [d.slice(0, 7), v]), unM = (un || []).map(([d, v]) => [d.slice(0, 7), v]);
  const today = ym(new Date());
  const recessions = NBER.map(([pk, tr, name]) => {
    const o = { peak: pk, trough: tr, name, months: mDiff(pk, tr) };
    if (months.length && pk >= months[0]) {
      const win = months.filter(m => m >= mAdd(pk, -18) && m <= tr);
      if (win.length) {
        const top = win.reduce((a, b) => (mClose[b] > mClose[a] ? b : a));
        const after = months.filter(m => m >= top && m <= mAdd(tr, 12));
        const bot = after.reduce((a, b) => (mLow[b] < mLow[a] ? b : a));
        o.spxTop = top; o.spxBottom = bot; o.dd = r1((mLow[bot] / mClose[top] - 1) * 100);
        o.topLead = mDiff(top, pk); o.bottomLead = mDiff(bot, tr);
        o.inRec = r1((at(tr) / at(pk) - 1) * 100);
        if (mAdd(tr, 12) <= today) o.after12 = r1((at(mAdd(tr, 12)) / at(tr) - 1) * 100);
      }
    }
    if (gq.length && pk >= gq[0][0]) {
      const w = gq.filter(([d]) => d >= mAdd(pk, -3) && d <= mAdd(tr, 3));
      if (w.length) { let hi = w[0][1], dd = 0; w.forEach(([, v]) => { hi = Math.max(hi, v); dd = Math.min(dd, v / hi - 1); }); o.gdpDrop = r1(dd * 100); }
    }
    if (unM.length && pk >= unM[0][0]) {
      const base = unM.find(([d]) => d >= pk)?.[1], w = unM.filter(([d]) => d >= pk && d <= mAdd(tr, 24));
      if (w.length) { const mx = w.reduce((a, b) => (b[1] > a[1] ? b : a)); o.unPeak = r1(mx[1]); o.unRise = r1(mx[1] - base); }
    }
    return o;
  });
  const expansions = NBER.map(([, tr], i) => {
    const next = NBER[i + 1]?.[0], end = next || today, o = { start: tr, end: next || null, ongoing: !next, months: mDiff(tr, end), name: BOOM[tr] || '' };
    const a = at(tr), b = at(end);
    if (a && b && tr >= months[0]) { o.spx = r1((b / a - 1) * 100); o.spxAnn = r1((Math.pow(b / a, 12 / Math.max(1, o.months)) - 1) * 100); }
    return o;
  });
  const avg = a => { const v = a.filter(x => x != null); return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  const post = recessions.filter(r => r.peak >= '1945'), postE = expansions.filter(e => e.start >= '1945' && !e.ongoing);
  const stats = {
    recAll: avg(recessions.map(r => r.months)), recPost: avg(post.map(r => r.months)),
    expAll: avg(expansions.filter(e => !e.ongoing).map(e => e.months)), expPost: avg(postE.map(e => e.months)),
    dd: avg(recessions.map(r => r.dd)), ddPost: avg(post.map(r => r.dd)), bottomLead: avg(recessions.map(r => r.bottomLead)), topLead: avg(recessions.map(r => r.topLead)),
    after12: avg(recessions.map(r => r.after12)), ddWins: recessions.filter(r => r.bottomLead != null && r.bottomLead > 0).length, ddN: recessions.filter(r => r.bottomLead != null).length,
    gdpDrop: avg(post.map(r => r.gdpDrop)), unRise: avg(post.map(r => r.unRise)), cur: expansions[expansions.length - 1],
  };
  // 圖表用：每月標普（取每 3 個月一點）、年度 GDP、失業率（每季一點）
  const spx = months.filter((m, i) => i % 3 === 0 || i === months.length - 1).map(m => [m, Math.round(mClose[m] * 100) / 100]);
  res.setHeader('Cache-Control', spx.length ? 's-maxage=86400, stale-while-revalidate=604800' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), recessions, expansions, stats, spx,
    gdpY: (gdpA || []).map(([d, v]) => [+d.slice(0, 4), r1(v)]), unrate: unM.filter((_, i) => i % 3 === 0).map(([d, v]) => [d, v]),
    src: '景氣日期：美國國家經濟研究局（NBER）；股價：Yahoo Finance 標普 500；GDP 與失業率：美國經濟分析局、勞工統計局（FRED）', errors }));
};
