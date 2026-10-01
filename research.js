/* 研究區改版：研究流程導覽、研究卡新版面、更多頁 */
'use strict';

/* ---------- 研究流程導覽（取代研究分頁的平鋪按鈕） ---------- */
const FLOWS = [
  { k: '基本面', ic: '🏭', steps: [['industry', '產業地位'], ['cards', '個股研究'], ['etf', 'ETF 健檢']] },
  { k: '技術面', ic: '📈', steps: [['learn', '技術教學'], ['claims', '待驗主張・回測']] },
];
const MORE_PAGES = ['strategy', 'trades', 'review', 'settings'];
const _subNavW = window.subNav;
window.subNav = p => {
  if (FLOWS.some(f => f.steps.some(s => s[0] === p))) {
    return `<div class="flow">${FLOWS.map(f => {
      const on = f.steps.some(s => s[0] === p);
      return `<div class="flow-row ${on ? 'on' : ''}"><span class="flow-k">${f.ic} ${f.k}</span><div class="flow-steps">${f.steps.map(([k, l], i) => `${i ? '<span class="flow-arr">›</span>' : ''}<button data-go="${k}" class="${k === p ? 'cur' : ''}"><b>${i + 1}</b>${l}</button>`).join('')}</div></div>`;
    }).join('')}</div>`;
  }
  if (MORE_PAGES.includes(p)) return `<div class="backbar"><button data-go="more">‹ 更多</button></div>`;
  if (p === 'more') return '';
  return _subNavW(p);
};

/* ---------- 更多：有內容的清單，不重複導覽 ---------- */
PAGES.more = () => {
  const hs = holdings(), live = hs.filter(h => h.shares > 0);
  const lastT = [...S.trades].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  const pendRev = S.reviews.filter(r => !r.result).length;
  const tot = S.alloc.reduce((s, a) => s + (num(a.value) || 0), 0);
  const worst = tot ? S.alloc.map(a => ({ n: a.name, d: (num(a.value) || 0) / tot * 100 - (num(a.target) || 0) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0] : null;
  const ef = S.emergency || {}, efM = num(ef.monthly) ? (num(ef.have) || 0) / num(ef.monthly) : null;
  const bk = S.lastExport ? Math.floor((Date.now() - S.lastExport) / 864e5) : null;
  const size = (() => { try { return (localStorage.getItem(STORE_KEY) || '').length; } catch (e) { return 0; } })();
  const row = (p, ic, t, s, badge) => `<button class="mrow" data-go="${p}"><span class="m-ic">${ic}</span><span class="m-t"><b>${t}</b><em>${s}</em></span>${badge ? `<span class="pill ${badge[1]}">${badge[0]}</span>` : ''}<span class="m-go">›</span></button>`;
  return `<h2>更多</h2>
  <div class="mgroup"><div class="mg-h">投資紀錄</div>
    ${row('trades', '🧾', '交易紀錄', S.trades.length ? `${S.trades.length} 筆・持有 ${live.length} 檔${lastT ? `・最近 ${esc(lastT.date)} ${esc(lastT.side)} ${esc(lastT.code)}` : ''}` : '每筆買賣與當時的分析報告')}
    ${row('review', '🔁', '覆盤', S.reviews.length ? `${S.reviews.length} 筆紀錄` : '檢討每筆決策做對、做錯什麼', pendRev ? [`${pendRev} 筆待填結果`, 'gold'] : null)}
  </div>
  <div class="mgroup"><div class="mg-h">規劃</div>
    ${row('strategy', '🎯', '策略與資產配置', [worst ? `偏離最大：${esc(worst.n)} ${worst.d >= 0 ? '+' : ''}${fmt(worst.d, 1)}%` : '設定目標配置', efM != null ? `緊急預備金 ${fmt(efM, 1)} 個月` : '', '部位計算器'].filter(Boolean).join('・'), worst && Math.abs(worst.d) > 5 ? ['該再平衡', 'red'] : null)}
  </div>
  <div class="mgroup"><div class="mg-h">資料</div>
    ${row('settings', '💾', '備份與設定', `${bk == null ? '還沒備份過' : bk === 0 ? '今天已備份' : `上次備份 ${bk} 天前`}・資料約 ${fmt(size / 1024, 0)} KB・只存在這台裝置`, bk == null || bk > 30 ? ['建議備份', 'red'] : null)}
  </div>
  <div class="help" style="text-align:center;margin-top:14px">研究工具在下方「研究」，總經與監控在「市場」。</div>`;
};
document.addEventListener('click', e => { if (e.target.closest('#exportBtn')) { S.lastExport = Date.now(); save(); } }, true);

/* ---------- 產業頁：列出這條鏈上研究過的公司（產業 → 個股） ---------- */
const _indPageR = PAGES.industry;
PAGES.industry = () => {
  const cid = S.chainTab || 'ai', ch = CHAINS.find(x => x.id === cid) || CHAINS[0];
  const mine = S.cards.map(c => ({ c, f: findLayer(c.layer) })).filter(x => x.f && x.f.ch.id === ch.id).sort((a, b) => a.f.i - b.f.i);
  const box = `<div class="card"><div class="card-head"><h3 class="gold-bar">這條鏈上我研究過的公司</h3><button class="btn-small" id="newCard">＋ 研究一檔</button></div>
    ${mine.length ? `<div class="ind-cards">${mine.map(({ c, f }) => `<button class="ind-c" data-card="${c.id}" data-go-card="1"><span class="ic-n">${f.i + 1}</span><span><b>${esc(c.code)} ${esc(c.name)}</b><em>${esc(f.l.n)}</em></span>${lightsHTML(c)}</button>`).join('')}</div>`
      : '<div class="empty">還沒有。看完每一層的角色後，按「研究一檔」建立研究卡，網站會自動判斷所在層。</div>'}</div>`;
  const html = _indPageR(), at = html.indexOf('<div class="card">');
  return at < 0 ? html + box : html.slice(0, at) + box + html.slice(at);
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go-card]'); if (!t) return;
  e.stopPropagation(); openCardId = t.dataset.card; go('cards');
}, true);

