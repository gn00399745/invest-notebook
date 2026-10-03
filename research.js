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
/* 持股 → 研究卡同步 */
const holdOf = code => holdings().find(h => h.shares > 0 && h.code === String(code || '').toUpperCase());
let syncBusy = false;
async function syncHoldCards() {
  const miss = holdings().filter(h => h.shares > 0 && !S.cards.some(c => String(c.code).toUpperCase() === h.code));
  if (!miss.length) return 0;
  const made = miss.map(h => { const c = blankCard(); c.code = h.code; c.name = h.name || ''; c.market = /^\d/.test(h.code) ? '台股' : '美股'; c.fromHold = true; S.cards.push(c); return c; });
  save(); toast(`已為 ${made.length} 檔持股建立研究卡，資料帶入中…`);
  if (current === 'cards' && !openCardId) render();
  if (!syncBusy && location.protocol.startsWith('http')) { syncBusy = true; for (const c of made) { try { await autoFillCard(c, true); } catch (e) { /* 略過 */ } } syncBusy = false; }
  return made.length;
}
PAGES.cards = () => {
  if (openCardId) { const c = S.cards.find(x => x.id === openCardId); if (c) return cardEditor(c); openCardId = null; }
  if (holdings().some(h => h.shares > 0 && !S.cards.some(x => String(x.code).toUpperCase() === h.code))) setTimeout(syncHoldCards, 50);
  if (S.cards.some(c => c.code && !c.example && (!c.layer || (c.layerGuess && !c.layerWhy)))) setTimeout(classifyMissing, 80);
  const flt = S.rcFilter || '全部', held = c => !!holdOf(c.code);
  const list = [...S.cards].filter(c => flt === '全部' || (flt === '持有中' ? held(c) : !held(c)))
    .sort((a, b) => (held(b) - held(a)) || (b.date || '').localeCompare(a.date || ''));
  const nHeld = S.cards.filter(held).length;
  return `<h2>個股研究卡</h2>
  <p class="lead">先在「產業地位」確認公司站在哪一層，再建卡研究財報、估值、技術與籌碼，最後寫下結論與「證明我錯」的條件。</p>
  <div class="chips">${['全部', '持有中', '觀察中'].map(k => `<button class="chip ${k === flt ? 'on' : ''}" data-rcf="${k}">${k}${k === '持有中' ? ` ${nHeld}` : k === '觀察中' ? ` ${S.cards.length - nHeld}` : ''}</button>`).join('')}</div>
  <div class="rc-grid">
    <button class="rc-new" id="newCard"><span>＋</span><b>研究一檔新標的</b><em>輸入代號，自動帶入財報、股價、籌碼</em></button>
    ${list.map(c => {
      const vs = valSummary(c), g = c.lights.filter(l => l.c === '綠').length, r = c.lights.filter(l => l.c === '紅').length, ch = chg20(c), f = findLayer(c.layer);
      return `<button class="rc-item" data-card="${c.id}">
        <div class="rc-i-top"><span class="rc-code">${esc(c.code)}</span>${held(c) ? '<span class="pill green">持有中</span>' : ''}${c.example ? '<span class="pill gold">範例</span>' : ''}<span class="spacer"></span>${lightsHTML(c)}</div>
        <div class="rc-i-name">${esc(c.name || '（未命名）')}</div>
        <div class="rc-i-layer">${esc(f ? `${f.ch.name}・${f.i + 1} ${f.l.n}` : c.layer || '未定位')}${c.layerGuess ? '<span class="la-q">推估</span>' : ''}</div>
        ${c.spark ? `<svg class="rc-i-spark" viewBox="0 0 120 30" preserveAspectRatio="none"><path d="${sparkPath(c.spark, 120, 30)}"/></svg>` : ''}
        <div class="rc-i-nums"><span><em>股價</em><b>${esc(c.price || '—')}</b></span><span><em>20 日</em><b class="${ch >= 0 ? 'up' : 'down'}">${ch == null ? '—' : pct(ch)}</b></span><span><em>估值空間</em><b class="${vs.upside >= 0 ? 'up' : 'down'}">${vs.upside == null ? '—' : pct(vs.upside)}</b></span></div>
        ${c.verdict ? `<div class="rc-i-v">${esc(c.verdict.replace(/^【自動草稿】/, ''))}</div>` : ''}
        <div class="rc-i-foot">綠 ${g}・紅 ${r}・${esc(c.date || '')}</div>
      </button>`;
    }).join('')}
  </div>`;
};

