// Vercel Serverless Function：雲端盯盤＋Telegram 通知
// 網站關著也會檢查：GitHub Actions 盤中每 10 分鐘呼叫 /api/watch?run=1。
// 監控清單存在你和機器人的 Telegram 對話裡（置頂的 watch.json 檔），不需要另外的資料庫。
//
// 需要的環境變數（在 Vercel 專案 Settings → Environment Variables 自己貼上）：
//   TG_BOT_TOKEN  BotFather 給的機器人金鑰
//   TG_CHAT_ID    （選填）你的 chat id；沒填時，網站「連結 Telegram」後會自動記住
//
// GET  ?status=1                 機器人是否設定好、機器人帳號
// GET  ?link=CODE                找到傳了「/start CODE」的對話，完成連結
// GET  ?state=1&chat=ID          目前雲端的監控清單（含已觸發）
// POST ?sync=1   {chat, mons}    更新雲端監控清單
// POST ?send=1   {chat, text}    傳一則通知（網站判斷「動作改變」時用）
// GET  ?run=1                    檢查所有條件，觸發就通知
'use strict';

const TOKEN = process.env.TG_BOT_TOKEN || '';
const API = m => `https://api.telegram.org/bot${TOKEN}/${m}`;
const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)', Accept: 'application/json' };
const T = ms => AbortSignal.timeout(ms);
const STORE_LANG = 'zu'; // 用一個幾乎沒人用的語言欄位，記住 chat id（不會顯示給一般使用者）

async function tg(method, body, ms = 10000) {
  const r = await fetch(API(method), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: T(ms) });
  const j = await r.json(); if (!j.ok) throw new Error(`Telegram ${method}：${j.description || r.status}`); return j.result;
}
async function chatId() {
  if (process.env.TG_CHAT_ID) return String(process.env.TG_CHAT_ID);
  const d = await tg('getMyShortDescription', { language_code: STORE_LANG }).catch(() => null);
  const m = /chat:(-?\d+)/.exec(d?.short_description || ''); return m ? m[1] : null;
}
async function readStore(chat) {
  const c = await tg('getChat', { chat_id: chat });
  const doc = c.pinned_message?.document; if (!doc || doc.file_name !== 'watch.json') return { mons: [], msg: null };
  const f = await tg('getFile', { file_id: doc.file_id });
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.file_path}`, { signal: T(10000) });
  const j = await r.json(); return { mons: Array.isArray(j.mons) ? j.mons : [], msg: c.pinned_message.message_id, updated: j.updated };
}
async function writeStore(chat, mons, oldMsg) {
  const body = JSON.stringify({ v: 1, updated: new Date().toISOString(), mons }, null, 1);
  const fd = new FormData();
  fd.append('chat_id', chat); fd.append('disable_notification', 'true');
  fd.append('caption', `📌 監控清單（${mons.filter(m => !m.fired).length} 個啟用中）・網站自動更新，請勿刪除`);
  fd.append('document', new Blob([body], { type: 'application/json' }), 'watch.json');
  const r = await fetch(API('sendDocument'), { method: 'POST', body: fd, signal: T(15000) });
  const j = await r.json(); if (!j.ok) throw new Error('Telegram sendDocument：' + j.description);
  await tg('pinChatMessage', { chat_id: chat, message_id: j.result.message_id, disable_notification: true });
  if (oldMsg) await tg('deleteMessage', { chat_id: chat, message_id: oldMsg }).catch(() => {}); // 48 小時以上的舊訊息刪不掉，沒關係
}

/* ---------- 股價（Yahoo，盤中約延遲 20 分鐘以內） ---------- */
const sma = (a, n) => a.length >= n ? a.slice(-n).reduce((x, y) => x + y, 0) / n : null;
function rsi(c, n = 14) {
  if (c.length <= n) return null; let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; d > 0 ? (g += d) : (l -= d); } g /= n; l /= n;
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
async function yq(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=6mo&interval=1d`, { headers: UA, signal: T(9000) });
  if (!r.ok) throw new Error('Yahoo HTTP ' + r.status);
  const R = (await r.json()).chart?.result?.[0]; if (!R?.meta?.regularMarketPrice) throw new Error('查無股價');
  return R;
}
async function snap(code) {
  const tw = /^\d/.test(code);
  let R; if (tw) { try { R = await yq(code + '.TW'); } catch (e) { R = await yq(code + '.TWO'); } } else R = await yq(code);
  const M = R.meta, c = (R.indicators.quote[0].close || []).filter(x => x != null), last = M.regularMarketPrice;
  if (c.length) c[c.length - 1] = last;
  const ma20 = sma(c, 20), ma60 = sma(c, 60), r = v => v == null ? null : Math.round(v * 100) / 100;
  return { last, hi: M.regularMarketDayHigh ?? last, lo: M.regularMarketDayLow ?? last, t: M.regularMarketTime, ma20: r(ma20), ma60: r(ma60), rsi: r(rsi(c)),
    d20: ma20 ? r((last / ma20 - 1) * 100) : null, d60: ma60 ? r((last / ma60 - 1) * 100) : null, chg20: c.length > 20 ? r((last / c[c.length - 21] - 1) * 100) : null };
}
const tick = (p, tw) => !tw ? 0.01 : p < 10 ? 0.01 : p < 50 ? 0.05 : p < 100 ? 0.1 : p < 500 ? 0.5 : p < 1000 ? 1 : 5;
const rnd = (p, tw, up) => { const t = tick(p, tw); return Math.round((up ? Math.ceil(p / t) : Math.floor(p / t)) * t * 100) / 100; };
const fmt = p => p == null ? '—' : p >= 100 ? (Math.round(p * 10) / 10).toLocaleString('en-US') : String(Math.round(p * 100) / 100);

