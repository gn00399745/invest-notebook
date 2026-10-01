/* 我的資產：收支記帳、存款、保單、房產、股票庫存、定期定額 */
'use strict';

['accounts', 'insurance', 'property', 'ledger', 'recurring', 'pendingDca', 'trades'].forEach(k => { S[k] = S[k] || []; });

/* ---------- 幣別 ---------- */
const CCY = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'AUD', 'GBP'];
const CCY_DEFAULT = { TWD: 1, USD: 32, JPY: 0.21, EUR: 35, CNY: 4.4, HKD: 4.1, AUD: 21, GBP: 41 };
const rate = c => (!c || c === 'TWD') ? 1 : c === 'USD' ? (S.fxRates?.USD || fx()) : (S.fxRates?.[c] || CCY_DEFAULT[c] || 1);
const toTWD = (a, c) => (num(a) || 0) * rate(c);
const conv = (a, from, to) => toTWD(a, from) / rate(to);
const ccyOf = code => /^\d/.test(code || '') ? 'TWD' : 'USD';
const money = (n, c = 'TWD') => (c === 'TWD' ? '' : c + ' ') + fmt(n, c === 'TWD' || Math.abs(n) >= 1000 ? 0 : 2);
async function loadFx() {
  if (S.fxAt && Date.now() - S.fxAt < 12 * 3600e3) return;
  try {
    const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json', { signal: AbortSignal.timeout(10000) });
    const d = (await r.json()).twd; const o = {};
    CCY.slice(1).forEach(c => { const v = d[c.toLowerCase()]; if (v) o[c] = Math.round(1 / v * 10000) / 10000; });
    if (o.USD) { S.fxRates = o; S.fxAt = Date.now(); save(); }
  } catch (e) { /* 用預設匯率 */ }
}

/* ---------- 分類 ---------- */
const CATS = {
  支出: [['餐飲', '🍱'], ['交通', '🚇'], ['居住', '🏠'], ['日用', '🧻'], ['購物', '🛍️'], ['娛樂', '🎬'], ['醫療', '🏥'], ['教育', '📚'], ['保險', '🛡️'], ['孝親', '👪'], ['旅遊', '✈️'], ['其他', '💳']],
  收入: [['薪資', '💼'], ['獎金', '🎁'], ['股利', '💰'], ['利息', '🏦'], ['兼職', '🧑‍💻'], ['租金', '🏘️'], ['其他', '➕']],
};
const catIcon = (type, c) => (CATS[type] || []).find(x => x[0] === c)?.[1] || '•';

/* ---------- 資產表單 ---------- */
const DAYS = Array.from({ length: 28 }, (_, i) => String(i + 1));
SCHEMAS.accounts = { title: '存款帳戶', fields: [
  { k: 'name', l: '帳戶名稱', ph: '例如：台新活存、郵局定存' },
  { k: 'kind', l: '種類', t: 'select', o: ['活存', '定存', '外幣存款', '證券交割戶', '電子支付／現金'] },
  { k: 'ccy', l: '幣別', t: 'select', o: CCY },
  { k: 'balance', l: '目前餘額', t: 'money', h: '打開網銀 App 看餘額照填。之後記帳、買賣股票選這個帳戶，餘額會自動增減。' },
  { k: 'rateP', l: '年利率 %（選填）', t: 'money', ph: '1.7' },
  { k: 'maturity', l: '定存到期日（選填）', t: 'date' }] };
SCHEMAS.insurance = { title: '保單', fields: [
  { k: 'name', l: '保單名稱', ph: '例如：富邦美元利率變動型' },
  { k: 'kind', l: '種類', t: 'select', o: ['儲蓄險', '投資型保單', '保障型（壽險／醫療／意外）'] },
  { k: 'ccy', l: '幣別', t: 'select', o: CCY },
  { k: 'cashValue', l: '目前保單價值（解約金）', t: 'money', h: '看保險公司 App 或保單「年度價值表」的解約金；保障型保單沒有累積價值就填 0。投資型保單填「保單帳戶價值」。' },
  { k: 'premium', l: '每年保費（選填）', t: 'money', h: '填了會自動在繳費月份記一筆「保險」支出。' },
  { k: 'payMonth', l: '繳費月份', t: 'select', o: Array.from({ length: 12 }, (_, i) => String(i + 1)) },
  { k: 'endYear', l: '繳費到哪一年（選填）', ph: '2032' }] };
SCHEMAS.property = { title: '房產', fields: [
  { k: 'name', l: '名稱', ph: '例如：自住 新北板橋' },
  { k: 'value', l: '估計市值', t: 'money', h: '可到內政部「實價登錄」查同社區近期成交，取個保守數字；一年更新一次就好。' },
  { k: 'loan', l: '房貸剩餘本金', t: 'money', h: '看銀行 App 的「貸款餘額」。淨值＝市值－房貸。' },
  { k: 'pay', l: '每月房貸（選填）', t: 'money', h: '填了會每月自動記一筆「居住」支出。' },
  { k: 'payDay', l: '每月扣款日', t: 'select', o: DAYS }] };

