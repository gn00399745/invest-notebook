/* Google 試算表雲端備份（透過使用者自己的 Apps Script 網頁應用程式） */
const GAS_KEY = 'invest-gas';
// 設定另存一個 key：還原備份時不會被蓋掉，匯出的 JSON 也不會帶著密碼
function gasCfg() { try { return Object.assign({ url: '', key: '', auto: true }, JSON.parse(localStorage.getItem(GAS_KEY) || '{}')); } catch (e) { return { url: '', key: '', auto: true }; } }
function gasSave(c) { try { localStorage.setItem(GAS_KEY, JSON.stringify(c)); } catch (e) { /* 空間不足時這次不記 */ } }
function gasHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return s.length + ':' + h; }
function gasDevice() { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : '其他'; }

async function gasCall(body, c = gasCfg()) {
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(c.url)) throw new Error('網址要是 https://script.google.com/… 開頭');
  // 用 text/plain 送出，瀏覽器不會先發預檢請求，Apps Script 才收得到
  const r = await fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: c.key, ...body }) });
  const txt = await r.text();
  let o; try { o = JSON.parse(txt); } catch (e) { throw new Error(/<html/i.test(txt) ? '連不上：部署時「誰可以存取」要選「所有人」' : '回應格式不對'); }
  if (!o.ok) throw new Error(o.error || '失敗');
  return o;
}

async function gasBackup(quiet) {
  const c = gasCfg();
  if (!c.url || !c.key) { if (!quiet) toast('先填網址和密碼'); return; }
  const json = JSON.stringify(S), h = gasHash(json);
  if (quiet && h === c.hash) return;
  try {
    const o = await gasCall({ action: 'backup', device: gasDevice(), ver: typeof APP_VER !== 'undefined' ? APP_VER : '', data: S }, c);
    Object.assign(c, { last: Date.now(), hash: h, err: '' }); gasSave(c);
    S.lastExport = Date.now(); save();
    if (!quiet) toast(`已備份到 Google 試算表（${Math.round(o.size / 1024)} KB）`);
  } catch (e) {
    c.err = e.message; gasSave(c);
    if (!quiet) toast('備份失敗：' + e.message);
  }
  if (current === 'settings') render();
}

async function gasRestoreList() {
  let o;
  try { toast('讀取雲端備份…'); o = await gasCall({ action: 'list' }); } catch (e) { return toast('讀取失敗：' + e.message); }
  if (!o.items.length) return toast('雲端還沒有備份');
  openModal({
    title: '從 Google 試算表還原', noSave: true,
    body: `<p class="lead">選一份備份。還原會<b>取代這台裝置上目前的資料</b>，建議先按「立即備份」留一份現在的。</p>
      <div class="gas-list">${o.items.map(it => `<button type="button" class="gas-item" data-gas-get="${esc(it.id)}">
        <b>${esc(it.time)}</b><span>${esc(it.device || '')}・${Math.max(1, Math.round((+it.size || 0) / 1024))} KB${it.ver ? `・版本 ${esc(it.ver)}` : ''}</span></button>`).join('')}</div>`,
  });
}

let gasArmed = '';
async function gasRestore(id) {
  if (gasArmed !== id) { gasArmed = id; setTimeout(() => { if (gasArmed === id) gasArmed = ''; }, 4000); return toast('再按一次確認還原這份'); }
  gasArmed = '';
  try {
    toast('下載中…');
    const o = await gasCall({ action: 'get', id });
    S = Object.assign(defaultState(), o.data); if (S.macro) S.macro.fetching = false;
    const c = gasCfg(); c.hash = gasHash(JSON.stringify(S)); gasSave(c);
    save(); $('#modal').close(); toast(`已還原 ${o.time} 的備份`); go('home');
  } catch (e) { toast('還原失敗：' + e.message); }
}

function gasAgo(t) {
  if (!t) return '還沒備份過';
  const m = Math.round((Date.now() - t) / 6e4);
  return m < 1 ? '剛剛' : m < 60 ? `${m} 分鐘前` : m < 1440 ? `${Math.round(m / 60)} 小時前` : `${Math.round(m / 1440)} 天前`;
}