/* ---------- 研究卡內頁 ---------- */
const GUIDE_F = [['guidance', '🧭', '管理層指引', '營收、毛利率區間；上修或下修多少'], ['quotes', '💬', '關鍵原話', '標日期'], ['qa', '🙋', '分析師問答重點', '分析師最關心什麼'], ['assumptions', '🔁', '轉成估值假設', '例如：明年營收成長 20%']];
const TECH_IC = ['📐', '🌡️', '〰️', '📏', '🔺', '🧱', '📊'];
const CHIP_IC = ['🌏', '🏢', '🏦', '💳', '🐻', '🎯', '👔'];
const SIG_L = { pos: '偏多', neg: '偏空', neu: '中性' };
const sig = t => { t = String(t || ''); if (!t || /^示範/.test(t)) return ''; if (/空頭|偏空|偏弱|轉弱|死亡交叉|跌破|賣超|過熱|偏熱|量增價跌|高估|下修/.test(t)) return 'neg'; if (/多頭|偏多|偏強|轉強|黃金交叉|站上|買超|突破|量增價漲|低估|上修|多方/.test(t)) return 'pos'; return 'neu'; };
// 籌碼數字：法人買超為正向；融資增加、融券增加視為風險
const numSig = (v, i) => { const n = num(String(v || '').replace(/[^\d.+-]/g, '')); if (n == null || n === 0) return ''; const good = i === 3 || i === 4 ? n < 0 : n > 0; return good ? 'pos' : 'neg'; };
const upOf = (c, i) => { const f = num(c.val[i].fair), p = num(c.price); return f && p ? (f / p - 1) * 100 : null; };
const upChip = (c, i) => { const u = upOf(c, i); return u == null ? '—' : `<span class="${u >= 0 ? 'up' : 'down'}">${pct(u)}</span>`; };
const sigOfUp = (c, i) => { const u = upOf(c, i); return u == null ? '' : u >= 10 ? 'pos' : u <= -10 ? 'neg' : 'neu'; };

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
    ${(() => { const h = holdOf(c.code); if (!h) return ''; const q = S.quotes?.[h.code]?.price ?? num(c.price); const mv = q ? q * h.shares : null, pl = mv != null ? mv - h.cost : null;
      return `<div class="rh-hold"><span>💼 我持有 <b>${shf(h.shares)}</b> 股・均價 ${fmt(h.cost / h.shares, 2)}</span>${pl != null ? `<span class="${pl >= 0 ? 'up' : 'down'}">${pl >= 0 ? '+' : ''}${fmt(pl)}（${pct(pl / h.cost * 100)}）</span>` : ''}<span class="rh-hbtn"><button data-hbuy="${esc(h.code)}">加碼</button><button data-hsell="${esc(h.code)}">賣出</button></span></div>`; })()}
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
    <div class="ind-box">${layerAutoHTML(c)}<label class="f"><span>所在供應鏈與層級</span>${layerSelectHTML(c.layer)}</label>
      ${f ? `<div class="ind-info"><b>${esc(f.l.n)}</b>：${esc(f.l.d)}${f.l.b ? `<br><span class="bn">${esc(f.l.b)}</span>` : ''}</div>` : ''}
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
    <div class="met-grid wide">${GUIDE_F.map(([k, ic, l, ph]) => `<div class="met ${filled([c[k]]) ? 'done' : ''}"><div class="met-h"><span>${ic} ${l}</span><span class="pill ${filled([c[k]]) ? 'green' : ''}">${filled([c[k]]) ? '已填' : '待填'}</span></div>
      ${k === 'guidance' ? `<div class="gdir">${['上修', '維持', '下修'].map((d, j) => `<button type="button" class="gd ${['綠', '黃', '紅'][j]} ${c.guideDir === d ? 'on' : ''}" data-gdir="${d}">${['▲', '■', '▼'][j]} ${d}</button>`).join('')}</div>` : ''}
      ${ta(k, c[k], ph)}</div>`).join('')}</div>
    ${srcLinks(c, 'guide')}
  </details>

  <details class="rc-sec" id="sec-val" open>${secHead('4', 'val', '估值（三法交叉）', valDone, 3)}
    <div class="met-grid">${VAL_ROWS.map((nm, i) => `<div class="met ${sigOfUp(c, i)}"><div class="met-h"><span>${['📏 相對估值', '🧮 DCF', '👥 分析師共識'][i]}</span>${tip(HELP.val[i])}</div>
      ${inp(`val.${i}.fair`, c.val[i].fair, 'class="met-v" inputmode="decimal" placeholder="合理價"')}
      <div class="met-p"><span>vs 現價</span><b data-vup="${i}">${upChip(c, i)}</b></div>
      ${ta(`val.${i}.assume`, c.val[i].assume, '關鍵假設')}${inp(`val.${i}.note`, c.val[i].note, 'class="met-s" placeholder="備註"')}</div>`).join('')}
      <div class="met sum"><div class="met-h"><span>⚖️ 三法平均</span></div><div class="met-v big" id="valAvg">${vs.avg == null ? '—' : fmt(vs.avg, 1)}</div><div class="met-p"><span>潛在空間</span><b id="valUp">${vs.upside == null ? '—' : `<span class="${vs.upside >= 0 ? 'up' : 'down'}">${pct(vs.upside)}</span>`}</b></div><div class="help" id="valSpread">${vs.min ? `區間 ${fmt(vs.min, 0)}～${fmt(vs.max, 0)}${vs.max / vs.min > 1.3 ? '・<span class="down">差距大，檢查假設</span>' : ''}` : '填兩個以上合理價即可比較'}</div></div></div>
    <div id="valResult" hidden>${valResultHTML(c, vs)}</div>
    ${srcLinks(c, 'val')}
    <details class="rc-sub"><summary>🧮 DCF 試算器</summary>${dcfHTML(c)}</details>
    <label class="f" style="margin-top:8px"><span>三法差距大時，哪個假設最脆弱？</span>${ta('valCheck', c.valCheck)}</label>
  </details>

  <details class="rc-sec" id="sec-tech" open>${secHead('5', 'tech', '技術面', techDone, 7)}
    ${chartHTML(c)}
    <div class="met-grid wide">${TECH_ROWS.map((nm, i) => { const sg = sig(c.tech[i].judge); return `<div class="met ${sg}"><div class="met-h"><span>${TECH_IC[i]} ${nm}</span>${sg ? `<span class="sigp ${sg}">${SIG_L[sg]}</span>` : ''}${tip(HELP.tech[i])}</div>
      ${techViz(i, c)}${ta(`tech.${i}.read`, c.tech[i].read, '讀數').replace('class="cell-ta" rows="2"', 'class="cell-ta t-read" rows="1"')}${ta(`tech.${i}.judge`, c.tech[i].judge, '判讀').replace('rows="2"', 'rows="1"')}</div>`; }).join('')}</div>
    <div class="tech-links"><span>看不懂指標？</span>${SEC_LESSON.map(([id, l]) => `<button class="chip" data-lesson-go="${id}">${l}</button>`).join('')}</div>
    <button class="btn-small" id="cardToBt">用歷史股價回測這檔的訊號 ›</button>
  </details>

  <details class="rc-sec" id="sec-chip" ${c.market === '美股' ? '' : 'open'}>${secHead('6', 'chip', '籌碼面' + (c.market === '美股' ? '（台股適用）' : ''), chipDone, 7)}
    <div class="met-grid">${CHIP_ROWS.map((nm, i) => { const x = c.chip[i], sg = sig(x.judge) || numSig(x.d20, i); return `<div class="met ${sg}"><div class="met-h"><span>${CHIP_IC[i]} ${nm}</span>${tip(HELP.chip[i])}</div>
      ${chipViz(x, i)}<div class="met-p"><span>5 日</span>${inp(`chip.${i}.d5`, x.d5, `class="met-v mid ${numSig(x.d5, i)}" placeholder="—"`)}</div>
      <div class="met-p"><span>20 日</span>${inp(`chip.${i}.d20`, x.d20, `class="mid2 ${numSig(x.d20, i)}" placeholder="—"`)}</div>
      ${ta(`chip.${i}.judge`, x.judge, '判讀').replace('rows="2"', 'rows="1"')}</div>`; }).join('')}</div>
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


