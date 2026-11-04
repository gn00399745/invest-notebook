// Vercel Serverless Function：價值雷達（長期被低估、營收沒在衰退）
// GET /api/value → { updated, revYM, universe, list:[{ code, name, mkt, ind, close, pe, indPE, rel, pb, dy, cumYoY, revYoY, rank }], hold:{ code:[名稱, 收盤, 本益比, 對同業, 殖利率, 累計營收年增, 淨值比] }, errors }
// 選股條件與回測（2022/1～2026/10）相同：本益比 ≤ 15 且 ≤ 同業中位數 × 0.8、淨值比 ≤ 2、殖利率 ≥ 4%、累計營收年增 ≥ 0
'use strict';
const { r1, isStock, twse, tpex, why } = require('./_market');

module.exports = async (req, res) => {
  const errors = [];
  const [A, B] = await Promise.all([twse(errors).catch(e => { errors.push('證交所：' + why(e)); return {}; }), tpex(errors).catch(e => { errors.push('櫃買中心：' + why(e)); return {}; })]);
  const all = Object.values({ ...A, ...B }).filter(u => u.close > 0 && isStock(u.code));
  // 同產業本益比、淨值比中位數
  const med = a => { const s = a.filter(v => v > 0).sort((x, y) => x - y); return s.length >= 3 ? s[Math.floor(s.length / 2)] : null; };
  const byInd = {}; all.forEach(u => { if (u.ind) (byInd[u.ind] = byInd[u.ind] || []).push(u); });
  const indMed = {}; Object.entries(byInd).forEach(([k, us]) => { indMed[k] = { pe: med(us.map(u => u.pe).filter(v => v < 200)), pb: med(us.map(u => u.pb)) }; });
  // 流動性：成交值 ≥ 1,000 萬
  const liq = all.filter(u => (u.value || 0) >= 1e7);
  liq.forEach(u => { const m = indMed[u.ind]; u.indPE = m?.pe ?? null; u.rel = u.pe > 0 && u.indPE ? u.pe / u.indPE : null; });
  const ok = liq.filter(u => u.pe > 0 && u.pe <= 15 && u.rel != null && u.rel <= 0.8 && u.pb > 0 && u.pb <= 2 && (u.dy || 0) >= 4 && u.cumYoY != null && u.cumYoY >= 0);
  // 綜合排名：對同業本益比越低、淨值比越低、殖利率越高越前面
  const rk = (arr, f) => { const s = [...arr].sort((a, b) => f(a) - f(b)); const m = new Map(); s.forEach((u, i) => m.set(u, i)); return m; };
  const R1 = rk(ok, u => u.rel), R2 = rk(ok, u => u.pb), R3 = rk(ok, u => -u.dy);
  const list = ok.map(u => ({ u, s: R1.get(u) + R2.get(u) + R3.get(u) })).sort((a, b) => a.s - b.s).map(({ u }, i) => ({
    code: u.code, name: u.name, mkt: u.mkt, ind: u.ind || '', close: u.close, value: u.value, pe: u.pe, indPE: u.indPE, rel: r1(u.rel * 100) / 100, pb: u.pb, dy: u.dy,
    cumYoY: r1(u.cumYoY), revYoY: r1(u.revYoY), rank: i + 1,
  }));
  // 續抱檢查用：所有有成交的股票（持股不一定在名單上）
  const hold = {};
  all.forEach(u => { hold[u.code] = [u.name, u.close, u.pe ?? null, u.pe > 0 && indMed[u.ind]?.pe ? Math.round(u.pe / indMed[u.ind].pe * 100) / 100 : null, u.dy ?? null, r1(u.cumYoY), u.pb ?? null]; });
  const revYM = all.map(u => u.revYM).filter(Boolean).sort().pop() || '';
  // 交易所資料不完整時只快取 10 分鐘，避免缺一半的名單被留 6 小時
  const partial = errors.some(e => /證交所|櫃買/.test(e));
  res.setHeader('Cache-Control', !list.length ? 'no-store' : partial ? 's-maxage=600' : 's-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), revYM, universe: all.length, liquid: liq.length, list, hold, errors }));
};
