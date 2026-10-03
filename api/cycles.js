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


/* ---------- 共用：股價月資料與每次衰退的股市統計 ---------- */
async function yDaily(sym, from) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${Math.floor(Date.UTC(from, 0, 1) / 1000)}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const R = (await r.json()).chart.result[0], c = R.indicators.quote[0].close, mClose = {}, mLow = {};
  R.timestamp.forEach((t, i) => { if (c[i] == null) return; const k = ym(new Date(t * 1000)); mClose[k] = c[i]; mLow[k] = Math.min(mLow[k] ?? Infinity, c[i]); });
  const months = Object.keys(mClose).sort();
  return { mClose, mLow, months, at: k => { let v = null; for (const m of months) { if (m > k) break; v = mClose[m]; } return v; } };
}
function mktStats(o, M) {
  if (!M || !M.months.length || o.peak < M.months[0]) return o;
  const today = ym(new Date()), win = M.months.filter(m => m >= mAdd(o.peak, -18) && m <= o.trough); if (!win.length) return o;
  const top = win.reduce((a, b) => (M.mClose[b] > M.mClose[a] ? b : a)), after = M.months.filter(m => m >= top && m <= mAdd(o.trough, 12));
  const bot = after.reduce((a, b) => (M.mLow[b] < M.mLow[a] ? b : a));
  Object.assign(o, { spxTop: top, spxBottom: bot, dd: r1((M.mLow[bot] / M.mClose[top] - 1) * 100), topLead: mDiff(top, o.peak), bottomLead: mDiff(bot, o.trough), inRec: r1((M.at(o.trough) / M.at(o.peak) - 1) * 100) });
  if (mAdd(o.trough, 12) <= today) o.after12 = r1((M.at(mAdd(o.trough, 12)) / M.at(o.trough) - 1) * 100);
  return o;
}
const avgOf = a => { const v = a.filter(x => x != null); return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null; };

