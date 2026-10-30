/* 導覽與版面：全站唯一的頁面分組（取代各檔案各自覆寫的 GROUPS／FLOWS／返回列） */
'use strict';

// 每個分組 = 手機底部一個分頁；電腦版左側選單一次列出全部頁面
const NAV = [
  { g: 'assets', ic: '💰', t: '資產', pages: [['home', '資產總覽'], ['ledger', '收支記帳'], ['trades', '交易紀錄']] },
  { g: 'research', ic: '🔍', t: '研究', pages: [['radar', '選股雷達'], ['picks', '策略組合'], ['cards', '個股研究卡'], ['industry', '產業定位'], ['etf', 'ETF 健檢']] },
  { g: 'market', ic: '🌐', t: '市場', pages: [['timing', '進出場時機'], ['extreme', '極端訊號'], ['macro', '總經'], ['cycles', '週期研究'], ['metfx', '黃金・匯率'], ['monitor', '監控提醒']] },
  { g: 'plan', ic: '🎯', t: '計畫', pages: [['plan', '財務計畫'], ['review', '覆盤'], ['claims', '待驗主張・回測']] },
  { g: 'more', ic: '📚', t: '學習', pages: [['learn', '技術分析教學'], ['overview', '投資流程與資料來源'], ['settings', '設定與備份']] },
];
// 舊網址與舊按鈕的頁面名稱 → 現在的頁面
const NAV_ALIAS = { more: 'settings', strategy: 'plan', retire: 'plan', season: 'cycles', empire: 'cycles' };
const navGroupOf = p => NAV.find(n => n.pages.some(x => x[0] === p)) || NAV[0];
const navLabel = p => NAV.flatMap(n => n.pages).find(x => x[0] === p)?.[1] || '';

// 需要注意的項目：顯示在選單上
function navBadges() {
  const b = {};
  try {
    const bk = S.lastExport ? Math.floor((Date.now() - S.lastExport) / 864e5) : null;
    if (bk == null || bk > 30) b.settings = ['該備份', 'red'];
    const pend = (S.reviews || []).filter(r => !r.result).length;
    if (pend) b.review = [pend, 'gold'];
    if (S.monAlerts?.length) b.monitor = [S.monAlerts.length, 'red'];
    if (S.pendingDca?.length) b.home = [S.pendingDca.length, 'gold'];
  } catch (e) { /* 資料不全時不顯示 */ }
  return b;
}

// 手機：頁面上方的分組內切換列；電腦：側欄已列出全部頁面，不另外顯示
window.subNav = p => {
  const n = navGroupOf(p);
  return n.pages.length > 1 ? `<div class="subnav">${n.pages.map(([k, l]) => `<button data-go="${k}" class="${k === p ? 'on' : ''}">${l}</button>`).join('')}</div>` : '';
};

// 底部／上方分頁列
$('#tabs').innerHTML = NAV.map(n => `<button data-go="${n.pages[0][0]}" data-tab="${n.g}"><i>${n.ic}</i><span>${n.t}</span></button>`).join('');

// 電腦版側欄
document.body.insertAdjacentHTML('afterbegin', '<aside class="side" id="side" aria-label="全部頁面"></aside>');
function renderSide() {
  const bd = navBadges();
  $('#side').innerHTML = NAV.map(n => `<div class="side-g"><div class="side-h">${n.ic} ${n.t}</div>${n.pages.map(([k, l]) =>
    `<button data-go="${k}" class="${k === current ? 'on' : ''}"><span>${l}</span>${bd[k] ? `<i class="side-b ${bd[k][1]}">${bd[k][0]}</i>` : ''}</button>`).join('')}</div>`).join('')
    + `<div class="side-ver">版本 ${typeof APP_VER !== 'undefined' ? APP_VER : ''}</div>`;
}

