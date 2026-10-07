// Vercel Serverless Function：極端訊號（冰水區／滾水區）
// GET /api/extreme?sym=^TWII|^GSPC|^IXIC|^SOX
// 用 1990 年以來的日線，計算四個「離常態有多遠」的指標，把今天放進歷史分布裡：
//   ① 離 200 日均線的距離 ② RSI(14) ③ 距 52 週高點的跌幅 ④ 近 20 日漲跌
// 四者的歷史百分位平均＝綜合溫度；綜合溫度落在歷史最低 5%＝冰水區、最高 5%＝滾水區。
// 並回測：歷史上進入冰水區／滾水區之後 1、3、6、12 個月的報酬。
'use strict';

const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)' };
const ALLOW = { '^TWII': '台灣加權指數', '^GSPC': '標普 500', '^IXIC': '那斯達克綜合', '^SOX': '費城半導體' };
const r1 = n => n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10;
const r2 = n => n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100;

async function daily(sym, from) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${Math.floor(Date.UTC(from, 0, 1) / 1000)}&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=history`;
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
  const R = (await r.json()).chart.result[0];
  if (R.meta?.dataGranularity && R.meta.dataGranularity !== '1d') throw new Error('Yahoo 回傳的不是日資料');
  const c = R.indicators.quote[0].close;
  return R.timestamp.map((t, i) => ({ d: new Date((t + (R.meta.gmtoffset || 0)) * 1000).toISOString().slice(0, 10), c: c[i] })).filter(x => x.c != null && x.c > 0);
}
// 某值在已排序陣列中的百分位（0～100）
function pctRank(sorted, v) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m; }
  return sorted.length ? lo / sorted.length * 100 : null;
}
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))];

module.exports = async (req, res) => {
  const sym = ALLOW[req.query?.sym] ? req.query.sym : '^TWII';
  try {
    const [bars, vix] = await Promise.all([daily(sym, 1988), sym === '^TWII' ? Promise.resolve(null) : daily('^VIX', 1990).catch(() => null)]);
    if (bars.length < 600) throw new Error('歷史資料不足');
    const c = bars.map(b => b.c), n = c.length;
    // 指標序列
    const dev = new Array(n).fill(null), rsi = new Array(n).fill(null), dd = new Array(n).fill(null), r20 = new Array(n).fill(null);
    let s200 = 0;
    for (let i = 0; i < n; i++) {
      s200 += c[i]; if (i >= 200) s200 -= c[i - 200];
      if (i >= 199) dev[i] = (c[i] / (s200 / 200) - 1) * 100;
      if (i >= 20) r20[i] = (c[i] / c[i - 20] - 1) * 100;
    }
    // 52 週高點（單調佇列）
    const dq = [];
    for (let i = 0; i < n; i++) {
      while (dq.length && c[dq[dq.length - 1]] <= c[i]) dq.pop(); dq.push(i);
      if (dq[0] <= i - 252) dq.shift();
      if (i >= 251) dd[i] = (c[i] / c[dq[0]] - 1) * 100;
    }
    // RSI(14) Wilder
    let g = 0, l = 0;
    for (let i = 1; i < n; i++) {
      const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= 14) { g += up / 14; l += dn / 14; if (i === 14) rsi[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
      else { g = (g * 13 + up) / 14; l = (l * 13 + dn) / 14; rsi[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    }
    const start = 252; // 四個指標都有值的起點
    const M = { dev, rsi, dd, r20 }, sorted = {};
    for (const k in M) sorted[k] = M[k].slice(start).filter(v => v != null).sort((a, b) => a - b);
    // 綜合溫度：四個百分位平均，再換成自身歷史百分位
    const comp = new Array(n).fill(null);
    for (let i = start; i < n; i++) comp[i] = (pctRank(sorted.dev, dev[i]) + pctRank(sorted.rsi, rsi[i]) + pctRank(sorted.dd, dd[i]) + pctRank(sorted.r20, r20[i])) / 4;
    const compS = comp.slice(start).sort((a, b) => a - b);
    const temp = comp.map(v => v == null ? null : pctRank(compS, v));
    const zoneOf = t => t == null ? null : t <= 5 ? 'ice' : t <= 20 ? 'cold' : t < 80 ? 'mid' : t < 95 ? 'hot' : 'boil';
    // 回測：各區之後的報酬
    const H = [[21, '1 個月'], [63, '3 個月'], [126, '6 個月'], [252, '12 個月']];
    const fwd = zone => H.map(([h, label]) => {
      const rs = []; for (let i = start; i < n - h; i++) if (zone === 'all' || zoneOf(temp[i]) === zone) rs.push((c[i + h] / c[i] - 1) * 100);
      return { h: label, avg: rs.length ? r1(rs.reduce((s, x) => s + x, 0) / rs.length) : null, win: rs.length ? Math.round(rs.filter(x => x > 0).length / rs.length * 100) : null, n: rs.length };
    });
    // 事件：連續進入同一區（間隔超過 30 個交易日算新事件）
    const episodes = zone => {
      const out = []; let cur = null;
      for (let i = start; i < n; i++) {
        if (zoneOf(temp[i]) !== zone) continue;
        if (cur && i - cur.last <= 30) { cur.last = i; if (zone === 'ice' ? c[i] < c[cur.ext] : c[i] > c[cur.ext]) cur.ext = i; continue; }
        if (cur) out.push(cur); cur = { first: i, last: i, ext: i };
      }
      if (cur) out.push(cur);
      return out.map(e => {
        const i = e.first, after = j => j < n ? r1((c[j] / c[i] - 1) * 100) : null;
        // 進入後再跌多深（冰水）／再漲多高（滾水），以進入後一年內計
        const win = c.slice(i, Math.min(n, i + 253));
        return { d: bars[i].d, end: bars[e.last].d, px: r2(c[i]), days: e.last - e.first + 1, extD: bars[e.ext].d,
          further: r1(zone === 'ice' ? (Math.min(...win) / c[i] - 1) * 100 : (Math.max(...win) / c[i] - 1) * 100),
          m3: after(i + 63), m12: after(i + 252), ongoing: e.last >= n - 2 };
      }).slice(-10).reverse();
    };
    const i = n - 1;
    const metric = (k, name, unit, good) => ({ k, name, unit, v: r1(M[k][i]), pct: r1(pctRank(sorted[k], M[k][i])), p5: r1(q(sorted[k], 0.05)), p50: r1(q(sorted[k], 0.5)), p95: r1(q(sorted[k], 0.95)), lo: r1(sorted[k][0]), hi: r1(sorted[k][sorted[k].length - 1]), good });
    const out = {
      sym, name: ALLOW[sym], since: bars[start].d, lastDate: bars[i].d, price: r2(c[i]), updated: new Date().toISOString(),
      temp: r1(temp[i]), zone: zoneOf(temp[i]),
      metrics: [metric('dev', '離 200 日均線', '%'), metric('rsi', 'RSI(14)', ''), metric('dd', '距 52 週高點', '%'), metric('r20', '近 20 日漲跌', '%')],
      // 近 2 年溫度（每 5 個交易日一點）
      hist: temp.slice(Math.max(start, n - 504)).filter((_, j, a) => (a.length - 1 - j) % 5 === 0).map(v => r1(v)),
      histStart: bars[Math.max(start, n - 504)].d,
      daysIn: (() => { let k = 0; for (let j = i; j >= start && zoneOf(temp[j]) === zoneOf(temp[i]); j--) k++; return k; })(),
      fwd: { all: fwd('all'), ice: fwd('ice'), cold: fwd('cold'), hot: fwd('hot'), boil: fwd('boil') },
      episodes: { ice: episodes('ice'), boil: episodes('boil') },
      src: 'Yahoo Finance 歷史日線（自行計算）',
    };
    if (vix?.length > 500) {
      const vs = vix.map(x => x.c).sort((a, b) => a - b), v = vix[vix.length - 1].c;
      out.vix = { v: r2(v), d: vix[vix.length - 1].d, pct: r1(pctRank(vs, v)), p5: r1(q(vs, 0.05)), p50: r1(q(vs, 0.5)), p95: r1(q(vs, 0.95)) };
    }
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(out));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ error: e.message });
  }
};