/* ---------- 台灣：國發會景氣循環基準日期 ---------- */
const TW_CYC = [ // [谷底, 高峰, 下一個谷底, 收縮期事件]
  ['1954-11', '1955-11', '1956-09', '韓戰後調整'], ['1956-09', '1964-09', '1966-01', '1965 美援終止'], ['1966-01', '1968-08', '1969-10', '1968–69 調整'],
  ['1969-10', '1974-02', '1975-02', '第一次石油危機'], ['1975-02', '1980-01', '1983-02', '第二次石油危機'], ['1983-02', '1984-05', '1985-08', '1985 美國景氣放緩・十信事件'],
  ['1985-08', '1989-05', '1990-08', '台股泡沫破裂'], ['1990-08', '1995-02', '1996-03', '台海飛彈危機'], ['1996-03', '1997-12', '1998-12', '亞洲金融風暴'],
  ['1998-12', '2000-09', '2001-09', '網路泡沫'], ['2001-09', '2004-03', '2005-02', '2004–05 庫存調整'], ['2005-02', '2008-03', '2009-02', '全球金融海嘯'],
  ['2009-02', '2011-02', '2012-01', '歐債危機'], ['2012-01', '2014-10', '2016-02', '全球貿易放緩'], ['2016-02', '2022-01', '2023-04', '疫後庫存調整・升息'],
];
const TW_BOOM = { '1956-09': '加工出口起飛', '1969-10': '十大建設前', '1975-02': '十大建設', '1985-08': '台幣升值・資產狂飆', '1990-08': '科技業起飛', '2009-02': '海嘯後反彈', '2016-02': '史上第二長擴張', '2023-04': 'AI 伺服器擴張' };
// 台灣年度經濟成長率（IMF 世界經濟展望，1980–2025）
const TW_GDP = [8, 9.5, 4.8, 9, 10, 4.8, 11.5, 12.8, 8, 8.7, 5.5, 8.4, 8.3, 6.8, 7.5, 6.5, 6.2, 6.1, 4.2, 6.7, 6.3, -1.4, 5.5, 4.2, 7, 5.4, 5.8, 6.9, 0.8, -1.6, 10.2, 3.7, 2.2, 2.5, 4.7, 1.5, 2.2, 3.7, 2.9, 3.1, 3.4, 6.7, 2.7, 1.1, 5.3, 8.7];
async function taiwanCycles() {
  const errors = []; const M = await yDaily('^TWII', 1997).catch(e => { errors.push('加權指數：' + e.message); return null; });
  const today = ym(new Date());
  const recessions = TW_CYC.map(([, pk, tr, name]) => mktStats({ peak: pk, trough: tr, name, months: mDiff(pk, tr) }, M));
  const starts = [TW_CYC[0][0], ...TW_CYC.map(c => c[2])];
  const expansions = starts.map((st, i) => { const pk = TW_CYC[i]?.[1], end = pk || today, o = { start: st, end: pk || null, ongoing: !pk, months: mDiff(st, end), name: TW_BOOM[st] || '' };
    if (M && st >= M.months[0]) { const a = M.at(st), b = M.at(end); if (a && b) { o.spx = r1((b / a - 1) * 100); o.spxAnn = r1((Math.pow(b / a, 12 / Math.max(1, o.months)) - 1) * 100); } } return o; });
  const done = expansions.filter(e => !e.ongoing);
  const stats = { recAll: avgOf(recessions.map(r => r.months)), recPost: avgOf(recessions.map(r => r.months)), expAll: avgOf(done.map(e => e.months)), expPost: avgOf(done.map(e => e.months)),
    dd: avgOf(recessions.map(r => r.dd)), ddPost: avgOf(recessions.map(r => r.dd)), bottomLead: avgOf(recessions.map(r => r.bottomLead)), topLead: avgOf(recessions.map(r => r.topLead)), after12: avgOf(recessions.map(r => r.after12)),
    ddWins: recessions.filter(r => r.bottomLead > 0).length, ddN: recessions.filter(r => r.bottomLead != null).length, cur: expansions[expansions.length - 1], maxExp: Math.max(...done.map(e => e.months)) };
  const spx = M ? M.months.filter((m, i) => i % 3 === 0 || i === M.months.length - 1).map(m => [m, Math.round(M.mClose[m])]) : [];
  return { region: 'tw', index: '台灣加權指數', since: 1954, count: recessions.length, updated: new Date().toISOString(), recessions, expansions, stats, spx, gdpY: TW_GDP.map((v, i) => [1980 + i, v]), unrate: [],
    src: '景氣循環基準日期：國家發展委員會；股價：Yahoo Finance 台灣加權指數（1997 年起）；經濟成長率：IMF 世界經濟展望', errors };
}