// 產業自動歸類：顯示依據、信心與其他可能
function layerAutoHTML(c) {
  const btn = `<button class="btn-small ghost" data-relayer="1">${c.layer ? '🔄 重新判斷' : '🤖 自動判斷產業'}</button>`;
  if (!c.layer) return `<div class="la-box"><div class="la-h"><span>🤖 還沒定位</span>${btn}</div>${c.layerWhy ? `<div class="help">${esc(c.layerWhy)}</div>` : '<div class="help">系統會依代號對照表、公司名稱、Yahoo 與證交所產業分類自動判斷。</div>'}</div>`;
  if (!c.layerAuto && !c.layerGuess) return `<div class="la-box mine"><div class="la-h"><span>✋ 你自己選的</span>${btn}</div></div>`;
  const alts = (c.layerAlts || []).filter(v => v !== c.layer);
  return `<div class="la-box ${c.layerGuess ? 'guess' : 'sure'}"><div class="la-h"><span>🤖 系統歸類</span><span class="pill ${c.layerGuess ? 'gold' : 'green'}">${c.layerGuess ? '推估，請確認' : '確定'}</span>${btn}</div>
    ${c.layerWhy ? `<div class="help">依據：${esc(c.layerWhy)}</div>` : ''}
    ${alts.length ? `<div class="la-alts"><span class="help">也可能是：</span>${alts.map(v => `<button class="chip" data-layerpick="${esc(v)}">${esc(v)}</button>`).join('')}</div>` : ''}</div>`;
}
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-relayer],[data-layerpick]'); if (!t) return;
  const c = S.cards.find(x => x.id === openCardId); if (!c) return;
  if (t.dataset.layerpick) { c.layer = t.dataset.layerpick; c.layerAuto = false; c.layerGuess = false; c.layerWhy = ''; layerLight(c); save(); const y = scrollY; render(); scrollTo(0, y); return; }
  t.disabled = true; t.textContent = '判斷中…';
  const ok = await classifyCard(c, true); save();
  const y = scrollY; render(); scrollTo(0, y);
  toast(ok ? `歸類為「${c.layer}」` : (c.layerWhy || '判斷不出來，請自己選'));
});
// 手動改下拉選單 → 標記為自己選的
document.addEventListener('change', e => {
  if (e.target.dataset?.cardF !== 'layer') return;
  const c = S.cards.find(x => x.id === openCardId); if (!c) return;
  c.layer = e.target.value; c.layerAuto = false; c.layerGuess = false; c.layerWhy = ''; layerLight(c); save();
  const y = scrollY; render(); scrollTo(0, y);
});
document.addEventListener('click', e => {
  const t = e.target.closest('[data-light],[data-tip],[data-golayer],[data-lesson-go],[data-rcf],[data-gdir],#cardToBt,.rc-toc a,.rh-dim');
  if (!t) return;
  const c = S.cards.find(x => x.id === openCardId);
  if (t.dataset.light != null && c) {
    const l = c.lights[+t.dataset.light]; l.c = l.c === t.dataset.c ? '' : t.dataset.c; l.auto = false; save();
    const y = scrollY; render(); scrollTo(0, y); return;
  }
  if (t.dataset.tip != null) { t.parentElement.classList.toggle('show'); return; }
  if (t.dataset.rcf) { S.rcFilter = t.dataset.rcf; save(); render(); return; }
  if (t.dataset.gdir && c) { c.guideDir = c.guideDir === t.dataset.gdir ? '' : t.dataset.gdir; const L = c.lights[2]; if (c.guideDir && (!L.c || L.auto || L.fromGuide)) { L.c = { 上修: '綠', 維持: '黃', 下修: '紅' }[c.guideDir]; L.fromGuide = true; } save(); const y = scrollY; render(); scrollTo(0, y); return; }
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
  const vs = valSummary(c), html = valGauge(c, vs); if (old) old.outerHTML = html || '<div class="gauge"></div>';
  document.querySelectorAll('[data-vup]').forEach(el => { el.innerHTML = upChip(c, +el.dataset.vup); });
  const A = document.getElementById('valAvg'), U = document.getElementById('valUp'), SP = document.getElementById('valSpread');
  if (A) A.textContent = vs.avg == null ? '—' : fmt(vs.avg, 1);
  if (U) U.innerHTML = vs.upside == null ? '—' : `<span class="${vs.upside >= 0 ? 'up' : 'down'}">${pct(vs.upside)}</span>`;
  if (SP) SP.innerHTML = vs.min ? `區間 ${fmt(vs.min, 0)}～${fmt(vs.max, 0)}${vs.max / vs.min > 1.3 ? '・<span class="down">差距大，檢查假設</span>' : ''}` : '填兩個以上合理價即可比較';
});
document.addEventListener('click', e => { if (e.target.closest('summary button')) e.preventDefault(); }, true);
go(current);
setTimeout(() => { if (holdings().some(h => h.shares > 0 && !S.cards.some(c => String(c.code).toUpperCase() === h.code))) syncHoldCards(); }, 2500);

