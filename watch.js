/* ================= 到價通知：交給券商 App =================
   網站關著時無法推播，所以到價通知交給券商 App（券商主機即時盯盤、手機推播，不需任何金鑰）。
   網站負責：算好價位、持有股自動設提醒、一鍵複製成券商到價通知／條件單的格式。 */
S.stPrev = S.stPrev || {};
if (S.autoLvl == null) S.autoLvl = true;
delete S.tg; // 舊版雲端通知設定，已停用
const TG_SELL = /停利|賣出|減碼|停損|出場/, TG_BUY = /承接|買進|加碼|分批買|好價/;

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
        notify: '券商到價通知', status: '啟用' });
      n++;
    });
  });
  return n;
}
/* ---------- 研究卡「現在該怎麼做」改變時提醒（打開網站時） ---------- */
function verdictWatch() {
  const msgs = [];
  S.cards.filter(c => c.code && !c.example).forEach(c => {
    const k = String(c.code).toUpperCase(); if (!cqOf(k)?.n) return; // 還沒拿到最新股價前不判斷，避免誤報
    const x = assetCheck(c); if (!x?.st?.[0]) return;
    const now = x.st[0], was = S.stPrev[k];
    S.stPrev[k] = now;
    if (!was || was === now) return;
    if (TG_SELL.test(now) || TG_BUY.test(now)) msgs.push(`${x.h ? '💼' : '👀'} ${k} ${c.name || ''}：「${was}」→「${now}」${x.h ? `（持有 ${x.h.shares.toLocaleString()} 股）` : ''}`);
  });
  if (msgs.length) {
    S.monAlerts = [...(S.monAlerts || []), ...msgs];
    if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.getRegistration().then(reg => { const o = { body: msgs.join('\n'), icon: 'icons/icon-192.png' }; reg ? reg.showNotification('研究卡動作改變', o) : new Notification('研究卡動作改變', o); }).catch(() => {});
  }
  return msgs.length;
}
// 股價更新完後：自動設價位、檢查動作改變
const _rcqW = refreshCardQuotes;
refreshCardQuotes = async function () {
  await _rcqW.apply(this, arguments);
  try { autoLevels(); verdictWatch(); save(); } catch (e) { console.warn(e); }
};

/* ---------- 複製給券商：到價通知＋條件單 ---------- */
window.addEventListener('click', e => {
  const t = e.target.closest('[data-cplvl]'); if (!t) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const code = t.dataset.cplvl, c = S.cards.find(y => y.code === code && !y.example) || S.cards.find(y => y.code === code); if (!c) return;
  const x = assetCheck(c), L = priceLevels(x), sh = x.h?.shares || 0;
  const alert = L.map(l => `・${l.label}：${l.op === '高於' ? '漲到' : '跌到'} ${fmtP(l.p)}${l.dyn ? '（跟著均線，每週更新）' : ''}`).join('\n');
  const order = L.filter(l => ['tp', 'trail', 'stop'].includes(l.kind) && sh).map(l => `・${l.label}｜賣出｜成交價${l.op === '高於' ? '≧' : '≦'} ${fmtP(l.p)}｜${l.kind === 'tp' ? `限價 ${fmtP(l.p)}` : '市價'}｜${(l.kind === 'stop' ? sh : Math.max(1, Math.floor(sh / 3))).toLocaleString()} 股`).join('\n');
  copy(`${code} ${c.name || ''}\n【到價通知】\n${alert}${order ? `\n【條件單（想到價自動賣才需要）】\n${order}` : ''}`);
  toast('已複製，到券商 App 設到價通知');
}, true);

/* ---------- 監控頁：說明怎麼設券商到價通知 ---------- */
function brokerCard() {
  const held = S.cards.filter(c => c.code && !c.example && typeof holdOf === 'function' && holdOf(c.code)).map(c => ({ c, L: priceLevels(assetCheck(c)) })).filter(o => o.L.length);
  return `<div class="card bk-card"><h3 class="gold-bar">🔔 到價通知：交給券商 App</h3>
    <div class="help" style="font-size:13px">網頁開著時（電腦放在背景分頁也可以）每 10 分鐘會自動檢查並跳通知；網頁關著時沒辦法推播，所以請同時把到價通知設在券商 App：券商主機即時盯盤、到價就推播到手機，不用任何金鑰，也不會有延遲。</div>
    <ol class="bk-steps"><li>按下面股票的「📋 複製」，價位會整理好</li><li>券商 App → 自選股／報價 → 點股票 → 🔔「到價通知」（有的叫「價格提醒」「警示」）</li><li>每個價位設一筆：「漲到 ≧」或「跌到 ≦」</li><li>移動停利、停損會跟著均線變，<b>每週回來看一次</b>，價位變了就改</li></ol>
    ${held.length ? `<div class="bk-list">${held.map(({ c, L }) => `<div class="bk-r"><b>${esc(c.code)} ${esc(c.name || '')}</b><span>${L.map(l => `<i class="${LV_C[l.kind]}">${l.label} ${fmtP(l.p)}</i>`).join('')}</span><button class="btn-small ghost" data-cplvl="${esc(c.code)}">📋 複製</button></div>`).join('')}</div>` : '<div class="help">目前沒有持有中的股票有價位。</div>'}
    <label class="tg-auto"><input type="checkbox" data-autolvl ${S.autoLvl ? 'checked' : ''}> 持有中的股票自動算好停利／停損價位</label></div>`;
}
const _monW = PAGES.monitor;
PAGES.monitor = () => {
  let h = _monW();
  const i = h.indexOf('<div class="card"><h3 class="gold-bar">📣 到價通知做得到什麼</h3>'), j = h.indexOf('<div class="card"><h3 class="gold-bar">系統自動監控</h3>');
  if (i >= 0 && j > i) h = h.slice(0, i) + h.slice(j);
  h = h.replace('網站關閉時無法推播（這是純網頁的限制）。', '網站關著時無法推播，到價通知請設在券商 App（見上方）。').replace(/<br>\s*・想在沒開網站時也收到通知：[^<]*<b>[^<]*<\/b>[^<]*/, '');
  h = h.replace('>開啟手機通知<', '>開啟通知（電腦／手機）<').replace('按「開啟手機通知」', '按「開啟通知」').replace('最多每 30 分鐘一次', '最多每 10 分鐘一次').replace('網站開著時觸發會跳出系統通知。', '網頁開著時（包含放在背景分頁）每 10 分鐘自動檢查，觸發會跳出系統通知。');
  const k = h.indexOf('<div class="card"><h3 class="gold-bar">怎麼提醒我？</h3>');
  return k >= 0 ? h.slice(0, k) + brokerCard() + h.slice(k) : brokerCard() + h;
};
document.addEventListener('change', e => {
  const t = e.target.closest('input[data-autolvl]'); if (!t) return;
  S.autoLvl = t.checked; if (t.checked) { const n = autoLevels(); toast(n ? `已為持有股設 ${n} 個價位` : '持有股的價位都已設好'); } save(); render();
});
if (current === 'monitor') render();