// 判斷一個條件：價格用「今天最高／最低價」判斷，兩次檢查之間碰到也算
function test(m, s) {
  const tw = /^\d/.test(m.code); let v, hit, thr = Number(m.value), how = '';
  if (m.dyn && s[m.dyn]) { thr = rnd(s[m.dyn] * (m.stop ? 0.97 : 1), tw, m.op === '高於'); }
  if (!m.metric || m.metric === '收盤價') {
    v = s.last; hit = m.op === '低於' ? s.lo <= thr : s.hi >= thr;
    if (hit && (m.op === '低於' ? s.last > thr : s.last < thr)) how = `（盤中曾${m.op === '低於' ? '跌到' : '漲到'} ${fmt(m.op === '低於' ? s.lo : s.hi)}）`;
  } else {
    v = { 'RSI': s.rsi, '距 20 日均線 %': s.d20, '距 60 日均線 %': s.d60, '近 20 日漲跌 %': s.chg20 }[m.metric];
    hit = v != null && (m.op === '低於' ? v < thr : v > thr);
  }
  return { hit, v, thr, how };
}

async function run() {
  const chat = await chatId(); if (!chat) return { skipped: '還沒連結 Telegram' };
  const st = await readStore(chat), live = st.mons.filter(m => !m.fired && m.code);
  if (!live.length) return { checked: 0 };
  const codes = [...new Set(live.map(m => m.code))], S = {};
  await Promise.all(codes.map(async k => { try { S[k] = await snap(k); } catch (e) { S[k] = null; } }));
  const hits = [], now = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
  live.forEach(m => {
    const s = S[m.code]; if (!s) return;
    const r = test(m, s); m.last = s.last; m.checked = now;
    if (!r.hit) return;
    m.fired = now;
    const sh = m.shares ? `\n🧾 條件單參考：${m.side === 'buy' ? '買進' : '賣出'} ${m.code}・觸發價 ${fmt(r.thr)}・${m.side === 'buy' ? '' : `股數 ${m.shares.toLocaleString('en-US')}（分批可先賣 ${Math.floor(m.shares / 3).toLocaleString('en-US')}）`}` : '';
    hits.push(`🔔 <b>${esc(m.target || m.code)}</b>\n${esc(m.cond || `${m.metric || '價格'} ${m.op} ${fmt(r.thr)}`)}\n現價 <b>${fmt(s.last)}</b>${r.how}\n👉 ${esc(m.action || '回網站研究卡確認後再動作')}${sh}`);
  });
  if (hits.length) {
    for (const h of hits) await tg('sendMessage', { chat_id: chat, text: h, parse_mode: 'HTML', disable_web_page_preview: true });
    await writeStore(chat, st.mons, st.msg);
  }
  return { checked: live.length, fired: hits.length };
}
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}
const KEEP = ['id', 'code', 'target', 'metric', 'op', 'value', 'dyn', 'stop', 'cond', 'action', 'side', 'shares', 'lvl'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  try {
    if (!TOKEN) { res.status(200).json({ ok: false, error: '還沒設定 TG_BOT_TOKEN' }); return; }
    if (q.status) { const me = await tg('getMe'); const c = await chatId(); res.status(200).json({ ok: true, bot: me.username, linked: !!c }); return; }
    if (q.link) {
      const code = String(q.link).replace(/[^\w-]/g, '').slice(0, 40);
      const ups = await tg('getUpdates', { allowed_updates: ['message'], timeout: 0 });
      const u = [...ups].reverse().find(x => (x.message?.text || '').trim() === `/start ${code}`);
      if (!u) { res.status(200).json({ ok: false, wait: true }); return; }
      const chat = String(u.message.chat.id);
      await tg('setMyShortDescription', { short_description: `chat:${chat}`, language_code: STORE_LANG });
      await tg('getUpdates', { offset: u.update_id + 1, timeout: 0 }).catch(() => {});
      await tg('sendMessage', { chat_id: chat, text: '✅ 已連結「AI 投資筆記」\n之後到價提醒、研究卡動作改變（例如可以停利了），都會傳到這裡。網站關著也會檢查：台股盤中約每 10 分鐘、美股盤中約每 20 分鐘。' });
      res.status(200).json({ ok: true, chat }); return;
    }
    if (q.run) { res.status(200).json({ ok: true, ...(await run()) }); return; }
    const chat = await chatId(), B = req.method === 'POST' ? await body(req) : {};
    const want = String(q.chat || B.chat || '');
    if (!chat || want !== chat) { res.status(200).json({ ok: false, error: '尚未連結，或對話不符' }); return; }
    if (q.state) { const st = await readStore(chat); res.status(200).json({ ok: true, mons: st.mons, updated: st.updated }); return; }
    if (req.method === 'POST' && q.sync) {
      const b = B, st = await readStore(chat), old = new Map(st.mons.map(m => [m.id, m]));
      const mons = (b.mons || []).slice(0, 80).map(m => { const o = {}; KEEP.forEach(k => { if (m[k] != null && m[k] !== '') o[k] = m[k]; }); const p = old.get(o.id); if (p?.fired && String(p.value) === String(o.value)) o.fired = p.fired; return o; });
      const same = JSON.stringify(mons.map(m => [m.id, m.value, m.op, m.fired])) === JSON.stringify(st.mons.map(m => [m.id, m.value, m.op, m.fired]));
      if (!same) await writeStore(chat, mons, st.msg);
      res.status(200).json({ ok: true, n: mons.length, changed: !same }); return;
    }
    if (req.method === 'POST' && q.send) {
      const b = B; const text = String(b.text || '').slice(0, 3500); if (!text) throw new Error('沒有內容');
      await tg('sendMessage', { chat_id: chat, text, disable_web_page_preview: true }); res.status(200).json({ ok: true }); return;
    }
    res.status(400).json({ ok: false, error: '不支援的操作' });
  } catch (e) { res.status(200).json({ ok: false, error: e.message }); }
};
