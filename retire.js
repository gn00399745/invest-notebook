/* 財務計畫：退休目標 × 資產配置 × 每期投入（取代原本的策略頁與退休試算） */
'use strict';

const PL_YEAR = new Date().getFullYear();
const PL_DEF = { birth: '', sys: '', start: '', retAge: 65, life: 90, pay: '', gross: '', lpBal: '', manualPen: '', lump: '',
  expSrc: '', city: '全國平均', people: 1, level: 1, expManual: '', rS: 7, rB: 3, infl: 2, stock: '',
  xTrav: 60000, xMed: 3000, xFam: 0, xHome: 30000, xLtc: 20000, ltcAge: 80, penAdj: 1, penErode: 1, finPay: '' };
// 特殊花費：旅遊（每年）、醫療與保險（每月）、孝親／家人（每月）、換車與房屋修繕（每年平均）、長照（某歲起每月）
const plExtraM = (p, a) => (num(p.xTrav) || 0) / 12 + (num(p.xMed) || 0) + (num(p.xFam) || 0) + (num(p.xHome) || 0) / 12 + (a >= (num(p.ltcAge) || 80) ? num(p.xLtc) || 0 : 0);
const plNeedM = (R, a) => R.E.v + plExtraM(R.q, a);
// 主計總處 112 年家庭收支調查：平均每人月消費支出（元）
const PL_CITY = { 全國平均: 25726, 臺北市: 34014, 新北市: 26226, 桃園市: 25235, 臺中市: 26957, 臺南市: 22661, 高雄市: 26399, 基隆市: 24234, 新竹市: 31211, 新竹縣: 29578, 嘉義市: 25599,
  宜蘭縣: 23808, 苗栗縣: 21017, 彰化縣: 19292, 南投縣: 18650, 雲林縣: 20356, 嘉義縣: 19410, 屏東縣: 21594, 臺東縣: 21412, 花蓮縣: 21484, 澎湖縣: 20971 };
const PL_CPI = 1.02 ** (PL_YEAR - 2023);          // 112 年 → 今年的物價調整
// 公務人員俸額表（114 年 1 月 1 日生效）：俸點 → 本俸
const PL_PT = { 800: 63570, 790: 60290, 780: 59520, 750: 57220, 730: 55690, 710: 54160, 690: 52630, 670: 51100, 650: 49560, 630: 48030, 610: 46500, 590: 44970,
  550: 41900, 535: 40760, 520: 39610, 505: 38460, 490: 37310, 475: 36160, 460: 35010, 445: 33860, 430: 32710, 415: 31560, 400: 30410, 385: 29270, 370: 28120,
  360: 27350, 350: 26580, 340: 25820, 330: 25050, 320: 24290, 310: 23520, 300: 22750, 290: 21990, 280: 21220, 270: 20460, 260: 19690, 250: 18920, 240: 18160,
  230: 17390, 220: 16630, 210: 16090, 200: 15540, 190: 15000, 180: 14460, 170: 13920, 160: 13380 };
// 專業加給月支數額（111.1.1 表）：[職等, 官等, 官階, 表一 一般公務人員, 表十八 關務人員]；112、114 年兩次調薪，乘 1.0714 推估現行數額
const PL_GRADE = [[14, '簡任', '', 43530, 0], [13, '簡任', '一階', 40540, 51700], [12, '簡任', '二階', 39320, 48880], [11, '簡任', '三階', 34980, 45460], [10, '簡任', '四階', 32100, 43290],
  [9, '薦任', '一階', 27620, 40320], [8, '薦任', '二階', 26470, 38750], [7, '薦任', '三階', 23270, 36080], [6, '薦任', '四階', 22280, 34190],
  [5, '委任', '一階', 20260, 30200], [4, '委任', '二階', 19360, 27950], [3, '委任', '三階', 19110, 26310], [2, '委任', '四階', 19050, 24550], [1, '委任', '', 18980, 22900]];
