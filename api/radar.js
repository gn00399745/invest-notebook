// Vercel Serverless Function：選股雷達（營收動能 × 技術強勢）
// GET /api/radar → { updated, revYM, universe, list:[{ code, name, mkt, ind, close, score, tags, ... }], errors }
// 來源：臺灣證券交易所 OpenAPI、證券櫃檯買賣中心 OpenAPI（全市場收盤、月營收、本益比），Yahoo Finance（入圍個股一年日線）
'use strict';

const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)', Accept: 'application/json' };
const T = ms => AbortSignal.timeout(ms);
const why = e => e.cause?.code ? `${e.message}（${e.cause.code}）` : e.message;
async function getJ(url, ms = 20000) { const r = await fetch(url, { headers: UA, signal: T(ms) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
const num = s => { const n = parseFloat(String(s ?? '').replace(/[,%\s]/g, '')); return Number.isFinite(n) ? n : null; };
const pick = (o, ...ks) => { for (const k of ks) if (o[k] != null && o[k] !== '') return o[k]; return null; };
const r1 = n => n == null ? null : Math.round(n * 10) / 10;
const isStock = c => /^[1-9]\d{3}$/.test(c);

/* ---------- 全市場資料 ---------- */
async function twse(errors) {
  const B = 'https://openapi.twse.com.tw/v1/';
  const [day, avg, pe, rev] = await Promise.all(['exchangeReport/STOCK_DAY_ALL', 'exchangeReport/STOCK_DAY_AVG_ALL', 'exchangeReport/BWIBBU_ALL', 'opendata/t187ap05_L']
    .map(p => getJ(B + p).catch(e => { errors.push(`證交所 ${p}：${why(e)}`); return []; })));
  const U = {};
  day.forEach(x => { if (!isStock(x.Code)) return; U[x.Code] = { code: x.Code, name: x.Name, mkt: '上市', close: num(x.ClosingPrice), chg: num(x.Change), value: num(x.TradeValue), vol: num(x.TradeVolume) }; });
  avg.forEach(x => { const u = U[x.Code]; if (u) u.mavg = num(x.MonthlyAveragePrice); });
  pe.forEach(x => { const u = U[x.Code]; if (u) { u.pe = num(x.PEratio); u.dy = num(x.DividendYield); u.pb = num(x.PBratio); } });
  revInto(U, rev);
  return U;
}
async function tpex(errors) {
  const B = 'https://www.tpex.org.tw/openapi/v1/';
  const [day, pe, rev] = await Promise.all(['tpex_mainboard_daily_close_quotes', 'tpex_mainboard_peratio_analysis', 'mopsfin_t187ap05_O']
    .map(p => getJ(B + p).catch(e => { errors.push(`櫃買中心 ${p}：${why(e)}`); return []; })));
  const U = {};
  (Array.isArray(day) ? day : []).forEach(x => {
    const code = pick(x, 'SecuritiesCompanyCode', 'Code', '代號'); if (!isStock(code || '')) return;
    U[code] = { code, name: pick(x, 'CompanyName', 'Name', '名稱'), mkt: '上櫃', close: num(pick(x, 'Close', 'ClosingPrice', '收盤')), chg: num(pick(x, 'Change', '漲跌')),
      value: num(pick(x, 'TransactionAmount', 'TradeValue', '成交金額')), vol: num(pick(x, 'TradingShares', 'TradeVolume', '成交股數')) };
  });
  (Array.isArray(pe) ? pe : []).forEach(x => { const u = U[pick(x, 'SecuritiesCompanyCode', 'Code')]; if (u) { u.pe = num(pick(x, 'PriceEarningRatio', 'PEratio')); u.dy = num(pick(x, 'YieldRatio', 'DividendYield')); u.pb = num(pick(x, 'PriceBookRatio', 'PBratio')); } });
  revInto(U, Array.isArray(rev) ? rev : []);
  return U;
}
function revInto(U, rev) {
  rev.forEach(x => {
    const u = U[x['公司代號']]; if (!u) return;
    u.ind = x['產業別'] || '';
    u.revYM = x['資料年月'] || '';
    u.rev = num(x['營業收入-當月營收']);
    u.revYoY = num(x['營業收入-去年同月增減(%)']);
    u.revMoM = num(x['營業收入-上月比較增減(%)']);
    u.cumYoY = num(x['累計營業收入-前期比較增減(%)']);
  });
}

/* ---------- 入圍個股：一年日線 ---------- */
async function bars(sym) {
  const j = await getJ(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`, 9000);
  const R = j.chart.result[0], q = R.indicators.quote[0];
  return R.timestamp.map((t, i) => ({ t, c: q.close[i], v: q.volume[i], h: q.high[i] })).filter(b => b.c != null);
}
async function pool(items, n, f) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await f(items[k]); } catch (e) { out[k] = null; } } })); return out; }
const sma = (a, n) => a.length >= n ? a.slice(-n).reduce((s, x) => s + x, 0) / n : null;
function tech(b, idx3m) {
  if (!b || b.length < 70) return null;
  const c = b.map(x => x.c), v = b.map(x => x.v || 0), last = c[c.length - 1];
  const ma20 = sma(c, 20), ma60 = sma(c, 60), ma120 = sma(c, 120), ma60p = sma(c.slice(0, -20), 60);
  const hi52 = Math.max(...b.map(x => x.h ?? x.c)), prior60 = Math.max(...c.slice(-61, -1));
  const r3 = c.length > 63 ? (last / c[c.length - 64] - 1) * 100 : null, r1m = (last / c[c.length - 22] - 1) * 100;
  const vr = sma(v, 60) ? sma(v, 5) / sma(v, 60) : null;
  return { last, ma20, ma60, ma120, ma60up: ma60p ? ma60 > ma60p : null, dist: (last / hi52 - 1) * 100, brk: last >= prior60, r3, r1m, rs: r3 != null && idx3m != null ? r3 - idx3m : null, vr, bias20: (last / ma20 - 1) * 100,
    spark: c.slice(-60).map(x => Math.round(x * 100) / 100) };
}
function score(u) {
  const t = u.t || {}, tags = []; let s = 0;
  const y = u.revYoY ?? -99, cy = u.cumYoY ?? -99;
  if (y >= 50) { s += 25; tags.push('營收爆發'); } else if (y >= 30) { s += 20; tags.push('營收高成長'); } else if (y >= 15) s += 12; else if (y >= 0) s += 4;
  if (cy >= 20) { s += 5; if (y >= 15) tags.push('累計營收也成長'); }
  if (u.revMoM >= 10 && y >= 15) tags.push('月增轉強');
  const px = t.last ?? u.close;
  if (t.ma20 && px > t.ma20 && t.ma20 > t.ma60) { s += 15; tags.push('多頭排列'); } else if (t.ma60 && px > t.ma60) s += 6;
  if (t.ma60up) s += 5;
  if (t.dist != null) { if (t.dist >= -3) { s += 15; tags.push(t.dist >= -0.5 ? '創 52 週新高' : '逼近 52 週高'); } else if (t.dist >= -10) s += 8; }
  if (t.brk && !tags.some(x => /新高/.test(x))) tags.push('突破 60 日高');
  if (t.rs != null) { if (t.rs >= 20) { s += 15; tags.push('強於大盤'); } else if (t.rs >= 10) s += 10; else if (t.rs >= 0) s += 5; }
  if (t.vr != null) { if (t.vr >= 1.5) { s += 10; tags.push('量增'); } else if (t.vr >= 1.2) s += 5; }
  const warn = [];
  if (t.bias20 > 20) { s -= 10; warn.push('短線漲多（離月線 >20%）'); }
  if (u.pe > 60) warn.push('本益比偏高'); if (u.pe == null && u.pb != null) warn.push('近四季虧損或無本益比');
  if (t.vr != null && t.vr < 0.7) warn.push('量縮');
  return { score: Math.max(0, Math.min(100, s)), tags, warn };
}

module.exports = async (req, res) => {
  const errors = [];
  const [A, B] = await Promise.all([twse(errors).catch(e => { errors.push('證交所：' + why(e)); return {}; }), tpex(errors).catch(e => { errors.push('櫃買中心：' + why(e)); return {}; })]);
  const all = Object.values({ ...A, ...B }).filter(u => u.close > 0);
  // 第一關：流動性（成交值 ≥ 2,000 萬）＋營收或股價動能
  const liq = all.filter(u => (u.value || 0) >= 2e7);
  const pre = u => Math.min(u.revYoY ?? -50, 150) * 0.5 + Math.min(u.cumYoY ?? -50, 100) * 0.3 + (u.mavg ? (u.close / u.mavg - 1) * 200 : 0);
  const revPick = liq.filter(u => (u.revYoY ?? -1) >= 15 && (u.cumYoY ?? -99) >= 5 && (!u.mavg || u.close >= u.mavg * 0.97)).sort((a, b) => pre(b) - pre(a)).slice(0, 48);
  const momPick = liq.filter(u => u.mavg && (u.revYoY ?? 0) > 0 && !revPick.includes(u)).sort((a, b) => b.close / b.mavg - a.close / a.mavg).slice(0, 14);
  const short = [...revPick, ...momPick];
  // 第二關：入圍個股的一年走勢
  const idxB = await bars('^TWII').catch(e => { errors.push('加權指數：' + why(e)); return null; });
  const idx3m = idxB && idxB.length > 64 ? (idxB[idxB.length - 1].c / idxB[idxB.length - 64].c - 1) * 100 : null;
  const bs = await pool(short, 8, u => bars(`${u.code}.${u.mkt === '上櫃' ? 'TWO' : 'TW'}`));
  let miss = 0;
  short.forEach((u, i) => { u.t = tech(bs[i], idx3m); if (!u.t) miss++; Object.assign(u, score(u)); });
  if (miss) errors.push(`${miss} 檔走勢資料暫時取不到（只用營收計分）`);
  const list = short.sort((a, b) => b.score - a.score).map(u => ({
    code: u.code, name: u.name, mkt: u.mkt, ind: u.ind || '', close: u.close, chg: u.chg, value: u.value, pe: u.pe, dy: u.dy, pb: u.pb,
    revYM: u.revYM, revYoY: r1(u.revYoY), revMoM: r1(u.revMoM), cumYoY: r1(u.cumYoY),
    dist: r1(u.t?.dist), rs: r1(u.t?.rs), r1m: r1(u.t?.r1m), r3: r1(u.t?.r3), vr: u.t?.vr != null ? Math.round(u.t.vr * 100) / 100 : null, bias20: r1(u.t?.bias20),
    trend: u.t ? (u.t.last > u.t.ma20 && u.t.ma20 > u.t.ma60 ? '多頭排列' : u.t.last > u.t.ma60 ? '季線之上' : '季線之下') : '', ma60up: u.t?.ma60up ?? null,
    score: u.score, tags: u.tags, warn: u.warn, spark: u.t?.spark || [],
  }));
  const revYM = all.map(u => u.revYM).filter(Boolean).sort().pop() || '';
  res.setHeader('Cache-Control', list.length ? 's-maxage=21600, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), revYM, universe: all.length, liquid: liq.length, idx3m: r1(idx3m), list, errors }));
};
