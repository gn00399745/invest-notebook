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

/* ---------- 首頁：把「去別的分頁看」換成真正的市場摘要 ---------- */
const _homeNav = PAGES.home;
PAGES.home = () => {
  let snap = '';
  try {
    if (typeof verdict === 'function') {
      const rows = [['tw', '🇹🇼 台股'], ['us', '🇺🇸 美股']].map(([id, l]) => {
        const v = verdict(id), P = typeof phaseOf === 'function' ? phaseOf(id) : null;
        return `<div class="ms-r"><b>${l}</b>${P ? `<i class="sigp ${PHASE[P.ph].c}">景氣${P.ph}</i>` : ''}${v ? `<i class="dc-z ${v.z}">${EXT_Z[v.z].ic} ${EXT_Z[v.z].n}</i><span>${v.M.ic} ${esc(v.M.n)}：${esc(v.M.short)}</span>` : '<span class="help">讀取中…</span>'}</div>`;
      }).join('');
      snap = `<div class="card ms"><div class="card-head"><h3 class="gold-bar">今天的市場</h3><button class="btn-small ghost" data-go="timing">進出場時機 →</button></div>${rows}</div>`;
    }
  } catch (e) { /* 市場資料未載入 */ }
  return _homeNav().replace(/<div class="card"><div class="card-head"><h3 class="gold-bar">投資研究<\/h3>[\s\S]*?<\/div><\/div>\s*$/, snap);
};

/* ---------- 電腦版：首頁、收支、進出場時機分成左右兩欄 ---------- */
const WIDE = matchMedia('(min-width: 1100px)');
WIDE.addEventListener('change', () => { if (DASH[current]) { const y = scrollY; render(); scrollTo(0, y); } });
const DASH = { home: { left: ['我的持股', '存款、貴金屬、保單、房產'], right: ['今天的市場', '月收支', '資產配置'] },
  timing: { left: ['① 週期'], right: ['② 溫度'] },
  ledger: { left: ['明細'], right: ['固定收支', '信用卡'] } };
const _renderDash = render;
render = function () {
  _renderDash();
  const d = DASH[current]; if (!d || !WIDE.matches) return;
  const v = $('#view'), cards = [...v.children].filter(e => e.classList.contains('card') && !e.classList.contains('alert') && !e.classList.contains('onboard'));
  const pick = names => names.map(n => cards.find(c => (c.querySelector('h3')?.textContent || '').includes(n))).filter(Boolean);
  const L = pick(d.left), R = pick(d.right); if (!L.length || !R.length) return;
  const at = [...L, ...R].sort((a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1)[0];
  const wrap = document.createElement('div'); wrap.className = 'dash dash-' + current;
  at.before(wrap);
  const cl = document.createElement('div'), cr = document.createElement('div');
  L.forEach(c => cl.appendChild(c)); R.forEach(c => cr.appendChild(c));
  wrap.append(cl, cr);
};

// 匯出備份時記下日期（選單上的「該備份」提醒用）
document.addEventListener('click', e => { if (e.target.closest('#exportBtn')) { S.lastExport = Date.now(); save(); } }, true);

go(window.__startPage || current);
