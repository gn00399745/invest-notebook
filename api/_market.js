// 共用：全市場收盤、本益比、殖利率、月營收（證交所、櫃買中心 OpenAPI）
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

module.exports = { UA, T, why, getJ, num, pick, r1, isStock, twse, tpex };
