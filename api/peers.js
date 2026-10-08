// Vercel Serverless Function：同業估值倍數
// GET /api/peers?code=2330&peers=2303,5347,6770        台股（證交所全市場資料，一次取得）
// GET /api/peers?code=NVDA&peers=AMD,AVGO,QCOM          美股（Yahoo 估值時間序列）
// 回傳同業的本益比、股價淨值比、殖利率、股價營收比、EV/營收、EV/EBITDA 與中位數
'use strict';

const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)', Accept: 'application/json' };
const T = ms => AbortSignal.timeout(ms);
const num = s => { const n = parseFloat(String(s ?? '').replace(/[,%\s]/g, '')); return Number.isFinite(n) ? n : null; };
const r = (n, d = 2) => n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d;
const med = a => { const b = a.filter(x => x != null && Number.isFinite(x) && x > 0).sort((x, y) => x - y); if (!b.length) return null; const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
async function getJ(u, ms = 20000) { const res = await fetch(u, { headers: UA, signal: T(ms) }); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }

let twCache = null; // 同一個執行個體內重複使用（全市場資料一天才變一次）
async function twMarket() {
  if (twCache && Date.now() - twCache.t < 3 * 3600e3) return twCache.d;
  const B = 'https://openapi.twse.com.tw/v1/';
  const [pe, day, info, rev] = await Promise.all(['exchangeReport/BWIBBU_ALL', 'exchangeReport/STOCK_DAY_ALL', 'opendata/t187ap03_L', 'opendata/t187ap05_L'].map(p => getJ(B + p).catch(() => [])));
  const M = {};
  day.forEach(x => { if (/^\d{4}$/.test(x.Code)) M[x.Code] = { code: x.Code, name: x.Name, close: num(x.ClosingPrice) }; });
  pe.forEach(x => { const m = M[x.Code]; if (m) Object.assign(m, { pe: num(x.PEratio), pb: num(x.PBratio), dy: num(x.DividendYield) }); });
  info.forEach(x => { const m = M[x['公司代號']]; if (m) m.shares = num(x['已發行普通股數或TDR原股發行股數']); });
  rev.forEach(x => {
    const m = M[x['公司代號']]; if (!m) return;
    m.ind = x['產業別'] || '';
    const ym = String(x['資料年月'] || ''), mo = +ym.slice(-2) || 12, cum = num(x['累計營業收入-當月累計營收']);
    if (cum) m.revAnn = cum * 1000 * 12 / mo; // 千元 → 元，年化
  });
  Object.values(M).forEach(m => { if (m.close && m.shares) { m.mcap = m.close * m.shares; if (m.revAnn) m.ps = m.mcap / m.revAnn; } if (m.pe > 0 && m.pb > 0) m.roe = m.pb / m.pe * 100; });
  twCache = { t: Date.now(), d: M };
  return M;
}

async function usRatios(sym) {
  const types = ['trailingPeRatio', 'trailingForwardPeRatio', 'trailingPsRatio', 'trailingPbRatio', 'trailingEnterprisesValueRevenueRatio', 'trailingEnterprisesValueEBITDARatio', 'trailingMarketCap'];
  const p2 = Math.floor(Date.now() / 1000), p1 = p2 - 200 * 86400;
  const j = await getJ(`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}?type=${types.join(',')}&period1=${p1}&period2=${p2}`, 9000);
  const o = { code: sym };
  (j.timeseries?.result || []).forEach(x => { const t = x.meta.type[0], a = (x[t] || []).filter(Boolean); const v = a[a.length - 1]?.reportedValue?.raw; if (v != null) o[t] = v; });
  return { code: sym, pe: o.trailingPeRatio, fpe: o.trailingForwardPeRatio, ps: o.trailingPsRatio, pb: o.trailingPbRatio, evRev: o.trailingEnterprisesValueRevenueRatio, evEbitda: o.trailingEnterprisesValueEBITDARatio, mcap: o.trailingMarketCap };
}

module.exports = async (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase();
  const peers = String(req.query.peers || '').toUpperCase().split(/[,\s]+/).filter(x => x && x !== code).slice(0, 12);
  const out = { code, updated: new Date().toISOString() };
  try {
    if (/^\d{4}$/.test(code)) {
      const M = await twMarket(), me = M[code] || {};
      let list = peers.map(p => M[p]).filter(Boolean);
      out.basis = '產業定位相同的公司';
      if (list.length < 4 && me.ind) { // 不足時用同產業別、市值最大的公司補
        const add = Object.values(M).filter(m => m.ind === me.ind && m.code !== code && !list.includes(m) && m.mcap).sort((a, b) => b.mcap - a.mcap).slice(0, 8 - list.length);
        list = list.concat(add); out.basis = list.length > add.length ? '產業定位相同＋同產業別市值最大的公司' : `證交所「${me.ind}」市值最大的公司`;
      }
      list = list.slice(0, 8);
      out.self = { pe: me.pe, pb: me.pb, dy: me.dy, ps: r(me.ps), roe: r(me.roe, 1), name: me.name, ind: me.ind };
      out.peers = list.map(m => ({ code: m.code, name: m.name, pe: m.pe, pb: m.pb, dy: m.dy, ps: r(m.ps), roe: r(m.roe, 1) }));
      out.med = { pe: r(med(list.map(m => m.pe))), pb: r(med(list.map(m => m.pb))), dy: r(med(list.map(m => m.dy))), ps: r(med(list.map(m => m.ps))), roe: r(med(list.map(m => m.roe)), 1) };
      out.src = '臺灣證券交易所 OpenAPI（本益比、股價淨值比、殖利率、月營收年化）';
    } else {
      const syms = [code, ...peers].slice(0, 8);
      const rows = (await Promise.all(syms.map(s => usRatios(s).catch(() => null)))).filter(Boolean);
      const me = rows.find(x => x.code === code) || {}, list = rows.filter(x => x.code !== code);
      out.basis = '產業定位相同的公司';
      out.self = me; out.peers = list;
      out.med = ['pe', 'fpe', 'ps', 'pb', 'evRev', 'evEbitda'].reduce((o, k) => (o[k] = r(med(list.map(x => x[k]))), o), {});
      out.src = 'Yahoo Finance 估值資料';
    }
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');
    res.status(200).json(out);
  } catch (e) { res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ error: e.message }); }
};