function acctSelectHTML(sel, label = '帳戶') {
  if (!S.accounts.length) return '';
  const v = sel ?? (acctById(S.lastAcct) ? S.lastAcct : (S.accounts.find(a => /活存|電子/.test(a.kind || '活存') && (a.ccy || 'TWD') === 'TWD') || {}).id ?? '');
  return `<label class="f"><span>${esc(label)}</span><select name="acct"><option value="">不連動帳戶</option>${S.accounts.map(a => `<option value="${a.id}" ${a.id === v ? 'selected' : ''}>${esc(a.name || a.kind)}（${a.ccy || 'TWD'}）</option>`).join('')}</select></label>`;
}
window.acctSelectHTML = acctSelectHTML;
const acctById = id => S.accounts.find(a => a.id === id);
function moveCash(id, delta) {
  const a = acctById(id); if (!a || !delta) return;
  a.balance = String(Math.round(((num(a.balance) || 0) + delta) * 100) / 100);
}
window.tradeCash = (old, rec) => {
  if (old?.acct && old.cashDelta) moveCash(old.acct, -old.cashDelta);
  if (!rec) return;
  rec.cashDelta = 0;
  const a = acctById(rec.acct); if (!a) return;
  const amt = (num(rec.price) || 0) * (num(rec.shares) || 0);
  const fee = rec.fee !== '' && rec.fee != null ? num(rec.fee) || 0 : estFee(rec);
  const gross = rec.side === '賣出' ? amt - fee : -(amt + fee);
  rec.cashDelta = Math.round(conv(gross, ccyOf(rec.code), a.ccy || 'TWD') * 100) / 100;
  moveCash(a.id, rec.cashDelta); S.lastAcct = a.id;
};

function editAsset(key, id) {
  const sc = SCHEMAS[key], rec = id ? S[key].find(r => r.id === id) : null;
  openModal({
    title: (rec ? '編輯' : '新增') + sc.title,
    body: sc.fields.map(f => fieldHTML(f, rec?.[f.k])).join(''),
    onSave: d => {
      if (key !== 'accounts' && !d.name) { toast('請填名稱'); return false; }
      let r = rec; if (r) Object.assign(r, d); else { r = { id: uid(), ...d }; S[key].push(r); }
      const msg = linkRecurring(key, r); toast(msg || '已儲存');
    },
    onDelete: rec ? () => { S[key] = S[key].filter(x => x.id !== id); S.recurring = S.recurring.filter(x => x.link !== id); save(); toast('已刪除'); } : null,
  });
}
// 房貸、保費 → 自動建立固定支出
function linkRecurring(key, r) {
  let spec = null;
  if (key === 'property' && num(r.pay) > 0) spec = { kind: '支出', name: `${r.name} 房貸`, cat: '居住', amount: r.pay, freq: '月', day: r.payDay || '1', ccy: 'TWD' };
  if (key === 'insurance' && num(r.premium) > 0) spec = { kind: '支出', name: `${r.name} 保費`, cat: '保險', amount: r.premium, freq: '年', month: r.payMonth || '1', day: '1', ccy: r.ccy || 'TWD', until: r.endYear };
  const ex = S.recurring.find(x => x.link === r.id);
  if (!spec) { if (ex) S.recurring = S.recurring.filter(x => x !== ex); return ''; }
  if (ex) { Object.assign(ex, spec); return '已儲存（固定支出已同步更新）'; }
  S.recurring.push({ id: uid(), link: r.id, ...spec, lastRun: today() });
  return key === 'property' ? '已儲存，並建立每月房貸固定支出' : '已儲存，並建立每年保費固定支出';
}

/* ---------- 記帳 ---------- */
function applyLedger(e, sign) {
  if (!e?.acct) return; const a = acctById(e.acct); if (!a) return;
  moveCash(a.id, sign * (e.type === '收入' ? 1 : -1) * conv(e.amount, e.ccy || 'TWD', a.ccy || 'TWD'));
}
function openLedger(pre = {}, id) {
  const rec = id ? S.ledger.find(x => x.id === id) : null;
  const v = Object.assign({ type: '支出', date: today(), cat: '' }, pre, rec || {});
  const catsHTML = type => CATS[type].map(([c, ic], i) => `<label><input type="radio" name="cat" value="${c}" ${(v.cat ? v.cat === c : i === 0) ? 'checked' : ''}><span><b>${ic}</b>${c}</span></label>`).join('');
  openModal({
    title: rec ? '編輯收支' : '記一筆',
    body: `<div class="seg big" style="margin-bottom:10px"><label class="sell"><input type="radio" name="type" value="支出" ${v.type !== '收入' ? 'checked' : ''}><span>支出</span></label><label><input type="radio" name="type" value="收入" ${v.type === '收入' ? 'checked' : ''}><span>收入</span></label></div>
      <input class="amt-input" name="amount" inputmode="decimal" placeholder="金額" value="${esc(v.amount || '')}" autocomplete="off">
      <div class="catgrid" id="catBox">${catsHTML(v.type)}</div>
      <div class="inline" style="margin-top:10px"><label class="f"><span>日期</span><input type="date" name="date" value="${esc(v.date)}"></label>${acctSelectHTML(v.acct, '從哪個帳戶')}</div>
      <label class="f"><span>備註（選填）</span><input type="text" name="note" value="${esc(v.note || '')}" placeholder="例如：午餐、10 月薪水"></label>`,
    saveText: rec ? '儲存' : '記下來',
    onSave: d => {
      const amount = num(d.amount); if (!amount || amount <= 0) { toast('請輸入金額'); return false; }
      const a = acctById(d.acct);
      const e = { date: d.date || today(), type: d.type, cat: d.cat || CATS[d.type][0][0], amount: String(amount), acct: d.acct || '', ccy: a?.ccy || rec?.ccy || 'TWD', note: d.note || '' };
      if (rec) { applyLedger(rec, -1); Object.assign(rec, e); applyLedger(rec, 1); }
      else { const n = { id: uid(), ...e }; S.ledger.push(n); applyLedger(n, 1); }
      if (d.acct) S.lastAcct = d.acct;
      S.ledgerMonth = e.date.slice(0, 7);
      toast(`已記錄 ${e.type} ${e.cat} ${fmt(amount)}`);
    },
    onDelete: rec ? () => { applyLedger(rec, -1); S.ledger = S.ledger.filter(x => x.id !== id); save(); toast('已刪除'); } : null,
  });
  const body = $('#modalBody');
  body.querySelectorAll('[name=type]').forEach(r => r.addEventListener('change', () => { v.cat = ''; $('#catBox').innerHTML = catsHTML(body.querySelector('[name=type]:checked').value); }));
  setTimeout(() => body.querySelector('.amt-input')?.focus(), 80);
}