const PL_ADJ = 1.0714;
function plSalary(p) {
  const g = PL_GRADE.find(x => x[0] === num(p.grade)), base = PL_PT[num(p.pt)] || 0, tbl = p.payTbl || 'customs';
  const prof = g ? Math.round((tbl === 'customs' ? g[4] : tbl === 'general' ? g[3] : 0) * PL_ADJ / 10) * 10 : 0, mgr = num(p.mgr) || 0;
  const real = num(p.grossReal) || 0, est = base + prof + mgr;
  return { g, base, prof, mgr, est, real, gross: real || est };
}
const PL_SYS = [['gov', '公務人員'], ['govdc', '公務人員（112/7 後到職）'], ['labor', '勞工'], ['other', '其他／自己填']];
const PL_LV = [[0.8, '精簡'], [1, '一般'], [1.3, '寬裕']];
const PL_FREQ = [[12, '每月'], [4, '每季'], [2, '每半年'], [1, '每年']];
// 只存使用者自己填的欄位；沒填的用預設值（出生年、身分留空，第一次使用要自己填）
const plP = () => Object.assign({}, PL_DEF, S.plan || {});
const plSet = (k, v) => { (S.plan = S.plan || {})[k] = v; save(); };
// 舊版曾把預設值存進資料：清掉沒有實際填過的出生年、身分、縣市
if (S.plan && !S.plan._v2) { const o = S.plan; if (o.birth == PL_YEAR - 34) delete o.birth; if (o.sys === 'gov') delete o.sys; if (o.city === '桃園市') delete o.city; o._v2 = 1; save(); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 從薪資單、記帳自動推算 ---------- */
function plSlip() {
  const r = (S.recurring || []).find(x => x.kind === '薪資單'); if (!r) return {};
  const d = n => (r.deds || []).find(x => new RegExp(n).test(x.name || ''));
  const tf = num(d('退撫')?.amount);
  // 退撫提撥率 15%，以本俸 ×2 為基準、本人負擔 35% → 每月扣款 = 本俸 × 10.5%
  return { pay: tf ? Math.round(tf / 0.105 / 10) * 10 : null, gross: num(r.gross) };
}
function plLedgerExp() {
  const cur = ym(today()), months = [...new Set(S.ledger.map(e => ym(e.date || '')))].filter(m => m && m < cur).sort().slice(-6);
  if (!months.length) return null;
  const tot = S.ledger.filter(e => e.type === '支出' && e.cat !== '社保扣繳' && months.includes(ym(e.date || ''))).reduce((s, e) => s + toTWD(e.amount, e.ccy), 0);
  return { v: tot / months.length, n: months.length };
}

/* ---------- 退休金估算（今日幣值，每月） ---------- */
function plPension(p, ra) {
  const by = num(p.birth), age = PL_YEAR - by, n = Math.max(0, ra - age);
  const gov = p.sys === 'gov' || p.sys === 'govdc';
  let svc, svcT;
  if (gov) {
    const sd = p.startDate ? new Date(p.startDate) : null;
    if (sd && !isNaN(sd)) {
      const rd = new Date(by + ra, 6, 1), mo = Math.max(0, (rd.getFullYear() - sd.getFullYear()) * 12 + rd.getMonth() - sd.getMonth());
      svc = mo / 12; svcT = `${Math.floor(mo / 12)} 年${mo % 12 ? ` ${mo % 12} 個月` : ''}`;
    }
  } else { const startAge = num(p.start) ? num(p.start) - by : 25; svc = Math.max(0, ra - startAge); svcT = `${svc} 年`; }
  const slip = plSlip(), out = { items: [], lump: 0, svc: svc || 0, svcT, notes: [] };
  if (gov && svc == null) { out.notes.push('填初任公職起始日才能算年資'); return out; }
  if (p.sys === 'gov' || p.sys === 'govdc') {
    const ptPay = PL_PT[num(p.pt)] || 0, bp = num(p.pay) || ptPay || slip.pay || 0; out.bp = bp; out.bpSrc = num(p.pay) ? '自己填' : ptPay ? `俸點 ${p.pt}（114 年俸額表）` : slip.pay ? '依薪資單退撫扣款推算' : '';
    if (!bp) { out.notes.push('填入本俸才能估算'); return out; }
    const finAuto = bp * Math.min(1.25, 1.01 ** n), fin = num(p.finPay) || finAuto; out.finAuto = finAuto; out.fin = fin;   // 退休時本(年功)俸（今日幣值）
    if (p.sys === 'gov') {
      if (svc < 15) { out.notes.push(`年資 ${svcT}，未滿 15 年不能領月退`); }
      else {
        const rate = Math.min(svc, 35) * 2 + Math.max(0, Math.min(svc, 40) - 35);                       // 新制：每年 2%，35 年後每年 1%
        const capR = 39 + 1.5 * (Math.min(svc, 35) - 15) + 0.5 * Math.max(0, Math.min(svc, 40) - 35);   // 替代率上限（凍結在 112 年）
        const formula = fin * 0.93 * 2 * rate / 100, cap = fin * 2 * capR / 100;
        let mon = Math.min(formula, cap), from = ra, adj = '';
        if (ra < 60) { from = 65; adj = '（未滿 60 歲退休，65 歲起領）'; }
        else if (ra < 65) { mon *= 1 - 0.04 * (65 - ra); adj = `（提前 ${65 - ra} 年起領，減 ${4 * (65 - ra)}%）`; }
        out.items.push({ n: '退撫月退休金', v: mon, from, d: `平均俸額 × 2 × 年資 ${svcT}（35 年內每年 2%、之後每年 1%）${formula > cap ? `，受替代率上限 ${fmt(capR, 1)}% 限制` : ''}${adj}` });
      }
      out.lump = fin * 1.2 * Math.min(svc, 35);
      out.lumpD = `公保一次養老給付：本俸 × 1.2 個月 × 年資 ${fmt(Math.min(svc, 35), Math.min(svc, 35) % 1 ? 1 : 0)} 年`;
    } else {
      const yrs = Math.min(n, svc), c = bp * 2 * 0.15, rr = 0.02; let acc = 0;
      for (let y = 0; y < yrs; y++) acc = acc * (1 + rr) + c * 12;
      const from = Math.max(ra, 60), yrsPay = Math.max(1, num(p.life) - from), ar = 0.015;
      const ann = acc * ar / (1 - (1 + ar) ** -yrsPay) / 12;
      out.items.push({ n: '退撫個人專戶年金', v: ann, from, d: `本俸 × 2 × 15% 每月提撥，累積約 ${fmt(acc)} 分 ${yrsPay} 年領` });
      out.items.push({ n: '公保養老年金', v: fin * Math.min(svc, 35) * 0.013, from: Math.max(ra, 65), d: `本俸 × 年資 ${fmt(Math.min(svc, 35), Math.min(svc, 35) % 1 ? 1 : 0)} 年 × 1.3%（65 歲起）` });
    }
  } else if (p.sys === 'labor') {
    const g = num(p.gross) || slip.gross || 0; out.gross = g; out.bpSrc = num(p.gross) ? '自己填' : slip.gross ? '依薪資單應發' : '';
    if (!g) { out.notes.push('填入月薪才能估算'); return out; }
    const ins = Math.min(g, 45800);
    out.items.push({ n: '勞保老年年金', v: Math.max(ins * svc * 0.00775 + 3000, ins * svc * 0.0155), from: Math.max(ra, 65), d: `投保薪資 ${fmt(ins)} × 年資 ${svc} 年 × 1.55%（65 歲起）` });
    let acc = num(p.lpBal) || 0; for (let y = 0; y < n; y++) acc = acc * 1.02 + g * 0.06 * 12;
    const from = Math.max(ra, 60), yrsPay = Math.max(1, num(p.life) - from), ar = 0.015;
    out.items.push({ n: '勞退個人帳戶', v: acc * ar / (1 - (1 + ar) ** -yrsPay) / 12, from, d: `雇主提撥 6%，累積約 ${fmt(acc)} 分 ${yrsPay} 年領` });
  } else if (!p.sys) { out.notes.push('選擇你的身分，自動估算退休金'); } else if (num(p.manualPen)) out.items.push({ n: '每月退休收入', v: num(p.manualPen), from: ra, d: '自己填' });
  out.lump += num(p.lump) || 0;
  return out;
}
const plPenAt = (P, a) => P.items.reduce((s, x) => s + (a >= x.from ? x.v * (P.adj ?? 1) * (1 - (P.erode ?? 0)) ** (a - x.from) : 0), 0);

/* ---------- 退休後花費（今日幣值，每月） ---------- */
function plExpense(p) {
  const L = plLedgerExp(), src = p.expSrc || (L ? 'ledger' : 'city');
  if (src === 'manual' && num(p.expManual)) return { v: num(p.expManual), d: '自己填', src };
  const lv = num(p.level) || 1, lvN = PL_LV.find(x => x[0] === lv)?.[1] || '';
  if (src === 'ledger' && L) return { v: L.v * lv, d: `你近 ${L.n} 個月平均支出 ${fmt(L.v)}（不含公保退撫健保）× ${lvN}`, src };
  const c = PL_CITY[p.city] || PL_CITY.全國平均, ppl = num(p.people) || 1;
  return { v: c * PL_CPI * ppl * lv, d: `${p.city}每人月消費 ${fmt(c)} × 物價調整 ${fmt(PL_CPI, 2)} × ${ppl} 人 × ${lvN}`, src: 'city' };
}

/* ---------- 配置：離退休越遠，股票越多 ---------- */
const plGlide = yrs => yrs >= 20 ? 80 : yrs >= 10 ? 70 : yrs >= 5 ? 60 : yrs > 0 ? 50 : 40;
function plNow(eNeed) {
  const W = wealth(), stock = W.tw + W.us + W.invIns, bond = W.savIns, metal = W.metal;
  const cashInv = Math.max(0, W.cash - eNeed);
  return { W, stock, bond: bond + cashInv, metal, cashInv, ef: Math.min(W.cash, eNeed), have: stock + bond + metal + cashInv };
}

/* ---------- 核心計算（實質＝今日幣值） ---------- */
function plCalc(p, o = {}) {
  const q = Object.assign({}, p, o);
  const age = PL_YEAR - num(q.birth), ra = num(q.retAge), life = num(q.life), n = ra - age, T = life - ra;
  if (!(age > 15 && age < 100)) return { err: '請填出生年' };
  if (!(n > 0)) return { err: '退休年齡要大於目前年齡' };
  if (!(T > 0)) return { err: '用到幾歲要大於退休年齡' };
  const E = plExpense(q), P = plPension(q, ra), i = num(q.infl) / 100;
  P.adj = num(q.penAdj) || 1; P.erode = (num(q.penErode) || 0) / 100;
  const sp = num(q.stock) || plGlide(n), rN = (sp * num(q.rS) + (100 - sp) * num(q.rB)) / 100 / 100;
  const r2N = (40 * num(q.rS) + 60 * num(q.rB)) / 100 / 100;
  const rr1 = (1 + rN) / (1 + i) - 1, rr2 = (1 + r2N) / (1 + i) - 1;
  const needAt = a => E.v + plExtraM(q, a), gap = a => Math.max(0, needAt(a) - plPenAt(P, a)) * 12;
  let need = 0; for (let y = 0; y < T; y++) need += gap(ra + y) / (1 + rr2) ** y;
  need = Math.max(0, need - P.lump);
  const eNeed = (plLedgerExp()?.v || E.v) * 6, N = o._now || plNow(eNeed);
  const fvHave = N.have * (1 + rr1) ** n, short = need - fvHave;
  const factor = k => { const rp = (1 + rr1) ** (1 / k) - 1; let f = 0; for (let j = 1; j <= k * n; j++) f += (1 + rp) ** (k * n - j); return f; };
  const per = {}; PL_FREQ.forEach(([k]) => { per[k] = short > 0 ? short / factor(k) : 0; });
  const cur = (S.recurring || []).filter(r => r.kind === '定期定額' || r.kind === '員工認股').reduce((s, r) => s + (num(r.amount) || 0) / (r.freq === '年' ? 12 : 1), 0);
  const sim = m => {
    const rp = (1 + rr1) ** (1 / 12) - 1, pts = [{ a: age, v: N.have }]; let B = N.have, out = null;
    for (let y = 0; y < n; y++) { for (let j = 0; j < 12; j++) B = B * (1 + rp) + m; pts.push({ a: age + y + 1, v: B }); }
    B += P.lump;
    for (let y = 0; y < T + 20; y++) { const g = gap(ra + y); if (B < g && out == null) out = ra + y + (g ? B / g : 0); B = Math.max(0, B - g) * (1 + rr2); if (y < T) pts.push({ a: ra + y + 1, v: B }); }
    return { pts, out };
  };
  const prog = need ? Math.min(1, (fvHave + cur * factor(12)) / need) : 1;
  const ann = rr2 ? rr2 / (1 - (1 + rr2) ** -T) : 1 / T;                 // 資產分 T 年提領完的每年比例
  const draw = m => (fvHave + m * factor(12) + P.lump) * ann / 12;        // 照每月投入 m，退休後每月可提領
  const pen0 = plPenAt(P, Math.max(ra, 65)), need0 = needAt(ra);
  return { q, age, ra, life, n, T, E, P, sp, rN, need, N, eNeed, fvHave, short, per, cur, sim, prog, ok: short <= 0, draw, pen0, need0, needAt, per1k: 1000 * factor(12) * ann / 12 };
}

/* ---------- 畫面 ---------- */
function plChart(A, B, R) {
  const W = 400, H = 200, L = 46, Rm = 18, Tp = 12, Bm = 22;
  const all = A.pts.concat(B ? B.pts : []), maxV = Math.max(...all.map(p => p.v), R.need, 1) * 1.08;
  const x = v => L + (v - R.age) / (R.life - R.age) * (W - L - Rm), y = v => Tp + (1 - v / maxV) * (H - Tp - Bm);
  const path = pts => pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.a).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const step = 10 ** Math.floor(Math.log10(maxV / 4)), unit = [1, 2, 5, 10].map(s => s * step).find(s => maxV / s <= 5);
  const ticks = []; for (let v = 0; v <= maxV; v += unit) ticks.push(v);
  const ages = []; for (let v = Math.ceil(R.age / 10) * 10; v <= R.life; v += 10) ages.push(v);
  const wan = v => v >= 1e8 ? fmt(v / 1e8, 1) + '億' : fmt(v / 1e4) + '萬';
  return `<svg class="rt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="資產隨年齡變化">
    ${ticks.map(v => `<line x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" class="rt-grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="rt-ax">${wan(v)}</text>`).join('')}
    ${ages.map(v => `<text x="${x(v)}" y="${H - 5}" text-anchor="middle" class="rt-ax">${v}歲</text>`).join('')}
    <line x1="${x(R.ra)}" x2="${x(R.ra)}" y1="${Tp}" y2="${H - Bm}" class="rt-ret"/><text x="${x(R.ra) + 4}" y="${Tp + 9}" class="rt-ax">退休</text>
    ${B ? `<path d="${path(B.pts)}" class="rt-l2"/>` : ''}<path d="${path(A.pts)}" class="rt-l1"/>
  </svg>
  <div class="rt-leg"><span><i class="k1"></i>照計畫投入</span>${B ? '<span><i class="k2"></i>維持現在的投入</span>' : ''}<span>以今天的錢計</span></div>`;
}
const plChip = (k, v, label, cur) => `<button type="button" class="pl-chip ${String(cur) === String(v) ? 'on' : ''}" data-plset="${k}" data-v="${esc(String(v))}">${label}</button>`;
const plIn = (k, label, help = '', ph = '') => `<label class="f"><span>${label}</span><input type="number" inputmode="decimal" data-pl="${k}" value="${esc(plP()[k] ?? '')}" placeholder="${esc(ph)}">${help ? `<em class="help">${help}</em>` : ''}</label>`;
const plRow = (id, ic, t, body) => `<details class="fp-row" data-plrow="${id}" ${(S.planOpen || (!num(plP().birth) ? 'me' : !plP().sys ? 'pen' : '')) === id ? 'open' : ''}><summary><span class="pl-ic">${ic}</span><span class="pl-t"><em>${t}</em><b id="pl_${id}_v"></b><small id="pl_${id}_d"></small></span><span class="pl-edit">調整</span></summary><div class="pl-body">${body}</div></details>`;

