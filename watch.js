/* ================= 雲端盯盤＋Telegram 通知 =================
   1. 持有中的股票自動設好停利／移動停利／停損價位（不用自己按）。
   2. 監控清單自動同步到雲端，網站關著時由雲端盤中定時檢查，觸發就傳 Telegram。
   3. 研究卡的「現在該怎麼做」變成停利、賣出、買進這類動作時，也會通知。
   4. 「複製給券商」改成條件單格式，貼到券商 App 的觸價／停損停利單，由券商主機自動執行。 */
S.tg = S.tg || {};
S.stPrev = S.stPrev || {};
if (S.autoLvl == null) S.autoLvl = true;
const TG_SELL = /停利|賣出|減碼|停損|出場/, TG_BUY = /承接|買進|加碼|分批買|好價/;
const tgOn = () => !!S.tg.chat && location.protocol.startsWith('http');
async function tgApi(q, data) {
  const r = await fetch('api/watch?' + q, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(30000) } : { signal: AbortSignal.timeout(30000) });
  return r.json();
}
// 把網站的監控條件轉成雲端用的格式（附上持股數、買／賣方向，給條件單參考）
function tgMons() {
  return S.monitors.filter(m => m.status === '啟用' && m.code && num(m.value) != null).map(m => {
    const kind = (m.lvl || '').replace(/[^a-z]/g, ''), h = typeof holdOf === 'function' ? holdOf(m.code) : null;
    const side = ['tp', 'trail', 'stop'].includes(kind) ? 'sell' : ['buy', 'break'].includes(kind) ? 'buy' : (h && m.op === '低於' ? 'sell' : '');
    return { id: m.id, code: String(m.code).toUpperCase(), target: m.target, metric: m.metric, op: m.op, value: m.value, dyn: m.dyn || '', stop: kind === 'stop' ? 1 : 0, cond: m.cond, action: m.action, lvl: m.lvl, side, shares: side === 'sell' && h ? h.shares : 0 };
  });
}
let tgSig = '', tgTimer = null, tgBusy = false;
async function tgSync(force) {
  if (!tgOn() || tgBusy) return;
  const mons = tgMons(), sig = JSON.stringify(mons.map(m => [m.id, m.value, m.op, m.shares]));
  if (!force && sig === (S.tg.sig || tgSig)) return;
  tgBusy = true;
  try { const r = await tgApi('sync=1', { chat: S.tg.chat, mons }); if (r.ok) { S.tg.sig = tgSig = sig; S.tg.synced = new Date().toISOString(); S.tg.err = ''; } else S.tg.err = r.error; }
  catch (e) { S.tg.err = '同步失敗（網路）'; }
  tgBusy = false; _tgSave();
}
// 雲端觸發過的條件，回到網站時標成「已觸發」
async function tgPull() {
  if (!tgOn()) return;
  try {
    const r = await tgApi('state=1&chat=' + encodeURIComponent(S.tg.chat)); if (!r.ok) return;
    const fired = r.mons.filter(m => m.fired); let n = 0;
    fired.forEach(f => { const m = S.monitors.find(x => x.id === f.id && x.status === '啟用'); if (m) { m.status = '已觸發'; m.triggeredAt = f.fired.slice(0, 10); m.lastVal = f.last; n++; S.monAlerts = [...(S.monAlerts || []), `${m.target || m.code}：${m.cond || ''}（雲端 ${f.fired} 觸發，已傳 Telegram）`]; } });
    if (n) { _tgSave(); if (['monitor', 'home', 'timing'].includes(current)) render(); }
  } catch (e) { /* ignore */ }
}
async function tgSend(text) { if (!tgOn()) return; try { await tgApi('send=1', { chat: S.tg.chat, text }); } catch (e) { /* ignore */ } }
// 每次存檔後，條件有變就同步（延後 3 秒合併）
const _tgSave = save;
save = function () { _tgSave.apply(this, arguments); if (tgOn()) { clearTimeout(tgTimer); tgTimer = setTimeout(() => tgSync(false), 3000); } };

