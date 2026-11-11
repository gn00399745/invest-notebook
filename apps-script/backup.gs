/**
 * AI 投資筆記：Google 試算表備份
 *
 * 安裝方式（只要做一次）：
 * 1. 開一個新的 Google 試算表 → 上方選單「擴充功能」→「Apps Script」
 * 2. 把這整段程式碼貼上，取代原本的內容
 * 3. 把下面 PASSWORD 改成你自己的密碼（App 裡要填一樣的）
 * 4. 右上角「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    執行身分：我　／　誰可以存取：所有人
 * 5. 按「部署」並授權，複製「網頁應用程式網址」（結尾是 /exec），貼到 App 的設定頁
 *
 * 之後改了程式碼要重新部署：「部署」→「管理部署作業」→ 編輯 → 版本選「新版本」。
 */
const PASSWORD = '請改成你自己的密碼';
const KEEP = 30;        // 保留最近幾份備份
const CHUNK = 45000;    // 每格最多 5 萬字，留一點空間
const DATA_SHEET = '_備份資料';

// 這些清單會另外整理成好讀的工作表（只放最新一份）
const READABLE = {
  trades: '交易紀錄', accounts: '帳戶', ledger: '記帳', recurring: '固定收支',
  insurance: '保險', property: '房產', cards: '研究卡', reviews: '覆盤',
  monitors: '監控', claims: '待驗主張', etfs: 'ETF', positions: '產業定位',
};

function doGet() {
  return ContentService.createTextOutput('投資筆記備份服務運作中');
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: '格式錯誤' }); }
  if (!PASSWORD || PASSWORD === '請改成你自己的密碼') return out({ ok: false, error: '請先在 Apps Script 裡設定密碼並重新部署' });
  if (req.key !== PASSWORD) return out({ ok: false, error: '密碼不對' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (req.action === 'ping') return out({ ok: true, name: SpreadsheetApp.getActive().getName() });
    if (req.action === 'backup') return out(backup(req));
    if (req.action === 'list') return out(list());
    if (req.action === 'get') return out(getOne(req.id));
    return out({ ok: false, error: '未知的動作' });
  } catch (err) {
    return out({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function dataSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.getRange(1, 1, 1, 6).setValues([['時間', '編號', '裝置', '版本', '字數', '內容（分段）']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function backup(req) {
  const json = JSON.stringify(req.data || {});
  const sh = dataSheet();
  const id = Utilities.getUuid().slice(0, 8);
  const time = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  // 每段前面加 ~，避免試算表把內容當成公式或數字
  const parts = [];
  for (let i = 0; i < json.length; i += CHUNK) parts.push('~' + json.slice(i, i + CHUNK));
  const row = ['~' + time, '~' + id, '~' + (req.device || ''), '~' + (req.ver || ''), json.length].concat(parts);
  sh.insertRowAfter(1);
  const rg = sh.getRange(2, 1, 1, row.length);
  rg.setNumberFormat('@');
  rg.setValues([row]);
  const last = sh.getLastRow();
  if (last > KEEP + 1) sh.deleteRows(KEEP + 2, last - KEEP - 1);
  try { writeReadable(req.data || {}); } catch (err) { /* 好讀版失敗不影響備份本身 */ }
  return { ok: true, id: id, time: time, size: json.length };
}

function list() {
  const sh = dataSheet();
  const n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, items: [] };
  const v = sh.getRange(2, 1, n, 5).getValues();
  return { ok: true, items: v.map(r => ({ time: strip(r[0]), id: strip(r[1]), device: strip(r[2]), ver: strip(r[3]), size: r[4] })) };
}

function getOne(id) {
  const sh = dataSheet();
  const n = sh.getLastRow() - 1;
  if (n < 1) return { ok: false, error: '還沒有任何備份' };
  const ids = sh.getRange(2, 2, n, 1).getValues().map(r => strip(r[0]));
  const i = id ? ids.indexOf(id) : 0;
  if (i < 0) return { ok: false, error: '找不到這份備份' };
  const width = sh.getLastColumn();
  const r = sh.getRange(i + 2, 1, 1, width).getValues()[0];
  const json = r.slice(5).filter(x => x !== '').map(strip).join('');
  return { ok: true, time: strip(r[0]), id: strip(r[1]), data: JSON.parse(json) };
}

function strip(x) {
  x = String(x);
  return x.charAt(0) === '~' ? x.slice(1) : x;
}

// 把常用清單整理成一般表格，方便直接在試算表裡看
function writeReadable(data) {
  const ss = SpreadsheetApp.getActive();
  Object.keys(READABLE).forEach(key => {
    const rows = Array.isArray(data[key]) ? data[key] : [];
    let sh = ss.getSheetByName(READABLE[key]);
    if (!rows.length) { if (sh) sh.clear(); return; }
    if (!sh) sh = ss.insertSheet(READABLE[key]);
    const cols = [];
    rows.forEach(o => Object.keys(o || {}).forEach(k => { if (cols.indexOf(k) < 0) cols.push(k); }));
    const vals = [cols].concat(rows.map(o => cols.map(k => cell(o ? o[k] : ''))));
    sh.clear();
    sh.getRange(1, 1, vals.length, cols.length).setNumberFormat('@').setValues(vals);
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
}

function cell(v) {
  if (v == null) return '';
  if (typeof v === 'object') v = Array.isArray(v) && v.every(x => typeof x !== 'object') ? v.join('、') : JSON.stringify(v);
  v = String(v);
  if (v.length > CHUNK) v = v.slice(0, CHUNK) + '…';
  return v.charAt(0) === '=' ? "'" + v : v;
}