function gasCardHTML() {
  const c = gasCfg(), on = c.url && c.key;
  return `<div class="card"><h3 class="gold-bar">☁️ Google 試算表備份</h3>
    ${on ? `<p class="lead">上次備份：<b>${gasAgo(c.last)}</b>${c.err ? `<br><span style="color:var(--rise)">上次失敗：${esc(c.err)}</span>` : ''}</p>` :
      `<p class="lead">資料會存到你自己 Google 帳號裡的試算表，換手機也能還原。設定一次就好：</p>
      <ol class="gas-steps">
        <li>開一個新的 Google 試算表 →「擴充功能」→「Apps Script」</li>
        <li>按下面「複製程式碼」，貼上取代原本內容，把 <code>PASSWORD</code> 改成你自己的密碼</li>
        <li>「部署」→「新增部署作業」→ 網頁應用程式；執行身分「我」、存取權「所有人」</li>
        <li>授權後複製結尾是 <code>/exec</code> 的網址，連同密碼填在下面</li>
      </ol>`}
    <label class="f"><span>Apps Script 網址</span><input type="url" id="gasUrl" value="${esc(c.url)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
    <label class="f"><span>密碼（和程式碼裡的 PASSWORD 一樣）</span><input type="password" id="gasKey" value="${esc(c.key)}" autocomplete="off"></label>
    <label class="gas-auto"><input type="checkbox" id="gasAuto" ${c.auto ? 'checked' : ''}> 自動備份（打開或離開 App 時，有改過資料才傳）</label>
    <div class="btn-row">
      <button class="btn-primary" id="gasNow">立即備份</button>
      <button class="btn-ghost" id="gasRestoreBtn">從雲端還原</button>
      <button class="btn-ghost" id="gasCode">複製程式碼</button>
      ${on ? '<button class="btn-ghost" id="gasTest">測試連線</button>' : ''}
    </div>
    <div class="help" style="margin-top:8px">試算表會留最近 30 份備份，另外把交易、帳戶、記帳、研究卡等整理成好讀的分頁。網址和密碼只存在這台裝置。</div>
  </div>`;
}

{
  const base = PAGES.settings;
  PAGES.settings = () => { gasLoadCode(); return base().replace('<div class="card"><h3 class="gold-bar">安裝到手機</h3>', gasCardHTML() + '<div class="card"><h3 class="gold-bar">安裝到手機</h3>'); };
}
// 先把程式碼抓好，按「複製」時才能直接寫入剪貼簿（iPhone 不允許等待網路後才複製）
let gasCodeTxt = '';
function gasLoadCode() { if (!gasCodeTxt) fetch('apps-script/backup.gs', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => { gasCodeTxt = t; }).catch(() => {}); }

document.addEventListener('change', e => {
  const t = e.target; if (!/^gas(Url|Key|Auto)$/.test(t.id || '')) return;
  const c = gasCfg();
  if (t.id === 'gasUrl') c.url = t.value.trim();
  if (t.id === 'gasKey') c.key = t.value;
  if (t.id === 'gasAuto') c.auto = t.checked;
  c.err = ''; gasSave(c);
});

document.addEventListener('click', async e => {
  const g = e.target.closest('[data-gas-get]');
  if (g) return gasRestore(g.dataset.gasGet);
  const t = e.target.closest('#gasNow,#gasRestoreBtn,#gasCode,#gasTest');
  if (!t) return;
  // 輸入框還沒失焦時，先把目前的值存起來
  const c = gasCfg(), u = $('#gasUrl'), k = $('#gasKey');
  if (u) c.url = u.value.trim(); if (k) c.key = k.value; gasSave(c);
  if (t.id === 'gasNow') { t.disabled = true; t.textContent = '備份中…'; return gasBackup(false); }
  if (t.id === 'gasRestoreBtn') return gasRestoreList();
  if (t.id === 'gasTest') { try { const o = await gasCall({ action: 'ping' }); toast(`連線成功：${o.name || '試算表'}`); } catch (er) { toast('連線失敗：' + er.message); } return; }
  if (t.id === 'gasCode') {
    if (gasCodeTxt) copy(gasCodeTxt); else { gasLoadCode(); toast('程式碼還在下載，請再按一次'); }
  }
});

// 自動備份：打開 App 後、或切到背景時，距上次超過 12 小時（切背景時 1 小時）且資料有變才傳
function gasAuto(gap) {
  const c = gasCfg();
  if (!c.auto || !c.url || !c.key || !navigator.onLine) return;
  if (c.last && Date.now() - c.last < gap) return;
  gasBackup(true);
}
setTimeout(() => gasAuto(12 * 3600e3), 8000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') gasAuto(3600e3); });
