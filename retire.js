/* 退休目標試算：每月／每季／每半年／每年要投入多少 */
'use strict';

const RT_DEF = { age: 35, retAge: 60, life: 90, exp: '', pension: 0, lump: 0, infl: 2, r1: 6, r2: 4, step: 0, src: 'all', have: '' };
const RT_FREQ = [[12, '每月'], [4, '每季'], [2, '每半年'], [1, '每年']];
const rtP = () => { S.retire = Object.assign({}, RT_DEF, S.retire || {}); return S.retire; };

/* 目前資產與投入速度（從資產頁、固定收支自動帶入） */
function rtHave(p) {
  if (p.src === 'manual') return num(p.have) || 0;
  const W = wealth();
  return p.src === 'inv' ? W.invest - W.cash : W.invest;
}
function rtCurMonthly() {
  return (S.recurring || []).filter(r => r.kind === '定期定額' || r.kind === '員工認股')
    .reduce((s, r) => s + (num(r.amount) || 0) / (r.freq === '年' ? 12 : 1), 0);
}

/* 核心計算（名目金額；生活費、月退以今日幣值輸入，按通膨放大） */
function rtCalc(p, over = {}) {
  const q = Object.assign({}, p, over);
  const age = num(q.age), ra = num(q.retAge), life = num(q.life);
  const i = (num(q.infl) || 0) / 100, r1 = (num(q.r1) || 0) / 100, r2 = (num(q.r2) || 0) / 100, g = (num(q.step) || 0) / 100;
  const n = ra - age, T = life - ra;
  if (!(n > 0) || !(T > 0)) return { err: !(n > 0) ? '退休年齡要大於目前年齡。' : '預期壽命要大於退休年齡。' };
  const exp = num(q.exp) || 0, pension = num(q.pension) || 0, lump = num(q.lump) || 0;
  const infF = (1 + i) ** n;
  const gapM = Math.max(0, exp - pension);               // 每月缺口（今日幣值）
  const W0 = gapM * 12 * infF;                           // 退休第一年要從資產提領的金額（名目）
  const need = Math.abs(r2 - i) < 1e-9 ? W0 * T : W0 * (1 + r2) * (1 - ((1 + i) / (1 + r2)) ** T) / (r2 - i); // 年初提領、逐年隨通膨增加
  const have = q._have != null ? q._have : rtHave(q);
  const fvHave = have * (1 + r1) ** n, fvLump = lump * infF;
  const short = need - fvHave - fvLump;
  // 每期投入 c、每年調高 g、期末投入，累積到退休的倍數
  const factor = k => { const rp = (1 + r1) ** (1 / k) - 1; let f = 0; for (let y = 0; y < n; y++) for (let j = 1; j <= k; j++) f += (1 + g) ** y * (1 + rp) ** (k * n - (y * k + j)); return f; };
  const per = {}; RT_FREQ.forEach(([k]) => { per[k] = short > 0 ? short / factor(k) : 0; });
  // 逐年模擬：給定「第一年每月投入」，回傳每年年底餘額與用完的年齡
  const sim = m0 => {
    const rp = (1 + r1) ** (1 / 12) - 1, pts = [{ a: age, v: have }]; let B = have, out = null;
    for (let y = 0; y < n; y++) { const c = m0 * (1 + g) ** y; for (let j = 0; j < 12; j++) B = B * (1 + rp) + c; pts.push({ a: age + y + 1, v: B }); }
    B += fvLump; let w = W0;
    for (let y = 0; y < T + 15; y++) {
      if (B < w && out == null) out = ra + y + (B > 0 ? B / w : 0);
      B = Math.max(0, B - w) * (1 + r2); w *= 1 + i;
      if (y < T) pts.push({ a: ra + y + 1, v: B });
    }
    return { pts, out, atRet: pts[n].v + fvLump };
  };
  return { n, T, gapM, W0, need, needToday: need / infF, have, fvHave, fvLump, short, per, factor, sim, infF, ra, age, life };
}