/* ---------- 打開 App 時的到價提示 ----------
   打開（或切回）App 時：更新股價 → 檢查所有條件 → 跳出視窗列出「已到價」和「接近中（3% 內）」。 */
let monP = Promise.resolve();
const _cmW = checkMonitors;
checkMonitors = function () { monP = Promise.resolve(_cmW.apply(this, arguments)).catch(() => {}); return monP; };
let oaBusy = false, oaLast = 0;
if (S.alertSeenN == null) S.alertSeenN = (S.monAlerts || []).length; // 第一次只提示之後的新提醒
async function openAlert(force) {
  if (oaBusy || !location.protocol.startsWith('http')) return;
  if (!force && Date.now() - oaLast < 10 * 60e3) return;
  if (force === 'tick') { force = false; S.monCheckedAt = 0; }
  oaBusy = true; oaLast = Date.now();
  try { await refreshCardQuotes(false); await checkMonitors(false); await monP; } catch (e) { /* ignore */ }
  oaBusy = false;
  const all = S.monAlerts || [], from = Math.min(S.alertSeenN || 0, all.length), fresh = all.slice(from);
  const near = S.monitors.filter(m => m.status === '啟用' && m.metric === '收盤價' && num(m.lastVal) && num(m.value))
    .map(m => ({ m, d: (num(m.lastVal) / num(m.value) - 1) * 100 }))
    .filter(o => (o.m.op === '低於' ? o.d > 0 : o.d < 0) && Math.abs(o.d) <= 3).sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  S.alertSeenN = all.length;
  const nsig = near.map(o => o.m.id).sort().join(','), nearNew = nsig !== (S.nearSig || ''); S.nearSig = nsig; save();
  if (!fresh.length && !(near.length && (force || nearNew))) return; // 定時檢查時，「接近中」沒變就不重複跳出
  const perm = 'Notification' in window && Notification.permission === 'default';
  const body = `<div class="oa">
    ${fresh.length ? `<div class="oa-sec hit"><b>🔔 已到價／有變化</b>${fresh.map(a => `<div class="oa-i">${esc(a)}</div>`).join('')}</div>` : ''}
    ${near.length ? `<div class="oa-sec near"><b>⏳ 接近中（差 3% 以內）</b>${near.map(({ m, d }) => `<div class="oa-i"><span>${esc(m.target || m.code)}</span><em>${esc((m.cond || '').split('（')[0])}</em><small>現價 ${fmtP(num(m.lastVal))}・還差 ${fmt(Math.abs(d), 1)}%</small></div>`).join('')}</div>` : ''}
    ${perm ? '<button type="button" class="btn-small" data-notify-on>🔔 開啟系統通知（網頁開著、在背景也會跳出）</button>' : ''}
    <div class="help">價格約延遲 20 分鐘；用當天最高／最低價判斷。要到價自動成交，請到研究卡按「📋 複製給券商」設條件單。</div></div>`;
  openModal({ title: fresh.length ? '🔔 到價提示' : '⏳ 快到價了', body, noSave: true });
}
setTimeout(() => openAlert(true), 2500);
// 網頁開著（包含在背景分頁）時：每 10 分鐘自動檢查一次，到價會跳系統通知
setInterval(() => openAlert('tick'), 10 * 60e3);
document.addEventListener('click', e => {
  if (!e.target.closest('[data-notify-on]')) return; e.preventDefault();
  if (!('Notification' in window)) { toast('這個瀏覽器不支援通知'); return; }
  Notification.requestPermission().then(p => { toast(p === 'granted' ? '已開啟通知：網頁開著時到價會跳出' : '沒有取得通知權限'); e.target.closest('[data-notify-on]')?.remove(); });
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') openAlert(false); });