/* ---------- 英國、歐洲、日本：以「實質 GDP 連續兩季衰退」認定 ---------- */
const INTL = [
  { id: 'uk', flag: '🇬🇧', name: '英國', gdp: 'NGDPRSAXDCGBQ', idx: '^FTSE', idxName: '富時 100', from: 1984 },
  { id: 'de', flag: '🇩🇪', name: '德國', gdp: 'CLVMNACSCAB1GQDE', idx: '^GDAXI', idxName: '德國 DAX', from: 1988 },
  { id: 'fr', flag: '🇫🇷', name: '法國', gdp: 'CLVMNACSCAB1GQFR', idx: '^FCHI', idxName: '法國 CAC 40', from: 1990 },
  { id: 'ea', flag: '🇪🇺', name: '歐元區', gdp: 'CLVMNACSCAB1GQEA19', idx: '^STOXX50E', idxName: '歐洲斯托克 50', from: 2007 },
  { id: 'jp', flag: '🇯🇵', name: '日本', gdp: 'JPNRGDPEXP', idx: '^N225', idxName: '日經 225', from: 1965 },
];
const qEnd = d => mAdd(d.slice(0, 7), 2);
function techRecessions(rows) { // rows: [[date, v]] 由舊到新
  const out = []; let i = 1;
  while (i < rows.length) {
    if (rows[i][1] < rows[i - 1][1] && i + 1 < rows.length && rows[i + 1][1] < rows[i][1]) {
      let j = i; while (j + 1 < rows.length && rows[j + 1][1] < rows[j][1]) j++;
      const pkV = rows[i - 1][1], lo = Math.min(...rows.slice(i, j + 1).map(x => x[1]));
      const prev = out[out.length - 1], pk = qEnd(rows[i - 1][0]), tr = qEnd(rows[j][0]);
      if (prev && mDiff(prev.trough, pk) <= 3) { prev.trough = tr; prev.gdpDrop = r1(Math.min(prev.gdpDrop, (lo / prev._pk - 1) * 100)); prev.months = mDiff(prev.peak, tr); }
      else out.push({ peak: pk, trough: tr, months: mDiff(pk, tr), gdpDrop: r1((lo / pkV - 1) * 100), _pk: pkV });
      i = j + 1;
    } else i++;
  }
  return out.map(({ _pk, ...o }) => o);
}
const INTL_NAME = r => r.peak >= '2019-10' && r.trough <= '2020-12' ? '新冠疫情' : r.peak >= '2007-10' && r.peak <= '2008-12' ? '全球金融海嘯' : r.peak >= '2011-01' && r.peak <= '2012-12' ? '歐債危機' : r.peak >= '2022-01' && r.peak <= '2023-12' ? '能源危機・升息' : r.peak >= '1973-01' && r.peak <= '1975-12' ? '石油危機' : r.peak >= '1979-01' && r.peak <= '1981-12' ? '第二次石油危機' : r.peak >= '1990-01' && r.peak <= '1993-12' ? '90 年代初衰退' : r.peak >= '2000-10' && r.peak <= '2002-12' ? '網路泡沫' : r.peak >= '1997-01' && r.peak <= '1998-12' ? '亞洲金融風暴' : '';
async function intlCycles() {
  const errors = [];
  const countries = await Promise.all(INTL.map(async c => {
    const [g, M] = await Promise.all([fred(c.gdp).catch(e => { errors.push(`${c.name} GDP：${e.message}`); return []; }), yDaily(c.idx, c.from).catch(e => { errors.push(`${c.idxName}：${e.message}`); return null; })]);
    const recs = techRecessions(g).map(r => mktStats({ ...r, name: INTL_NAME(r) }, M));
    const yrs = g.length ? (mDiff(g[0][0].slice(0, 7), g[g.length - 1][0].slice(0, 7)) / 12) : 0;
    return { id: c.id, flag: c.flag, name: c.name, idxName: c.idxName, since: g[0]?.[0]?.slice(0, 4), last: g[g.length - 1]?.[0]?.slice(0, 7), recessions: recs,
      stats: { n: recs.length, perDecade: yrs ? r1(recs.length / yrs * 10) : null, months: avgOf(recs.map(r => r.months)), gdpDrop: avgOf(recs.map(r => r.gdpDrop)), dd: avgOf(recs.map(r => r.dd)), after12: avgOf(recs.map(r => r.after12)) } };
  }));
  // 美國與台灣作為對照（只列期間）
  const us = NBER.filter(([pk]) => pk >= '1955').map(([pk, tr, name]) => ({ peak: pk, trough: tr, name })), tw = TW_CYC.map(([, pk, tr, name]) => ({ peak: pk, trough: tr, name }));
  return { region: 'intl', updated: new Date().toISOString(), countries, us, tw, src: '實質 GDP：英國國家統計局、Eurostat、日本內閣府（經 FRED）；衰退＝實質 GDP 連續兩季下滑（技術性衰退）；股價：Yahoo Finance', errors };
}

module.exports = async (req, res) => {
  const region = req.query?.region;
  if (region === 'tw' || region === 'intl') {
    try { const j = region === 'tw' ? await taiwanCycles() : await intlCycles(); res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.status(200).send(JSON.stringify(j)); }
    catch (e) { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ error: e.message }); }
  }
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
  stats.maxExp = Math.max(...expansions.filter(e => !e.ongoing).map(e => e.months));
  res.status(200).send(JSON.stringify({ region: 'us', index: '標普 500', since: 1920, count: recessions.length, updated: new Date().toISOString(), recessions, expansions, stats, spx,
    gdpY: (gdpA || []).map(([d, v]) => [+d.slice(0, 4), r1(v)]), unrate: unM.filter((_, i) => i % 3 === 0).map(([d, v]) => [d, v]),
    src: '景氣日期：美國國家經濟研究局（NBER）；股價：Yahoo Finance 標普 500；GDP 與失業率：美國經濟分析局、勞工統計局（FRED）', errors }));
};
