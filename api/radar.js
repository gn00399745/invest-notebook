// Vercel Serverless Function：選股雷達（公允價值 × 長抱 3～5 年）
// GET /api/radar → { updated, revYM, universe, list:[{ code, name, mkt, ind, close, fair, fairPE, fairPB, fairDiv, ratio, buyBelow, pe, indPE, pb, indPB, dy, cumYoY, revYoY }], hold:{ code:[名稱, 收盤, 本益比, 公允價值, 價格÷公允, 累計營收年增] }, errors }
// 公允價值＝三種估法的中位數（與 2013～2026 回測相同）：
//   本益比法：每股盈餘 × 同業本益比中位數（夾在 8～20 倍）
//   淨值法：  每股淨值 × 同業股價淨值比中位數（夾在 0.8～2.5 倍）
//   股利法：  每股股利 ÷ 5%
// 入選：本益比 ≥ 6（太低常是一次性獲利）、殖利率 ≥ 3%、股價 ≤ 公允價值 × 0.7（安全邊際 30%）、累計營收年增 ≥ 0、成交值 ≥ 1,000 萬
'use strict';
const { r1, isStock, twse, tpex, why } = require('./_market');

const MARGIN = 0.7, DY_FAIR = 5;
const clip = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = n => n == null ? null : Math.round(n * 100) / 100;
const median = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

module.exports = async (req, res) => {
  const errors = [];
  const [A, B] = await Promise.all([twse(errors).catch(e => { errors.push('證交所：' + why(e)); return {}; }), tpex(errors).catch(e => { errors.push('櫃買中心：' + why(e)); return {}; })]);
  const all = Object.values({ ...A, ...B }).filter(u => u.close > 0 && isStock(u.code));
  // 同產業本益比、淨值比中位數（至少 3 家）
  const byInd = {}; all.forEach(u => { if (u.ind) (byInd[u.ind] = byInd[u.ind] || []).push(u); });
  const indMed = {};
  Object.entries(byInd).forEach(([k, us]) => {
    const pes = us.map(u => u.pe).filter(v => v > 0 && v < 200), pbs = us.map(u => u.pb).filter(v => v > 0);
    indMed[k] = { pe: pes.length >= 3 ? median(pes) : null, pb: pbs.length >= 3 ? median(pbs) : null };
  });
  all.forEach(u => {
    const m = indMed[u.ind]; if (!(u.pe > 0) || !(u.pb > 0) || !m?.pe || !m?.pb) return;
    u.indPE = m.pe; u.indPB = m.pb;
    u.fairPE = u.close / u.pe * clip(m.pe, 8, 20);
    u.fairPB = u.close / u.pb * clip(m.pb, 0.8, 2.5);
    u.fairDiv = u.dy > 0 ? u.close * u.dy / 100 / (DY_FAIR / 100) : null;
    u.fair = u.fairDiv ? median([u.fairPE, u.fairPB, u.fairDiv]) : (u.fairPE + u.fairPB) / 2;
    u.ratio = u.close / u.fair;
  });
  const liq = all.filter(u => (u.value || 0) >= 1e7);
  const list = liq.filter(u => u.ratio != null && u.ratio <= MARGIN && u.pe >= 6 && (u.dy || 0) >= 3 && u.cumYoY != null && u.cumYoY >= 0)
    .sort((a, b) => a.ratio - b.ratio).map((u, i) => ({
      code: u.code, name: u.name, mkt: u.mkt, ind: u.ind || '', close: u.close, value: u.value,
      fair: r2(u.fair), fairPE: r2(u.fairPE), fairPB: r2(u.fairPB), fairDiv: r2(u.fairDiv), ratio: r2(u.ratio), buyBelow: r2(u.fair * MARGIN),
      pe: u.pe, indPE: r1(u.indPE), pb: u.pb, indPB: r2(u.indPB), dy: u.dy, cumYoY: r1(u.cumYoY), revYoY: r1(u.revYoY), rank: i + 1,
    }));
  // 持股檢查用：所有股票（持股不一定在名單上）
  const hold = {};
  all.forEach(u => { hold[u.code] = [u.name, u.close, u.pe ?? null, r2(u.fair), r2(u.ratio), r1(u.cumYoY)]; });
  const revYM = all.map(u => u.revYM).filter(Boolean).sort().pop() || '';
  // 交易所資料不完整時只快取 10 分鐘，避免缺一半的名單被留 6 小時
  const partial = errors.some(e => /證交所|櫃買/.test(e));
  res.setHeader('Cache-Control', !list.length ? 'no-store' : partial ? 's-maxage=600' : 's-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), revYM, universe: all.length, liquid: liq.length, margin: MARGIN, list, hold, errors }));
};