/* ---------- 持有中自動設價位 ---------- */
function autoLevels() {
  if (!S.autoLvl || typeof priceLevels !== 'function') return 0;
  let n = 0; const recent = d => d && (Date.now() - new Date(d)) < 5 * 864e5;
  S.cards.filter(c => c.code && !c.example).forEach(c => {
    const x = assetCheck(c); if (!x?.h) return;
    priceLevels(x).forEach(l => {
      const key = l.kind + l.label, code = x.code;
      const on = S.monitors.find(m => m.status === '啟用' && m.code === code && m.lvl === key);
      const fired = S.monitors.find(m => m.status === '已觸發' && m.code === code && m.lvl === key && recent(m.triggeredAt));
      if (on || fired) return; // 已在監控，或 5 天內剛觸發過：不重設
      S.monitors.push({ id: uid(), target: `${code} ${c.name || ''}`.trim(), code, metric: '收盤價', op: l.op, value: String(l.p), dyn: l.dyn, lvl: key, auto: 1,
        cond: `${l.label}：${VERB[l.kind]} ${fmtP(l.p)}（${l.why}${l.dyn ? '，價位每日跟著均線更新' : ''}）`,
        action: { tp: '先賣 1/3～1/2 鎖住獲利', trail: '移動停利：賣出一部分，其餘跌破季線再賣', stop: '對照「證明我錯」條件，論點被推翻就出場', buy: '依分批計畫買進一批', break: '趨勢轉強：買第一批' }[l.kind],
        notify: tgOn() ? 'Telegram' : '網站內提醒', status: '啟用' });
      n++;
    });
  });
  return n;
}
/* ---------- 研究卡「現在該怎麼做」改變時通知 ---------- */
function verdictWatch() {
  const msgs = [];
  S.cards.filter(c => c.code && !c.example).forEach(c => {
    const k = String(c.code).toUpperCase(); if (!cqOf(k)?.n) return; // 還沒拿到最新股價前不判斷，避免誤報
    const x = assetCheck(c); if (!x?.st?.[0]) return;
    const now = x.st[0], was = S.stPrev[k];
    S.stPrev[k] = now;
    if (!was || was === now) return;
    const act = (x.h && TG_SELL.test(now)) || (!x.h && TG_BUY.test(now)) || (x.h && TG_BUY.test(now));
    if (act) msgs.push(`${x.h ? '💼' : '👀'} ${k} ${c.name || ''}：「${was}」→「${now}」\n${x.st[2] || ''}${x.h ? `\n持有 ${x.h.shares.toLocaleString()} 股` : ''}`);
  });
  if (msgs.length) {
    S.monAlerts = [...(S.monAlerts || []), ...msgs.map(m => m.replace(/\n/g, '　'))];
    tgSend('📣 研究卡動作改變\n\n' + msgs.join('\n\n'));
    if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.getRegistration().then(reg => { const o = { body: msgs.join('\n'), icon: 'icons/icon-192.png' }; reg ? reg.showNotification('研究卡動作改變', o) : new Notification('研究卡動作改變', o); }).catch(() => {});
  }
  return msgs.length;
}
// 股價更新完後：自動設價位、檢查動作改變
const _rcqTg = refreshCardQuotes;
refreshCardQuotes = async function () {
  await _rcqTg.apply(this, arguments);
  try { const a = autoLevels(), v = verdictWatch(); if (a || v) save(); else save(); } catch (e) { console.warn(e); }
};