PAGES.plan = () => {
  const p = plP(), slip = plSlip(), L = plLedgerExp();
  setTimeout(plFill, 0);
  const sysBody = p.sys === 'gov' || p.sys === 'govdc'
    ? `<div class="pl-lbl" style="grid-column:1/-1;margin-top:0">專業加給</div><div class="pl-chips" style="grid-column:1/-1">${[['customs', '關務人員（表十八）'], ['general', '一般公務人員（表一）'], ['none', '不列入']].map(([v, l]) => plChip('payTbl', v, l, p.payTbl || 'customs')).join('')}</div>
      <label class="f"><span>職等（官階）</span><select data-pl="grade"><option value="">（選擇）</option>${PL_GRADE.map(([n, t, a]) => `<option value="${n}" ${num(p.grade) === n ? 'selected' : ''}>${t}第 ${n} 職等${a ? `（${a}）` : ''}</option>`).join('')}</select><em class="help">看派令或薪資明細</em></label>
      <label class="f"><span>俸點</span><select data-pl="pt"><option value="">（選擇）</option>${Object.keys(PL_PT).map(Number).sort((a, b) => b - a).map(k => `<option value="${k}" ${num(p.pt) === k ? 'selected' : ''}>${k} 點｜${fmt(PL_PT[k])}</option>`).join('')}</select><em class="help">薪資明細上的「俸點」或「俸額」</em></label>
      ${plIn('grossReal', '實際月薪（選填）', '薪資明細的應發合計，填了就以這個為準')}${plIn('mgr', '主管加給（選填）')}${plIn('pay', '本俸自己填（選填）', slip.pay ? `薪資單退撫扣款推算約 ${fmt(slip.pay)}` : '有選俸點就不用填')}
      <div class="pl-split" id="plPayD" style="grid-column:1/-1"></div>
      <label class="f"><span>初任公職起始日</span><input type="date" data-pl="startDate" value="${esc(p.startDate || '')}"><em class="help">看派令或公務人員履歷上的初任日期</em></label>${plIn('finPay', '預估退休時本俸（選填）', '空白＝依目前本俸估算；預期會升官等可填高一點（今日幣值）')}
      <div class="help" style="grid-column:1/-1">要更準確（含舊制年資、危勞職務）可到 <a href="https://iocs.mocs.gov.tw/medmvc/cal1010000" target="_blank" rel="noopener">銓敘部退休試算 ↗</a>，需要出生日期與初任公職起始日。</div>`
    : p.sys === 'labor' ? `${plIn('gross', '目前月薪', slip.gross ? `薪資單應發 ${fmt(slip.gross)}` : '', slip.gross ? String(slip.gross) : '')}${plIn('start', '開始工作年（西元）', '', num(p.birth) ? String(num(p.birth) + 23) : '')}${plIn('lpBal', '勞退帳戶目前累積（選填）', '勞保局 e 化服務可查')}`
    : plIn('manualPen', '退休後每月固定收入', '今日幣值');
  const expSrc = p.expSrc || (L ? 'ledger' : 'city');
  return `<h2>財務計畫</h2>
  <div class="hero pl-hero" id="plHero"></div>
  <div class="card pl-card">
    ${plRow('me', '👤', '我', `<div class="inline">${plIn('birth', '出生年（西元）')}</div>
      <div class="pl-lbl">退休年齡 <b id="plRaV">${p.retAge}</b> 歲</div><input type="range" min="50" max="70" step="1" data-pl="retAge" value="${esc(p.retAge)}" class="pl-range">
      <div class="pl-lbl">錢要用到幾歲</div><div class="pl-chips">${[85, 90, 95, 100].map(v => plChip('life', v, v + ' 歲', p.life)).join('')}</div>`)}
    ${plRow('pen', '🏛️', '退休金（每月）', `<div class="pl-chips">${PL_SYS.map(([v, l]) => plChip('sys', v, l, p.sys)).join('')}</div>
      <div class="pl-lbl">保守估計（制度可能再改）</div><div class="pl-chips">${[[1, '照現行法規'], [0.9, '打九折'], [0.8, '打八折']].map(([v, l]) => plChip('penAdj', v, l, p.penAdj)).join('')}</div><div class="inline" style="margin-top:10px">${sysBody}${plIn('lump', '其他一次入帳（選填）', '到期儲蓄險、繼承等，今日幣值')}</div><div class="help" id="plPenD"></div>`)}
    ${plRow('exp', '🏠', '退休後花費（每月）', `<div class="pl-chips">${[['ledger', '用我的記帳'], ['city', '用縣市平均'], ['manual', '我自己定']].map(([v, l]) => plChip('expSrc', v, l, expSrc)).join('')}</div>
      ${expSrc === 'manual' ? `<div class="inline" style="margin-top:10px">${plIn('expManual', '基本生活費每月（今日幣值）', '吃住交通日用等；特殊花費在下面另外加')}</div>` : `
      ${expSrc === 'city' ? `<div class="inline" style="margin-top:10px"><label class="f"><span>住在哪裡</span><select data-pl="city">${Object.keys(PL_CITY).map(c => `<option ${c === p.city ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
        <div class="pl-lbl">幾個人一起生活</div><div class="pl-chips">${[1, 2, 3].map(v => plChip('people', v, v + ' 人', p.people)).join('')}</div>` : (L ? '' : '<div class="help" style="margin-top:6px">收支頁還沒有完整月份的記帳，先用縣市平均。</div>')}
      <div class="pl-lbl">生活水準</div><div class="pl-chips">${PL_LV.map(([v, l]) => plChip('level', v, l, p.level)).join('')}</div>`}
      <div class="pl-lbl" style="margin-top:16px"><b style="font-size:14px">特殊花費</b>　平常記帳看不到、退休後一定會有的錢（今日幣值，不需要就填 0）</div>
      <div class="inline">${plIn('xTrav', '旅遊（每年）')}${plIn('xMed', '醫療、保險（每月）', '自費醫療、保費、健保')}${plIn('xFam', '孝親、家人（每月）')}${plIn('xHome', '換車、房屋修繕（每年平均）', '例如 10 年換車 60 萬＝每年 6 萬')}${plIn('xLtc', '長期照顧（每月）', '居家照顧約 2～3 萬、機構約 3～5 萬')}${plIn('ltcAge', '長照從幾歲開始')}</div>`)}
    ${plRow('have', '💼', '現有資產（可用於退休）', `<div class="help" id="plHaveD"></div><div class="btn-row" style="margin-top:8px"><button type="button" class="btn-small ghost" data-go="home">到資產頁更新 →</button></div>`)}
  </div>
  <div class="card"><h3 class="gold-bar">每一期要投入</h3><div class="pl-freq" id="plFreq"></div><div class="help" id="plCur"></div></div>
  <div class="card"><h3 class="gold-bar">怎麼放</h3><div id="plAlloc"></div></div>
  <div class="card"><h3 class="gold-bar">資產走勢</h3><div id="plChart"></div></div>
  <details class="card pl-adv" ${S.planAdv ? 'open' : ''}><summary><h3 class="gold-bar" style="display:inline">進階</h3></summary>
    <div class="pl-lbl">報酬與通膨假設</div>
    <div class="inline">${plIn('rS', '股票年報酬 %', '全球股市長期約 6～8%')}${plIn('rB', '債券年報酬 %', '投資等級債約 3～4%')}${plIn('infl', '通膨 %', '台灣長期約 2%')}${plIn('stock', '股票比例 %（選填）', '空白＝依退休年限自動')}${plIn('penErode', '退休金每年購買力縮水 %', '月退休金不會完全隨物價調整，預設 1%')}</div>
    <div class="pl-lbl" style="margin-top:14px">部位計算器（單筆買多少）</div>
    <div class="inline">${['cap|總資金', 'risk|最多虧總資金 %', 'entry|進場價', 'stop|停損價'].map(s => { const [k, l] = s.split('|'); return `<label class="f"><span>${l}</span><input type="number" inputmode="decimal" data-ps="${k}" value="${esc(S.ps?.[k] ?? (k === 'risk' ? '1' : ''))}"></label>`; }).join('')}</div>
    <div class="help" id="plPs"></div>
    <div class="pl-lbl" style="margin-top:14px">我的投資守則</div>
    <textarea data-bind="rules" style="min-height:100px">${esc(S.rules || '')}</textarea>
  </details>
  <div class="note">以固定報酬率、今日幣值估算，退休金依現行法規概算（公務人員替代率上限依 114 年修法凍結於 112 年標準）。實際請以銓敘部、退撫基金或勞保局試算為準。這是規劃參考，不構成投資建議。</div>`;
};

function plFill() {
  if (!$('#plHero')) return;
  const p = plP(), R = plCalc(p), set = (id, h) => { const e = $('#' + id); if (e) e.innerHTML = h; };
  const rv = $('#plRaV'); if (rv) rv.textContent = p.retAge;
  if (R.err) {
    const first = !num(p.birth);
    set('plHero', first ? `<div class="h-lbl">財務計畫</div><div class="h-num" style="font-size:24px">先填 2 項就能開始</div><div class="h-sub">① 出生年　② 你的身分（公務人員、勞工…）<br>其他像生活費、現有資產、定期定額，會從記帳和資產頁自動帶入。</div>` : `<div class="h-num" style="font-size:22px">${R.err}</div>`);
    set('pl_me_v', first ? '尚未填寫' : R.err); set('pl_me_d', first ? '填出生年' : '');
    ['pen', 'exp', 'have'].forEach(k => { set(`pl_${k}_v`, '—'); set(`pl_${k}_d`, ''); });
    ['plFreq', 'plCur', 'plAlloc', 'plChart'].forEach(id => set(id, '<div class="empty">填完上面的資料就會顯示</div>'));
    return;
  }
  const penM = plPenAt(R.P, Math.max(R.ra, 65));
  // 摘要列
  set('pl_me_v', `${R.age} 歲 → ${R.ra} 歲退休`); set('pl_me_d', `還有 ${R.n} 年・錢要用到 ${R.life} 歲`);
  set('pl_pen_v', R.P.items.length ? `約 ${fmt(penM)} 元` : R.P.notes[0] || '—');
  if (R.P.fin) R.P.notes.push(`退休時本俸以 ${fmt(R.P.fin)} 計算（${num(p.finPay) ? '自己填' : `自動估算：目前本俸 × ${fmt(R.P.fin / R.P.bp, 2)}`}）`);
  if (R.P.items.length) R.P.notes.push(`退休後購買力每年縮水 ${num(p.penErode) || 0}%：${R.ra + 20} 歲時約剩 ${fmt(plPenAt(R.P, Math.max(R.ra, 65) + 20))}`);
  set('pl_pen_d', `${PL_SYS.find(x => x[0] === p.sys)?.[1] || ''}${R.P.svcT ? `・退休時年資 ${R.P.svcT}` : ''}${R.P.lump ? `・一次 ${fmt(R.P.lump / 1e4)} 萬` : ''}`);
  { const Y = plSalary(p); set('plPayD', Y.base || Y.prof || Y.real ? `${Y.base || Y.prof ? `本俸 <b>${fmt(Y.base)}</b>${Y.prof ? ` ＋ 專業加給 <b>${fmt(Y.prof)}</b>` : ''}${Y.mgr ? ` ＋ 主管加給 ${fmt(Y.mgr)}` : ''} ＝ 估算 ${fmt(Y.est)}` : ''}${Y.real ? `${Y.base ? '<br>' : ''}實際月薪 <b>${fmt(Y.real)}</b>${Y.est ? `（估算${Y.real >= Y.est ? '少' : '多'}了 ${fmt(Math.abs(Y.real - Y.est))}）` : ''}` : ''}<div class="help">退休金只用本俸計算，專業加給、主管加給不列入。專業加給依 111 年表乘上 112、114 年調薪推估，請以薪資明細為準。</div>` : '選職等與俸點，自動帶出本俸與專業加給。'); }
  set('plPenD', [...R.P.items.map(x => `<b>${x.n}</b> ${fmt(x.v)}／月：${esc(x.d)}`), R.P.lumpD ? `<b>一次入帳</b> ${fmt(R.P.lump)}：${esc(R.P.lumpD)}` : '', ...R.P.notes, R.P.bpSrc ? `本俸／月薪來源：${R.P.bpSrc}` : ''].filter(Boolean).join('<br>'));
  const xNow = plExtraM(p, R.ra), xLtcV = num(p.xLtc) || 0;
  set('pl_exp_v', `約 ${fmt(R.need0)} 元`);
  set('pl_exp_d', `基本 ${fmt(R.E.v)}（${R.E.d}）＋ 特殊 ${fmt(xNow)}${xLtcV && num(p.ltcAge) > R.ra ? `；${num(p.ltcAge)} 歲起長照再加 ${fmt(xLtcV)}` : ''}`);
  set('pl_have_v', `${fmt(R.N.have)} 元`); set('pl_have_d', `已先扣下緊急預備金 ${fmt(R.N.ef)}`);
  set('plHaveD', `股票與投資型保單 ${fmt(R.N.stock)}・債券／儲蓄險／多餘現金 ${fmt(R.N.bond)}${R.N.metal ? `・貴金屬 ${fmt(R.N.metal)}` : ''}<br>緊急預備金目標 6 個月 ${fmt(R.eNeed)}，現在存款${R.N.W.cash >= R.eNeed ? '已足夠，多出來的算進投資' : `只有 ${fmt(R.N.W.cash)}，<b class="bad">建議先補足 ${fmt(R.eNeed - R.N.W.cash)}</b>`}。`);
  // 主結果
  const pct = Math.round(R.prog * 100), B = R.cur && !R.ok ? R.sim(R.cur) : null;
  const mPlan = R.ok ? R.cur : R.per[12], dCur = R.draw(R.cur), inc = R.pen0 + dCur, incPlan = R.pen0 + R.draw(mPlan);
  const bar = (pen, dr, need) => { const mx = Math.max(pen + dr, need) * 1.05 || 1; return `<div class="pl-inc"><i class="p" style="width:${pen / mx * 100}%"></i><i class="d" style="width:${dr / mx * 100}%"></i><b style="left:${need / mx * 100}%"></b></div>
    <div class="pl-inc-l"><span><i class="p"></i>退休金 ${fmt(pen)}</span><span><i class="d"></i>投資提領 ${fmt(dr)}</span><span><i class="n"></i>需要 ${fmt(need)}</span></div>`; };
  set('plHero', `<div class="h-lbl">${R.ra} 歲退休後，每月需要 <b>${fmt(R.need0)}</b>（含特殊花費）</div>
    ${R.ok
      ? `<div class="h-num">每月可用 ${fmt(inc)}</div><div class="h-sub">照現在每月投 ${fmt(R.cur)}，退休後每月比需要多 ${fmt(inc - R.need0)}</div>`
      : `<div class="h-num">每月要存 ${fmt(R.per[12])}</div><div class="h-sub">${R.cur ? `目前每月投 ${fmt(R.cur)}，退休後每月只能用 ${fmt(inc)}，${R.cur >= R.per[12] ? '進度 OK' : `還差 ${fmt(R.per[12] - R.cur)}／月${B?.out ? `（照現在的速度 ${fmt(B.out, 0)} 歲錢會用完）` : ''}`}` : `還沒有設定定期定額；存到這個數字，退休後每月可用 ${fmt(incPlan)}`}</div>`}
    ${bar(R.pen0, R.ok ? dCur : R.draw(mPlan), R.need0)}
    <div class="h-chips">${!p.sys ? '<span>⚠ 還沒選身分，退休金先以 0 計算</span>' : ''}<span>準備度 ${pct}%</span>${R.need ? `<span>退休時要有 ${fmt(R.need / 1e4)} 萬（今日幣值）</span>` : ''}<span>每多存 1,000／月 → 退休每月多 ${fmt(R.per1k)}</span></div>
    ${(() => { const W = plCalc(p, { rS: num(p.rS) - 2, rB: num(p.rB) - 2, penAdj: 0.8 }); if (W.err) return ''; const wi = W.pen0 + W.draw(R.ok ? R.cur : R.per[12]); return `<div class="pl-worst ${wi < W.need0 ? 'bad' : ''}">保守情境（報酬少 2%、退休金打八折）：每月可用 ${fmt(wi)}，${wi >= W.need0 ? '仍然夠用' : `<b>不夠 ${fmt(W.need0 - wi)}</b>`}</div>`; })()}`);
  set('plFreq', PL_FREQ.map(([k, l]) => `<div><em>${l}</em><b>${R.ok ? '0' : fmt(R.per[k])}</b></div>`).join(''));
  const late = R.ok ? null : plCalc(p, { birth: num(p.birth) - 1, _now: { ...R.N, have: R.N.have * (1 + R.rN) } });
  set('plCur', R.ok ? `照目前的投入已足夠。想退休後每月多花 1 萬，每月要再多存約 ${fmt(10000 / R.per1k * 1000)}。` : `一年投一次要放比較多，因為錢在市場裡的時間較短。${late && !late.err ? `晚一年開始，每月要 ${fmt(late.per[12])}（多 ${fmt(late.per[12] - R.per[12])}）。` : ''}${R.cur ? '' : ' <a href="#" data-go="ledger">到收支頁設定定期定額 →</a>'}`);
  // 配置
  const tot = R.N.stock + R.N.bond + R.N.metal, nowS = tot ? R.N.stock / tot * 100 : 0, sp = R.sp;
  const m = R.ok ? R.cur : Math.max(R.per[12], R.cur);
  let adv;
  if (!tot) adv = '還沒有投資資產，從每月投入開始。';
  else if (nowS < sp - 5) { const lack = tot * sp / 100 - R.N.stock; adv = `股票比目標少 <b>${fmt(lack)}</b>。新的錢先全部買股票類${m ? `，約 ${fmt(Math.ceil(lack / m))} 個月可回到目標` : ''}；${R.N.cashInv > lack / 2 ? '或把多餘現金分 6～12 個月慢慢投入。' : ''}` }
  else if (nowS > sp + 5) { const over = R.N.stock - tot * sp / 100; adv = `股票比目標多 <b>${fmt(over)}</b>。新的錢先買債券類；大漲後可以賣一些股票補債券（再平衡）。`; }
  else adv = '配置在目標範圍內（±5%），照比例投入就好。';
  const q = typeof quadrant === 'function' ? quadrant() : null;
  set('plAlloc', `<div class="pl-al"><span>目標</span><div class="pl-stack"><i class="s" style="width:${sp}%">股 ${sp}%</i><i class="b" style="width:${100 - sp}%">${100 - sp >= 30 ? '債／現金 ' : '債 '}${100 - sp}%</i></div></div>
    <div class="pl-al"><span>現在</span><div class="pl-stack">${tot ? `<i class="s" style="width:${nowS}%">${nowS >= 12 ? `股 ${fmt(nowS, 0)}%` : ''}</i><i class="b" style="width:${R.N.bond / tot * 100}%">${R.N.bond / tot >= .12 ? `債／現金 ${fmt(R.N.bond / tot * 100, 0)}%` : ''}</i>${R.N.metal ? `<i class="m" style="width:${R.N.metal / tot * 100}%"></i>` : ''}` : '<i class="e" style="width:100%">尚無資料</i>'}</div></div>
    <div class="help" style="margin-top:6px">離退休 ${R.n} 年，${num(p.stock) ? '自訂' : '建議'}股票 ${sp}%（越接近退休越保守）。預期年報酬約 ${fmt(R.rN * 100, 1)}%。</div>
    ${m ? `<div class="pl-split">每月 ${fmt(m)} 這樣分：<b>股票類 ${fmt(m * sp / 100)}</b>（如全市場、全球股票 ETF）＋ <b>債券類 ${fmt(m * (100 - sp) / 100)}</b>（如投資等級債 ETF）</div>` : ''}
    <div class="pl-adv-t">${adv}</div>
    ${q ? `<div class="help" style="margin-top:6px">目前總經判斷：${esc(q.name)}，${esc(q.tilt)}。可在 ±5% 內微調，不要大幅偏離計畫。</div>` : ''}`);
  set('plChart', plChart(R.sim(R.ok ? 0 : R.per[12]), B, R));
  plPs();
}
function plPs() {
  const el = $('#plPs'); if (!el) return;
  const g = k => num(S.ps?.[k]), cap = g('cap'), risk = g('risk') || 1, en = g('entry'), st = g('stop');
  if (!(cap && en && st) || en <= st) { el.textContent = '填總資金、進場價、停損價（要比進場價低），算出這筆最多買幾股，停損出場也只虧事先決定的金額。'; return; }
  const sh = Math.floor(cap * risk / 100 / (en - st));
  el.innerHTML = `最多買 <b>${fmt(sh)} 股</b>（${sh >= 1000 ? `${fmt(Math.floor(sh / 1000))} 張＋` : ''}${fmt(sh % 1000)} 股零股），部位 ${fmt(sh * en)}，佔總資金 ${fmt(sh * en / cap * 100, 1)}%。停損時虧 ${fmt(sh * (en - st))}。`;
}

/* ---------- 事件 ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-plset]'); if (!b) return;
  e.preventDefault(); const y = scrollY;
  plSet(b.dataset.plset, isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v); render(); scrollTo(0, y);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset?.pl) { plSet(t.dataset.pl, t.value); plFill(); return; }
  if (t.dataset?.ps) { S.ps = S.ps || {}; S.ps[t.dataset.ps] = t.value; save(); plPs(); }
});
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d.classList?.contains('fp-row') && d.open) { S.planOpen = d.dataset.plrow; document.querySelectorAll('.fp-row[open]').forEach(x => { if (x !== d) x.open = false; }); }
  if (d.classList?.contains('fp-row') && !d.open && S.planOpen === d.dataset.plrow) S.planOpen = '';
  if (d.classList?.contains('pl-adv')) S.planAdv = d.open;
}, true);

/* ---------- 導覽：策略、退休都導到財務計畫 ---------- */
PAGES.retire = PAGES.strategy = PAGES.plan;

/* ---------- 目標金額模式：最快存到 X 萬 ---------- */
const GL_T = [1000, 3000, 5000, 10000];   // 萬
const plCurDca = () => (S.recurring || []).filter(r => r.kind === '定期定額' || r.kind === '員工認股').reduce((s, r) => s + (num(r.amount) || 0) / (r.freq === '年' ? 12 : 1), 0);
// 從 P 開始、每月投 m（每年增加 g）、年報酬 r，幾年後到 T；100 年內到不了回傳 null
function glYears(T, P, m, r, g = 0) {
  if (P >= T) return 0;
  const rp = (1 + r) ** (1 / 12) - 1; let B = P;
  for (let k = 0; k < 1200; k++) { B = B * (1 + rp) + m * (1 + g) ** Math.floor(k / 12); if (B >= T) return (k + 1) / 12; }
  return null;
}
// 想在 y 年內到 T，第一年每月要投多少
function glPmt(T, P, y, r, g = 0) {
  const n = Math.round(y * 12), rp = (1 + r) ** (1 / 12) - 1, gap = T - P * (1 + rp) ** n;
  if (gap <= 0) return 0;
  let f = 0; for (let k = 0; k < n; k++) f += (1 + g) ** Math.floor(k / 12) * (1 + rp) ** (n - k - 1);
  return gap / f;
}
function glCalc(p) {
  const T = (num(p.gTarget) || 0) * 1e4, E = plExpense(p), N = plNow((plLedgerExp()?.v || E.v) * 6);
  const cur = plCurDca(), m = p.gMonthly !== undefined && p.gMonthly !== '' ? num(p.gMonthly) || 0 : cur;
  const sp = num(p.gStock) || 80, i = num(p.infl) / 100, real = num(p.gReal) === 1;
  const rN = (sp * num(p.rS) + (100 - sp) * num(p.rB)) / 1e4, r = real ? (1 + rN) / (1 + i) - 1 : rN;
  const g = (num(p.gStep) || 0) / 100, age = num(p.birth) ? PL_YEAR - num(p.birth) : null;
  return { T, N, P: N.have, cur, m, sp, rN, r, i, real, g, age, yrs: T ? glYears(T, N.have, m, r, g) : null };
}
function glPage(p) {
  const G = glCalc(p);
  return `<div class="hero pl-hero" id="glHero"></div>
  <div class="card"><h3 class="gold-bar">目標</h3>
    <div class="pl-chips">${GL_T.map(v => plChip('gTarget', v, v >= 10000 ? v / 10000 + ' 億' : fmt(v) + ' 萬', p.gTarget)).join('')}</div>
    <div class="inline" style="margin-top:10px">${plIn('gTarget', '目標金額（萬）', '', '例如 5000')}${plIn('gMonthly', '每月能投入', `${G.cur ? `目前定期定額 ${fmt(G.cur)}，空白就用這個` : '空白＝0'}${plSalary(p).gross ? `｜月薪約 ${fmt(plSalary(p).gross)}，存 30%＝${fmt(Math.round(plSalary(p).gross * 0.3 / 100) * 100)}` : ''}`, G.cur ? String(G.cur) : '')}${plIn('gStep', '每年投入增加 %', '加薪的部分也拿去投，可填 0')}</div>
    <div class="pl-lbl">股票比例（越高報酬越高、波動也越大）</div><div class="pl-chips">${[60, 80, 100].map(v => plChip('gStock', v, '股 ' + v + '%', G.sp)).join('')}</div>
    <div class="pl-lbl">目標是哪一種金額</div><div class="pl-chips">${plChip('gReal', 0, '未來帳面上的金額', G.real ? 1 : 0)}${plChip('gReal', 1, '今天購買力的金額（扣通膨）', G.real ? 1 : 0)}</div>
    <div class="pl-lbl">想幾年內達成 <b id="glYV">${num(p.gYears) || 20}</b> 年</div><input type="range" min="3" max="40" step="1" data-pl="gYears" value="${num(p.gYears) || 20}" class="pl-range">
    <div class="pl-split" id="glYOut"></div>
    <div class="help" style="margin-top:8px">現有可投資資產 <b id="glHave"></b>（從資產頁帶入，已先扣 6 個月緊急預備金）</div>
  </div>
  <div class="card"><h3 class="gold-bar">怎麼更快</h3><div id="glFast"></div></div>
  <div class="card"><h3 class="gold-bar">對照表：要幾年</h3><div id="glTbl"></div></div>
  <div class="note">以固定年報酬估算，實際市場會大幅波動：股票比例越高，中途遇到 3～5 成跌幅的機會越大，能不能撐住不賣比報酬率更重要。報酬與通膨假設可在「退休計畫 → 進階」調整。這是試算，不構成投資建議。</div>`;
}
function glFill() {
  if (!$('#glHero')) return;
  const p = plP(), G = glCalc(p), set = (id, h) => { const e = $('#' + id); if (e) e.innerHTML = h; };
  const yv = $('#glYV'); if (yv) yv.textContent = num(p.gYears) || 20;
  const wan = v => v >= 1e8 ? fmt(v / 1e8, 2) + ' 億' : fmt(v / 1e4) + ' 萬';
  const yrsT = y => y == null ? '100 年以上' : y === 0 ? '已達成' : `${fmt(y, 1)} 年`;
  set('glHave', fmt(G.P));
  if (!G.T) { set('glHero', `<div class="h-lbl">存到目標金額</div><div class="h-num" style="font-size:24px">先選一個目標</div><div class="h-sub">例如 5,000 萬。會算出照現在的速度要幾年，以及想更快要怎麼做。</div>`); ['glYOut', 'glFast', 'glTbl'].forEach(id => set(id, '')); return; }
  const realNote = G.real ? `今天購買力的 ${wan(G.T)}` : wan(G.T);
  set('glHero', `<div class="h-lbl">每月投 ${fmt(G.m)}${G.g ? `（每年多 ${fmt(G.g * 100, 0)}%）` : ''}，存到 ${realNote}</div>
    <div class="h-num">${yrsT(G.yrs)}</div>
    <div class="h-sub">${G.yrs == null ? '照這個速度很難達成，往下看怎麼加快。' : G.yrs === 0 ? '現有資產已超過目標。' : `大約在 ${PL_YEAR + Math.ceil(G.yrs)} 年${G.age ? `、${G.age + Math.ceil(G.yrs)} 歲` : ''}達成`}</div>
    <div class="h-chips"><span>現有 ${wan(G.P)}</span><span>預期年報酬 ${fmt(G.rN * 100, 1)}%${G.real ? `（扣通膨後 ${fmt(G.r * 100, 1)}%）` : ''}</span>${!G.real && G.yrs ? `<span>到時約等於今天的 ${wan(G.T / (1 + G.i) ** G.yrs)}</span>` : ''}</div>`);
  const y = num(p.gYears) || 20, need = glPmt(G.T, G.P, y, G.r, G.g);
  set('glYOut', need ? `想 <b>${y} 年</b>內達成：每月要投 <b>${fmt(need)}</b>${G.g ? `（第一年，之後每年增加 ${fmt(G.g * 100, 0)}%）` : ''}${G.m ? `，${need > G.m ? `比現在多 ${fmt(need - G.m)}` : `現在的 ${fmt(G.m)} 已經夠`}` : ''}` : `現有資產放著不動，${y} 年內就會達成。`);
  // 各種加速方法各能提早幾年
  const base = G.yrs, d = v => base == null ? (v == null ? '仍然很難' : `變成 ${fmt(v, 1)} 年`) : v == null ? '—' : `提早 <b>${fmt(base - v, 1)} 年</b>`;
  const rows = [
    ['💰', '每月多投 1 萬', glYears(G.T, G.P, G.m + 1e4, G.r, G.g), '最有效、最確定：提高收入或砍掉固定大支出'],
    ['📈', '加薪的部分全拿去投（每年多投 3%）', glYears(G.T, G.P, G.m, G.r, G.g + 0.03), '生活水準不跟著加薪升級'],
    ['🏦', '現有資產多 100 萬（例如閒置存款拿去投）', glYears(G.T, G.P + 1e6, G.m, G.r, G.g), '先確定緊急預備金留夠'],
    ['🎢', '年報酬多 1%', glYears(G.T, G.P, G.m, G.r + 0.01, G.g), '要提高股票比例或承擔更大風險，不保證拿得到'],
  ];
  set('glFast', rows.map(([ic, t, v, h]) => `<div class="gl-row"><span class="gl-ic">${ic}</span><span class="gl-t"><b>${t}</b><em>${h}</em></span><span class="gl-v">${d(v)}</span></div>`).join(''));
  // 對照表
  const ms = [...new Set([1e4, 2e4, 4e4, 6e4, 1e5, Math.round(G.m)].filter(x => x > 0))].sort((a, b) => a - b), rs = [0.04, 0.06, 0.08, 0.1];
  const near = rs.reduce((a, b) => Math.abs(b - G.rN) < Math.abs(a - G.rN) ? b : a);
  set('glTbl', `<div class="tbl-wrap"><table class="gl-tbl"><thead><tr><th>每月投入</th>${rs.map(r => `<th class="num">年報酬 ${r * 100}%</th>`).join('')}</tr></thead><tbody>
    ${ms.map(m => `<tr class="${m === Math.round(G.m) ? 'gl-me' : ''}"><td>${fmt(m)}${m === Math.round(G.m) ? '（你）' : ''}</td>${rs.map(r => { const rr = G.real ? (1 + r) / (1 + G.i) - 1 : r, v = glYears(G.T, G.P, m, rr, G.g); return `<td class="num ${r === near && m === Math.round(G.m) ? 'gl-hit' : ''}">${v == null ? '>100' : fmt(v, 1)}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div><div class="help">單位：年。以你現有的 ${wan(G.P)} 起算${G.real ? '，扣除通膨' : ''}。全球股市長期大約 6～8%，10% 很難長期維持。</div>`);
}
document.addEventListener('input', e => { if (e.target.dataset?.pl) glFill(); });

/* 模式切換：退休計畫｜存到目標金額 */
const _planRet = PAGES.plan;
PAGES.plan = () => {
  const p = plP(), mode = p.mode || 'retire';
  const tabs = `<div class="pl-mode">${plChip('mode', 'retire', '🏖️ 退休計畫', mode)}${plChip('mode', 'goal', '🎯 存到目標金額', mode)}</div>`;
  if (mode === 'goal') { setTimeout(glFill, 0); return `<h2>財務計畫</h2>${tabs}${glPage(p)}`; }
  return _planRet().replace('<h2>財務計畫</h2>', `<h2>財務計畫</h2>${tabs}`);
};
PAGES.retire = PAGES.strategy = PAGES.plan;
if (window.__startPage === 'plan') render();