/* ---------- 研究卡清單 ---------- */
function sparkPath(sp, W, H) {
  if (!sp || sp.length < 2) return '';
  const cl = sp.map(x => x[1]), lo = Math.min(...cl), hi = Math.max(...cl);
  return cl.map((v, i) => `${i ? 'L' : 'M'}${(i * W / (cl.length - 1)).toFixed(1)},${(H - 2 - (v - lo) * (H - 4) / (hi - lo || 1)).toFixed(1)}`).join('');
}
const chg20 = c => { const sp = c.spark; if (!sp || sp.length < 21) return null; const a = sp[sp.length - 21][1], b = sp[sp.length - 1][1]; return (b / a - 1) * 100; };
PAGES.cards = () => {
  if (openCardId) { const c = S.cards.find(x => x.id === openCardId); if (c) return cardEditor(c); openCardId = null; }
  const list = [...S.cards].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `<h2>個股研究卡</h2>
  <p class="lead">先在「產業地位」確認公司站在哪一層，再建卡研究財報、估值、技術與籌碼，最後寫下結論與「證明我錯」的條件。</p>
  <div class="rc-grid">
    <button class="rc-new" id="newCard"><span>＋</span><b>研究一檔新標的</b><em>輸入代號，自動帶入財報、股價、籌碼</em></button>
    ${list.map(c => {
      const vs = valSummary(c), g = c.lights.filter(l => l.c === '綠').length, r = c.lights.filter(l => l.c === '紅').length, ch = chg20(c), f = findLayer(c.layer);
      return `<button class="rc-item" data-card="${c.id}">
        <div class="rc-i-top"><span class="rc-code">${esc(c.code)}</span>${c.example ? '<span class="pill gold">範例</span>' : ''}<span class="spacer"></span>${lightsHTML(c)}</div>
        <div class="rc-i-name">${esc(c.name || '（未命名）')}</div>
        <div class="rc-i-layer">${esc(f ? `${f.ch.name}・${f.i + 1} ${f.l.n}` : c.layer || '未定位')}</div>
        ${c.spark ? `<svg class="rc-i-spark" viewBox="0 0 120 30" preserveAspectRatio="none"><path d="${sparkPath(c.spark, 120, 30)}"/></svg>` : ''}
        <div class="rc-i-nums"><span><em>股價</em><b>${esc(c.price || '—')}</b></span><span><em>20 日</em><b class="${ch >= 0 ? 'up' : 'down'}">${ch == null ? '—' : pct(ch)}</b></span><span><em>估值空間</em><b class="${vs.upside >= 0 ? 'up' : 'down'}">${vs.upside == null ? '—' : pct(vs.upside)}</b></span></div>
        ${c.verdict ? `<div class="rc-i-v">${esc(c.verdict.replace(/^【自動草稿】/, ''))}</div>` : ''}
        <div class="rc-i-foot">綠 ${g}・紅 ${r}・${esc(c.date || '')}</div>
      </button>`;
    }).join('')}
  </div>`;
};