/* ---------- 選股雷達：營收動能 × 技術強勢 ---------- */
FLOWS[0].steps.unshift(['radar', '選股雷達']);
const RADAR_P = [
  ['綜合', '綜合分數', () => true, '營收、趨勢、新高、相對強度、量能加總'],
  ['營收', '營收爆發', x => x.revYoY >= 30 && x.cumYoY >= 10, '月營收年增 ≥30%、累計年增 ≥10%'],
  ['突破', '技術突破', x => x.dist != null && x.dist >= -3 && x.trend === '多頭排列', '多頭排列且距 52 週高點 3% 內'],
  ['回檔', '成長股回檔', x => x.revYoY >= 20 && x.trend !== '季線之下' && x.bias20 != null && x.bias20 < 3 && x.dist != null && x.dist <= -8, '營收仍強，股價回到月線附近、離高點 8% 以上'],
  ['價值', '成長＋合理本益比', x => x.revYoY >= 20 && x.pe > 0 && x.pe <= 20, '營收年增 ≥20% 且本益比 ≤20'],
];
let radarBusy = false;
async function loadRadar(force) {
  if (radarBusy || !location.protocol.startsWith('http')) return;
  if (!force && S.radar && Date.now() - (S.radarAt || 0) < 6 * 3600e3) return;
  radarBusy = true; function chipViz(x, i) {
  const a = num(String(x.d5 || '').replace(/[^\d.+-]/g, '')), b = num(String(x.d20 || '').replace(/[^\d.+-]/g, '')); if (a == null && b == null) return '';
  const rows = [{ l: '5 日', v: a }, { l: '20 日', v: b }].filter(r => r.v != null), inv = i === 3 || i === 4; // 融資、融券增加視為風險
  const mx = Math.max(...rows.map(r => Math.abs(r.v)), 1e-9);
  return `<div class="tv-dv sm">${rows.map(r => `<div class="tv-dr"><span>${r.l}</span><div class="tv-dt"><i class="tv-0"></i><i class="tv-db ${(r.v < 0) !== inv ? 'n' : 'p'}" style="${r.v < 0 ? `right:50%;width:${Math.abs(r.v) / mx * 50}%` : `left:50%;width:${r.v / mx * 50}%`}"></i></div></div>`).join('')}</div>`;
}
if (current === 'radar') render();
  try {
    const j = await (await fetch('api/radar' + (force ? '?t=' + Date.now() : ''), { signal: AbortSignal.timeout(90000) })).json();
    if (!j.list) throw new Error('格式錯誤');
    S.radar = j; S.radarAt = Date.now(); save(); if (force) toast(`已篩出 ${j.list.length} 檔`);
  } catch (e) { toast('選股雷達更新失敗：' + e.message); }
  radarBusy = false; if (current === 'radar') { const y = scrollY; render(); scrollTo(0, y); }
}
const bar5 = (v, lo, hi, good) => { if (v == null) return '<i class="rb-n">—</i>'; const w = Math.max(3, Math.min(100, (v - lo) / (hi - lo) * 100)); return `<span class="rb"><i class="${good ? 'g' : v < 0 ? 'r' : ''}" style="width:${w}%"></i></span>`; };
PAGES.radar = () => {
  setTimeout(() => loadRadar(false), 30);
  const R = S.radar, p = RADAR_P.find(x => x[0] === (S.radarP || '綜合')) || RADAR_P[0], mk = S.radarMkt || '全部';
  const list = (R?.list || []).filter(p[2]).filter(x => mk === '全部' || x.mkt === mk);
  const ym = R?.revYM ? `${+R.revYM.slice(0, 3) + 1911} 年 ${+R.revYM.slice(3)} 月` : '';
  const mine = code => S.cards.find(c => String(c.code) === code);
  const rows = list.map((x, i) => `<div class="rd">
    <div class="rd-h"><span class="rd-rank">${i + 1}</span><div class="rd-id"><b>${esc(x.code)} ${esc(x.name)}</b><em>${esc(x.mkt)}・${esc(x.ind || '—')}${x.pe ? `・本益比 ${x.pe}` : ''}</em></div>
      <div class="rd-px"><b>${fmt(x.close, x.close < 100 ? 2 : 1)}</b>${x.r1m != null ? `<em class="${x.r1m >= 0 ? 'up' : 'down'}">近 1 月 ${pct(x.r1m)}</em>` : ''}</div>
      <div class="rd-sc ${x.score >= 70 ? 'hi' : x.score >= 50 ? 'mid' : ''}"><b>${x.score}</b><em>分</em></div></div>
    ${x.spark?.length > 2 ? `<svg class="rd-spark" viewBox="0 0 300 34" preserveAspectRatio="none"><path d="${sparkPath(x.spark.map((v, k) => [k, v]), 300, 34)}"/></svg>` : ''}
    <div class="rd-m">
      <div><em>月營收年增</em>${bar5(x.revYoY, 0, 100, x.revYoY >= 30)}<b class="${x.revYoY >= 0 ? 'up' : 'down'}">${x.revYoY == null ? '—' : pct(x.revYoY, 0)}</b></div>
      <div><em>累計營收年增</em>${bar5(x.cumYoY, 0, 60, x.cumYoY >= 20)}<b class="${x.cumYoY >= 0 ? 'up' : 'down'}">${x.cumYoY == null ? '—' : pct(x.cumYoY, 0)}</b></div>
      <div><em>距 52 週高點</em>${bar5(x.dist == null ? null : 30 + x.dist, 0, 30, x.dist >= -3)}<b>${x.dist == null ? '—' : x.dist >= -0.5 ? '新高' : pct(x.dist, 1)}</b></div>
      <div><em>3 個月強於大盤</em>${bar5(x.rs, -20, 50, x.rs >= 10)}<b class="${x.rs >= 0 ? 'up' : 'down'}">${x.rs == null ? '—' : (x.rs >= 0 ? '+' : '') + fmt(x.rs, 1) + ' 點'}</b></div>
      <div><em>量比（5 日 / 60 日）</em>${bar5(x.vr, 0, 2.5, x.vr >= 1.5)}<b>${x.vr == null ? '—' : x.vr + ' 倍'}</b></div>
    </div>
    <div class="rd-tags">${(x.tags || []).map(t => `<span class="pill green">${esc(t)}</span>`).join('')}${x.trend && !x.tags?.includes(x.trend) ? `<span class="pill">${esc(x.trend)}</span>` : ''}${(x.warn || []).map(t => `<span class="pill red">${esc(t)}</span>`).join('')}</div>
    <div class="btn-row">${mine(x.code) ? `<button class="btn-small ghost" data-card="${mine(x.code).id}" data-go-card="1">看研究卡 ›</button>` : `<button class="btn-small" data-radarcard="${esc(x.code)}" data-n="${esc(x.name)}">建研究卡驗證</button>`}
      <a class="btn-small ghost" href="https://tw.stock.yahoo.com/quote/${esc(x.code)}.${x.mkt === '上櫃' ? 'TWO' : 'TW'}/revenue" target="_blank" rel="noopener">營收明細</a></div>
  </div>`).join('');
  return `<h2>選股雷達</h2>
  <p class="lead">「飆股」通常同時具備兩件事：<b>基本面有新變化</b>（營收突然大幅成長）＋ <b>股價已經開始反映</b>（多頭排列、創新高、強於大盤、量增）。雷達每天從上市櫃全部股票篩一遍，給你值得研究的名單。</p>
  <div class="card"><div class="rd-steps">${[['1', '營收動能', '月營收年增、累計年增'], ['2', '趨勢轉強', '站上均線、多頭排列'], ['3', '相對強勢', '逼近新高、強於大盤'], ['4', '量能確認', '近 5 日量放大'], ['5', '研究卡驗證', '產業、財報、估值、籌碼']].map(([n, t, s]) => `<div><b>${n}</b><span>${t}</span><em>${s}</em></div>`).join('')}</div>
    <div class="help">分數滿分 100：營收 30、趨勢 20、新高 15、相對強度 15、量能 10；離月線太遠（短線漲多）會扣分。</div></div>
  <div class="chips">${RADAR_P.map(([k, l]) => `<button class="chip ${k === p[0] ? 'on' : ''}" data-radarp="${k}">${l}</button>`).join('')}</div>
  <div class="chips sm">${['全部', '上市', '上櫃'].map(k => `<button class="chip ${k === mk ? 'on' : ''}" data-radarmkt="${k}">${k}</button>`).join('')}<span class="spacer"></span><button class="btn-small ghost" id="radarRefresh">${radarBusy ? '篩選中…' : '↻ 重新篩選'}</button></div>
  <div class="help" style="margin:-4px 0 10px">${esc(p[3])}${R ? `｜${list.length} 檔` : ''}</div>
  ${R ? rows || '<div class="card empty">這個條件目前沒有符合的股票，換一個條件看看。</div>' : `<div class="card empty">${radarBusy ? '正在篩選上市櫃全部股票…（約 20～40 秒）' : '按「重新篩選」開始。'}</div>`}
  ${R ? `<div class="help" style="margin-top:10px">營收資料：${ym}（每月 10 日前公布上月營收）｜全市場 ${R.universe} 檔、成交值 2,000 萬以上 ${R.liquid} 檔｜加權指數近 3 個月 ${R.idx3m == null ? '—' : pct(R.idx3m)}｜更新 ${new Date(R.updated).toLocaleString('zh-TW', { hour12: false })}${R.errors?.length ? `<br><span class="down">${R.errors.map(esc).join('；')}</span>` : ''}<br>來源：證交所、櫃買中心 OpenAPI，Yahoo Finance。篩選結果是研究的起點，不是買進建議；強勢股波動大，建卡時先寫好「證明我錯」的條件與停損。</div>` : ''}`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-radarp],[data-radarmkt],#radarRefresh,[data-radarcard]'); if (!t) return;
  if (t.dataset.radarp) { S.radarP = t.dataset.radarp; save(); return render(); }
  if (t.dataset.radarmkt) { S.radarMkt = t.dataset.radarmkt; save(); return render(); }
  if (t.id === 'radarRefresh') return loadRadar(true);
  if (t.dataset.radarcard) {
    const c = blankCard(); c.code = t.dataset.radarcard; c.name = t.dataset.n || ''; c.market = '台股'; c.fromRadar = true;
    const x = S.radar?.list?.find(y => y.code === c.code); if (x) c.thesis = `【選股雷達 ${new Date().toLocaleDateString('zh-TW')}】${x.score} 分：${[...(x.tags || []), ...(x.warn || [])].join('、')}。月營收年增 ${x.revYoY ?? '—'}%、累計年增 ${x.cumYoY ?? '—'}%。`;
    S.cards.push(c); openCardId = c.id; save(); go('cards'); setTimeout(() => autoFillCard(c), 50);
  }
});