/* ---------- 條件單格式（複製給券商） ---------- */
window.addEventListener('click', e => {
  const t = e.target.closest('[data-cplvl]'); if (!t) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const code = t.dataset.cplvl, c = S.cards.find(y => y.code === code && !y.example) || S.cards.find(y => y.code === code); if (!c) return;
  const x = assetCheck(c), L = priceLevels(x), sh = x.h?.shares || 0, lot = /^\d/.test(code) ? 1000 : 1;
  const part = n => { const v = Math.floor(sh * n / lot) * lot; return v > 0 ? v : sh; };
  const row = l => {
    const sell = ['tp', 'trail', 'stop'].includes(l.kind), q = sell ? (l.kind === 'stop' ? sh : part(l.kind === 'tp' ? 1 / 3 : 1 / 2)) : 0;
    return `・${l.label}｜${sell ? '賣出' : '買進'}｜觸發：成交價${l.op === '高於' ? '≧' : '≦'} ${fmtP(l.p)}｜委託：${l.kind === 'stop' || l.kind === 'trail' ? '市價（確保成交）' : `限價 ${fmtP(l.p)}`}${sell && sh ? `｜${q.toLocaleString()} 股` : ''}${l.dyn ? '｜⚠ 均線價位每天會變，建議每週更新一次' : ''}`;
  };
  copy(`${code} ${c.name || ''} 條件單（觸價單／停損停利單）\n${L.map(row).join('\n')}\n有效期間：選「長效」或最長天數`);
  toast('已複製條件單內容，貼到券商 App 的「條件單／智慧單」');
}, true);

