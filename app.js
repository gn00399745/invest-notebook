/* AI 投資筆記 — 依「AI 投資分析架構」八分頁 + 策略頁 */
'use strict';

const STORE_KEY = 'invest-notebook-v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : null; };
const fmt = (n, d = 0) => n == null || !isFinite(n) ? '—' : n.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n, d = 1) => n == null || !isFinite(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(d) + '%';

/* ---------- 預設資料 ---------- */
const MACRO_INDICATORS = [
  ['CPI（含核心）', '消費者物價；高於預期→升息壓力、壓抑估值'],
  ['PPI', '生產端成本；領先 CPI，影響企業毛利'],
  ['核心 PCE', 'Fed 主要參考的通膨指標'],
  ['非農就業', '就業動能；過熱→降息延後'],
  ['失業率', '上升過快→衰退風險'],
  ['初領失業金', '週頻，最快反映就業轉弱'],
  ['聯邦基金利率', '資金成本基準'],
  ['美國 10 年期公債殖利率', '估值折現率；上升壓成長股'],
  ['美元兌新台幣', '台幣貶→出口股受惠、外資可能匯出'],
  ['台灣景氣對策信號', '國發會燈號，判斷台灣景氣位置'],
  ['台灣出口年增率', '電子供應鏈需求的即時溫度計'],
];
const LAYERS = [
  ['終端需求與變現', '企業與消費者付費使用 AI 應用', '整條鏈的金流源頭'],
  ['模型與 AI 實驗室', '訓練與提供大型模型', '少數實驗室主導'],
  ['AI 平台與雲端', '建資料中心、出租算力', '雲端資本支出是上游營收的領先訊號'],
  ['資料中心與系統整合', '伺服器、機櫃組裝與整合', ''],
  ['網通與光通訊', '交換器、光模組、高速傳輸', ''],
  ['電力與散熱', '供電、液冷、機電', '留意供電是否限制建置速度'],
  ['AI 晶片設計', 'GPU、客製化 ASIC', ''],
  ['記憶體', 'HBM 等高頻寬記憶體', '物理瓶頸：HBM'],
  ['先進封裝', '晶片與記憶體整合封裝', '物理瓶頸：先進封裝'],
  ['晶圓代工', '先進製程製造', '物理瓶頸：先進製程'],
  ['半導體設備', '微影、蝕刻、量測設備', ''],
  ['材料與零組件', '晶圓、化學品、載板', ''],
];
const DIMENSIONS = ['產業位置', '財報體質', '管理層指引', '估值位置', '技術面', '籌碼／資金'];
const FIN_ROWS = [['營收', 'amt'], ['毛利率', 'pct'], ['營業利益率', 'pct'], ['EPS', 'amt'], ['營業現金流', 'amt'], ['自由現金流', 'amt'], ['資本支出', 'amt'], ['存貨', 'amt']];
const TECH_ROWS = ['趨勢（均線排列）', 'RSI', 'MACD', '布林通道', '型態（W 底、M 頭等）', '支撐／壓力', '量價分佈'];
const CHIP_ROWS = ['外資買賣超', '投信買賣超', '自營商買賣超', '融資餘額變化', '融券餘額變化', '主力分點集中度', '大股東持股增減'];
const VAL_ROWS = ['相對估值（本益比、EV/EBITDA 對同業）', '現金流折現 DCF', '分析師共識'];

function defaultState() {
  return {
    macro: {
      rows: MACRO_INDICATORS.map(([name, hint]) => ({ name, hint, latest: '', prev: '', implication: '', next: '' })),
      fedNote: '', growth: '', inflation: '', keywords: '',
    },
    events: [], impacts: [],
    layers: LAYERS.map(() => ''),
    positions: [], cards: [],
    etfs: [], etfAlloc: {}, etfLog: [], etfEnv: '',
    alloc: [
      { name: '台股', target: 40, value: '' },
      { name: '美股', target: 30, value: '' },
      { name: '債券', target: 20, value: '' },
      { name: '現金', target: 10, value: '' },
    ],
    rules: '1. 每筆交易最大虧損不超過總資金 1%\n2. 進場前先寫下「證明我錯的條件」\n3. 單一個股不超過總資產 10%\n4. 配置偏離目標超過 5 個百分點才再平衡',
    monitors: [], claims: [], reviews: [],
    report: { watchlist: '', content: '當天公布財報的關注公司、台股籌碼摘要、隔日美股與匯率', schedule: '' },
    backtest: {},
  };
}

let S = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return defaultState();
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast('儲存失敗：瀏覽器空間不足'); }
  }, 150);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('已複製到剪貼簿'); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('已複製'); }
}

/* ---------- 通用：記錄清單 + 編輯視窗 ---------- */
const SCHEMAS = {
  events: { title: '行事曆事件', fields: [
    { k: 'date', l: '日期', t: 'date' }, { k: 'event', l: '事件' },
    { k: 'type', l: '類型', t: 'select', o: ['財報', '經濟數據', '央行', '法說會', '除權息', '其他'] },
    { k: 'targets', l: '影響我的哪些標的' }],
    head: r => r.event, meta: r => `${r.date || ''} · ${r.type || ''}`, body: r => r.targets, sort: (a, b) => (a.date || '').localeCompare(b.date || '') },
  impacts: { title: '事件衝擊拆解', fields: [
    { k: 'event', l: '事件' }, { k: 'path', l: '傳導路徑', t: 'textarea' }, { k: 'exposure', l: '受影響部位' },
    { k: 'trigger', l: '觸發我行動的條件' }, { k: 'watch', l: '觀察指標' }],
    head: r => r.event, meta: r => r.exposure, body: r => [r.path && '路徑：' + r.path, r.trigger && '觸發：' + r.trigger, r.watch && '觀察：' + r.watch].filter(Boolean).join('\n') },
  positions: { title: '標的卡位紀錄', fields: [
    { k: 'company', l: '公司' }, { k: 'layer', l: '所在層', t: 'select', o: LAYERS.map((l, i) => `${i + 1} ${l[0]}`) },
    { k: 'revenueFrom', l: '收入來自哪層的支出' }, { k: 'capacityBy', l: '產能受哪層限制' },
    { k: 'leading', l: '領先指標' }, { k: 'updated', l: '更新日', t: 'date', d: today }],
    head: r => r.company, meta: r => `${r.layer || ''} · ${r.updated || ''}`, body: r => [r.revenueFrom && '收入←' + r.revenueFrom, r.capacityBy && '產能受限：' + r.capacityBy, r.leading && '領先：' + r.leading].filter(Boolean).join('　') },
  monitors: { title: '監控條件', fields: [
    { k: 'target', l: '標的' }, { k: 'cond', l: '條件（白話）', t: 'textarea' }, { k: 'action', l: '觸發後我要做什麼', t: 'textarea' },
    { k: 'notify', l: '通知方式', t: 'select', o: ['手機推播', '券商到價提醒', 'Email', '盤後報告'] },
    { k: 'status', l: '狀態', t: 'select', o: ['啟用', '暫停', '已觸發'] }],
    head: r => r.target, meta: r => r.notify, badge: r => r.status, body: r => `條件：${r.cond || ''}\n動作：${r.action || ''}` },
  claims: { title: '待驗主張', fields: [
    { k: 'date', l: '登記日', t: 'date', d: today }, { k: 'claim', l: '主張', t: 'textarea' },
    { k: 'def', l: '事件定義（可量化）', t: 'textarea' }, { k: 'method', l: '驗證方式' },
    { k: 'status', l: '狀態', t: 'select', o: ['待驗', '確認', '證偽', '理由改寫'] }, { k: 'conclusion', l: '結論', t: 'textarea' }],
    head: r => r.claim, meta: r => r.date, badge: r => r.status, body: r => [r.def && '定義：' + r.def, r.method && '方法：' + r.method, r.conclusion && '結論：' + r.conclusion].filter(Boolean).join('\n') },
  reviews: { title: '覆盤紀錄', fields: [
    { k: 'date', l: '日期', t: 'date', d: today }, { k: 'target', l: '標的' },
    { k: 'decision', l: '決策', t: 'select', o: ['買進', '加碼', '減碼', '賣出', '觀望', '停損'] },
    { k: 'reason', l: '當時理由', t: 'textarea' }, { k: 'result', l: '結果', t: 'textarea' },
    { k: 'lesson', l: '學到什麼', t: 'textarea' },
    { k: 'writeback', l: '寫回哪個分頁', t: 'select', o: ['', '總經', '產業定位', '研究卡', 'ETF 健檢', '策略', '監控', '待驗主張'] }],
    head: r => `${r.target || ''}　${r.decision || ''}`, meta: r => r.date, body: r => [r.reason && '理由：' + r.reason, r.result && '結果：' + r.result, r.lesson && '教訓：' + r.lesson].filter(Boolean).join('\n'),
    sort: (a, b) => (b.date || '').localeCompare(a.date || '') },
  etfLog: { title: '健檢紀錄', fields: [
    { k: 'date', l: '日期', t: 'date', d: today }, { k: 'change', l: '與上次相比變了什麼', t: 'textarea' }, { k: 'action', l: '動作' }],
    head: r => r.date, body: r => `${r.change || ''}${r.action ? '\n動作：' + r.action : ''}`, sort: (a, b) => (b.date || '').localeCompare(a.date || '') },
};
const BADGE_COLOR = { 啟用: 'green', 暫停: '', 已觸發: 'gold', 待驗: 'yellow', 確認: 'green', 證偽: 'red', 理由改寫: 'gold' };

