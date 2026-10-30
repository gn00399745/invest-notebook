/* ================= 交易成績單＋大師檢查表 =================
   交易成績單：參考開源專案 anti-gambling-trader-tw 的做法，從你的交易紀錄算勝率、期望值、
   獲利因子、類夏普值與 t 檢定，判斷績效是實力還是運氣。全部在你的手機上計算，不上傳。
   大師檢查表：用研究卡已有的財報與估值資料，照巴菲特、葛拉漢、林區、柏瑞的公開選股原則逐項打勾。
   這是規則化的簡化版，不代表這些投資人本人的看法。 */

/* ---------- 統計小工具 ---------- */
function lgamma(x) { const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const c of g) s += c / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function betacf(a, b, x) { let m2, aa, c = 1, d = 1 - (a + b) * x / (a + 1); if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) { m2 = 2 * m; aa = m * (b - m) * x / ((a - 1 + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + 1 + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; }
  return h; }
function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
const tPval1 = (t, df) => { const p2 = ibeta(df / (df + t * t), df / 2, 0.5); return t > 0 ? p2 / 2 : 1 - p2 / 2; }; // 單尾：平均報酬 > 0

/* ---------- 交易成績單 ---------- */
function tradeOutcomes() {
  const pos = {}, out = [];
  [...S.trades].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
    const k = String(t.code || '').toUpperCase(); if (!k || !t.date) return;
    const p = pos[k] = pos[k] || { sh: 0, cost: 0, day: 0, name: t.name };
    const sh = num(t.shares) || 0, px = num(t.price) || 0, fee = t.fee !== '' && t.fee != null ? num(t.fee) || 0 : estFee(t), dn = new Date(t.date) / 864e5;
    if (t.name) p.name = t.name;
    if (t.side === '賣出') {
      if (!p.sh) return; const q = Math.min(sh, p.sh), avg = p.cost / p.sh, basis = avg * q, pl = q * px - fee * (q / sh) - basis;
      out.push({ code: k, name: p.name, date: t.date, q, ret: basis ? pl / basis * 100 : 0, pl, plT: pl * (/^\d/.test(k) ? 1 : fx()), days: Math.max(0, Math.round(dn - p.day)) });
      p.cost -= basis; p.sh = Math.round((p.sh - q) * 1e6) / 1e6; if (p.sh <= 0) { p.sh = 0; p.cost = 0; }
    } else { p.day = p.sh ? (p.day * p.sh + dn * sh) / (p.sh + sh) : dn; p.sh = Math.round((p.sh + sh) * 1e6) / 1e6; p.cost += sh * px + fee; }
  });
  return out;
}
function tradeStats() {
  const O = tradeOutcomes(), n = O.length; if (!n) return { n: 0, O };
  const R = O.map(o => o.ret), W = O.filter(o => o.pl > 0), L = O.filter(o => o.pl <= 0);
  const mean = R.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(R.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const avgW = W.length ? W.reduce((a, o) => a + o.ret, 0) / W.length : 0, avgL = L.length ? L.reduce((a, o) => a + o.ret, 0) / L.length : 0;
  const gw = W.reduce((a, o) => a + o.plT, 0), gl = -L.reduce((a, o) => a + o.plT, 0);
  let streak = 0, maxL = 0; O.forEach(o => { streak = o.pl <= 0 ? streak + 1 : 0; maxL = Math.max(maxL, streak); });
  const t = n > 2 && sd > 0 ? mean / (sd / Math.sqrt(n)) : null, p = t != null ? tPval1(t, n - 1) : null;
  const by = {}; O.forEach(o => { const b = by[o.code] = by[o.code] || { code: o.code, name: o.name, n: 0, w: 0, plT: 0 }; b.n++; if (o.pl > 0) b.w++; b.plT += o.plT; });
  return { n, O, win: W.length / n * 100, mean, sd, avgW, avgL, payoff: avgL ? avgW / -avgL : null, pf: gl > 0 ? gw / gl : null, total: gw - gl, maxL,
    days: O.reduce((a, o) => a + o.days, 0) / n, sharpe: sd ? mean / sd : null, t, p, by: Object.values(by).sort((a, b) => b.plT - a.plT) };
}
function verdictOfStats(s) {
  if (s.n < 5) return ['neu', `只有 ${s.n} 筆已平倉交易，樣本太少，先累積到 20 筆以上再看。`];
  if (s.p != null && s.p < 0.05 && s.mean > 0) return ['pos', `平均每筆 ${pc(s.mean, 1)}%，統計上有意義（p ≈ ${fmt(s.p, 3)}）：目前看起來是方法有效，不只是運氣。`];
  if (s.mean > 0) return ['gold', `平均每筆是賺的（${pc(s.mean, 1)}%），但還不能排除運氣（p ≈ ${fmt(s.p, 2)}，要小於 0.05 才算有把握）。${s.n < 30 ? '多累積幾筆再看。' : ''}`];
  return ['neg', `平均每筆 ${pc(s.mean, 1)}%：目前的做法期望值是負的，先檢查是不是「賺小賠大」或停損太晚。`];
}
function tradeReportHTML() {
  const s = tradeStats();
  if (!s.n) return `<div class="card tr-card"><h3 class="gold-bar">📊 交易成績單</h3><div class="empty">還沒有賣出紀錄。賣出（平倉）後才算得出勝率、期望值。</div></div>`;
  const [vc, vt] = verdictOfStats(s);
  const tile = (k, v, sub, c = '') => `<div class="tr-t"><span>${k}</span><b class="${c}">${v}</b><small>${sub}</small></div>`;
  return `<div class="card tr-card"><h3 class="gold-bar">📊 交易成績單</h3>
    <div class="tr-v ${vc}">${esc(vt)}</div>
    <div class="tr-grid">
      ${tile('勝率', `${fmt(s.win, 0)}%`, `${s.n} 筆中賺 ${Math.round(s.win * s.n / 100)} 筆`)}
      ${tile('期望值', `${pc(s.mean, 1)}%`, '平均每筆報酬', s.mean >= 0 ? 'up' : 'down')}
      ${tile('賺賠比', s.payoff ? fmt(s.payoff, 2) : '—', `平均賺 ${pc(s.avgW, 1)}%／賠 ${pc(s.avgL, 1)}%`)}
      ${tile('獲利因子', s.pf ? fmt(s.pf, 2) : '—', '總賺 ÷ 總賠，>1.5 算好')}
      ${tile('已實現損益', fmt(Math.round(s.total)), '元（美股換算台幣）', s.total >= 0 ? 'up' : 'down')}
      ${tile('類夏普值', s.sharpe != null ? fmt(s.sharpe, 2) : '—', '平均 ÷ 波動，>0.5 算穩')}
      ${tile('最多連虧', `${s.maxL} 筆`, '心理壓力測試')}
      ${tile('平均持有', `${fmt(s.days, 0)} 天`, '買進到賣出')}
    </div>
    ${s.t != null ? `<div class="help">t 檢定：t = ${fmt(s.t, 2)}，p ≈ ${fmt(s.p, 3)}（p 越小，越不像運氣；小於 0.05 才算有統計意義）。</div>` : ''}
    <details class="rc-sub"><summary>各檔成績（${s.by.length} 檔）</summary>${gtable(['標的', '筆數', '勝率', '損益'], s.by.map(b => `<div class="gt-r"><span>${esc(b.code)} ${esc(b.name || '')}</span><span>${b.n}</span><span>${fmt(b.w / b.n * 100, 0)}%</span><span class="${b.plT >= 0 ? 'up' : 'down'}">${fmt(Math.round(b.plT))}</span></div>`))}</details>
    <details class="rc-sub"><summary>每筆平倉明細</summary>${gtable(['日期', '標的', '報酬', '持有'], [...s.O].reverse().map(o => `<div class="gt-r"><span>${o.date}</span><span>${esc(o.code)}</span><span class="${o.ret >= 0 ? 'up' : 'down'}">${pc(o.ret, 1)}%</span><span>${o.days} 天</span></div>`))}</details>
    <div class="help">以平均成本法計算，含手續費與證交稅；每一筆賣出算一筆交易。觀念參考開源專案 anti-gambling-trader-tw。</div></div>`;
}
const _tradesIns = PAGES.trades;
PAGES.trades = () => {
  const h = _tradesIns(), k = h.indexOf('<div class="card">\n    <div class="card-head"><h3 class="gold-bar">交易紀錄</h3>');
  return k >= 0 ? h.slice(0, k) + tradeReportHTML() + h.slice(k) : h + tradeReportHTML();
};

/* ---------- 大師檢查表 ---------- */
function masterData(c) {
  const F = c.fm || {}, px = num(c.price), sh = F.shares, vs = typeof valSummary === 'function' ? valSummary(c) : {};
  const avg = (a, b) => (a != null && b != null ? (a + b) / 2 : a);
  const eq = avg(F.equity, F.equityP), mcap = px && sh ? px * sh : null;
  const eps = F.ni != null && sh ? F.ni / sh : null, bvps = F.equity && sh ? F.equity / sh : null;
  const pe = mcap && F.ni > 0 ? mcap / F.ni : null, pb = mcap && F.equity > 0 ? mcap / F.equity : null;
  const g = F.ni > 0 && F.niP > 0 ? (F.ni / F.niP - 1) * 100 : null, revG = F.revG ?? (F.rev && F.revP ? (F.rev / F.revP - 1) * 100 : null);
  const dyRow = (c.valx || []).find(v => v.k === 'dy'), dy = dyRow?.dy ?? null;
  const ev = mcap != null ? mcap + (F.debt || 0) - (F.cash || 0) : null;
  const q = typeof cqOf === 'function' ? cqOf(c.code)?.n : null;
  const lay = typeof findLayer === 'function' ? findLayer(c.layer) : null, fin = lay?.ch?.id === 'fin' && lay.i < 2;
  return { px, pe, pb, eps, bvps, g, revG, dy, fin, roe: F.ni != null && eq > 0 ? F.ni / eq * 100 : null, om: F.opInc != null && F.rev ? F.opInc / F.rev * 100 : null,
    de: F.equity > 0 && F.debt != null ? F.debt / F.equity : null, ndE: F.ebitda > 0 ? ((F.debt || 0) - (F.cash || 0)) / F.ebitda : null,
    evE: ev != null && F.ebitda > 0 ? ev / F.ebitda : null, fair: vs.avg, epv: typeof epvOf === 'function' ? epvOf(c)?.fair : null, ma60: q?.ma60, last: q?.last ?? px, has: !!c.fm };
}
const MASTERS = [
  { id: 'buffett', n: '巴菲特', t: '好公司＋護城河＋合理價格', ck: d => [
    ['ROE ≥ 15%', d.roe, v => v >= 15, v => `${fmt(v, 1)}%`],
    ['營業利益率 ≥ 15%（定價能力）', d.fin ? null : d.om, v => v >= 15, v => `${fmt(v, 1)}%`],
    ['負債 ≤ 股東權益的 0.5 倍', d.fin ? null : d.de, v => v <= 0.5, v => `${fmt(v, 2)} 倍`],
    ['獲利比去年成長', d.g, v => v > 0, v => `${pc(v, 1)}%`],
    ['股價 ≤ 綜合合理價', d.fair && d.px ? d.px / d.fair : null, v => v <= 1, v => `合理價的 ${fmt(v * 100, 0)}%`]] },
  { id: 'graham', n: '葛拉漢', t: '便宜才買，要有安全邊際', ck: d => [
    ['本益比 ≤ 15', d.pe, v => v <= 15, v => `${fmt(v, 1)} 倍`],
    ['本益比 × 股價淨值比 ≤ 22.5', d.pe && d.pb ? d.pe * d.pb : null, v => v <= 22.5, v => fmt(v, 1)],
    ['股價 ≤ 葛拉漢數字 √(22.5×EPS×每股淨值)', d.eps > 0 && d.bvps > 0 && d.px ? d.px / Math.sqrt(22.5 * d.eps * d.bvps) : null, v => v <= 1, v => `葛拉漢數字的 ${fmt(v * 100, 0)}%`],
    ['有發現金股利', d.dy, v => v > 0, v => `殖利率 ${fmt(v, 2)}%`],
    ['近四季有獲利', d.eps, v => v > 0, v => `EPS ${fmt(v, 2)}`]] },
  { id: 'lynch', n: '彼得林區', t: '用合理價格買成長', ck: d => [
    ['PEG（本益比 ÷ 獲利成長率）≤ 1', d.pe && d.g > 0 ? d.pe / d.g : null, v => v <= 1, v => fmt(v, 2)],
    ['獲利成長 15～50%（穩健成長）', d.g, v => v >= 15 && v <= 50, v => `${pc(v, 1)}%`],
    ['營收成長 ≥ 10%', d.revG, v => v >= 10, v => `${pc(v, 1)}%`],
    ['負債 ≤ 股東權益的 0.8 倍', d.fin ? null : d.de, v => v <= 0.8, v => `${fmt(v, 2)} 倍`]] },
  { id: 'burry', n: '麥可柏瑞', t: '逆向找被市場冷落的低估股', ck: d => [
    ['EV／EBITDA ≤ 8', d.fin ? null : d.evE, v => v <= 8, v => `${fmt(v, 1)} 倍`],
    ['股價 ≤ 盈利能力價值 EPV', d.epv && d.px ? d.px / d.epv : null, v => v <= 1, v => `EPV 的 ${fmt(v * 100, 0)}%`],
    ['淨負債 ≤ 2 年 EBITDA', d.fin ? null : d.ndE, v => v <= 2, v => v < 0 ? '淨現金' : `${fmt(v, 1)} 年`],
    ['股價在季線下（市場冷落）', d.ma60 && d.last ? d.last / d.ma60 - 1 : null, v => v < 0, v => `離季線 ${pc(v * 100, 1)}%`]] },
];
function masterHTML(c) {
  if (c.example === undefined && !c.code) return '';
  const d = masterData(c);
  if (!d.has) return `<details class="rc-sub ms"><summary>🎓 大師檢查表</summary><div class="help">按上方「⚡ 自動帶入」取得財報後，就會依巴菲特、葛拉漢、林區、柏瑞的選股原則逐項檢查。</div></details>`;
  const rows = MASTERS.map(M => {
    const C = M.ck(d).map(([k, v, ok, f]) => ({ k, v, st: v == null || !isFinite(v) ? 'na' : ok(v) ? 'ok' : 'no', f })), y = C.filter(x => x.st === 'ok').length, nn = C.filter(x => x.st !== 'na').length;
    const sc = nn ? y / nn : null, cl = sc == null ? 'neu' : sc >= 0.75 ? 'pos' : sc >= 0.5 ? 'gold' : 'neg', tx = sc == null ? '資料不足' : sc >= 0.75 ? '符合' : sc >= 0.5 ? '部分符合' : '不符合';
    return { M, C, y, nn, cl, tx };
  });
  const best = rows.filter(r => r.cl === 'pos').map(r => r.M.n);
  return `<details class="rc-sub ms" open><summary>🎓 大師檢查表${best.length ? `・<b class="up">${best.join('、')}會喜歡</b>` : ''}</summary>
    <div class="ms-list">${rows.map(r => `<details class="ms-m" data-ms="${r.M.id}" ${msOpen.has(r.M.id) ? 'open' : ''}><summary><b>${r.M.n}</b><em>${r.M.t}</em><i class="sigp ${r.cl}">${r.tx} ${r.nn ? `${r.y}/${r.nn}` : ''}</i></summary>
      ${r.C.map(x => `<div class="ms-c ${x.st}"><span>${x.st === 'ok' ? '✅' : x.st === 'no' ? '❌' : '➖'} ${x.k}</span><small>${x.st === 'na' ? (d.fin && /負債|EBITDA|利益率/.test(x.k) ? '金融股不適用' : '缺資料') : x.f(x.v)}</small></div>`).join('')}</details>`).join('')}</div>
    <div class="help">用研究卡的財報（近四季）與估值計算，是照公開選股原則做的簡化版，不代表本人觀點；不同風格本來就會有不同結論，用來檢查自己有沒有漏看。</div></details>`;
}
const msOpen = new Set(); // 重新整理畫面時保留展開狀態
document.addEventListener('toggle', e => { const d = e.target; if (d.dataset?.ms) d.open ? msOpen.add(d.dataset.ms) : msOpen.delete(d.dataset.ms); }, true);
const _cardsMs = PAGES.cards;
PAGES.cards = () => {
  const h = _cardsMs(); if (!openCardId) return h;
  const c = S.cards.find(x => x.id === openCardId); if (!c?.code) return h;
  const k = h.indexOf('<details class="rc-sub mg"');
  return k >= 0 ? h.slice(0, k) + masterHTML(c) + h.slice(k) : h;
};
if (['cards', 'trades'].includes(current)) render();