/* ---------- 監控頁：Telegram 設定卡 ---------- */
let tgSt = null, tgLinkCode = null, tgPoll = null;
async function tgStatus() { try { tgSt = await tgApi('status=1'); } catch (e) { tgSt = { ok: false, error: '連不到伺服器' }; } if (current === 'monitor') { const y = scrollY; render(); scrollTo(0, y); } }
function tgCard() {
  const on = tgOn(), mons = tgMons(), auto = S.monitors.filter(m => m.auto && m.status === '啟用').length;
  const st = !tgSt ? '<span class="tg-s">檢查中…</span>' : !tgSt.ok ? `<span class="tg-s bad">⚠ ${esc(tgSt.error || '機器人未設定')}</span>` : on ? `<span class="tg-s ok">✅ 已連結 @${esc(tgSt.bot)}</span>` : `<span class="tg-s">機器人 @${esc(tgSt.bot)} 已就緒，尚未連結</span>`;
  const setup = tgSt && !tgSt.ok ? `<ol class="tg-steps"><li>Telegram 搜尋 <b>@BotFather</b> → 傳 <code>/newbot</code> → 取名字（例如「我的盯盤」）→ 拿到一串金鑰</li>
      <li>到 Vercel 專案 <b>invest-notebook → Settings → Environment Variables</b>，新增 <code>TG_BOT_TOKEN</code>，值貼上金鑰（請自己貼，不要傳給任何人）</li>
      <li>Vercel 的 Deployments 按最新一筆的「Redeploy」，回來這頁按「重新檢查」</li></ol><button class="btn-small ghost" data-tg="re">重新檢查</button>` : '';
  const link = tgSt?.ok && !on ? `<button class="btn-small" data-tg="link">📲 連結 Telegram</button><div class="help">會開啟 Telegram，按下「開始（Start）」後回到這裡${tgLinkCode ? '，等待中…' : ''}</div>` : '';
  const linked = on ? `<div class="tg-info">雲端監控 <b>${mons.length}</b> 個條件${auto ? `（其中 ${auto} 個是持有股自動設的）` : ''}・${S.tg.synced ? `上次同步 ${(d => `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)(new Date(S.tg.synced))}` : '尚未同步'}${S.tg.err ? `・<span class="bad">${esc(S.tg.err)}</span>` : ''}</div>
      <div class="btn-row"><button class="btn-small" data-tg="sync">立即同步</button><button class="btn-small ghost" data-tg="test">傳測試訊息</button><button class="btn-small ghost" data-tg="off">取消連結</button></div>` : '';
  return `<div class="card tg-card"><h3 class="gold-bar">📲 網站關著也通知我（Telegram）</h3>${st}
    <div class="pl-note"><div class="ok">✅ 雲端盤中檢查：台股約每 10 分鐘、美股約每 20 分鐘；用「當天最高／最低價」判斷，兩次檢查之間碰到也會通知。</div>
    <div class="ok">✅ 持有中的股票自動設好停利、移動停利、停損價位；研究卡動作變成「停利／賣出」時也會通知。</div>
    <div class="no">⚠️ 股價約延遲 20 分鐘以內。想要「到價自動成交」，請按研究卡的「📋 複製給券商」貼到券商條件單。</div></div>
    ${setup}${link}${linked}
    <label class="tg-auto"><input type="checkbox" data-tg="auto" ${S.autoLvl ? 'checked' : ''}> 持有中的股票自動設到價提醒</label></div>`;
}
const _monTg = PAGES.monitor;
PAGES.monitor = () => {
  if (!tgSt) setTimeout(tgStatus, 20);
  let h = _monTg();
  // 拿掉已過時的說明（「網站關著收不到」），改放 Telegram 卡在最上面
  const i = h.indexOf('<div class="card"><h3 class="gold-bar">📣 到價通知做得到什麼</h3>'), j = h.indexOf('<div class="card"><h3 class="gold-bar">系統自動監控</h3>');
  if (i >= 0 && j > i) h = h.slice(0, i) + h.slice(j);
  h = h.replace('網站關閉時無法推播（這是純網頁的限制）。', '網站關著時，改由雲端檢查並傳 Telegram（見上方）。').replace(/<br>\s*・想在沒開網站時也收到通知：[^<]*<b>[^<]*<\/b>[^<]*/, '');
  const k = h.indexOf('<div class="card"><h3 class="gold-bar">怎麼提醒我？</h3>');
  return k >= 0 ? h.slice(0, k) + tgCard() + h.slice(k) : tgCard() + h;
};
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-tg]'); if (!t || t.tagName === 'INPUT') return; e.preventDefault();
  const a = t.dataset.tg, rr = () => { const y = scrollY; render(); scrollTo(0, y); };
  if (a === 're') { tgSt = null; rr(); tgStatus(); }
  if (a === 'link') {
    tgLinkCode = 'in' + Math.random().toString(36).slice(2, 12);
    window.open(`https://t.me/${tgSt.bot}?start=${tgLinkCode}`, '_blank'); rr();
    clearInterval(tgPoll); let k = 0;
    tgPoll = setInterval(async () => {
      if (++k > 40) { clearInterval(tgPoll); tgLinkCode = null; toast('沒有等到 Telegram 的「開始」，請再按一次連結'); rr(); return; }
      try { const r = await tgApi('link=' + tgLinkCode); if (r.ok) { clearInterval(tgPoll); tgLinkCode = null; S.tg.chat = r.chat; S.tg.sig = ''; autoLevels(); save(); await tgSync(true); toast('✅ Telegram 已連結，監控清單已上傳'); rr(); } } catch (err) { /* keep polling */ }
    }, 3000);
  }
  if (a === 'sync') { await tgSync(true); toast(S.tg.err ? '同步失敗：' + S.tg.err : '已同步到雲端'); rr(); }
  if (a === 'test') { await tgSend('🔔 測試：AI 投資筆記的通知可以正常收到'); toast('已傳送，請看 Telegram'); }
  if (a === 'off') { S.tg = {}; save(); toast('已取消連結（雲端不再通知）'); rr(); }
});
document.addEventListener('change', e => {
  const t = e.target.closest('input[data-tg="auto"]'); if (!t) return;
  S.autoLvl = t.checked; if (t.checked) { const n = autoLevels(); toast(n ? `已為持有股設 ${n} 個到價提醒` : '持有股的到價提醒都已設好'); } save(); render();
});
// 打開網站時：拉回雲端觸發結果、確保清單已同步
setTimeout(() => { tgPull(); tgSync(false); }, 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tgPull(); });
if (current === 'monitor') render();