/* ---------- 技術指標視覺化（像通膨比較圖：一眼看出位置） ---------- */
const tn = (s, re) => { const m = String(s || '').match(re); return m ? num(m[1].replace(/,/g, '')) : null; };
function rangeBar(lo, hi, v, o = {}) {
  // 一條刻度：lo～hi，標出 v；zones：[[from, to, cls]]；ticks：[[value, label]]
  if (lo == null || hi == null || v == null || hi <= lo) return '';
  const X = x => Math.max(0, Math.min(100, (x - lo) / (hi - lo) * 100));
  return `<div class="tv-rg"><div class="tv-tr">${(o.zones || []).map(([a, b, cl]) => `<i class="tv-z ${cl}" style="left:${X(a)}%;width:${X(b) - X(a)}%"></i>`).join('')}${(o.ticks || []).map(([t]) => `<i class="tv-tk" style="left:${X(t)}%"></i>`).join('')}<i class="tv-dot" style="left:${X(v)}%"><span>${esc(o.label ?? fmt(v, v < 100 ? 2 : 0))}</span></i></div>
    <div class="tv-ax">${(o.ticks || []).map(([t, l]) => `<span style="left:${X(t)}%">${esc(l)}</span>`).join('')}</div></div>`;
}
function devBars(rows, unit = '%') {
  // 正負長條（以 0 為中心）
  const mx = Math.max(...rows.map(r => Math.abs(r.v || 0)), 0.1);
  return `<div class="tv-dv">${rows.map(r => r.v == null ? '' : `<div class="tv-dr"><span>${esc(r.l)}</span><div class="tv-dt"><i class="tv-0"></i><i class="tv-db ${r.v < 0 ? 'n' : 'p'}" style="${r.v < 0 ? `right:50%;width:${Math.abs(r.v) / mx * 50}%` : `left:50%;width:${r.v / mx * 50}%`}"></i></div><b class="${r.v < 0 ? 'down' : 'up'}">${r.v > 0 ? '+' : ''}${fmt(r.v, Math.abs(r.v) < 10 ? 2 : 1)}${unit}</b></div>`).join('')}</div>`;
}
function techViz(i, c) {
  const rd = c.tech[i]?.read || '', px = num(c.price) ?? tn(c.tech[0]?.read, /價\s*([\d.,]+)/);
  try {
    if (i === 0) { const p = tn(rd, /價\s*([\d.,]+)/) ?? px; if (!p) return '';
      const ms = [['MA20 月線', tn(rd, /MA20\s*([\d.,]+)/)], ['MA60 季線', tn(rd, /MA60\s*([\d.,]+)/)], ['MA120 半年線', tn(rd, /MA120\s*([\d.,]+)/)]].filter(m => m[1]);
      return ms.length ? `<div class="tv"><div class="tv-cap">股價比各均線高（+）或低（−）多少</div>${devBars(ms.map(([l, m]) => ({ l, v: (p / m - 1) * 100 })))}</div>` : ''; }
    if (i === 1) { const r = tn(rd, /RSI\(?\d*\)?\s*([\d.]+)/); return r == null ? '' : `<div class="tv">${rangeBar(0, 100, r, { label: 'RSI ' + fmt(r, 0), zones: [[0, 30, 'cold'], [70, 100, 'hot']], ticks: [[0, '0'], [30, '30 超賣'], [50, '50'], [70, '70 超買'], [100, '100']] })}</div>`; }
    if (i === 2) { const d = tn(rd, /DIF\s*(-?[\d.]+)/), sgl = tn(rd, /訊號\s*(-?[\d.]+)/), h = tn(rd, /柱\s*(-?[\d.]+)/); if (d == null) return '';
      return `<div class="tv"><div class="tv-cap">柱狀體 = DIF − 訊號線；由負翻正常是轉強訊號</div>${devBars([{ l: 'DIF 快線', v: d }, { l: '訊號線', v: sgl }, { l: '柱狀體', v: h }], '')}</div>`; }
    if (i === 3) { const up = tn(rd, /上軌\s*([\d.,]+)/), mid = tn(rd, /中軌\s*([\d.,]+)/), lo = tn(rd, /下軌\s*([\d.,]+)/); if (!up || !lo || !px) return '';
      const pb = (px - lo) / (up - lo) * 100, pad = (up - lo) * 0.15;
      return `<div class="tv">${rangeBar(lo - pad, up + pad, px, { label: `現價 ${fmt(px, 2)}`, zones: [[lo - pad, lo, 'cold'], [up, up + pad, 'hot']], ticks: [[lo, '下軌'], [mid, '中軌'], [up, '上軌']] })}<div class="tv-cap">位置 %B ${fmt(pb, 0)}%（0% = 下軌、100% = 上軌）</div></div>`; }
    if (i === 4) { const m = rd.match(/52\s*週\s*([\d.,]+)\s*～\s*([\d.,]+)/); if (!m || !px) return ''; const lo = num(m[1].replace(/,/g, '')), hi = num(m[2].replace(/,/g, ''));
      return `<div class="tv">${rangeBar(lo, hi, px, { label: `現價 ${fmt(px, 2)}`, ticks: [[lo, '52 週低'], [hi, '52 週高']] })}<div class="tv-cap">距高點 ${pct((px / hi - 1) * 100)}、距低點 ${pct((px / lo - 1) * 100)}</div></div>`; }
    if (i === 5) { const sp = tn(rd, /支撐\s*([\d.,]+)/), rs = tn(rd, /壓力\s*([\d.,]+)/); if (!sp || !rs || !px) return ''; const pad = (rs - sp) * 0.1;
      return `<div class="tv">${rangeBar(sp - pad, rs + pad, px, { label: `現價 ${fmt(px, 2)}`, zones: [[sp - pad, sp, 'cold'], [rs, rs + pad, 'hot']], ticks: [[sp, '支撐 ' + fmt(sp, 0)], [rs, '壓力 ' + fmt(rs, 0)]] })}</div>`; }
    if (i === 6) { const v5 = tn(rd, /5\s*日均量\s*([\d.,]+)/), v20 = tn(rd, /20\s*日均量\s*([\d.,]+)/); if (!v5 || !v20) return ''; const r = v5 / v20;
      return `<div class="tv">${rangeBar(0, 2.5, Math.min(r, 2.5), { label: `量比 ${fmt(r, 2)} 倍`, zones: [[0, 0.7, 'cold'], [1.5, 2.5, 'hot']], ticks: [[0, '0'], [0.7, '量縮'], [1, '1 倍'], [1.5, '量增'], [2.5, '2.5']] })}<div class="tv-cap">近 5 日平均成交量是 20 日平均的幾倍</div></div>`; }
  } catch (e) { /* 讀數格式不符時不畫圖 */ }
  return '';
}
function chipViz(x, i) {
  const a = num(String(x.d5 || '').replace(/[^\d.+-]/g, '')), b = num(String(x.d20 || '').replace(/[^\d.+-]/g, '')); if (a == null && b == null) return '';
  const rows = [{ l: '5 日', v: a }, { l: '20 日', v: b }].filter(r => r.v != null), inv = i === 3 || i === 4; // 融資、融券增加視為風險
  const mx = Math.max(...rows.map(r => Math.abs(r.v)), 1e-9);
  return `<div class="tv-dv sm">${rows.map(r => `<div class="tv-dr"><span>${r.l}</span><div class="tv-dt"><i class="tv-0"></i><i class="tv-db ${(r.v < 0) !== inv ? 'n' : 'p'}" style="${r.v < 0 ? `right:50%;width:${Math.abs(r.v) / mx * 50}%` : `left:50%;width:${r.v / mx * 50}%`}"></i></div></div>`).join('')}</div>`;
}
if (current === 'radar') render();