const _goNav = go;
go = function (page) {
  page = NAV_ALIAS[page] || page;
  _goNav(page);
  const g = navGroupOf(current).g;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === g));
  document.title = `${navLabel(current) || 'AI 投資筆記'}・AI 投資筆記`;
};
const _renderNav = render;
render = function () {
  _renderNav();
  document.body.dataset.page = current;
  renderSide();
};

/* ---------- 首頁：今天的市場摘要（取代原本「去別的分頁看」的說明卡） ---------- */
const _homeNav = PAGES.home;
PAGES.home = () => {
  let snap = '';
  try {
    if (typeof verdict === 'function') {
      const rows = [['tw', '🇹🇼 台股'], ['us', '🇺🇸 美股']].map(([id, l]) => {
        const v = verdict(id), P = typeof phaseOf === 'function' ? phaseOf(id) : null;
        return `<div class="mk-r"><b>${l}</b>${P ? `<i class="sigp ${PHASE[P.ph].c}">景氣${P.ph}</i>` : ''}${v ? `<i class="dc-z ${v.z}">${EXT_Z[v.z].ic} ${EXT_Z[v.z].n}</i><span>${v.M.ic} ${esc(v.M.n)}：${esc(v.M.short)}</span>` : '<span class="help">讀取中…</span>'}</div>`;
      }).join('');
      const M = typeof mktSignals === 'function' ? mktSignals() : null;
      const sig = M?.rows.length ? `<div class="mk-r"><b>九大指標</b><i class="sig-lv ${M.lv[0]}">${SIG_IC[M.lv[0]]} ${M.lv[1]}</i><span>🟢 ${M.g}　🟡 ${M.y}　🔴 ${M.red}${M.rows.filter(r => r.c === 'r' || r.c === 'o').map(r => `｜${esc(r.n)}`).join('')}</span></div>` : '';
      snap = `<div class="card mk"><div class="card-head"><h3 class="gold-bar">今天的市場</h3><button class="btn-small ghost" data-go="timing">進出場時機 →</button></div>${rows}${sig}</div>`;
    }
  } catch (e) { /* 市場資料未載入 */ }
  // 放在右側欄最上面（手機版排在持股之後）
  const html = _homeNav();
  return html.includes('<div class="hg-side">') ? html.replace('<div class="hg-side">', '<div class="hg-side">' + snap) : html + snap;
};

/* ---------- 日間／夜間：跟隨系統 → 日間 → 夜間 ----------
   樣式表的夜間規則都寫在 @media (prefers-color-scheme: dark) 裡，手動切換時直接改這些規則的條件 */
const THEMES = { auto: ['🌓', '跟隨系統'], light: ['☀️', '日間'], dark: ['🌙', '夜間'] };
function applyTheme(t) {
  if (!THEMES[t]) t = 'auto';
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch (e) { continue; }
    for (const r of rules) if (r instanceof CSSMediaRule && (r._q || r.media.mediaText).includes('prefers-color-scheme')) {
      r._q = r._q || r.media.mediaText;
      r.media.mediaText = t === 'auto' ? r._q : t === 'dark' ? 'all' : 'not all';
    }
  }
  document.documentElement.style.colorScheme = t === 'auto' ? 'light dark' : t;
  const b = $('#themeBtn'); if (b) { b.textContent = THEMES[t][0]; b.title = `目前：${THEMES[t][1]}（點一下切換）`; }
}
const themeNow = () => { try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; } };
$('#themeBtn').addEventListener('click', () => {
  const ks = Object.keys(THEMES), t = ks[(ks.indexOf(themeNow()) + 1) % ks.length];
  try { localStorage.setItem('theme', t); } catch (e) { /* 無法儲存時只切換這次 */ }
  applyTheme(t); toast(`已切換：${THEMES[t][1]}`);
});
applyTheme(themeNow());

// 匯出備份時記下日期（選單上的「該備份」提醒用）
document.addEventListener('click', e => { if (e.target.closest('#exportBtn')) { S.lastExport = Date.now(); save(); } }, true);

go(window.__startPage || current);