/* 折線圖：資產隨年齡變化 */
function rtChart(a, b, R) {
  const W = 400, H = 220, L = 46, Rm = 18, Tp = 14, Bm = 24;
  const all = a.pts.concat(b ? b.pts : []), maxV = Math.max(...all.map(p => p.v), R.need) * 1.08 || 1;
  const x = v => L + (v - R.age) / (R.life - R.age) * (W - L - Rm), y = v => Tp + (1 - v / maxV) * (H - Tp - Bm);
  const path = pts => pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.a).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const step = 10 ** Math.floor(Math.log10(maxV / 4)), unit = [1, 2, 5, 10].map(s => s * step).find(s => maxV / s <= 5);
  const ticks = []; for (let v = 0; v <= maxV; v += unit) ticks.push(v);
  const ages = []; for (let v = Math.ceil(R.age / 10) * 10; v <= R.life; v += 10) ages.push(v);
  const wan = v => v >= 1e8 ? fmt(v / 1e8, v >= 1e9 ? 0 : 1) + '億' : fmt(v / 1e4) + '萬';
  return `<svg class="rt-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="資產隨年齡變化">
    ${ticks.map(v => `<line x1="${L}" x2="${W - Rm}" y1="${y(v)}" y2="${y(v)}" class="rt-grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="rt-ax">${wan(v)}</text>`).join('')}
    ${ages.map(v => `<text x="${x(v)}" y="${H - 6}" text-anchor="middle" class="rt-ax">${v} 歲</text>`).join('')}
    <line x1="${x(R.ra)}" x2="${x(R.ra)}" y1="${Tp}" y2="${H - Bm}" class="rt-ret"/><text x="${x(R.ra) + 4}" y="${Tp + 10}" class="rt-ax">退休</text>
    <line x1="${L}" x2="${x(R.ra)}" y1="${y(R.need)}" y2="${y(R.need)}" class="rt-goal"/>
    ${b ? `<path d="${path(b.pts)}" class="rt-l2"/>` : ''}<path d="${path(a.pts)}" class="rt-l1"/>
  </svg>
  <div class="rt-leg"><span><i class="k1"></i>照建議金額投入</span>${b ? '<span><i class="k2"></i>維持目前投入</span>' : ''}<span><i class="k3"></i>退休時要有的目標</span></div>`;
}

function rtOut() {
  const p = rtP(), R = rtCalc(p), el = $('#rtOut'); if (!el) return;
  if (R.err) { el.innerHTML = `<div class="card"><div class="empty">${R.err}</div></div>`; return; }
  if (!num(p.exp)) { el.innerHTML = `<div class="card"><div class="empty">先填「退休後每月生活費」。</div></div>`; return; }
  const cur = rtCurMonthly(), A = R.sim(R.per[12]), B = cur || R.short > 0 ? R.sim(cur) : null;
  const ok = R.short <= 0;
  const curPct = R.per[12] ? Math.min(999, cur / R.per[12] * 100) : 100;
  const freqTbl = RT_FREQ.map(([k, l]) => `<tr><td>${l}</td><td class="num"><b>${fmt(R.per[k])}</b></td><td class="num">${fmt(R.per[k] * k)}</td>${num(p.step) ? `<td class="num">${fmt(R.per[k] * (1 + num(p.step) / 100) ** (R.n - 1))}</td>` : ''}</tr>`).join('');
  // 敏感度：報酬率 × 退休年齡
  const rs = [num(p.r1) - 2, num(p.r1), num(p.r1) + 2], as = [num(p.retAge) - 5, num(p.retAge), num(p.retAge) + 5].filter(a => a > num(p.age) && a < num(p.life));
  const sens = `<div class="tbl-wrap"><table class="rt-sens"><thead><tr><th>退休前年報酬</th>${as.map(a => `<th class="num">${a} 歲退休</th>`).join('')}</tr></thead><tbody>
    ${rs.map(r => `<tr><td>${fmt(r, 1)}%</td>${as.map(a => { const x = rtCalc(p, { r1: r, retAge: a, _have: R.have }); return `<td class="num ${r === num(p.r1) && a === num(p.retAge) ? 'rt-me' : ''}">${x.err ? '—' : x.short <= 0 ? '已足夠' : fmt(x.per[12])}</td>`; }).join('')}</tr>`).join('')}
  </tbody></table></div>`;
  const late = rtCalc(p, { age: num(p.age) + 1, _have: R.have * (1 + num(p.r1) / 100) });
  el.innerHTML = `
  <div class="hero rt-hero">
    <div class="h-lbl">${ok ? '照目前資產，不再投入也夠用' : `要在 ${p.retAge} 歲退休、用到 ${p.life} 歲，每月需投入`}</div>
    <div class="h-num">${ok ? '已達標 🎉' : fmt(R.per[12]) + ' 元'}</div>
    <div class="h-sub">${ok ? `目前資產 ${fmt(R.have)} 以年報酬 ${p.r1}% 成長到退休，約 ${fmt(R.fvHave + R.fvLump)}，超過目標 ${fmt(-R.short)}。` : `或每年投入 ${fmt(R.per[1])} 元${num(p.step) ? `（之後每年調高 ${p.step}%）` : ''}`}</div>
    <div class="h-chips"><span>退休時要準備 ${fmt(R.need)}</span><span>≈ 今天的 ${fmt(R.needToday)}</span><span>還有 ${R.n} 年</span>${cur ? `<span>目前每月定期投入 ${fmt(cur)}（${ok ? '—' : fmt(curPct, 0) + '%'}）</span>` : ''}</div>
  </div>
  <div class="card"><h3 class="gold-bar">每一期要投入多少</h3>
    <div class="tbl-wrap"><table><thead><tr><th>頻率</th><th class="num">每期金額</th><th class="num">一年合計</th>${num(p.step) ? `<th class="num">最後一年每期</th>` : ''}</tr></thead><tbody>${freqTbl}</tbody></table></div>
    <div class="help">頻率越低（例如一年投一次），每期要放更多，因為錢在市場裡的時間比較短。${num(p.step) ? `第一年用表上金額，之後每年多投 ${p.step}%。` : ''}</div>
    ${!ok ? `<div class="note">晚一年才開始：每月要投入 <b>${late.err ? '—' : fmt(late.per[12])}</b> 元（多 ${late.err ? '—' : fmt(late.per[12] - R.per[12])}）。</div>` : ''}
  </div>
  <div class="card"><h3 class="gold-bar">資產走勢</h3>
    ${rtChart(A, B && cur !== R.per[12] ? B : null, R)}
    ${B ? `<div class="help" style="margin-top:6px">${B.out == null ? `維持目前每月 ${fmt(cur)} 的投入，資產可以撐到 ${p.life} 歲以後。` : `維持目前每月 ${fmt(cur)} 的投入，資產約在 <b class="down">${fmt(B.out, 0)} 歲</b>用完，比預期壽命早 ${fmt(num(p.life) - B.out, 0)} 年。`}</div>` : ''}
  </div>
  <div class="card"><h3 class="gold-bar">怎麼算出來的</h3>
    <dl class="kv rt-kv">
      <dt>每月缺口（生活費 ${fmt(num(p.exp))} − 固定收入 ${fmt(num(p.pension) || 0)}，今日幣值）</dt><dd>${fmt(R.gapM)}</dd>
      <dt>${R.n} 年後通膨放大 ${fmt(R.infF, 2)} 倍，第一年要提領</dt><dd>${fmt(R.W0)}</dd>
      <dt>提領 ${R.T} 年（每年隨通膨增加、餘額以 ${p.r2}% 成長）需要</dt><dd>${fmt(R.need)}</dd>
      <dt>現有資產 ${fmt(R.have)} 成長到退休</dt><dd>− ${fmt(R.fvHave)}</dd>
      ${R.fvLump ? `<dt>退休時一次入帳</dt><dd>− ${fmt(R.fvLump)}</dd>` : ''}
      <dt>還差（要靠定期投入補足）</dt><dd class="${ok ? 'up' : 'down'}">${ok ? '0' : fmt(R.short)}</dd>
    </dl>
  </div>
  <div class="card"><h3 class="gold-bar">換個假設看看（每月投入）</h3>${sens}
    <div class="help">報酬率每差 2%，或早／晚 5 年退休，每月要投入的金額差很多。建議用保守的報酬率規劃。</div></div>
  <div class="note">以固定報酬率估算，實際市場會波動，尤其退休前後遇到大跌影響最大。這是規劃參考，不構成投資建議；月退俸請以銓敘部或退撫基金的試算為準。</div>`;
}

PAGES.retire = () => {
  const p = rtP(), W = wealth(), avg = avgMonthlyExpense();
  if (!num(p.exp) && avg) p.exp = Math.round(avg / 1000) * 1000;
  const f = (k, l, h, extra = '') => `<label class="f"><span>${l}</span><input type="number" inputmode="decimal" data-rt="${k}" value="${esc(p[k] ?? '')}" ${extra}>${h ? `<em class="help">${h}</em>` : ''}</label>`;
  setTimeout(rtOut, 0);
  return `<h2>退休目標試算</h2>
  <p class="lead">算出每月、每季或每年要投入多少，才能在想退休的年紀存到夠用一輩子的錢。現有資產與定期定額會從「資產」「收支」自動帶入。</p>
  <div class="card"><h3 class="gold-bar">我的條件</h3>
    <div class="inline">
      ${f('age', '目前年齡')}${f('retAge', '想幾歲退休')}${f('life', '準備用到幾歲', '保守抓 90～95 歲')}
    </div>
    <div class="inline" style="margin-top:10px">
      ${f('exp', '退休後每月生活費', avg ? `用今天的物價填。近 3 個月平均支出 ${fmt(avg)}` : '用今天的物價填')}
      ${f('pension', '退休後每月固定收入', '月退俸、勞保年金等（今日幣值）')}
      ${f('lump', '退休時一次入帳（選填）', '一次退休金、到期儲蓄險等（今日幣值）')}
    </div>
    <div class="inline" style="margin-top:10px">
      <label class="f"><span>現有資產怎麼算</span><select data-rt="src">
        ${[['all', `全部可投資資產（${fmt(W.invest)}）`], ['inv', `不含現金存款（${fmt(W.invest - W.cash)}）`], ['manual', '自己填']].map(([v, t]) => `<option value="${v}" ${p.src === v ? 'selected' : ''}>${t}</option>`).join('')}
      </select><em class="help">存款若是緊急預備金，選「不含現金存款」較準</em></label>
      <label class="f" id="rtHaveF" ${p.src === 'manual' ? '' : 'hidden'}><span>退休用的現有資產</span><input type="number" inputmode="decimal" data-rt="have" value="${esc(p.have)}"></label>
    </div>
    <details class="rt-adv" ${S.retireAdv ? 'open' : ''}><summary>報酬率與通膨假設</summary>
      <div class="inline" style="margin-top:8px">
        ${f('r1', '退休前年報酬 %', '股債混合長期約 5～7%')}${f('r2', '退休後年報酬 %', '退休後偏保守，約 3～4%')}
        ${f('infl', '通膨 %', '台灣長期約 1.5～2%')}${f('step', '每年調高投入 %', '隨加薪多投一點，可填 0')}
      </div>
    </details>
  </div>
  <div id="rtOut"></div>`;
};

document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset?.rt) return;
  rtP()[t.dataset.rt] = t.value; save();
  if (t.dataset.rt === 'src') { const h = $('#rtHaveF'); if (h) h.hidden = t.value !== 'manual'; }
  rtOut();
});
document.addEventListener('toggle', e => { if (e.target.classList?.contains('rt-adv')) { S.retireAdv = e.target.open; save(); } }, true);

/* 放進「更多 → 規劃」與分頁群組 */
if (typeof MORE_PAGES !== 'undefined') MORE_PAGES.push('retire');
if (typeof GROUPS !== 'undefined') GROUPS.more.splice(2, 0, ['retire', '退休']);
const _moreRt = PAGES.more;
PAGES.more = () => {
  const p = S.retire, R = p && num(p.exp) ? rtCalc(rtP()) : null;
  const sub = R && !R.err ? (R.short <= 0 ? `${p.retAge} 歲退休：目前資產已足夠` : `${p.retAge} 歲退休：每月需投入 ${fmt(R.per[12])}・目前 ${fmt(rtCurMonthly())}`) : '每月／每季／每年該投入多少才夠退休';
  const badge = R && !R.err && R.short > 0 && rtCurMonthly() < R.per[12] ? '<span class="pill red">投入不足</span>' : R && !R.err ? '<span class="pill green">進度 OK</span>' : '';
  const row = `<button class="mrow" data-go="retire"><span class="m-ic">🏖️</span><span class="m-t"><b>退休目標試算</b><em>${esc(sub)}</em></span>${badge}<span class="m-go">›</span></button>`;
  return _moreRt().replace('<div class="mgroup"><div class="mg-h">規劃</div>', `<div class="mgroup"><div class="mg-h">規劃</div>${row}`);
};

/* 啟動時若直接開「更多」或「退休」頁，重繪以套用本模組 */
if (['retire', 'more'].includes(window.__startPage)) go(window.__startPage);