function fieldHTML(f, val) {
  const v = val ?? (f.d ? f.d() : '');
  const name = `name="${f.k}"`;
  let input;
  if (f.t === 'select') input = `<select ${name}>${f.o.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.t === 'textarea') input = `<textarea ${name}>${esc(v)}</textarea>`;
  else input = `<input type="${f.t || 'text'}" ${name} value="${esc(v)}">`;
  return `<label class="f"><span>${esc(f.l)}</span>${input}</label>`;
}

function openModal({ title, body, onSave, onDelete, saveText = '儲存' }) {
  const dlg = $('#modal');
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#modalSave').textContent = saveText;
  $('#modalDelete').hidden = !onDelete;
  $('#modalDelete').onclick = () => { if (confirmInline()) { onDelete(); dlg.close(); render(); } };
  $('#modalCancel').onclick = () => dlg.close();
  $('#modalForm').onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData($('#modalForm')).entries());
    if (onSave(data, $('#modalBody')) !== false) { dlg.close(); save(); render(); }
  };
  dlg.showModal();
}
let delArmed = 0;
function confirmInline() {
  // 避免瀏覽器 confirm 對話框：第一次點擊提示，3 秒內再點一次才刪除
  if (Date.now() - delArmed < 3000) { delArmed = 0; return true; }
  delArmed = Date.now(); toast('再按一次「刪除」確認'); return false;
}

function editRecord(key, id) {
  const sc = SCHEMAS[key];
  const list = S[key];
  const rec = id ? list.find(r => r.id === id) : null;
  openModal({
    title: (rec ? '編輯' : '新增') + sc.title,
    body: sc.fields.map(f => fieldHTML(f, rec?.[f.k])).join(''),
    onSave: data => { if (rec) Object.assign(rec, data); else list.push({ id: uid(), ...data }); toast('已儲存'); },
    onDelete: rec ? () => { S[key] = list.filter(r => r.id !== id); save(); toast('已刪除'); } : null,
  });
}

function recordList(key, emptyText = '尚無資料') {
  const sc = SCHEMAS[key];
  let list = [...S[key]];
  if (sc.sort) list.sort(sc.sort);
  const items = list.map(r => {
    const b = sc.badge?.(r);
    return `<div class="rec" data-edit="${key}" data-id="${r.id}">
      <div class="r-top"><span class="r-title">${esc(sc.head(r) || '（未命名）')}</span>${b ? `<span class="pill ${BADGE_COLOR[b] || ''}">${esc(b)}</span>` : ''}</div>
      ${sc.meta?.(r) ? `<div class="r-meta">${esc(sc.meta(r))}</div>` : ''}
      ${sc.body?.(r) ? `<div class="r-body">${esc(sc.body(r))}</div>` : ''}
    </div>`;
  }).join('');
  return items || `<div class="empty">${emptyText}</div>`;
}
const addBtn = (key, text = '＋ 新增') => `<button class="btn-small" data-add="${key}">${text}</button>`;

/* ---------- 頁面 ---------- */
const PAGES = {};

PAGES.home = () => {
  const activeMon = S.monitors.filter(m => m.status === '啟用').length;
  const pending = S.claims.filter(c => !c.status || c.status === '待驗').length;
  const t = today();
  const upcoming = S.events.filter(e => (e.date || '') >= t).sort(SCHEMAS.events.sort).slice(0, 5);
  const q = quadrant();
  return `
  <h2>總覽</h2>
  <p class="lead">由上而下：先看總經環境，再看產業位置，最後用六面向研究個股。AI 負責整理與計算，決策權在你。</p>
  <div class="grid grid-4" style="margin-bottom:14px">
    <div class="stat" data-go="cards"><div class="num">${S.cards.length}</div><div class="lbl">公司研究卡</div></div>
    <div class="stat" data-go="monitor"><div class="num">${activeMon}</div><div class="lbl">啟用中的監控</div></div>
    <div class="stat" data-go="claims"><div class="num">${pending}</div><div class="lbl">待驗主張</div></div>
    <div class="stat" data-go="review"><div class="num">${S.reviews.length}</div><div class="lbl">覆盤紀錄</div></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-head"><h3 class="gold-bar">目前總經象限</h3><button class="btn-small ghost" data-go="macro">更新</button></div>
      ${q ? `<div class="big" style="font-size:20px;font-weight:700">${q.name}</div><div class="lead" style="margin:4px 0 0">${q.desc}</div>` : '<div class="empty">尚未判斷。到「總經」頁選擇成長與通膨方向。</div>'}
      ${S.macro.fedNote ? `<div class="note">Fed 判讀：${esc(S.macro.fedNote)}</div>` : ''}
    </div>
    <div class="card">
      <div class="card-head"><h3 class="gold-bar">近期行事曆</h3><button class="btn-small ghost" data-go="macro">全部</button></div>
      ${upcoming.length ? upcoming.map(e => `<div class="rec" data-edit="events" data-id="${e.id}"><div class="r-top"><span class="r-title">${esc(e.event)}</span><span class="pill">${esc(e.type || '')}</span></div><div class="r-meta">${esc(e.date)}${e.targets ? ' · ' + esc(e.targets) : ''}</div></div>`).join('') : '<div class="empty">沒有即將到來的事件</div>'}
    </div>
  </div>
  <div class="card">
    <h3 class="gold-bar">個股研究標準流程（七步）</h3>
    <ol class="steps">
      <li><b>確認總經環境</b><small>利率、通膨、景氣位置對這檔股票是順風還是逆風</small></li>
      <li><b>產業定位</b><small>公司站在供應鏈哪一層？收入來自誰的支出、產能受誰限制</small></li>
      <li><b>財報事實</b><small>只填原始文件數字，找出頭條與真實體質的落差</small></li>
      <li><b>法說會</b><small>管理層指引、關鍵原話（標日期），轉成估值假設</small></li>
      <li><b>估值三法交叉</b><small>相對估值、DCF、分析師共識；差距大就檢查最脆弱的假設</small></li>
      <li><b>技術面與籌碼</b><small>趨勢、指標、型態；外資投信、融資券、大股東</small></li>
      <li><b>結論與監控</b><small>白話結論、證明我錯的條件、部位大小，並寫入監控條件</small></li>
    </ol>
  </div>
  <div class="card">
    <h3 class="gold-bar">筆記紀律</h3>
    <ul style="margin:0;padding-left:20px;font-size:14px">
      <li>事實、引述、判讀分開寫。</li>
      <li>每個數字都要能追溯到來源文件與日期。</li>
      <li>還沒驗證的想法先登記到「待驗主張」，不直接拿來下判斷。</li>
      <li>ETF 每季健檢一次；每次決策都留一行覆盤。</li>
    </ul>
  </div>
  <div class="card links">
    <h3 class="gold-bar">常用資料來源</h3>
    <a href="https://mops.twse.com.tw/" target="_blank" rel="noopener">公開資訊觀測站</a>
    <a href="https://www.twse.com.tw/zh/trading/foreign/bfi82u.html" target="_blank" rel="noopener">三大法人買賣金額</a>
    <a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noopener">SEC EDGAR</a>
    <a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener">FRED 經濟數據</a>
    <a href="https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm" target="_blank" rel="noopener">FOMC 會議日程</a>
    <a href="https://index.ndc.gov.tw/" target="_blank" rel="noopener">國發會景氣指標</a>
    <a href="https://www.cbc.gov.tw/" target="_blank" rel="noopener">中央銀行</a>
  </div>`;
};

/* 總經 */
const QUADS = {
  '上升|下降': { name: '復甦（成長↑ 通膨↓）', desc: '企業獲利改善、利率壓力小。股票整體順風，成長股與景氣循環股通常表現較佳。', tilt: '偏多股票；成長、半導體、循環股；債券中性' },
  '上升|上升': { name: '過熱（成長↑ 通膨↑）', desc: '需求強但央行可能緊縮。原物料、價值股、金融較抗壓，高估值成長股與長債承壓。', tilt: '股票中性偏多但偏價值；縮短債券天期；可配原物料' },
  '下降|上升': { name: '停滯性通膨（成長↓ 通膨↑）', desc: '最難的環境：獲利下修又難降息。現金、短債與抗通膨資產相對有利，控制槓桿與部位。', tilt: '降低股票比重；提高現金與短債；避開高估值' },
  '下降|下降': { name: '衰退（成長↓ 通膨↓）', desc: '央行轉向寬鬆。長天期公債與防禦型股票（公用、必需消費、高股息）相對有利，等待復甦訊號。', tilt: '提高長債與防禦股；分批布局優質成長股' },
};
function quadrant() { return QUADS[`${S.macro.growth}|${S.macro.inflation}`] || null; }
function dirOf(r) {
  const a = num(r.latest), b = num(r.prev);
  if (a == null || b == null) return '';
  return a > b ? '<span class="up">▲</span>' : a < b ? '<span class="down">▼</span>' : '＝';
}
PAGES.macro = () => `
  <h2>總經與行事曆</h2>
  <p class="lead">重點不在數字高低，而在它怎麼影響利率與你的部位。每月數據公布後更新一次，並寫一句 Fed 判讀。</p>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">指標追蹤</h3><button class="btn-small ghost" data-ai="macro">產生 AI 更新提示</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>指標</th><th>最新值</th><th>前值</th><th>方向</th><th>對利率／市場的意涵</th><th>下次公布</th></tr></thead>
      <tbody>${S.macro.rows.map((r, i) => `<tr>
        <td><b>${esc(r.name)}</b><div class="r-meta" style="font-size:11px;color:var(--muted)">${esc(r.hint || '')}</div></td>
        <td><input data-macro="${i}" data-f="latest" value="${esc(r.latest)}" style="width:80px"></td>
        <td><input data-macro="${i}" data-f="prev" value="${esc(r.prev)}" style="width:80px"></td>
        <td class="dir" data-dir="${i}">${dirOf(r)}</td>
        <td><input data-macro="${i}" data-f="implication" value="${esc(r.implication)}" style="min-width:160px"></td>
        <td><input type="date" data-macro="${i}" data-f="next" value="${esc(r.next)}"></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="note">CPI 看消費者物價，PPI 看生產端成本，PCE 是 Fed 主要參考的通膨指標。</div>
    <label class="f"><span>本月 Fed 判讀（一句話）</span><input type="text" data-bind="macro.fedNote" value="${esc(S.macro.fedNote)}"></label>
  </div>
  <div class="card">
    <h3 class="gold-bar">景氣象限判斷</h3>
    <div class="inline">
      <label class="f"><span>經濟成長動能</span><select data-bind="macro.growth">${['', '上升', '下降'].map(o => `<option ${o === S.macro.growth ? 'selected' : ''} value="${o}">${o || '請選擇'}</option>`).join('')}</select></label>
      <label class="f"><span>通膨趨勢</span><select data-bind="macro.inflation">${['', '上升', '下降'].map(o => `<option ${o === S.macro.inflation ? 'selected' : ''} value="${o}">${o || '請選擇'}</option>`).join('')}</select></label>
    </div>
    ${quadHTML()}
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">行事曆</h3>${addBtn('events')}</div>
    ${recordList('events', '尚無事件。新增財報、經濟數據、央行會議等日期。')}
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">事件衝擊拆解</h3>${addBtn('impacts')}</div>
    <p class="lead" style="margin-bottom:8px">遇到地緣衝突或政策轉向，先拆出風險怎麼傳到部位，再決定要不要動。</p>
    ${recordList('impacts')}
  </div>
  <div class="card">
    <h3 class="gold-bar">新聞過濾關鍵字</h3>
    <label class="f"><span>只追蹤與持股及關注產業相關的關鍵字（逗號或換行分隔）</span><textarea data-bind="macro.keywords">${esc(S.macro.keywords)}</textarea></label>
  </div>`;
function quadHTML() {
  const k = `${S.macro.growth}|${S.macro.inflation}`;
  const cell = key => { const q = QUADS[key]; return `<div class="${k === key ? 'on' : ''}"><b>${q.name}</b>${q.tilt}</div>`; };
  return `<div class="quad" id="quad">${cell('上升|上升')}${cell('上升|下降')}${cell('下降|上升')}${cell('下降|下降')}</div>`;
}

/* 產業定位 */
PAGES.industry = () => `
  <h2>產業定位</h2>
  <p class="lead">投資前先確認公司站在哪一層：收入來自哪一層的支出，產能又受哪一層限制。需求與金流由第 1 層往下拉動。</p>
  <div class="card">
    <h3 class="gold-bar">AI 供應鏈十二層</h3>
    ${LAYERS.map(([nm, ds, bn], i) => `<div class="layer"><div class="n">${i + 1}</div><div>
      <div class="nm">${esc(nm)}</div><div class="ds">${esc(ds)}</div>${bn ? `<div class="bn">${esc(bn)}</div>` : ''}
      <input type="text" placeholder="我關注的公司" data-layer="${i}" value="${esc(S.layers[i] || '')}">
    </div></div>`).join('')}
    <div class="note">層別依課程公開的供應鏈關鍵字自擬，可依你的持股調整。上層支出（例如雲端資本支出）轉向時，先看它沿哪條路徑往下傳到哪幾層。</div>
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">標的卡位紀錄</h3>${addBtn('positions')}</div>
    ${recordList('positions')}
  </div>`;

/* 公司研究卡 */
function blankCard() {
  return {
    id: uid(), code: '', name: '', market: '台股', layer: '', date: today(), price: '',
    lights: DIMENSIONS.map(() => ({ c: '', note: '' })),
    fin: FIN_ROWS.map(() => ({ cur: '', prev: '', src: '' })), finGap: '',
    guidance: '', quotes: '', qa: '', assumptions: '',
    val: VAL_ROWS.map(() => ({ assume: '', fair: '', note: '' })), valCheck: '',
    tech: TECH_ROWS.map(() => ({ read: '', judge: '' })),
    chip: CHIP_ROWS.map(() => ({ d5: '', d20: '', judge: '' })),
    verdict: '', thesis: '', wrongIf: '', action: '', monitored: '否',
  };
}
function lightsHTML(c) { return `<span class="lights">${c.lights.map(l => `<span class="light ${esc(l.c)}"></span>`).join('')}</span>`; }
function valSummary(c) {
  const fairs = c.val.map(v => num(v.fair)).filter(v => v != null);
  const avg = fairs.length ? fairs.reduce((a, b) => a + b, 0) / fairs.length : null;
  const p = num(c.price);
  return { avg, upside: avg != null && p ? (avg / p - 1) * 100 : null, min: fairs.length ? Math.min(...fairs) : null, max: fairs.length ? Math.max(...fairs) : null };
}
let openCardId = null;
PAGES.cards = () => {
  if (openCardId) { const c = S.cards.find(x => x.id === openCardId); if (c) return cardEditor(c); openCardId = null; }
  const list = [...S.cards].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
  <h2>公司研究卡</h2>
  <p class="lead">每研究一檔建一張卡。先填事實，再填判讀，最後才寫結論。</p>
  <div class="btn-row" style="margin-bottom:12px"><button class="btn-primary" id="newCard">＋ 新增研究卡</button></div>
  ${list.length ? list.map(c => {
    const g = c.lights.filter(l => l.c === '綠').length, r = c.lights.filter(l => l.c === '紅').length;
    const vs = valSummary(c);
    return `<div class="rec" data-card="${c.id}">
      <div class="r-top"><span class="r-title">${esc(c.code)} ${esc(c.name)}</span>${lightsHTML(c)}</div>
      <div class="r-meta">${esc(c.market)} · ${esc(c.layer || '未定位')} · ${esc(c.date)}　綠 ${g} / 紅 ${r}${vs.upside != null ? `　合理價均值 ${fmt(vs.avg, 1)}（${pct(vs.upside)}）` : ''}</div>
      ${c.verdict ? `<div class="r-body">${esc(c.verdict)}</div>` : ''}
    </div>`;
  }).join('') : '<div class="card empty">還沒有研究卡。按上方按鈕建立第一張。</div>'}`;
};
function cardEditor(c) {
  const vs = valSummary(c);
  const inp = (path, v, attrs = '') => `<input type="text" data-card-f="${path}" value="${esc(v)}" ${attrs}>`;
  const ta = (path, v, ph = '') => `<textarea data-card-f="${path}" placeholder="${esc(ph)}">${esc(v)}</textarea>`;
  return `
  <div class="btn-row" style="margin-bottom:10px">
    <button class="btn-small ghost" id="backCards">← 返回清單</button><span class="spacer"></span>
    <button class="btn-small ghost" data-ai="card">產生 AI 研究提示</button>
    <button class="btn-small ghost" id="cardMd">匯出 Markdown</button>
    <button class="btn-danger btn-small" id="delCard" style="background:transparent">刪除</button>
  </div>
  <h2>${esc(c.code || '新研究卡')} ${esc(c.name)}</h2>
  <div class="card">
    <div class="inline">
      <label class="f"><span>代號</span>${inp('code', c.code)}</label>
      <label class="f"><span>名稱</span>${inp('name', c.name)}</label>
      <label class="f"><span>市場</span><select data-card-f="market">${['台股', '美股', '其他'].map(o => `<option ${o === c.market ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="f"><span>所在層</span><select data-card-f="layer"><option value="">—</option>${LAYERS.map((l, i) => { const v = `${i + 1} ${l[0]}`; return `<option ${v === c.layer ? 'selected' : ''}>${v}</option>`; }).join('')}<option ${c.layer === '非 AI 供應鏈' ? 'selected' : ''}>非 AI 供應鏈</option></select></label>
      <label class="f"><span>研究日</span><input type="date" data-card-f="date" value="${esc(c.date)}"></label>
      <label class="f"><span>目前股價</span>${inp('price', c.price, 'inputmode="decimal"')}</label>
    </div>
  </div>
  <div class="card">
    <h3 class="gold-bar">六面向燈號</h3>
    <div class="tbl-wrap"><table><thead><tr><th>面向</th><th>燈號</th><th>一句話判讀</th></tr></thead><tbody>
    ${DIMENSIONS.map((d, i) => `<tr><td><b>${d}</b></td><td><select data-card-f="lights.${i}.c">${['', '綠', '黃', '紅'].map(o => `<option ${o === c.lights[i].c ? 'selected' : ''} value="${o}">${o || '—'}</option>`).join('')}</select></td><td>${inp(`lights.${i}.note`, c.lights[i].note)}</td></tr>`).join('')}
    </tbody></table></div>
  </div>
  <div class="card">
    <h3 class="gold-bar">一、財報事實</h3>
    <p class="lead" style="margin-bottom:6px">來源：美股 10-Q／10-K／8-K；台股公開資訊觀測站。只填原始文件的數字。</p>
    <div class="tbl-wrap"><table><thead><tr><th>指標</th><th>本期</th><th>去年同期</th><th class="num">年增</th><th>來源與日期</th></tr></thead><tbody>
    ${FIN_ROWS.map(([nm, kind], i) => { const f = c.fin[i]; return `<tr><td>${nm}${kind === 'pct' ? '（%）' : ''}</td><td>${inp(`fin.${i}.cur`, f.cur, 'inputmode="decimal" style="width:90px"')}</td><td>${inp(`fin.${i}.prev`, f.prev, 'inputmode="decimal" style="width:90px"')}</td><td class="num" data-yoy="${i}">${yoy(f, kind)}</td><td>${inp(`fin.${i}.src`, f.src)}</td></tr>`; }).join('')}
    </tbody></table></div>
    <label class="f" style="margin-top:8px"><span>頭條數字與真實體質的落差（例如獲利創高但現金流轉負）</span>${ta('finGap', c.finGap)}</label>
  </div>
  <div class="card">
    <h3 class="gold-bar">二、法說會</h3>
    <label class="f"><span>管理層指引（營收、毛利率區間；上修或下修多少）</span>${ta('guidance', c.guidance)}</label>
    <label class="f"><span>關鍵原話（標日期）</span>${ta('quotes', c.quotes)}</label>
    <label class="f"><span>分析師問答重點</span>${ta('qa', c.qa)}</label>
    <label class="f"><span>轉成估值假設</span>${ta('assumptions', c.assumptions)}</label>
  </div>
  <div class="card">
    <h3 class="gold-bar">三、估值（三法交叉）</h3>
    <div class="tbl-wrap"><table><thead><tr><th>方法</th><th>關鍵假設</th><th>合理價</th><th>備註</th></tr></thead><tbody>
    ${VAL_ROWS.map((nm, i) => `<tr><td>${nm}</td><td>${inp(`val.${i}.assume`, c.val[i].assume)}</td><td>${inp(`val.${i}.fair`, c.val[i].fair, 'inputmode="decimal" style="width:90px"')}</td><td>${inp(`val.${i}.note`, c.val[i].note)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="result" id="valResult">${valResultHTML(c, vs)}</div>
    <label class="f" style="margin-top:8px"><span>三法差距很大時，先檢查哪個假設最脆弱</span>${ta('valCheck', c.valCheck)}</label>
  </div>
  <div class="card">
    <h3 class="gold-bar">四、技術面</h3>
    <div class="tbl-wrap"><table><thead><tr><th>項目</th><th>讀數</th><th>判讀</th></tr></thead><tbody>
    ${TECH_ROWS.map((nm, i) => `<tr><td>${nm}</td><td>${inp(`tech.${i}.read`, c.tech[i].read)}</td><td>${inp(`tech.${i}.judge`, c.tech[i].judge)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="note">台股用還原股價計算，避免除權息造成失真。</div>
  </div>
  <div class="card">
    <h3 class="gold-bar">五、籌碼面（台股）</h3>
    <div class="tbl-wrap"><table><thead><tr><th>項目</th><th>近 5 日</th><th>近 20 日</th><th>判讀</th></tr></thead><tbody>
    ${CHIP_ROWS.map((nm, i) => `<tr><td>${nm}</td><td>${inp(`chip.${i}.d5`, c.chip[i].d5, 'style="width:90px"')}</td><td>${inp(`chip.${i}.d20`, c.chip[i].d20, 'style="width:90px"')}</td><td>${inp(`chip.${i}.judge`, c.chip[i].judge)}</td></tr>`).join('')}
    </tbody></table></div>
  </div>
  <div class="card">
    <h3 class="gold-bar">六、結論</h3>
    <label class="f"><span>白話結論（一句話）</span>${inp('verdict', c.verdict)}</label>
    <label class="f"><span>投資論點：為什麼是這家、為什麼是現在</span>${ta('thesis', c.thesis)}</label>
    <label class="f"><span>證明我錯的條件</span>${ta('wrongIf', c.wrongIf)}</label>
    <label class="f"><span>動作與部位大小（可用「策略」頁的部位計算器）</span>${ta('action', c.action)}</label>
    <div class="btn-row" style="align-items:center">
      <label class="f" style="margin:0;flex:1"><span>監控條件已寫入「監控」分頁</span><select data-card-f="monitored">${['否', '是'].map(o => `<option ${o === c.monitored ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <button class="btn-small" id="cardToMonitor">＋ 建立監控條件</button>
    </div>
  </div>`;
}
function yoy(f, kind) {
  const a = num(f.cur), b = num(f.prev);
  if (a == null || b == null) return '—';
  if (kind === 'pct') { const d = a - b; return `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d.toFixed(1)} pp</span>`; }
  if (b === 0) return '—';
  const g = (a / b - 1) * 100 * (b < 0 ? -1 : 1);
  return `<span class="${g >= 0 ? 'up' : 'down'}">${pct(g)}</span>`;
}
function valResultHTML(c, vs) {
  if (vs.avg == null) return '<span class="lead">填入合理價後自動計算平均與潛在空間。</span>';
  const spread = vs.min ? (vs.max / vs.min - 1) * 100 : null;
  return `<dl class="kv"><dt>三法合理價平均</dt><dd>${fmt(vs.avg, 2)}</dd>
    <dt>區間</dt><dd>${fmt(vs.min, 2)} ～ ${fmt(vs.max, 2)}</dd>
    <dt>相對目前股價</dt><dd class="${vs.upside >= 0 ? 'up' : 'down'}">${pct(vs.upside)}</dd>
    ${spread != null && spread > 30 ? `<dt>提醒</dt><dd class="down">三法差距 ${spread.toFixed(0)}%，請回頭檢查假設</dd>` : ''}</dl>`;
}
function setPath(obj, path, val) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}
function cardMarkdown(c) {
  const L = [];
  L.push(`# ${c.code} ${c.name}`, '', `市場：${c.market}｜所在層：${c.layer}｜研究日：${c.date}｜股價：${c.price}`, '', '## 六面向燈號');
  DIMENSIONS.forEach((d, i) => L.push(`- ${d}：${c.lights[i].c || '—'} ${c.lights[i].note}`));
  L.push('', '## 財報事實', '| 指標 | 本期 | 去年同期 | 來源 |', '|---|---|---|---|');
  FIN_ROWS.forEach(([n], i) => L.push(`| ${n} | ${c.fin[i].cur} | ${c.fin[i].prev} | ${c.fin[i].src} |`));
  L.push('', `落差：${c.finGap}`, '', '## 法說會', `- 指引：${c.guidance}`, `- 原話：${c.quotes}`, `- 問答：${c.qa}`, `- 估值假設：${c.assumptions}`);
  L.push('', '## 估值');
  VAL_ROWS.forEach((n, i) => L.push(`- ${n}：${c.val[i].fair}（${c.val[i].assume}）`));
  L.push('', '## 技術面'); TECH_ROWS.forEach((n, i) => L.push(`- ${n}：${c.tech[i].read} ${c.tech[i].judge}`));
  L.push('', '## 籌碼面'); CHIP_ROWS.forEach((n, i) => L.push(`- ${n}：5日 ${c.chip[i].d5}／20日 ${c.chip[i].d20} ${c.chip[i].judge}`));
  L.push('', '## 結論', `- 白話結論：${c.verdict}`, `- 論點：${c.thesis}`, `- 證明我錯：${c.wrongIf}`, `- 動作：${c.action}`);
  return L.join('\n');
}
function aiCardPrompt(c) {
  const id = `${c.code} ${c.name}`.trim() || '（請填入代號與名稱）';
  return `請依照我的「AI 投資分析架構」研究 ${id}（${c.market}）。

規則：
- 事實、引述、判讀分開寫；每個數字都要附來源文件與日期（美股用 10-Q/10-K/8-K，台股用公開資訊觀測站）。
- 找不到可靠來源的欄位留白並註明，不要推測。
- 不要給買賣建議，決策由我做。

請依序輸出：
1. 產業定位：在 AI 供應鏈十二層中的哪一層？收入來自哪一層的支出、產能受哪一層限制、領先指標。
2. 財報事實（最近一季 vs 去年同期）：營收、毛利率、營業利益率、EPS、營業現金流、自由現金流、資本支出、存貨；並指出頭條數字與真實體質的落差。
3. 法說會：管理層指引（區間與上下修）、關鍵原話（標日期）、分析師問答重點、可轉成的估值假設。
4. 估值三法：相對估值（本益比、EV/EBITDA 對同業）、DCF、分析師共識，各列關鍵假設與合理價。
5. 技術面：均線排列、RSI、MACD、布林通道、型態、支撐壓力、量價分佈（台股用還原股價）。
6. 籌碼面（台股）：外資、投信、自營商近 5／20 日買賣超，融資融券變化，主力分點集中度，大股東持股增減。
7. 六面向燈號建議（綠／黃／紅）各一句理由，以及「證明這個論點錯誤的條件」。

目前股價：${c.price || '（未填）'}；研究日：${c.date}。`;
}
function aiMacroPrompt() {
  return `請幫我更新以下總經指標的「最新值、前值、下次公布日期」，並各用一句話說明對利率與股市的意涵。每個數字附來源與公布日期，找不到就留白：
${S.macro.rows.map(r => `- ${r.name}`).join('\n')}

最後請：
1. 用一句話判讀 Fed 目前立場。
2. 判斷經濟成長動能與通膨趨勢各是「上升」或「下降」，並說明依據。
3. 列出未來兩週的重要經濟數據、央行會議與${S.macro.keywords ? `以下關鍵字相關（${S.macro.keywords.replace(/\n/g, '、')}）的` : ''}事件日期。`;
}

/* ETF 健檢 */
function parseHoldings(text) {
  const out = [];
  String(text || '').split(/\n/).forEach(line => {
    const m = line.trim().match(/^(.+?)[\s,，\t]+([\d.]+)\s*%?$/);
    if (m) out.push({ name: m[1].trim(), w: parseFloat(m[2]) });
  });
  return out;
}
function etfStats(e) {
  const h = parseHoldings(e.holdings).sort((a, b) => b.w - a.w);
  const top10 = h.slice(0, 10).reduce((s, x) => s + x.w, 0);
  const tot = h.reduce((s, x) => s + x.w, 0);
  const neff = tot ? 1 / h.reduce((s, x) => s + (x.w / 100) ** 2, 0) : null; // 以實際權重計算（未列出的成分視為極分散）
  return { h, top10, tot, neff };
}
function overlap(a, b) {
  const mb = new Map(parseHoldings(b.holdings).map(x => [x.name.toUpperCase(), x.w]));
  return parseHoldings(a.holdings).reduce((s, x) => s + Math.min(x.w, mb.get(x.name.toUpperCase()) || 0), 0);
}
PAGES.etf = () => {
  const etfs = S.etfs;
  const rows = etfs.map(e => { const st = etfStats(e); return `<tr data-etf="${e.id}" style="cursor:pointer">
    <td><b>${esc(e.name)}</b></td><td class="num">${st.h.length ? st.top10.toFixed(1) + '%' : '—'}</td>
    <td class="num">${st.neff ? st.neff.toFixed(1) : '—'}</td><td>${esc(e.sector || '')}</td><td>${esc(e.country || '')}</td><td class="num">${esc(e.fee || '')}</td></tr>`; }).join('');
  let pairs = '';
  for (let i = 0; i < etfs.length; i++) for (let j = i + 1; j < etfs.length; j++) {
    const o = overlap(etfs[i], etfs[j]);
    pairs += `<tr><td>${esc(etfs[i].name)} × ${esc(etfs[j].name)}</td><td class="num">${o.toFixed(1)}%</td><td>${o >= 50 ? '<span class="pill red">高度重疊</span>' : o >= 25 ? '<span class="pill yellow">中度重疊</span>' : '<span class="pill green">低</span>'}</td></tr>`;
  }
  // 整組合穿透
  const allocTot = etfs.reduce((s, e) => s + (num(S.etfAlloc[e.id]) || 0), 0);
  const merged = new Map();
  etfs.forEach(e => { const a = num(S.etfAlloc[e.id]) || 0; parseHoldings(e.holdings).forEach(x => {
    const k = x.name.toUpperCase(); const m = merged.get(k) || { name: x.name, w: 0, from: new Set() };
    m.w += a / (allocTot || 1) * x.w; m.from.add(e.name); merged.set(k, m); }); });
  const top = [...merged.values()].sort((a, b) => b.w - a.w).slice(0, 15);
  return `
  <h2>ETF 健檢</h2>
  <p class="lead">買了放著也要每季健檢一次：看穿成分股，確認幾檔 ETF 是不是同一份曝險買了好幾次，再對照當前利率與通膨環境。</p>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">單檔透視</h3><button class="btn-small" id="addEtf">＋ 新增 ETF</button></div>
    ${etfs.length ? `<div class="tbl-wrap"><table><thead><tr><th>ETF</th><th class="num">前十大權重</th><th class="num">有效檔數</th><th>主要產業</th><th>主要國家</th><th class="num">費用率</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">新增 ETF 並貼上成分股權重（每行「代號 權重%」）。</div>'}
    <div class="note">有效檔數 N = 1 ÷ Σ(權重²)，數字越小代表越集中。例如 N = 12 代表風險分散程度約等於平均持有 12 檔。</div>
  </div>
  ${etfs.length > 1 ? `<div class="card"><h3 class="gold-bar">多檔重疊度</h3>
    <div class="tbl-wrap"><table><thead><tr><th>比較組合</th><th class="num">個股加權重疊</th><th>結論</th></tr></thead><tbody>${pairs}</tbody></table></div>
    <div class="note">加權重疊 = Σ min(A 權重, B 權重)。超過 50% 代表兩檔大致是同一份曝險。</div></div>` : ''}
  ${etfs.length ? `<div class="card"><h3 class="gold-bar">整組合穿透</h3>
    <p class="lead" style="margin-bottom:6px">輸入每檔 ETF 在你投資組合中的比重（%），計算合併後的個股曝險。</p>
    <div class="inline">${etfs.map(e => `<label class="f"><span>${esc(e.name)} 比重 %</span><input type="number" inputmode="decimal" data-alloc="${e.id}" value="${esc(S.etfAlloc[e.id] ?? '')}"></label>`).join('')}</div>
    ${allocTot ? `<div class="tbl-wrap"><table><thead><tr><th>曝險項目</th><th class="num">合併權重</th><th>來自哪幾檔</th></tr></thead><tbody>
      ${top.map(m => `<tr><td>${esc(m.name)}</td><td class="num">${m.w.toFixed(2)}%</td><td>${esc([...m.from].join('、'))}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </div>` : ''}
  <div class="card"><h3 class="gold-bar">環境對照</h3>
    ${quadrant() ? `<div class="note">目前象限：<b>${quadrant().name}</b>　${quadrant().tilt}</div>` : '<div class="note">先到「總經」頁判斷景氣象限。</div>'}
    <label class="f"><span>哪些結構特徵正在承壓？整體是順風還是逆風？</span><textarea data-bind="etfEnv">${esc(S.etfEnv)}</textarea></label>
  </div>
  <div class="card"><div class="card-head"><h3 class="gold-bar">健檢紀錄</h3>${addBtn('etfLog')}</div>${recordList('etfLog')}</div>`;
};
function editEtf(id) {
  const e = id ? S.etfs.find(x => x.id === id) : null;
  const F = [{ k: 'name', l: 'ETF 代號／名稱' }, { k: 'sector', l: '主要產業' }, { k: 'country', l: '主要國家' }, { k: 'fee', l: '費用率' }];
  openModal({
    title: e ? '編輯 ETF' : '新增 ETF',
    body: F.map(f => fieldHTML(f, e?.[f.k])).join('') + `<label class="f"><span>成分股權重（每行「代號 權重%」，可直接從投信網站貼上）</span><textarea name="holdings" style="min-height:160px" placeholder="2330 45.2\n2317 5.1\n2454 4.3">${esc(e?.holdings || '')}</textarea></label>`,
    onSave: d => { if (e) Object.assign(e, d); else S.etfs.push({ id: uid(), ...d }); },
    onDelete: e ? () => { S.etfs = S.etfs.filter(x => x.id !== id); delete S.etfAlloc[id]; save(); } : null,
  });
}

/* 策略 */
PAGES.strategy = () => {
  const q = quadrant();
  const tot = S.alloc.reduce((s, a) => s + (num(a.value) || 0), 0);
  return `
  <h2>投資策略</h2>
  <p class="lead">把總經判斷轉成配置方向，用風險決定部位大小，定期再平衡。以下為計算工具與框架，決策由你做。</p>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">一、總經象限 → 配置方向</h3><button class="btn-small ghost" data-go="macro">調整判斷</button></div>
    ${q ? `<div class="result"><div class="big">${q.name}</div><div style="margin-top:4px">${q.desc}</div><div class="note">配置傾向：${q.tilt}</div></div>` : '<div class="empty">尚未判斷象限。</div>'}
    ${quadHTML()}
  </div>
  <div class="card">
    <h3 class="gold-bar">二、部位計算器（固定風險法）</h3>
    <div class="inline">
      <label class="f"><span>總資金</span><input type="number" inputmode="decimal" id="ps_cap" value="${esc(S.ps?.cap ?? '1000000')}"></label>
      <label class="f"><span>單筆可承受虧損 %</span><input type="number" inputmode="decimal" id="ps_risk" value="${esc(S.ps?.risk ?? '1')}"></label>
      <label class="f"><span>進場價</span><input type="number" inputmode="decimal" id="ps_entry" value="${esc(S.ps?.entry ?? '')}"></label>
      <label class="f"><span>停損價</span><input type="number" inputmode="decimal" id="ps_stop" value="${esc(S.ps?.stop ?? '')}"></label>
      <label class="f"><span>目標價（選填）</span><input type="number" inputmode="decimal" id="ps_target" value="${esc(S.ps?.target ?? '')}"></label>
      <label class="f"><span>交易單位</span><select id="ps_lot">${[['1000', '台股整張（1000 股）'], ['1', '零股／美股（1 股）']].map(([v, t]) => `<option value="${v}" ${String(S.ps?.lot ?? '1000') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    </div>
    <div class="result" id="psResult"></div>
  </div>
  <div class="card">
    <h3 class="gold-bar">三、資產配置與再平衡</h3>
    <div class="tbl-wrap"><table><thead><tr><th>類別</th><th class="num">目標 %</th><th class="num">目前市值</th><th class="num">實際 %</th><th class="num">偏離</th><th class="num">調整金額</th><th></th></tr></thead><tbody>
    ${S.alloc.map((a, i) => { const v = num(a.value) || 0; const act = tot ? v / tot * 100 : 0; const dev = act - (num(a.target) || 0); const adj = tot * (num(a.target) || 0) / 100 - v;
      return `<tr><td><input data-alloc-row="${i}" data-f="name" value="${esc(a.name)}" style="width:90px"></td>
      <td><input type="number" inputmode="decimal" data-alloc-row="${i}" data-f="target" value="${esc(a.target)}" style="width:70px"></td>
      <td><input type="number" inputmode="decimal" data-alloc-row="${i}" data-f="value" value="${esc(a.value)}" style="width:110px"></td>
      <td class="num">${tot ? act.toFixed(1) + '%' : '—'}</td>
      <td class="num ${Math.abs(dev) > 5 ? 'down' : ''}">${tot ? (dev > 0 ? '+' : '') + dev.toFixed(1) : '—'}</td>
      <td class="num">${tot ? (adj > 0 ? '買 ' : '賣 ') + fmt(Math.abs(adj)) : '—'}</td>
      <td><button class="btn-small ghost" data-alloc-del="${i}">✕</button></td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="btn-row" style="margin-top:8px"><button class="btn-small ghost" id="allocAdd">＋ 新增類別</button>
      <span class="lead" style="margin:0;align-self:center">目標合計 ${fmt(S.alloc.reduce((s, a) => s + (num(a.target) || 0), 0), 1)}%　總市值 ${fmt(tot)}</span></div>
    <div class="note">偏離超過 5 個百分點以紅字標示。調整金額是回到目標比重所需的買賣金額。</div>
  </div>
  <div class="card">
    <h3 class="gold-bar">四、定期定額試算</h3>
    <div class="inline">
      <label class="f"><span>每月投入</span><input type="number" inputmode="decimal" id="dca_m" value="${esc(S.dca?.m ?? '10000')}"></label>
      <label class="f"><span>年數</span><input type="number" inputmode="decimal" id="dca_y" value="${esc(S.dca?.y ?? '20')}"></label>
      <label class="f"><span>假設年報酬 %</span><input type="number" inputmode="decimal" id="dca_r" value="${esc(S.dca?.r ?? '6')}"></label>
    </div>
    <div class="result" id="dcaResult"></div>
  </div>
  <div class="card">
    <h3 class="gold-bar">五、我的策略守則</h3>
    <textarea data-bind="rules" style="min-height:140px">${esc(S.rules)}</textarea>
  </div>`;
};
function calcStrategy() {
  const g = id => num($('#' + id)?.value);
  if (!$('#ps_cap')) return;
  S.ps = { cap: $('#ps_cap').value, risk: $('#ps_risk').value, entry: $('#ps_entry').value, stop: $('#ps_stop').value, target: $('#ps_target').value, lot: $('#ps_lot').value };
  S.dca = { m: $('#dca_m').value, y: $('#dca_y').value, r: $('#dca_r').value };
  save();
  const cap = g('ps_cap'), risk = g('ps_risk'), entry = g('ps_entry'), stop = g('ps_stop'), target = g('ps_target'), lot = g('ps_lot') || 1;
  let html = '<span class="lead">輸入進場價與停損價。</span>';
  if (cap && risk && entry && stop && entry !== stop) {
    const riskAmt = cap * risk / 100, perShare = Math.abs(entry - stop);
    const shares = Math.floor(riskAmt / perShare / lot) * lot;
    const posVal = shares * entry, posPct = posVal / cap * 100;
    const rr = target ? Math.abs(target - entry) / perShare : null;
    html = `<dl class="kv">
      <dt>可承受虧損金額</dt><dd>${fmt(riskAmt)}</dd>
      <dt>每股風險</dt><dd>${fmt(perShare, 2)}（${(perShare / entry * 100).toFixed(1)}%）</dd>
      <dt>建議股數</dt><dd class="big" style="font-size:18px">${fmt(shares)} 股${lot === 1000 ? `（${fmt(shares / 1000)} 張）` : ''}</dd>
      <dt>部位金額</dt><dd>${fmt(posVal)}（佔總資金 ${posPct.toFixed(1)}%）</dd>
      ${rr != null ? `<dt>風險報酬比</dt><dd class="${rr >= 2 ? 'up' : 'down'}">1 : ${rr.toFixed(2)}${rr < 2 ? '（低於 1:2）' : ''}</dd>` : ''}
      </dl>${shares === 0 ? '<div class="note">停損距離太大或資金太小，連一個交易單位都買不起；可改零股或放寬單筆風險。</div>' : ''}${posPct > 100 ? '<div class="note">部位超過總資金，代表停損設得太近，請重新檢查。</div>' : ''}`;
  }
  $('#psResult').innerHTML = html;
  const m = g('dca_m'), y = g('dca_y'), r = g('dca_r');
  if (m && y != null) {
    const n = Math.round(y * 12), i = (r || 0) / 100 / 12;
    const fv = i ? m * ((1 + i) ** n - 1) / i : m * n;
    const cost = m * n;
    $('#dcaResult').innerHTML = `<dl class="kv"><dt>累計投入</dt><dd>${fmt(cost)}</dd><dt>期末估計</dt><dd class="big" style="font-size:18px">${fmt(fv)}</dd><dt>估計報酬</dt><dd class="up">${fmt(fv - cost)}（${pct((fv / cost - 1) * 100)}）</dd></dl><div class="note">以固定年報酬估算，實際報酬會波動，僅供規劃參考。</div>`;
  }
}

/* 監控 */
PAGES.monitor = () => `
  <h2>監控條件</h2>
  <p class="lead">條件用白話寫，一行一個，之後可直接交給 AI 或券商 App 的到價提醒執行。條件由你設定，觸發後的決策仍由你做。</p>
  <div class="card"><div class="card-head"><h3 class="gold-bar">條件清單</h3>${addBtn('monitors')}</div>
    ${recordList('monitors', '範例：「收盤價站上 20 日均線，且 RSI 從 30 以下回升 → 檢查籌碼面後決定是否分批進場」')}</div>
  <div class="card"><h3 class="gold-bar">盤後報告設定</h3>
    <label class="f"><span>關注清單</span><input type="text" data-bind="report.watchlist" value="${esc(S.report.watchlist)}"></label>
    <label class="f"><span>每日報告內容</span><textarea data-bind="report.content">${esc(S.report.content)}</textarea></label>
    <label class="f"><span>寄送時間與方式</span><input type="text" data-bind="report.schedule" value="${esc(S.report.schedule)}"></label>
    <button class="btn-small ghost" id="copyReport">複製成 AI 盤後報告指令</button>
  </div>`;

/* 待驗主張 */
const BT_CHECKS = ['沒有用到當時還不知道的資料（前視偏誤）', '樣本包含已下市或被剔除的公司（倖存者偏誤）', '參數沒有為了配合歷史而反覆微調（過度擬合）', '已計入手續費與交易稅', '樣本數足夠，且涵蓋多頭與空頭市場'];
PAGES.claims = () => `
  <h2>待驗主張清冊</h2>
  <p class="lead">還沒被數據檢驗的想法一律先登記在這裡，用歷史資料逐條回測；只有「確認」的才寫進分析流程。</p>
  <div class="grid grid-4" style="margin-bottom:14px">${['待驗', '確認', '證偽', '理由改寫'].map(s => `<div class="stat"><div class="num">${S.claims.filter(c => (c.status || '待驗') === s).length}</div><div class="lbl">${s}</div></div>`).join('')}</div>
  <div class="card"><div class="card-head"><h3 class="gold-bar">主張清單</h3>${addBtn('claims')}</div>
    ${recordList('claims', '範例：「外資連續 5 日買超後，之後 20 日報酬優於大盤」')}
    <div class="note">結案標準：確認（數據支持，納入流程）、證偽（數據不支持，標記為迷思）、理由改寫（現象存在但原因不同，改寫後重新登記）。</div></div>
  <div class="card checklist"><h3 class="gold-bar">回測前檢查</h3>
    <p class="lead" style="margin-bottom:6px">回測是為了驗證邏輯站不站得住，不是找歷史報酬最高的參數。</p>
    ${BT_CHECKS.map((t, i) => `<label><input type="checkbox" data-bt="${i}" ${S.backtest[i] ? 'checked' : ''}> ${t}</label>`).join('')}
  </div>`;

/* 覆盤 */
PAGES.review = () => `
  <h2>覆盤日誌</h2>
  <p class="lead">每次決策都留一行：當時為什麼這樣做，結果如何，有沒有值得寫回系統的教訓。</p>
  <div class="card"><div class="card-head"><h3 class="gold-bar">紀錄</h3>${addBtn('reviews')}</div>${recordList('reviews')}</div>
  <div class="card"><h3 class="gold-bar">覆盤提問</h3>
    <ol style="margin:0;padding-left:20px;font-size:14px">
      <li>這次漏看了哪個面向？</li><li>哪個數字事後證明不可靠？來源是什麼？</li>
      <li>有沒有新的規律或陷阱？要登記到待驗主張清冊嗎？</li><li>結果好是因為判斷對，還是運氣？</li><li>流程本身要改哪一步？</li>
    </ol></div>`;

/* 設定 */
PAGES.settings = () => `
  <h2>設定與備份</h2>
  <div class="card"><h3 class="gold-bar">備份</h3>
    <p class="lead">資料只存在這台裝置的瀏覽器。換手機、清除瀏覽資料前請先匯出。</p>
    <div class="btn-row"><button class="btn-primary" id="exportBtn">匯出 JSON 備份</button>
    <label class="btn-ghost" style="cursor:pointer">匯入備份<input type="file" accept="application/json,.json" id="importFile" hidden></label></div>
  </div>
  <div class="card"><h3 class="gold-bar">安裝到手機</h3>
    <ul style="margin:0;padding-left:20px;font-size:14px">
      <li>iPhone（Safari）：分享 → 加入主畫面</li>
      <li>Android（Chrome）：右上選單 → 安裝應用程式／加到主畫面</li>
      <li>安裝後可離線開啟。</li>
    </ul></div>
  <div class="card"><h3 class="gold-bar">重設</h3>
    <p class="lead">清除這台裝置上的所有筆記（無法復原）。</p>
    <button class="btn-danger" id="resetBtn">清除全部資料</button></div>
  <p class="lead" style="text-align:center">版本 1.0</p>`;

/* ---------- 路由與事件 ---------- */
let current = 'home';
function go(page) {
  if (!PAGES[page]) page = 'home';
  if (page !== 'cards') openCardId = null;
  current = page;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.go === page));
  const active = document.querySelector(`#tabs button[data-go="${page}"]`);
  active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page);
  render(); window.scrollTo(0, 0);
}
function render() {
  $('#view').innerHTML = PAGES[current]();
  if (current === 'strategy') calcStrategy();
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-add],[data-edit],[data-card],[data-etf],[data-ai],[data-alloc-del],button[id]');
  if (!t) return;
  if (t.dataset.go) return go(t.dataset.go);
  if (t.dataset.add) return t.dataset.add === 'etf' ? editEtf() : editRecord(t.dataset.add);
  if (t.dataset.edit) return editRecord(t.dataset.edit, t.dataset.id);
  if (t.dataset.card) { openCardId = t.dataset.card; render(); return window.scrollTo(0, 0); }
  if (t.dataset.etf) return editEtf(t.dataset.etf);
  if (t.dataset.ai === 'macro') return copy(aiMacroPrompt());
  if (t.dataset.ai === 'card') return copy(aiCardPrompt(S.cards.find(c => c.id === openCardId)));
  if (t.dataset.allocDel != null) { S.alloc.splice(+t.dataset.allocDel, 1); save(); return render(); }
  switch (t.id) {
    case 'newCard': { const c = blankCard(); S.cards.push(c); openCardId = c.id; save(); render(); break; }
    case 'backCards': openCardId = null; render(); window.scrollTo(0, 0); break;
    case 'delCard': if (confirmInline()) { S.cards = S.cards.filter(c => c.id !== openCardId); openCardId = null; save(); render(); toast('已刪除'); } break;
    case 'cardMd': copy(cardMarkdown(S.cards.find(c => c.id === openCardId))); break;
    case 'cardToMonitor': {
      const c = S.cards.find(x => x.id === openCardId);
      S.monitors.push({ id: uid(), target: `${c.code} ${c.name}`.trim(), cond: c.wrongIf ? `證明我錯：${c.wrongIf}` : '', action: '', notify: '手機推播', status: '啟用' });
      c.monitored = '是'; save(); go('monitor'); editRecord('monitors', S.monitors[S.monitors.length - 1].id); break;
    }
    case 'addEtf': editEtf(); break;
    case 'allocAdd': S.alloc.push({ name: '新類別', target: 0, value: '' }); save(); render(); break;
    case 'copyReport': copy(`每個交易日收盤後，請整理一份盤後報告：\n關注清單：${S.report.watchlist}\n內容：${S.report.content}\n\n另外檢查以下監控條件是否觸發：\n${S.monitors.filter(m => m.status === '啟用').map(m => `- ${m.target}：${m.cond}`).join('\n') || '（無）'}\n\n只整理事實與數據並附來源，不給買賣建議。`); break;
    case 'exportBtn': {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `投資筆記備份_${today()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); break;
    }
    case 'resetBtn': if (confirmInline()) { S = defaultState(); save(); toast('已清除'); go('home'); } break;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.bind) { setPath(S, t.dataset.bind, t.value); save(); return; }
  if (t.dataset.macro != null) {
    const r = S.macro.rows[+t.dataset.macro]; r[t.dataset.f] = t.value; save();
    const d = $(`[data-dir="${t.dataset.macro}"]`); if (d) d.innerHTML = dirOf(r); return;
  }
  if (t.dataset.layer != null) { S.layers[+t.dataset.layer] = t.value; save(); return; }
  if (t.dataset.cardF) {
    const c = S.cards.find(x => x.id === openCardId); if (!c) return;
    setPath(c, t.dataset.cardF, t.value); save();
    const m = t.dataset.cardF.match(/^fin\.(\d+)\./);
    if (m) { const i = +m[1]; $(`[data-yoy="${i}"]`).innerHTML = yoy(c.fin[i], FIN_ROWS[i][1]); }
    if (/^val\.|^price$/.test(t.dataset.cardF)) $('#valResult').innerHTML = valResultHTML(c, valSummary(c));
    return;
  }
  if (t.dataset.alloc) { S.etfAlloc[t.dataset.alloc] = t.value; save(); return; }
  if (t.dataset.allocRow != null) { S.alloc[+t.dataset.allocRow][t.dataset.f] = t.value; save(); return; }
  if (current === 'strategy' && /^(ps_|dca_)/.test(t.id)) calcStrategy();
});
document.addEventListener('change', e => {
  const t = e.target;
  // 需要重繪的欄位
  if (t.dataset.bind === 'macro.growth' || t.dataset.bind === 'macro.inflation') { $('#quad').outerHTML = quadHTML(); return; }
  if (t.dataset.alloc || t.dataset.allocRow != null) { const y = scrollY; render(); scrollTo(0, y); return; }
  if (t.dataset.cardF && t.tagName === 'SELECT') { save(); return; }
  if (t.dataset.bt != null) { S.backtest[t.dataset.bt] = t.checked; save(); return; }
  if (t.id === 'importFile' && t.files[0]) {
    const fr = new FileReader();
    fr.onload = () => { try { S = Object.assign(defaultState(), JSON.parse(fr.result)); save(); toast('匯入完成'); go('home'); } catch { toast('檔案格式錯誤'); } };
    fr.readAsText(t.files[0]);
  }
  if (current === 'strategy' && t.id === 'ps_lot') calcStrategy();
});
// 送出 select 變更後即時更新清單摘要
document.addEventListener('change', e => { if (e.target.dataset.cardF === 'layer' || e.target.dataset.cardF === 'market') save(); });

/* PWA */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').hidden = true;
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (p && p !== current) go(p); });
go(location.hash.slice(1) || 'home');
