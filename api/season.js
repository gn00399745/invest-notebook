// Vercel Serverless Function：季節性／選舉週期分析
// GET /api/season?sym=^GSPC|^TWII|^IXIC|^SOX
// 回傳各類年份「從前一年年底起算的平均累積漲跌幅」路徑、今年實際走勢、各月平均報酬與勝率
'use strict';

const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)' };
const ALLOW = { '^GSPC': '標普 500', '^TWII': '台灣加權指數', '^IXIC': '那斯達克綜合', '^SOX': '費城半導體', '^DJI': '道瓊工業' };
// 美國總統任期資料（用於分類）
const SIXTH = [1958, 1966, 1974, 1986, 1998, 2006, 2014]; // 同一政黨執政第 6 年（第二任期的期中選舉年）
const REP_2ND = [1954, 1970, 1982, 1990, 2002, 2018]; // 共和黨總統第一任的期中選舉年
const STEP = 2; // 每 2 天取一點

module.exports = async (req, res) => {
  const sym = ALLOW[req.query?.sym] ? req.query.sym : '^GSPC';
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=max&interval=1d`, { headers: UA, signal: AbortSignal.timeout(25000) });
    if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
    const R = (await r.json()).chart.result[0], cl = R.indicators.quote[0].close;
    const pts = R.timestamp.map((t, i) => ({ d: new Date((t + (R.meta.gmtoffset || 0)) * 1000), c: cl[i] })).filter(p => p.c != null);
    // 依年份整理：日序（1～366）→ 收盤
    const byY = {};
    pts.forEach(p => { const y = p.d.getUTCFullYear(), doy = Math.floor((p.d - Date.UTC(y, 0, 1)) / 864e5) + 1; (byY[y] = byY[y] || []).push([doy, p.c]); });
    const years = Object.keys(byY).map(Number).sort((a, b) => a - b), thisY = years[years.length - 1];
    const first = Math.max(years[0] + 1, sym === '^GSPC' || sym === '^DJI' ? 1950 : years[0] + 1);
    const path = y => { // 相對前一年最後收盤的累積漲跌 %，每 STEP 天一點
      const prev = byY[y - 1]; if (!prev) return null; const base = prev[prev.length - 1][1], arr = byY[y]; const out = []; let j = 0, last = null;
      for (let doy = 1; doy <= 366; doy += STEP) { while (j < arr.length && arr[j][0] <= doy) { last = arr[j][1]; j++; } out.push(last == null ? 0 : (last / base - 1) * 100); }
      return out;
    };
    const full = years.filter(y => y >= first && y < thisY);
    const avg = ys => { const ps = ys.map(path).filter(Boolean); if (!ps.length) return null; return { n: ps.length, v: ps[0].map((_, i) => Math.round(ps.reduce((s, p) => s + p[i], 0) / ps.length * 100) / 100) }; };
    const cats = [
      ['all', `全部年份（${full[0]}–${full[full.length - 1]}）`, full],
      ['mid', '美國期中選舉年', full.filter(y => y % 4 === 2)],
      ['post', '美國大選隔年', full.filter(y => y % 4 === 1)],
      ['pre', '美國大選前一年', full.filter(y => y % 4 === 3)],
      ['elec', '美國大選年', full.filter(y => y % 4 === 0)],
    ];
    if (sym === '^GSPC' || sym === '^DJI') cats.push(['sixth', '總統任期第 6 年', full.filter(y => SIXTH.includes(y))], ['rep2', '共和黨總統第 2 年', full.filter(y => REP_2ND.includes(y))]);
    if (sym === '^TWII') cats.push(['twelec', '台灣總統大選年', full.filter(y => y % 4 === 0 && y >= 1996)]);
    const series = cats.map(([k, name, ys]) => { const a = avg(ys); return a ? { k, name, n: a.n, years: ys, v: a.v } : null; }).filter(Boolean);
    // 今年實際走勢（只到今天）
    const cur = byY[thisY], lastDoy = cur[cur.length - 1][0], cp = path(thisY);
    const curPath = cp ? cp.slice(0, Math.floor((lastDoy - 1) / STEP) + 1).map(v => Math.round(v * 100) / 100) : [];
    // 各月平均報酬與上漲機率
    const mEnd = {}; pts.forEach(p => { mEnd[p.d.getUTCFullYear() * 12 + p.d.getUTCMonth()] = p.c; });
    const monthly = ys => Array.from({ length: 12 }, (_, m) => {
      const rs = ys.map(y => { const k = y * 12 + m, a = mEnd[k - 1], b = mEnd[k]; return a && b ? (b / a - 1) * 100 : null; }).filter(v => v != null);
      return rs.length ? { avg: Math.round(rs.reduce((s, v) => s + v, 0) / rs.length * 100) / 100, win: Math.round(rs.filter(v => v > 0).length / rs.length * 100), n: rs.length } : null;
    });
    // 期中選舉年 9 月底買進、持有 12 個月
    const at = d => { let p = null; for (const x of pts) { if (x.d > d) break; p = x; } return p; };
    const fwd = full.filter(y => y % 4 === 2).map(y => { const a = at(new Date(Date.UTC(y, 8, 30))), b = at(new Date(Date.UTC(y + 1, 8, 30))); return a && b && b.d > a.d ? { y, r: Math.round((b.c / a.c - 1) * 1000) / 10 } : null; }).filter(Boolean);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({ sym, name: ALLOW[sym], step: STEP, thisYear: thisY, isMid: thisY % 4 === 2, updated: new Date().toISOString(), lastDate: pts[pts.length - 1].d.toISOString().slice(0, 10),
      series, current: curPath, monthly: { all: monthly(full), mid: monthly(full.filter(y => y % 4 === 2)) }, midFwd: fwd, src: 'Yahoo Finance 歷史日線' }));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ error: e.message });
  }
};