/* ---------- 研究卡內頁 ---------- */
const LIGHT_C = ['綠', '黃', '紅'];
const DIM_IC = ['🏭', '📊', '🎤', '💰', '📈', '🏦'];
const SEC_LESSON = [['ma', '均線'], ['trend', '支撐壓力'], ['rsi', 'RSI'], ['macd', 'MACD'], ['bb', '布林通道'], ['volume', '成交量'], ['pattern', '型態']];
function secHead(n, id, title, done, total, extra = '') {
  return `<summary class="rc-sh"><span class="rc-n">${n}</span><span class="rc-st">${title}</span>${total ? `<span class="rc-prog ${done >= total ? 'full' : ''}">${done}/${total}</span>` : ''}${extra}<span class="rc-chev">⌄</span></summary>`;
}
const filled = arr => arr.filter(v => v != null && String(v).trim() && !/^示範|^請查詢|^待補/.test(String(v))).length;
function valGauge(c, vs) {
  const p = num(c.price); if (vs.avg == null || !p) return '';
  const lo = Math.min(vs.min, p) * 0.92, hi = Math.max(vs.max, p) * 1.08, X = v => ((v - lo) / (hi - lo) * 100).toFixed(1);
  return `<div class="gauge"><div class="g-track"><div class="g-band" style="left:${X(vs.min)}%;width:${X(vs.max) - X(vs.min)}%"></div><div class="g-avg" style="left:${X(vs.avg)}%"></div><div class="g-px" style="left:${X(p)}%"><span>現價 ${fmt(p, p < 100 ? 2 : 0)}</span></div></div>
    <div class="g-lbl"><span>合理價 ${fmt(vs.min, 0)}～${fmt(vs.max, 0)}，均值 ${fmt(vs.avg, 0)}</span><b class="${vs.upside >= 0 ? 'up' : 'down'}">${vs.upside >= 0 ? '低估' : '高估'} ${pct(Math.abs(vs.upside)).replace('+', '')}</b></div></div>`;
}
cardEditor = function (c) {
  const vs = valSummary(c);
  const inp = (path, v, attrs = '') => `<input type="text" data-card-f="${path}" value="${esc(v)}" ${attrs}>`;
  const ta = (path, v, ph = '') => `<textarea class="cell-ta" rows="2" data-card-f="${path}" placeholder="${esc(ph)}">${esc(v)}</textarea>`;
  const tip = t => t ? `<button type="button" class="tipb" data-tip>?</button><div class="tipt">${esc(t)}</div>` : '';
  const f = findLayer(c.layer), ch = chg20(c);
  const g = c.lights.filter(l => l.c === '綠').length, y = c.lights.filter(l => l.c === '黃').length, r = c.lights.filter(l => l.c === '紅').length;
  const pos = S.positions.find(p => p.company && (p.company.includes(c.code) || (c.name && p.company.includes(c.name))));
  const finDone = filled(c.fin.map(x => x.cur)), guideDone = filled([c.guidance, c.quotes, c.qa, c.assumptions]), valDone = filled(c.val.map(x => x.fair));
  const techDone = filled(c.tech.map(x => x.read)), chipDone = filled(c.chip.map(x => x.d5)), endDone = filled([c.verdict, c.thesis, c.wrongIf, c.action]);
  return `
  <div class="rc-bar"><button class="btn-small ghost" id="backCards">‹ 研究卡</button><span class="spacer"></span>
    <button class="btn-small" id="autoFill">⚡ 自動帶入</button>
    <button class="icon-sq" data-ai="card" title="複製 AI 研究提示">🤖</button>
    <button class="icon-sq" id="cardMd" title="匯出 Markdown">⤓</button>
    <button class="icon-sq danger" id="delCard" title="刪除">🗑</button></div>

  <section class="rc-hero">
    <div class="rh-top">
      <div class="rh-id"><div class="rh-code">${esc(c.code || '代號')}<span>${esc(c.market)}</span>${c.example ? '<span>範例</span>' : ''}</div>
        <div class="rh-name">${esc(c.name || '新研究卡')}</div>
        <button class="rh-layer" data-golayer="${esc(c.layer || '')}">${f ? `${esc(f.ch.name)} › 第 ${f.i + 1} 層 ${esc(f.l.n)}${f.l.bottleneck ? ' ・瓶頸' : ''}` : '尚未定位產業 ›'}</button></div>
      <div class="rh-px"><div class="rh-price">${esc(c.price || '—')}</div>${ch != null ? `<div class="rh-chg ${ch >= 0 ? 'up' : 'down'}">近 20 日 ${pct(ch)}</div>` : ''}
        ${c.spark ? `<svg class="rh-spark" viewBox="0 0 140 40" preserveAspectRatio="none"><path d="${sparkPath(c.spark.slice(-120), 140, 40)}"/></svg>` : ''}</div>
    </div>
    <textarea class="rh-verdict cell-ta" rows="1" data-card-f="verdict" placeholder="一句話結論（例如：AI 先進製程唯一供應商，估值合理偏低）">${esc(c.verdict)}</textarea>
    <div class="rh-score">${c.lights.map((l, i) => `<a class="rh-dim ${esc(l.c)}" href="#sec-lights"><i></i>${DIMENSIONS[i].replace('／資金', '')}</a>`).join('')}</div>
    <div class="rh-sum"><span class="s-g">綠 ${g}</span><span class="s-y">黃 ${y}</span><span class="s-r">紅 ${r}</span><span class="rh-date">研究日 ${esc(c.date)}</span></div>
    ${valGauge(c, vs)}
  </section>
  ${c.example ? '<div class="note">範例卡：財報數字附來源日期；標「示範」的是填法示意，不是事實或投資建議。</div>' : ''}
  ${c.auto ? `<details class="rc-auto"><summary>📋 自動資料摘要・${esc(new Date(c.auto.at).toLocaleDateString('zh-TW'))}</summary><div class="r-body" style="white-space:pre-wrap;color:var(--text)">${esc(c.auto.summary)}</div>${c.auto.errors?.length ? `<div class="help down">部分資料抓取失敗：${esc(c.auto.errors.join('；'))}</div>` : ''}</details>` : ''}

  <nav class="rc-toc">${[['lights', '燈號'], ['ind', '產業'], ['fin', '財報'], ['guide', '法說'], ['val', '估值'], ['tech', '技術'], ['chip', '籌碼'], ['end', '結論']].map(([k, l]) => `<a href="#sec-${k}">${l}</a>`).join('')}</nav>

  <details class="rc-sec" id="sec-lights" open>${secHead('◎', 'lights', '六面向燈號', filled(c.lights.map(l => l.c)), 6, '<button class="btn-small ghost rc-x" id="relight">依資料重算</button>')}
    <div class="dim-grid">${DIMENSIONS.map((d, i) => `<div class="dim ${esc(c.lights[i].c)}"><div class="dim-h"><span>${DIM_IC[i]} ${d}</span>${tip(HELP.dim[i])}</div>
      <div class="dim-dots">${LIGHT_C.map(k => `<button type="button" class="dd ${k} ${c.lights[i].c === k ? 'on' : ''}" data-light="${i}" data-c="${k}" aria-label="${k}燈"></button>`).join('')}</div>
      ${ta(`lights.${i}.note`, c.lights[i].note, '一句話判讀')}</div>`).join('')}</div>
  </details>

  <details class="rc-sec" id="sec-ind" open>${secHead('1', 'ind', '產業地位', c.layer ? 1 : 0, 1)}
    <div class="ind-box"><label class="f"><span>所在供應鏈與層級</span>${layerSelectHTML(c.layer)}</label>
      ${f ? `<div class="ind-info"><b>${esc(f.l.n)}</b>：${esc(f.l.d)}${f.l.b ? `<br><span class="bn">${esc(f.l.b)}</span>` : ''}${c.layerGuess ? '<br><span class="help">（自動判斷，請確認）</span>' : ''}</div>` : ''}
      ${pos ? `<div class="ind-info">卡位紀錄：收入←${esc(pos.revenueFrom || '—')}；產能受限：${esc(pos.capacityBy || '—')}；領先指標：${esc(pos.leading || '—')}</div>` : ''}
      <button class="btn-small ghost" data-golayer="${esc(c.layer || '')}">到產業地位看整條供應鏈 ›</button></div>
    ${srcLinks(c, 'industry')}
  </details>

  <details class="rc-sec" id="sec-fin" open>${secHead('2', 'fin', '財報體質', finDone, 8)}
    <div class="met-grid">${FIN_ROWS.map(([nm, kind], i) => { const x = c.fin[i]; return `<div class="met"><div class="met-h"><span>${nm}${kind === 'pct' ? ' %' : ''}</span>${tip(HELP.fin[i])}</div>
      ${inp(`fin.${i}.cur`, x.cur, 'class="met-v" inputmode="decimal" placeholder="本期"')}
      <div class="met-p"><span>去年</span>${inp(`fin.${i}.prev`, x.prev, 'inputmode="decimal" placeholder="—"')}<b data-yoy="${i}">${yoy(x, kind)}</b></div>
      ${inp(`fin.${i}.src`, x.src, 'class="met-s" placeholder="來源與日期"')}</div>`; }).join('')}</div>
    <label class="f"><span>頭條數字 vs 真實體質的落差</span>${ta('finGap', c.finGap, '例如：獲利創高但營業現金流轉負')}</label>
  </details>

  <details class="rc-sec" id="sec-guide" open>${secHead('3', 'guide', '法說會與管理層指引', guideDone, 4)}
    ${srcLinks(c, 'guide')}
    <div class="two">${[['guidance', '管理層指引', '營收、毛利率區間；上修或下修多少'], ['quotes', '關鍵原話', '標日期'], ['qa', '分析師問答重點', ''], ['assumptions', '轉成估值假設', '例如：明年營收成長 20%']].map(([k, l, ph]) => `<label class="f"><span>${l}</span>${ta(k, c[k], ph)}</label>`).join('')}</div>
  </details>

  <details class="rc-sec" id="sec-val" open>${secHead('4', 'val', '估值（三法交叉）', valDone, 3)}
    <div class="val-grid">${VAL_ROWS.map((nm, i) => `<div class="valm"><div class="met-h"><span>${['相對估值', 'DCF 現金流折現', '分析師共識'][i]}</span>${tip(HELP.val[i])}</div>
      <div class="valm-f"><em>合理價</em>${inp(`val.${i}.fair`, c.val[i].fair, 'class="met-v" inputmode="decimal" placeholder="—"')}</div>
      ${ta(`val.${i}.assume`, c.val[i].assume, '關鍵假設')}${inp(`val.${i}.note`, c.val[i].note, 'class="met-s" placeholder="備註"')}</div>`).join('')}</div>
    <div class="result" id="valResult">${valResultHTML(c, vs)}</div>
    ${srcLinks(c, 'val')}
    <details class="rc-sub"><summary>🧮 DCF 試算器</summary>${dcfHTML(c)}</details>
    <label class="f" style="margin-top:8px"><span>三法差距大時，哪個假設最脆弱？</span>${ta('valCheck', c.valCheck)}</label>
  </details>

  <details class="rc-sec" id="sec-tech" open>${secHead('5', 'tech', '技術面', techDone, 7)}
    ${chartHTML(c)}
    <div class="trows">${TECH_ROWS.map((nm, i) => `<div class="trow"><div class="met-h"><span>${nm}</span>${tip(HELP.tech[i])}</div>${inp(`tech.${i}.read`, c.tech[i].read, 'class="t-read" placeholder="讀數"')}${ta(`tech.${i}.judge`, c.tech[i].judge, '判讀')}</div>`).join('')}</div>
    <div class="tech-links"><span>看不懂指標？</span>${SEC_LESSON.map(([id, l]) => `<button class="chip" data-lesson-go="${id}">${l}</button>`).join('')}</div>
    <button class="btn-small" id="cardToBt">用歷史股價回測這檔的訊號 ›</button>
  </details>

  <details class="rc-sec" id="sec-chip" ${c.market === '美股' ? '' : 'open'}>${secHead('6', 'chip', '籌碼面' + (c.market === '美股' ? '（台股適用）' : ''), chipDone, 7)}
    <div class="trows">${CHIP_ROWS.map((nm, i) => `<div class="trow chip3"><div class="met-h"><span>${nm}</span>${tip(HELP.chip[i])}</div><div class="c2"><label><em>5 日</em>${inp(`chip.${i}.d5`, c.chip[i].d5)}</label><label><em>20 日</em>${inp(`chip.${i}.d20`, c.chip[i].d20)}</label></div>${ta(`chip.${i}.judge`, c.chip[i].judge, '判讀')}</div>`).join('')}</div>
  </details>

  <details class="rc-sec" id="sec-end" open>${secHead('7', 'end', '結論與行動', endDone, 4)}
    <label class="f"><span>投資論點：為什麼是這家、為什麼是現在</span>${ta('thesis', c.thesis)}</label>
    <label class="f wrong"><span>⚠ 證明我錯的條件</span>${ta('wrongIf', c.wrongIf, '例如：毛利率連兩季低於 50%、跌破季線且外資連賣 10 日')}</label>
    <label class="f"><span>動作與部位大小</span>${ta('action', c.action)}</label>
    <div class="end-acts">
      <button class="act" id="cardToMonitor"><i>🔔</i>建立監控${c.monitored === '是' ? ' ✓' : ''}</button>
      <button class="act" id="cardToSize"><i>📐</i>算部位</button>
      <button class="act" id="cardToTrade"><i>🧾</i>記錄買進</button>
    </div>
  </details>
  <div class="rc-meta"><label>代號 ${inp('code', c.code)}</label><label>名稱 ${inp('name', c.name)}</label><label>市場 <select data-card-f="market">${['台股', '美股', '其他'].map(o => `<option ${o === c.market ? 'selected' : ''}>${o}</option>`).join('')}</select></label><label>股價 ${inp('price', c.price, 'inputmode="decimal"')}</label><label>研究日 <input type="date" data-card-f="date" value="${esc(c.date)}"></label></div>`;
};