/* ---------- 固定收支與定期定額 ---------- */
function openRecurring(id, preKind) {
  const rec = id ? S.recurring.find(x => x.id === id) : null;
  const v = Object.assign({ kind: preKind || '支出', freq: '月', day: '5', month: '1' }, rec || {});
  const catsHTML = k => (CATS[k] || []).map(([c, ic], i) => `<label><input type="radio" name="cat" value="${c}" ${(v.cat ? v.cat === c : i === 0) ? 'checked' : ''}><span><b>${ic}</b>${c}</span></label>`).join('');
  openModal({
    title: rec ? '編輯固定收支' : '設定固定收支／定期定額',
    body: `<div class="seg" style="margin-bottom:10px">${['支出', '收入', '定期定額'].map(k => `<label><input type="radio" name="kind" value="${k}" ${v.kind === k ? 'checked' : ''}><span>${k === '定期定額' ? '定期定額' : '固定' + k}</span></label>`).join('')}</div>
      <div id="rcDca" ${v.kind === '定期定額' ? '' : 'hidden'}><div class="inline"><label class="f"><span>代號</span><input type="text" name="code" value="${esc(v.code || '')}" placeholder="0050、VOO…" autocapitalize="characters"></label><label class="f"><span>名稱（自動）</span><input type="text" name="cname" value="${esc(v.cname || '')}"></label></div>
        <div class="help">到期時首頁會出現「待確認」，按一下帶入當天價格，確認後才計入持股。</div></div>
      <div id="rcCat" ${v.kind === '定期定額' ? 'hidden' : ''}><label class="f"><span>名稱</span><input type="text" name="name" value="${esc(v.name || '')}" placeholder="例如：薪水、房租、手機費、Netflix"></label><div class="catgrid" id="rcCats">${catsHTML(v.kind)}</div></div>
      <label class="f" style="margin-top:10px"><span>每次金額</span><input type="text" inputmode="decimal" name="amount" value="${esc(v.amount || '')}" placeholder="0"></label>
      <div class="inline"><label class="f"><span>頻率</span><select name="freq">${['月', '年'].map(o => `<option value="${o}" ${v.freq === o ? 'selected' : ''}>每${o}</option>`).join('')}</select></label>
        <label class="f" id="rcMonth" ${v.freq === '年' ? '' : 'hidden'}><span>月份</span><select name="month">${Array.from({ length: 12 }, (_, i) => `<option ${String(i + 1) === String(v.month) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
        <label class="f"><span>每${v.freq === '年' ? '年該月' : '月'}幾號</span><select name="day">${DAYS.map(o => `<option ${o === String(v.day) ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
        ${acctSelectHTML(v.acct, '扣款／入帳帳戶')}</div>
      <div class="help">從今天以後的日期才會自動記帳，不會補記過去。</div>`,
    onSave: (d, body) => {
      const amount = num(d.amount); if (!amount) { toast('請輸入金額'); return false; }
      const kind = d.kind, code = String(d.code || '').trim().toUpperCase();
      if (kind === '定期定額' && !code) { toast('請輸入代號'); return false; }
      const r = { kind, amount: String(amount), freq: d.freq, month: d.month, day: d.day, acct: d.acct || '', ccy: acctById(d.acct)?.ccy || (kind === '定期定額' ? ccyOf(code) : 'TWD'),
        code: kind === '定期定額' ? code : '', cname: d.cname || '', name: kind === '定期定額' ? `定期定額 ${code} ${d.cname || ''}`.trim() : (d.name || d.cat), cat: kind === '定期定額' ? '' : d.cat };
      if (rec) Object.assign(rec, r); else S.recurring.push({ id: uid(), ...r, lastRun: dayBefore(today()) });
      processRecurring(); toast('已設定');
    },
    onDelete: rec ? () => { S.recurring = S.recurring.filter(x => x.id !== id); save(); toast('已刪除（已記的帳不受影響）'); } : null,
  });
  const body = $('#modalBody'), f = n => body.querySelector(`[name=${n}]`);
  body.querySelectorAll('[name=kind]').forEach(r => r.addEventListener('change', () => {
    const k = body.querySelector('[name=kind]:checked').value; v.cat = '';
    $('#rcDca').hidden = k !== '定期定額'; $('#rcCat').hidden = k === '定期定額'; if (k !== '定期定額') $('#rcCats').innerHTML = catsHTML(k);
  }));
  f('freq').addEventListener('change', () => { $('#rcMonth').hidden = f('freq').value !== '年'; });
  let tm; f('code').addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(async () => { try { const q = await quote(f('code').value.trim()); f('cname').value = q.name || ''; } catch (e) { /* ignore */ } }, 600); });
}
const dayBefore = d => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const pad = n => String(n).padStart(2, '0');
function dueDates(r, from, to) {
  const out = []; let [y, m] = from.slice(0, 7).split('-').map(Number);
  for (let i = 0; i < 40; i++) {
    const d = `${y}-${pad(m)}-${pad(Math.min(+r.day || 1, 28))}`;
    if (d > to) break;
    if (d > from && (r.freq !== '年' || +r.month === m) && (!r.until || y <= +r.until)) out.push(d);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
function processRecurring() {
  const t = today(); let n = 0, p = 0;
  S.recurring.forEach(r => {
    const from = r.lastRun || dayBefore(t);
    dueDates(r, from, t).forEach(d => {
      if (r.kind === '定期定額') {
        if (!S.pendingDca.some(x => x.rid === r.id && x.date === d)) { S.pendingDca.push({ id: uid(), rid: r.id, date: d, code: r.code, name: r.cname, amount: r.amount, acct: r.acct }); p++; }
      } else {
        const e = { id: uid(), date: d, type: r.kind, cat: r.cat || '其他', amount: r.amount, acct: r.acct || '', ccy: r.ccy || 'TWD', note: r.name, auto: r.id };
        S.ledger.push(e); applyLedger(e, 1); n++;
      }
    });
    r.lastRun = t;
  });
  if (n || p) { save(); setTimeout(() => toast([n && `已自動記入 ${n} 筆固定收支`, p && `${p} 筆定期定額待確認`].filter(Boolean).join('，')), 600); }
}
function confirmDca(pid) {
  const x = S.pendingDca.find(y => y.id === pid); if (!x) return;
  const px = S.quotes?.[x.code]?.price, amt = num(x.amount) || 0;
  const tw = /^\d/.test(x.code);
  const shares = px ? (tw ? Math.floor(amt / px) : Math.floor(amt / px * 10000) / 10000) : '';
  openTradeForm({ code: x.code, name: x.name, side: '買進', date: x.date, price: px || '', shares: shares ? String(shares) : '', acct: x.acct, kind: '定期定額', pendingId: x.id, dcaAmt: amt, fee: tw ? '1' : '0' });
}

/* ---------- 匯入券商庫存 ---------- */
function openImport() {
  const row = () => `<div class="imp-row"><input class="i-code" placeholder="代號" autocapitalize="characters"><input class="i-sh" inputmode="decimal" placeholder="股數"><input class="i-avg" inputmode="decimal" placeholder="成本均價"><span class="i-name"></span></div>`;
  openModal({
    title: '匯入券商庫存',
    body: `<div class="help" style="font-size:14px;margin-bottom:8px">打開券商 App 的「庫存」或「帳務」頁，每檔照抄 3 個數字：<b>代號、股數、成本均價</b>。不用一筆一筆補記過去的交易。</div>
      <div class="imp-head"><span>代號</span><span>股數</span><span>成本均價</span></div>
      <div id="impRows">${row()}${row()}${row()}</div>
      <button type="button" class="btn-small ghost" id="impMore" style="margin-top:6px">＋ 再加一列</button>
      ${S.trades.length ? '<div class="help" style="margin-top:8px">已經在網站裡的持股不用重抄，否則股數會重複計算。</div>' : ''}`,
    saveText: '匯入',
    onSave: (d, body) => {
      let n = 0;
      body.querySelectorAll('.imp-row').forEach(r => {
        const code = r.querySelector('.i-code').value.trim().toUpperCase(), sh = num(r.querySelector('.i-sh').value), avg = num(r.querySelector('.i-avg').value);
        if (!code || !sh || !avg) return;
        S.trades.push({ id: uid(), kind: '庫存匯入', date: today(), code, name: /^(…|查無)$/.test(r.querySelector('.i-name').textContent) ? '' : r.querySelector('.i-name').textContent, side: '買進', price: String(avg), shares: String(sh), fee: '0', reasons: [], reason: '從券商庫存匯入', plan: '', conf: '' });
        n++;
      });
      if (!n) { toast('請至少填一列完整的代號、股數、均價'); return false; }
      toast(`已匯入 ${n} 檔持股`); refreshHoldQuotes(true);
    },
  });
  const box = $('#impRows');
  $('#impMore').onclick = () => box.insertAdjacentHTML('beforeend', row());
  let tm;
  box.addEventListener('input', e => {
    if (!e.target.classList.contains('i-code')) return;
    const r = e.target.closest('.imp-row'); clearTimeout(tm);
    tm = setTimeout(async () => { const c = e.target.value.trim(); if (!c) return; r.querySelector('.i-name').textContent = '…'; try { const q = await quote(c); r.querySelector('.i-name').textContent = q.name || ''; } catch (err) { r.querySelector('.i-name').textContent = '查無'; } }, 600);
  });
}
function holdingDetail(code) {
  const list = S.trades.filter(t => String(t.code).toUpperCase() === code).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  openModal({
    title: `${code} 的紀錄`, noSave: true,
    body: list.map(t => `<div class="rec" data-edit="trades" data-id="${t.id}"><div class="r-top"><span class="r-title">${esc(t.side)} ${fmt(num(t.shares), num(t.shares) % 1 ? 4 : 0)} 股 @ ${esc(t.price)}</span>${t.kind ? `<span class="pill">${esc(t.kind)}</span>` : ''}</div><div class="r-meta">${esc(t.date)}${t.reason ? '｜' + esc(t.reason) : ''}</div></div>`).join('') +
      '<div class="help" style="margin-top:8px">點一筆可以修改或刪除。要調整股數或均價，直接修改「庫存匯入」那一筆最簡單。</div>',
  });
}

/* ---------- 計算 ---------- */
let qBusy = false;
async function refreshHoldQuotes(force) {
  if (qBusy || !location.protocol.startsWith('http')) return;
  const codes = holdings().filter(h => h.shares > 0).map(h => h.code)
    .concat(S.pendingDca.map(x => x.code))
    .filter((c, i, a) => a.indexOf(c) === i && (force || !S.quotes?.[c]?.t || Date.now() - S.quotes[c].t > 30 * 60e3));
  if (!codes.length) return;
  qBusy = true; S.quotes = S.quotes || {};
  for (const c of codes) { try { const d = await quote(c); S.quotes[c] = { price: d.price, prev: d.prev, name: d.name, date: d.priceDate, t: Date.now() }; } catch (e) { S.quotes[c] = Object.assign(S.quotes[c] || {}, { t: Date.now() }); } }
  qBusy = false; save();
  if (current === 'home') { const y = scrollY; render(); scrollTo(0, y); }
  if (force) toast('已更新現價');
}
function wealth() {
  const hs = holdings().filter(h => h.shares > 0).map(h => {
    const q = S.quotes?.[h.code], ccy = ccyOf(h.code), priced = q?.price != null;
    const px = priced ? q.price : h.cost / h.shares, mv = px * h.shares;
    const day = priced && q.prev ? (q.price - q.prev) * h.shares : null;
    return { ...h, name: h.name || q?.name || '', ccy, px, priced, mv, mvT: toTWD(mv, ccy), plT: toTWD(mv - h.cost, ccy), plP: (mv / h.cost - 1) * 100, dayT: day == null ? null : toTWD(day, ccy), chg: priced && q.prev ? (q.price / q.prev - 1) * 100 : null };
  }).sort((a, b) => b.mvT - a.mvT);
  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const cash = sum(S.accounts, a => toTWD(a.balance, a.ccy));
  const tw = sum(hs.filter(h => h.ccy === 'TWD'), h => h.mvT), us = sum(hs.filter(h => h.ccy !== 'TWD'), h => h.mvT);
  const savIns = sum(S.insurance.filter(i => i.kind === '儲蓄險'), i => toTWD(i.cashValue, i.ccy));
  const invIns = sum(S.insurance.filter(i => i.kind === '投資型保單'), i => toTWD(i.cashValue, i.ccy));
  const prop = sum(S.property, p => num(p.value)), loan = sum(S.property, p => num(p.loan));
  const invest = cash + tw + us + savIns + invIns;
  return { hs, cash, tw, us, savIns, invIns, prop, loan, invest, net: invest + prop - loan,
    pl: sum(hs, h => h.plT), day: hs.some(h => h.dayT != null) ? sum(hs, h => h.dayT) : null, realized: sum(holdings(), h => toTWD(h.realized, ccyOf(h.code))) };
}
const ym = d => d.slice(0, 7);
function monthStats(m) {
  const list = S.ledger.filter(e => ym(e.date || '') === m);
  const inc = list.filter(e => e.type === '收入').reduce((s, e) => s + toTWD(e.amount, e.ccy), 0);
  const exp = list.filter(e => e.type === '支出').reduce((s, e) => s + toTWD(e.amount, e.ccy), 0);
  const byCat = {}; list.filter(e => e.type === '支出').forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + toTWD(e.amount, e.ccy); });
  return { list, inc, exp, net: inc - exp, rate: inc ? (inc - exp) / inc * 100 : null, cats: Object.entries(byCat).sort((a, b) => b[1] - a[1]) };
}
function avgMonthlyExpense() {
  const cur = ym(today()), months = [...new Set(S.ledger.map(e => ym(e.date || '')))].filter(m => m && m < cur).sort().slice(-3);
  if (!months.length) return null;
  return months.reduce((s, m) => s + monthStats(m).exp, 0) / months.length || null;
}
const shiftMonth = (m, k) => { let [y, mm] = m.split('-').map(Number); mm += k; while (mm < 1) { mm += 12; y--; } while (mm > 12) { mm -= 12; y++; } return `${y}-${pad(mm)}`; };

/* ---------- 圖表 ---------- */
const PIE_COLORS = ['#13305a', '#c9a24a', '#1e9e5a', '#3b82c4', '#8b5cf6', '#98a4b8'];
function donut(parts) {
  const tot = parts.reduce((s, p) => s + Math.max(0, p.v), 0); if (!tot) return '';
  let acc = 0; const R = 15.915;
  const segs = parts.map((p, i) => { const f = Math.max(0, p.v) / tot * 100; const s = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${PIE_COLORS[i % 6]}" stroke-width="6" stroke-dasharray="${f} ${100 - f}" stroke-dashoffset="${25 - acc}"></circle>`; acc += f; return s; }).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 42 42" class="donut">${segs}</svg>
    <div class="legend">${parts.map((p, i) => p.v > 0 ? `<div><i style="background:${PIE_COLORS[i % 6]}"></i><span>${esc(p.l)}</span><b>${fmt(p.v / tot * 100, 0)}%</b><em>${fmt(p.v)}</em></div>` : '').join('')}</div></div>`;
}
const bar = (l, v, max, ic) => `<div class="cbar"><span>${ic ? ic + ' ' : ''}${esc(l)}</span><div><i style="width:${max ? Math.max(2, v / max * 100) : 0}%"></i></div><b>${fmt(v)}</b></div>`;
const signed = (n, d = 0) => n == null ? '—' : `<span class="${n >= 0 ? 'up' : 'down'}">${n >= 0 ? '+' : ''}${fmt(n, d)}</span>`;

/* ---------- 首頁：我的資產 ---------- */
PAGES.overview = PAGES.home;
PAGES.home = () => {
  setTimeout(() => refreshHoldQuotes(false), 30);
  const W = wealth(), m = ym(today()), M = monthStats(m), avgExp = avgMonthlyExpense();
  const emptyAll = !S.accounts.length && !W.hs.length && !S.ledger.length && !S.insurance.length && !S.property.length;
  const parts = [{ l: '現金與存款', v: W.cash }, { l: '台股', v: W.tw }, { l: '美股／海外', v: W.us }, { l: '儲蓄險', v: W.savIns }, { l: '投資型保單', v: W.invIns }];
  if (S.showProp) parts.push({ l: '房產淨值', v: W.prop - W.loan });
  const alerts = S.monAlerts?.length ? `<div class="card alert"><div class="card-head"><h3 class="gold-bar">⚠ 監控條件觸發</h3><button class="btn-small ghost" id="clearAlerts">知道了</button></div>${S.monAlerts.map(a => `<div>${esc(a)}</div>`).join('')}</div>` : '';
  const pend = S.pendingDca.length ? `<div class="card alert"><h3 class="gold-bar">定期定額待確認</h3>${S.pendingDca.map(x => `<div class="pend"><span>${esc(x.date.slice(5))}　<b>${esc(x.code)}</b> ${esc(x.name || '')}　${fmt(num(x.amount))} 元</span><span class="btn-row"><button class="btn-small" data-dca="${x.id}">確認入帳</button><button class="btn-small ghost" data-dcaskip="${x.id}">這期沒扣</button></span></div>`).join('')}<div class="help">確認時會帶入現價與估計股數，請對照券商的成交通知修改。</div></div>` : '';
  const onboard = emptyAll ? `<div class="card onboard"><h3 class="gold-bar">3 步建立你的資產表（約 5 分鐘）</h3>
      <button class="step" data-act="addAcct"><b>1</b><span><strong>加入存款帳戶</strong><em>打開網銀 App，抄下每個帳戶的餘額</em></span></button>
      <button class="step" data-act="import"><b>2</b><span><strong>匯入股票／ETF 庫存</strong><em>照抄券商 App 庫存頁的代號、股數、均價</em></span></button>
      <button class="step" data-act="recur"><b>3</b><span><strong>設定薪水、房租等固定收支</strong><em>之後每月自動記帳，只需記零星支出</em></span></button>
      <div class="help" style="margin-top:6px">有保單、房產也可以加進來：按右下角 ＋。資料只存在這台裝置，記得定期到 ⚙︎ 匯出備份。</div></div>` : '';
  const hold = W.hs.map(h => `<div class="hcard">
      <div class="h-top"><div><b>${esc(h.code)}</b> <span>${esc(h.name || '')}</span></div><div class="h-mv">${fmt(h.mvT)}</div></div>
      <div class="h-mid"><span>${fmt(h.shares, h.shares % 1 ? 4 : 0)} 股　均價 ${fmt(h.cost / h.shares, 2)}　現價 ${h.priced ? fmt(h.px, 2) : '—'}</span></div>
      <div class="h-bot"><span>損益 ${signed(h.plT)}（${pct(h.plP)}）${h.chg != null ? `　今日 <span class="${h.chg >= 0 ? 'up' : 'down'}">${pct(h.chg, 2)}</span>` : ''}</span>
        <span class="btn-row"><button class="btn-small" data-hbuy="${esc(h.code)}">加碼</button><button class="btn-small ghost" data-hsell="${esc(h.code)}">賣出</button><button class="btn-small ghost" data-hdet="${esc(h.code)}">明細</button></span></div></div>`).join('');
  const other = [
    ...S.accounts.map(a => ({ k: 'accounts', id: a.id, ic: '🏦', t: a.name || a.kind, s: `${a.kind || ''}${a.rateP ? `｜${a.rateP}%` : ''}${a.maturity ? `｜${a.maturity} 到期` : ''}`, v: money(num(a.balance) || 0, a.ccy || 'TWD') })),
    ...S.insurance.map(i => ({ k: 'insurance', id: i.id, ic: '🛡️', t: i.name, s: `${i.kind}${i.premium ? `｜年繳 ${fmt(num(i.premium))}` : ''}`, v: money(num(i.cashValue) || 0, i.ccy || 'TWD') })),
    ...S.property.map(p => ({ k: 'property', id: p.id, ic: '🏠', t: p.name, s: `市值 ${fmt(num(p.value))}｜房貸 ${fmt(num(p.loan))}`, v: fmt((num(p.value) || 0) - (num(p.loan) || 0)) })),
  ].map(o => `<div class="arow" data-edit="${o.k}" data-id="${o.id}"><span class="a-ic">${o.ic}</span><span class="a-t"><b>${esc(o.t)}</b><em>${esc(o.s)}</em></span><span class="a-v">${o.v}</span></div>`).join('');
  const fxNote = S.accounts.concat(S.insurance).some(a => a.ccy && a.ccy !== 'TWD') || W.us ? `<div class="help">外幣以 1 USD = ${fmt(rate('USD'), 2)} 元等即時匯率換算成台幣。</div>` : '';
  return `${alerts}${pend}
  <div class="hero">
    <div class="h-lbl">淨資產（新台幣）</div>
    <div class="h-num">${fmt(W.net)}</div>
    <div class="h-sub">${W.day != null ? `今日投資損益 ${signed(W.day)}　` : ''}${W.hs.length ? `持股未實現 ${signed(W.pl)}` : '按 ＋ 開始記錄'}</div>
    <div class="h-chips"><span>可投資資產 ${fmt(W.invest)}</span>${W.prop ? `<span>房產淨值 ${fmt(W.prop - W.loan)}</span>` : ''}${avgExp && W.cash ? `<span>存款可撐 ${fmt(W.cash / avgExp, 1)} 個月生活費</span>` : ''}</div>
  </div>
  <div class="quick">
    <button data-act="exp"><i>➖</i>記支出</button><button data-act="inc"><i>➕</i>記收入</button>
    <button data-act="buy"><i>📈</i>買股票</button><button data-act="sheet"><i>🗂️</i>更多</button>
  </div>
  ${onboard}
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">${+m.slice(5)} 月收支</h3><button class="btn-small ghost" data-go="ledger">看明細 →</button></div>
    <div class="mstats"><div><em>收入</em><b class="up">${fmt(M.inc)}</b></div><div><em>支出</em><b class="down">${fmt(M.exp)}</b></div><div><em>結餘</em><b>${fmt(M.net)}</b></div><div><em>儲蓄率</em><b>${M.rate == null ? '—' : fmt(M.rate, 0) + '%'}</b></div></div>
    ${M.cats.length ? `<div style="margin-top:10px">${M.cats.slice(0, 4).map(([c, v]) => bar(c, v, M.cats[0][1], catIcon('支出', c))).join('')}</div>` : '<div class="empty">這個月還沒記帳。設定薪水、房租等固定收支後會自動記入。</div>'}
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">資產配置</h3><label class="tog"><input type="checkbox" id="showProp" ${S.showProp ? 'checked' : ''}> 含房產</label></div>
    ${donut(parts) || '<div class="empty">加入存款、持股或保單後，這裡會畫出配置圓餅圖。</div>'}
    <div class="btn-row" style="margin-top:8px"><button class="btn-small ghost" id="walletToAlloc">同步到策略頁的目標配置</button></div>
    ${fxNote}
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">我的持股</h3><div class="btn-row"><button class="btn-small ghost" id="qRefresh">更新現價</button><button class="btn-small ghost" data-act="import">匯入庫存</button></div></div>
    ${hold || '<div class="empty">還沒有持股。按「匯入庫存」照抄券商 App 的庫存，或按「買股票」記一筆。</div>'}
    ${W.realized ? `<div class="help" style="margin-top:6px">已實現損益累計 ${signed(W.realized)} 元</div>` : ''}
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">存款、保單、房產</h3><button class="btn-small" data-act="sheetAsset">＋ 新增</button></div>
    ${other || '<div class="empty">還沒有資料。</div>'}
  </div>
  <div class="card"><div class="card-head"><h3 class="gold-bar">投資研究</h3><button class="btn-small ghost" data-go="overview">研究總覽 →</button></div>
    <div class="help" style="font-size:14px">總經燈號、研究卡、ETF 健檢、技術分析教學都在下方「研究」「市場」分頁。</div></div>`;
};

/* ---------- 收支頁 ---------- */
PAGES.ledger = () => {
  const m = S.ledgerMonth || ym(today()), M = monthStats(m);
  const groups = {};
  [...M.list].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
  const rows = Object.entries(groups).map(([d, es]) => `<div class="lday">${esc(d.slice(5).replace('-', '/'))}</div>` + es.map(e => `<div class="lrow" data-edit="ledger" data-id="${e.id}"><span class="l-ic">${catIcon(e.type, e.cat)}</span><span class="l-t"><b>${esc(e.note || e.cat)}</b><em>${esc(e.cat)}${e.acct && acctById(e.acct) ? '｜' + esc(acctById(e.acct).name) : ''}${e.auto ? '｜自動' : ''}</em></span><span class="l-v ${e.type === '收入' ? 'up' : 'down'}">${e.type === '收入' ? '+' : '−'}${money(num(e.amount), e.ccy || 'TWD')}</span></div>`).join('')).join('');
  const rec = S.recurring.map(r => `<div class="lrow" data-edit="recurring" data-id="${r.id}"><span class="l-ic">${r.kind === '定期定額' ? '📈' : catIcon(r.kind, r.cat)}</span><span class="l-t"><b>${esc(r.name)}</b><em>每${r.freq === '年' ? `年 ${r.month} 月` : '月'} ${r.day} 號${r.acct && acctById(r.acct) ? '｜' + esc(acctById(r.acct).name) : ''}</em></span><span class="l-v ${r.kind === '收入' ? 'up' : ''}">${fmt(num(r.amount))}</span></div>`).join('');
  return `<h2>收支</h2>
  <div class="mnav"><button class="btn-small ghost" data-act="mprev">‹</button><b>${m.replace('-', ' 年 ')} 月</b><button class="btn-small ghost" data-act="mnext">›</button></div>
  <div class="card"><div class="mstats"><div><em>收入</em><b class="up">${fmt(M.inc)}</b></div><div><em>支出</em><b class="down">${fmt(M.exp)}</b></div><div><em>結餘</em><b>${fmt(M.net)}</b></div><div><em>儲蓄率</em><b>${M.rate == null ? '—' : fmt(M.rate, 0) + '%'}</b></div></div>
    ${M.cats.length ? `<div style="margin-top:10px">${M.cats.map(([c, v]) => bar(c, v, M.cats[0][1], catIcon('支出', c))).join('')}</div>` : ''}
    <div class="btn-row" style="margin-top:10px"><button class="btn-primary" data-act="exp">＋ 記支出</button><button class="btn-ghost" data-act="inc">＋ 記收入</button></div></div>
  <div class="card"><h3 class="gold-bar">明細</h3>${rows || '<div class="empty">這個月還沒有紀錄。</div>'}</div>
  <div class="card"><div class="card-head"><h3 class="gold-bar">固定收支與定期定額</h3><button class="btn-small" data-act="recur">＋ 新增</button></div>
    ${rec || '<div class="empty">把薪水、房租、手機費、保費、定期定額設成固定項目，到了扣款日會自動記帳，你只需要記零星花費。</div>'}</div>`;
};

/* ---------- 更多 ---------- */
PAGES.more = () => `<h2>更多功能</h2>
  <div class="tiles">
    ${[['overview', '🧭', '研究總覽', '總經、研究卡、事件一頁看'], ['strategy', '🎯', '策略與配置', '目標配置、部位計算、緊急預備金'], ['trades', '🧾', '交易紀錄', '每一筆買賣與當時的分析'], ['review', '🔁', '覆盤', '檢討做對做錯什麼'], ['monitor', '🔔', '監控提醒', '價格、RSI 到點提醒'], ['learn', '📖', '技術分析教學', '9 堂課＋小測驗'], ['settings', '⚙︎', '設定與備份', '匯出、匯入、範例資料']]
      .map(([p, ic, t, s]) => `<button class="tile" data-go="${p}"><i>${ic}</i><b>${t}</b><em>${s}</em></button>`).join('')}
  </div>`;

/* ---------- 分頁群組 ---------- */
const GROUPS = {
  home: [['home', '資產']], ledger: [['ledger', '收支']],
  research: [['cards', '研究卡'], ['industry', '產業定位'], ['etf', 'ETF 健檢'], ['claims', '待驗主張'], ['learn', '技術教學']],
  market: [['macro', '總經'], ['monitor', '監控'], ['overview', '研究總覽']],
  more: [['more', '全部'], ['strategy', '策略'], ['trades', '交易紀錄'], ['review', '覆盤'], ['settings', '設定']],
};
const groupOf = p => Object.keys(GROUPS).find(g => GROUPS[g].some(x => x[0] === p)) || 'more';
window.subNav = p => { const g = GROUPS[groupOf(p)]; return g.length > 1 ? `<div class="subnav">${g.map(([k, l]) => `<button data-go="${k}" class="${k === p ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''; };
const _goW = go;
go = function (page) { _goW(page); const g = groupOf(current); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === g)); };

/* ---------- 動作 ---------- */
function sheet(kind) {
  const all = [['exp', '➖', '記支出'], ['inc', '➕', '記收入'], ['buy', '📈', '買進股票／ETF'], ['sell', '📉', '賣出'], ['import', '📋', '匯入券商庫存'], ['recur', '🔁', '固定收支／定期定額'], ['addAcct', '🏦', '存款帳戶'], ['addIns', '🛡️', '保單'], ['addProp', '🏠', '房產']];
  const list = kind === 'asset' ? all.slice(6).concat([all[4]]) : all;
  openModal({ title: kind === 'asset' ? '新增資產' : '要記什麼？', noSave: true, body: `<div class="tiles sm">${list.map(([a, ic, t]) => `<button type="button" class="tile" data-act="${a}"><i>${ic}</i><b>${t}</b></button>`).join('')}</div>` });
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-hbuy],[data-hsell],[data-hdet],[data-dca],[data-dcaskip],#fab,#qRefresh,#walletToAlloc');
  if (!t) return;
  if (t.id === 'fab') return sheet();
  if (t.id === 'qRefresh') return refreshHoldQuotes(true);
  if (t.dataset.hbuy) return openTradeForm({ code: t.dataset.hbuy, side: '買進' });
  if (t.dataset.hsell) return openTradeForm({ code: t.dataset.hsell, side: '賣出' });
  if (t.dataset.hdet) return holdingDetail(t.dataset.hdet);
  if (t.dataset.dca) return confirmDca(t.dataset.dca);
  if (t.dataset.dcaskip) { S.pendingDca = S.pendingDca.filter(x => x.id !== t.dataset.dcaskip); save(); render(); return toast('已略過這一期'); }
  if (t.id === 'walletToAlloc') {
    const W = wealth(), set = (re, v) => { const a = S.alloc.find(x => re.test(x.name)); if (a) a.value = String(Math.round(v)); };
    set(/台股/, W.tw); set(/美股|海外/, W.us + W.invIns); set(/債券|固定/, W.savIns); set(/現金/, W.cash);
    save(); go('strategy'); return toast('已帶入目前市值（投資型保單併入海外、儲蓄險併入固定收益）');
  }
  switch (t.dataset.act) {
    case 'exp': return openLedger({ type: '支出' });
    case 'inc': return openLedger({ type: '收入' });
    case 'buy': return openTradeForm({ side: '買進' });
    case 'sell': return openTradeForm({ side: '賣出' });
    case 'import': return openImport();
    case 'recur': return openRecurring(null);
    case 'addAcct': return editAsset('accounts');
    case 'addIns': return editAsset('insurance');
    case 'addProp': return editAsset('property');
    case 'sheet': return sheet();
    case 'sheetAsset': return sheet('asset');
    case 'mprev': S.ledgerMonth = shiftMonth(S.ledgerMonth || ym(today()), -1); return render();
    case 'mnext': S.ledgerMonth = shiftMonth(S.ledgerMonth || ym(today()), 1); return render();
  }
});
document.addEventListener('change', e => { if (e.target.id === 'showProp') { S.showProp = e.target.checked; save(); const y = scrollY; render(); scrollTo(0, y); } });
const _editW = editRecord;
editRecord = function (key, id) {
  if (key === 'accounts' || key === 'insurance' || key === 'property') return editAsset(key, id);
  if (key === 'ledger') return openLedger({}, id);
  if (key === 'recurring') return openRecurring(id);
  return _editW(key, id);
};

/* ---------- 啟動 ---------- */
document.body.insertAdjacentHTML('beforeend', '<button class="fab" id="fab" aria-label="新增紀錄">＋</button>');
processRecurring();
loadFx();
go(window.__startPage || 'home');