document.addEventListener('click', e => {
  const t = e.target.closest('[data-light],[data-tip],[data-golayer],[data-lesson-go],#cardToBt,.rc-toc a,.rh-dim');
  if (!t) return;
  const c = S.cards.find(x => x.id === openCardId);
  if (t.dataset.light != null && c) {
    const l = c.lights[+t.dataset.light]; l.c = l.c === t.dataset.c ? '' : t.dataset.c; l.auto = false; save();
    const y = scrollY; render(); scrollTo(0, y); return;
  }
  if (t.dataset.tip != null) { t.parentElement.classList.toggle('show'); return; }
  if (t.dataset.golayer != null) { const f = findLayer(t.dataset.golayer); if (f) S.chainTab = f.ch.id; go('industry'); return; }
  if (t.dataset.lessonGo) { S.learnLesson = t.dataset.lessonGo; if (c?.code) S.learnCode = c.code; save(); go('learn'); return; }
  if (t.id === 'cardToBt' && c) { S.bt = Object.assign(S.bt || { rule: 'rsiLow', N: 30, hold: 20 }, { code: c.code }); save(); go('claims'); setTimeout(() => document.getElementById('bt_code')?.scrollIntoView({ block: 'center' }), 50); return; }
  if (t.matches('.rc-toc a, .rh-dim')) {
    e.preventDefault(); const el = document.querySelector(t.getAttribute('href')); if (!el) return;
    el.open = true; window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'smooth' });
  }
});
// 編輯股價、合理價時即時更新估值儀表
document.addEventListener('input', e => {
  const p = e.target.dataset?.cardF; if (!p || !/^val\.\d+\.fair$|^price$/.test(p)) return;
  const c = S.cards.find(x => x.id === openCardId); const old = document.querySelector('.gauge'); if (!c) return;
  const html = valGauge(c, valSummary(c)); if (old) old.outerHTML = html || '<div class="gauge"></div>';
});
document.addEventListener('click', e => { if (e.target.closest('summary button')) e.preventDefault(); }, true);
go(current);
