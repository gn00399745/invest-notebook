/* 總經：主要經濟體圖卡（台灣、美國、中國、日本、歐元區、香港、韓國） */
'use strict';

const ECON = [
  { id: 'global', flag: '🌏', name: '全球' },
  { id: 'tw', flag: '🇹🇼', name: '台灣', imf: 'TWN', rel: '台股基本面的源頭：出口、工業生產與景氣燈號，最直接反映半導體與 AI 供應鏈的熱度。' },
  { id: 'us', flag: '🇺🇸', name: '美國', imf: 'USA', rel: 'AI 伺服器與半導體的最大終端需求；Fed 利率與美元牽動全球資金流向與台股外資。' },
  { id: 'cn', flag: '🇨🇳', name: '中國', imf: 'CHN', rel: '台灣重要的貿易夥伴（含經香港轉口）；內需強弱與產業政策影響傳產、面板、原物料。' },
  { id: 'jp', flag: '🇯🇵', name: '日本', imf: 'JPN', rel: '半導體設備與材料的重要供應國；日圓與日本利率變化會引發亞洲資金移動（套利交易）。' },
  { id: 'eu', flag: '🇪🇺', name: '歐元區', imf: 'EURO', rel: '工業、車用與綠能需求來源；ECB 利率與歐元走勢影響全球資金與出口報價。' },
  { id: 'hk', flag: '🇭🇰', name: '香港', imf: 'HKG', rel: '對中國貿易的轉口樞紐，港股反映中國資金情緒；港幣釘住美元，利率跟隨 Fed。' },
  { id: 'kr', flag: '🇰🇷', name: '韓國', imf: 'KOR', rel: '記憶體、面板的主要競爭對手；出口數據常被當作全球科技需求的溫度計。' },
];
const IND_IC = { gdp: '🏭', cpi: '🛒', core: '🧺', unemp: '👷', export: '🚢', ip: '⚙️', signal: '🚦', cli: '🧭', cliTW: '🧭', rate: '🏦', y10: '📈' };

/* ---------- 資料 ---------- */
let worldBusy = false;
async function loadWorld(force) {
  if (worldBusy || !location.protocol.startsWith('http')) return;
  if (!force && S.world && Date.now() - (S.worldAt || 0) < 6 * 3600e3) {
    if (!S.twOff && !S.twOffTry) { S.twOffTry = 1; fetch('api/twofficial').then(r => r.json()).then(o => { if (o && (o.cbc || o.dgbas || o.orders)) { S.twOff = o; S.twOffAt = Date.now(); save(); if (current === 'macro') { const y = scrollY; render(); scrollTo(0, y); } } }).catch(() => {}); }
    return;
  }
  worldBusy = true; if (current === 'macro') { const st = $('#worldStatus'); if (st) st.textContent = '更新中…（約 10～30 秒）'; }
  try {
    const offP = fetch('api/twofficial', { signal: AbortSignal.timeout(60000) }).then(r => r.json()).then(o => { if (o && (o.cbc || o.dgbas || o.orders)) { S.twOff = o; S.twOffAt = Date.now(); } }).catch(() => {});
    const r = await fetch('api/world', { signal: AbortSignal.timeout(90000) });
    const j = await r.json(); if (!j.economies) throw new Error('格式錯誤');
    await offP;
    S.world = j; S.worldAt = Date.now(); save();
    if (force) toast(j.errors?.length ? `已更新（${j.errors.length} 項來源失敗）` : '已更新各國數據');
  } catch (e) { if (force) toast('更新失敗：' + e.message); S.worldErr = e.message; }
  worldBusy = false;
  if (current === 'macro') { const y = scrollY; render(); scrollTo(0, y); }
}

/* ---------- 判讀 ---------- */
function judge(x) {
  const v = x.v, p = x.prev, up = p != null && v > p, dn = p != null && v < p, d = p != null ? v - p : null;
  const trend = up ? '上升' : dn ? '下降' : '持平';
  switch (x.kind) {
    case 'cpi': return v > 3 ? { c: 'neg', l: '偏熱', t: `物價年增 ${v}%，高於多數央行 2% 目標，降息空間小${up ? '，且仍在升溫' : ''}` }
      : v < 0 ? { c: 'neg', l: '通縮', t: '物價下跌，反映需求疲弱，企業定價能力受壓' }
      : v <= 2.5 && v >= 0.8 ? { c: 'pos', l: '溫和', t: `物價溫和（${trend}），央行有彈性維持或放寬貨幣政策` }
      : { c: 'neu', l: v < 0.8 ? '偏低' : '略高', t: v < 0.8 ? '物價偏低，留意需求是否轉弱' : `物價略高於目標，${trend}中` };
    case 'gdp': return v >= 3 ? { c: 'pos', l: '強勁', t: `經濟年增 ${v}%，${up ? '成長加速' : dn ? '仍強但動能放緩' : '維持高檔'}` }
      : v < 1 ? { c: 'neg', l: v < 0 ? '衰退' : '疲弱', t: v < 0 ? '經濟負成長，企業獲利有下修風險' : '成長偏弱，內需與出口動能不足' }
      : { c: 'neu', l: '溫和', t: `經濟溫和成長，${up ? '動能回升' : dn ? '動能放緩' : '大致持平'}` };
    case 'unemp': return up && d >= 0.2 ? { c: 'neg', l: '轉弱', t: `失業率升至 ${v}%，就業市場降溫，消費可能轉弱` }
      : dn ? { c: 'pos', l: '改善', t: `失業率降至 ${v}%，就業市場穩健` } : { c: 'neu', l: '持平', t: `失業率 ${v}%，就業大致穩定` };
    case 'export': case 'ip': return v >= 10 ? { c: 'pos', l: '暢旺', t: `年增 ${v}%，${x.kind === 'export' ? '外需強勁，電子與 AI 相關出口是主要動能' : '生產活動熱絡'}` }
      : v >= 0 ? { c: 'neu', l: '正成長', t: `年增 ${v}%，${up ? '動能回升' : '成長放緩'}` } : { c: 'neg', l: '衰退', t: `年減 ${Math.abs(v)}%，需求轉弱` };
    case 'signal': { const b = v >= 38 ? ['紅燈', '熱絡', 'red'] : v >= 32 ? ['黃紅燈', '轉向熱絡', 'yr'] : v >= 23 ? ['綠燈', '穩定', 'green'] : v >= 17 ? ['黃藍燈', '轉向低迷', 'yb'] : ['藍燈', '低迷', 'blue'];
      return { c: 'sig-' + b[2], l: b[0], t: `${v} 分，景氣${b[1]}${up ? `，較上月增加 ${d} 分` : dn ? `，較上月減少 ${-d} 分` : ''}。紅燈常見於景氣高峰，藍燈常是股市相對低點的參考。` }; }
    case 'cli': case 'cliTW': { const base = 100; return v >= base && up ? { c: 'pos', l: '擴張', t: '領先指標在長期趨勢之上且上升，未來 6～9 個月景氣偏擴張' }
      : v >= base ? { c: 'neu', l: '趨緩', t: '仍在趨勢之上，但動能放緩' } : up ? { c: 'neu', l: '復甦', t: '低於趨勢但開始回升，景氣可能觸底' } : { c: 'neg', l: '收縮', t: '低於趨勢且下降，未來景氣偏弱' }; }
    case 'rate': return up ? { c: 'neg', l: '升息', t: `利率由 ${p}% 升至 ${v}%，資金成本上升，評價承壓` } : dn ? { c: 'pos', l: '降息', t: `利率由 ${p}% 降至 ${v}%，資金轉寬鬆` } : { c: 'neu', l: '持平', t: `利率維持 ${v}%` };
    case 'y10': return up ? { c: 'neg', l: '上升', t: '長天期殖利率上升，成長股評價承壓' } : dn ? { c: 'pos', l: '下降', t: '殖利率回落，有利股市評價' } : { c: 'neu', l: '持平', t: '殖利率持平' };
  }
  return { c: '', l: '', t: '' };
}

/* ---------- 元件 ---------- */
const spk = (arr, cls = '') => arr && arr.length > 2 ? `<svg class="w-spark ${cls}" viewBox="0 0 100 28" preserveAspectRatio="none"><path d="${sparkPath(arr.map((v, i) => [i, v]), 100, 28)}"/></svg>` : '';
const chg = (n, d = 1) => n == null ? '—' : `<span class="${n >= 0 ? 'up' : 'down'}">${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(d)}%</span>`;
function tile(x) {
  const j = judge(x), d = x.prev != null ? r1(x.v - x.prev) : null;
  return `<div class="met wt ${j.c}">
    <div class="met-h"><span>${IND_IC[x.kind] || IND_IC[x.k] || '•'} ${esc(x.name)}</span>${j.l ? `<span class="sigp ${j.c}">${j.l}</span>` : ''}</div>
    <div class="wt-v"><b>${fmtN(x.v)}</b><em>${esc(x.unit || '')}</em></div>
    <div class="met-p"><span>${esc(x.date || '')}</span><span>${x.prev != null ? `前值 ${fmtN(x.prev)}${d ? ` <i class="${d > 0 ? 'u' : 'd'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</i>` : ''}` : ''}</span></div>
    ${spk(x.spark)}
    <div class="wt-t">${esc(j.t)}</div>
    ${x.nx ? `<div class="w-when">${x.nx.last ? `<span>公布 ${md(x.nx.last)}</span>` : ''}${x.nx.date ? `<span>下次 <b>${md(x.nx.date)}</b>${x.nx.time ? ' ' + esc(x.nx.time) : ''}${x.nx.approx ? ' 前' : ''}</span>` : ''}</div>` : ''}
    <div class="wt-s">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.src)}</a>` : esc(x.src)}</div></div>`;
}
const r1 = n => Math.round(n * 100) / 100;
const fmtN = v => v == null ? '—' : Math.abs(v) >= 1000 ? fmt(v, 0) : String(v);
function mktRow(ms) {
  if (!ms?.length) return '';
  return `<div class="w-mkts">${ms.map(m => `<div class="w-mkt"><em>${esc(m.name)}</em><b>${fmtN(m.price)}</b><span>${chg(m.chg1d, 2)}<small>今日</small></span><span>${chg(m.chg1m)}<small>近 1 月</small></span>${spk(m.spark, 'lt')}</div>`).join('')}</div>`;
}
function imfBars(e) {
  const g = S.world?.imf?.NGDP_RPCH?.[e.imf], c = S.world?.imf?.PCPIPCH?.[e.imf]; if (!g) return '';
  const ys = ['2025', '2026', '2027'], max = Math.max(...ys.map(y => Math.abs(g[y] || 0)), 1);
  return `<div class="w-imf"><div class="w-imf-h">IMF 預測　<small>經濟成長｜通膨${S.world?.imf?.snapshot ? `（${S.world.imf.snapshot} 版本）` : ''}</small></div>${ys.map(y => `<div class="w-bar"><span>${y}</span><div><i style="width:${Math.max(3, Math.abs(g[y] || 0) / max * 100)}%"></i></div><b>${g[y] ?? '—'}%</b><em>${c?.[y] != null ? c[y] + '%' : ''}</em></div>`).join('')}</div>`;
}
function hero(e, extra = '') {
  const eco = S.world?.economies?.[e.id];
  return `<section class="w-hero"><div class="w-hero-t"><span class="w-flag">${e.flag}</span><div><div class="w-name">${e.name}</div><div class="w-rel">${esc(e.rel || '')}</div></div></div>
    ${mktRow(eco?.markets)}${imfBars(e)}${extra}</section>`;
}
function usCPI() { const r = S.macro.rows.find(x => x.key === 'cpi'); return r?.latest ? num(r.latest) : null; }
function headline(id) {
  const eco = S.world?.economies?.[id]; const f = k => eco?.indicators?.find(x => x.k === k);
  return { cpi: id === 'us' ? usCPI() : f('cpi')?.v, gdp: S.world?.imf?.NGDP_RPCH?.[ECON.find(e => e.id === id).imf]?.['2026'], cli: f('cli') || f('signal'), mkt: eco?.markets?.[0], fx: eco?.markets?.[1] };
}
function worldStatus() {
  const w = S.world; if (!w) return worldBusy ? '更新中…' : '尚未載入，按「更新」取得各國數據';
  return `更新於 ${new Date(w.updated).toLocaleString('zh-TW', { hour12: false })}${w.errors?.length ? `・<details class="w-err"><summary>${w.errors.length} 項來源暫時失敗</summary>${w.errors.map(esc).join('<br>')}</details>` : ''}`;
}

/* ---------- 頁面 ---------- */
/* ---------- 台灣：重點指標快照（央行、經濟部；新資料公布後更新） ---------- */
const TW_SNAP = {
  cbc: { src: '中央銀行理監事會預測（實際值：主計總處）', prevNote: '上次（2026/6/18）預測 9.45%',
    annual: [['2025', 8.76, '實際'], ['2026(f)', 11.48, '上次 9.45'], ['2027(f)', 5.82, '']],
    q: [['26Q1', 15.43, 0], ['26Q2', 12.93, 0], ['26Q3', 11.5, 1], ['26Q4', 6.86, 1], ['27Q1', 5.81, 1], ['27Q2', 6.5, 1], ['27Q3', 5.33, 1], ['27Q4', 5.68, 1]], half: [['上半年', 14.15], ['下半年(f)', 9.09]] },
  comp: { src: '主計總處、中央銀行', cols: ['經濟成長率', '內需', '民間消費', '政府消費', '資本形成', '國外淨需求', '輸出', '(−)輸入'],
    rows: [['2026(f)', 11.48, 7.20, 2.15, 0.66, 4.40, 4.28, 16.22, 11.95], ['上半年', 14.15, 6.10, 2.40, 0.45, 3.26, 8.05, 20.00, 11.95], ['下半年(f)', 9.09, 8.20, 1.93, 0.85, 5.42, 0.89, 12.83, 11.94]],
    gcols: ['經濟成長率', '內需', '民間消費', '政府消費', '資本形成', '民間投資', '政府投資', '公營投資', '輸出', '(−)輸入'],
    grows: [['2026(f)', 11.48, 8.91, 4.97, 5.37, 17.37, 12.47, 8.42, -5.32, 22.05, 21.91], ['上半年', 14.15, 7.29, 5.37, 3.74, 12.12, 10.36, 7.63, 3.75, 27.73, 21.55], ['下半年(f)', 9.09, 10.48, 4.58, 6.77, 22.73, 14.75, 8.95, -10.92, 17.17, 22.26]] },
  orders: { date: '2026 年 8 月', src: '經濟部統計處', items: [['資訊通信', 100.5], ['電子產品', 83.9], ['機械', 28.3], ['基本金屬', 26.8], ['化學品', 15.4], ['塑橡膠製品', 6.7], ['光學器材', -5.0]] },
};
const heat = (v, scale = 5, invert) => { if (v == null || !isFinite(v)) return ''; const a = Math.min(1, Math.abs(v) / scale) * 0.32 + 0.04; const good = invert ? v < 0 : v >= 0; return `background:${good ? `rgba(30,158,90,${a})` : `rgba(214,69,69,${a})`}`; };
const pc = (v, d = 1) => v == null ? '—' : `${v > 0 ? '+' : ''}${(+v).toFixed(d)}`;
function gtable(cols, rows, cls = '') { return `<div class="gt ${cls}" style="--n:${cols.length}"><div class="gt-r gt-h">${cols.map(c => `<span>${c}</span>`).join('')}</div>${rows.join('')}</div>`; }
function hbars(rows, o = {}) {
  // rows: [{l, v, sub}] ；支援負值與目標線
  const vals = rows.map(r => r.v).filter(v => v != null), mx = Math.max(...vals.map(Math.abs), o.target || 0, 0.1) * (o.target ? 1.25 : 1), neg = vals.some(v => v < 0);
  const X = v => (neg ? 50 + v / mx * 50 : v / mx * 100);
  return `<div class="hb">${rows.map(r => `<div class="hb-r"><span>${r.l}</span><div class="hb-t">${neg ? '<i class="hb-0"></i>' : ''}${o.target ? `<i class="hb-tg" style="left:${X(o.target)}%"></i>` : ''}${r.v == null ? '' : `<i class="hb-b ${r.v < 0 ? 'n' : ''} ${r.cls || ''}" style="${neg ? (r.v < 0 ? `left:${X(r.v)}%;width:${50 - X(r.v)}%` : `left:50%;width:${X(r.v) - 50}%`) : `width:${Math.max(1.5, X(r.v))}%`}"></i>`}</div><b>${r.v == null ? '—' : r.v + (o.unit ?? '%')}</b></div>`).join('')}</div>${o.target ? `<div class="help">虛線：${o.targetLabel || '目標 ' + o.target + '%'}</div>` : ''}`;
}
function lineSVG(pts, o = {}) {
  // pts: [[label, v, isForecast]]
  const W = 320, H = 150, P = 22, vs = pts.map(p => p[1]), lo = Math.min(0, ...vs), hi = Math.max(...vs) * 1.12;
  const X = i => P + i * (W - 2 * P) / (pts.length - 1), Y = v => H - 22 - (v - lo) * (H - 44) / (hi - lo || 1);
  const seg = (a, b) => pts.slice(a, b).map((p, i) => `${i ? 'L' : 'M'}${X(a + i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const fi = pts.findIndex(p => p[2]);
  return `<svg class="ln" viewBox="0 0 ${W} ${H}"><path class="ln-a" d="${seg(0, fi < 0 ? pts.length : fi)}"/>${fi > 0 ? `<path class="ln-f" d="${seg(fi - 1, pts.length)}"/>` : ''}
    ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p[1])}" r="3" class="${p[2] ? 'f' : ''}"/><text x="${X(i)}" y="${Y(p[1]) - 7}" text-anchor="middle">${p[1]}</text><text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="ax">${p[0]}</text>`).join('')}</svg>`;
}
/* ---------- 公布日／下次公布 ---------- */
const md = d => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '';
const ymd = d => d ? `${d.slice(0, 4)}/${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '';
const todayTW = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const daysTo = d => Math.round((new Date(d + 'T00:00:00+08:00') - new Date(todayTW() + 'T00:00:00+08:00')) / 864e5);
function when(pub, next, o = {}) {
  const n = next ? daysTo(next) : null;
  const pubS = pub ? (pub.length > 10 ? pub.replace(/-/g, '/') : ymd(pub)) : '';
  return `<div class="w-when big">${pubS ? `<span>📅 公布 ${esc(pubS)}</span>` : ''}${next ? `<span>⏭️ 下次 <b>${ymd(next)}</b>${o.time ? ' ' + esc(o.time) : ''}${n != null && n >= 0 ? `（${n === 0 ? '今天' : n + ' 天後'}）` : ''}</span>` : o.nextNote ? `<span>${esc(o.nextNote)}</span>` : ''}</div>`;
}
const latest = (...ds) => ds.filter(Boolean).sort().pop() || '';
const soonest = (...xs) => xs.filter(x => x?.date).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
// 台灣各指標對應的發布時間表項目
const TW_CAL = { gdp: 'gdp', cpi: 'cpi', core: 'cpi', unemp: 'unemp', export: 'export', ip: 'ip', orders: 'orders', ordersAmt: 'orders', signal: 'signal', cli: 'cli' };

/* ---------- 各國央行會議 ---------- */
const CB = {
  us: { name: 'Fed 聯準會（FOMC）', dates: ['2026-10-28', '2026-12-09'], url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', note: '3、6、9、12 月的會議會同時公布經濟預測（SEP 點陣圖）。日期為美國時間，台灣隔天凌晨公布。' },
  eu: { name: '歐洲央行（ECB）', dates: ['2026-10-29', '2026-12-17'], url: 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html', note: '3、6、9、12 月的會議會同時公布員工經濟預測。' },
  jp: { name: '日本央行（BOJ）', dates: ['2026-10-30', '2026-12-18'], url: 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm', note: '1、4、7、10 月的會議會同時公布「經濟物價展望報告」。日圓升息會引發套利交易平倉，影響亞洲股市。' },
  hk: { name: '香港金管局（跟隨 Fed）', follow: 'us', url: 'https://www.hkma.gov.hk/eng/key-functions/monetary-stability/', note: '港幣釘住美元，基本利率在 Fed 決議後（香港時間隔天）同步調整。' },
  cn: { name: '中國人民銀行（LPR 報價）', lpr: true, url: 'http://www.pbc.gov.cn/', note: '每月 20 日（遇假日順延）公布 1 年期與 5 年期貸款市場報價利率；降準、降息另行宣布，時間不固定。' },
  kr: { name: '韓國央行（BOK）', url: 'https://www.bok.or.kr/eng/main/main.do', note: '每年 8 次貨幣政策會議，日程以韓國央行官網公告為準。' },
};
const addDay = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
function lprNext(today) {
  let [y, m] = today.split('-').map(Number); if (+today.slice(8) > 20) { m++; if (m > 12) { m = 1; y++; } }
  let d = `${y}-${String(m).padStart(2, '0')}-20`; const wd = new Date(d + 'T00:00:00Z').getUTCDay();
  if (wd === 6) d = addDay(d, 2); else if (wd === 0) d = addDay(d, 1); return d;
}
function cbCard(id) {
  const c = CB[id]; if (!c) return '';
  const today = todayTW(), eco = S.world?.economies?.[id];
  const dates = (c.follow ? CB[c.follow].dates.map(d => addDay(d, 1)) : c.lpr ? [lprNext(today)] : c.dates || []).filter(d => d >= today);
  const rate = id === 'us' ? (() => { const r = S.macro.rows.find(x => x.key === 'ffr'); return r?.latest ? { v: r.latest, name: '聯邦基金利率' } : null; })() : (x => x ? { v: x.v + '%', name: x.name, date: x.date } : null)(eco?.indicators?.find(x => x.k === 'rate'));
  return `<div class="card"><div class="card-head"><h3 class="gold-bar">🏦 ${esc(c.name)}</h3>${dates[0] ? `<span class="pill gold">下次 ${md(dates[0])}・${daysTo(dates[0]) === 0 ? '今天' : daysTo(dates[0]) + ' 天後'}</span>` : ''}</div>
    ${rate ? `<div class="w-rates"><span>${esc(rate.name)} <b>${esc(String(rate.v))}</b>${rate.date ? `<small>（${esc(rate.date)}）</small>` : ''}</span></div>` : ''}
    ${dates.length ? `<div class="w-meet">${dates.map((d, i) => `<span class="${i ? '' : 'on'}">${ymd(d)}</span>`).join('')}</div>` : ''}
    <div class="help">${esc(c.note || '')}</div><div class="srclinks"><a href="${c.url}" target="_blank" rel="noopener">官方會議日程</a></div></div>`;
}

/* ---------- 經濟成長貢獻、預測 ---------- */
function contribCard(c, title, note) {
  if (!c?.periods?.length) return '';
  const keys = Object.keys(c.periods[0]).filter(k => k !== 'label' && k !== 'GDP');
  const last = c.periods[c.periods.length - 1];
  const top = keys.filter(k => last[k] != null).sort((a, b) => last[b] - last[a]);
  return `<div class="card"><h3 class="gold-bar">🧩 ${title}</h3>
    <div class="help" style="margin-bottom:6px">最新一期 ${esc(last.label)}：GDP ${pc(last.GDP)}%，最大推手是 ${top[0]}（${pc(last[top[0]])}），${last[top[top.length - 1]] < 0 ? '拖累最多' : '貢獻最小'}的是 ${top[top.length - 1]}（${pc(last[top[top.length - 1]])}）。</div>
    ${hbars(keys.map(k => ({ l: k, v: last[k] })), { unit: '' })}
    ${gtable(['期間', 'GDP', ...keys], c.periods.slice().reverse().map(p => `<div class="gt-r"><span>${esc(p.label)}</span><span style="${heat(p.GDP, 4)}"><b>${pc(p.GDP)}</b></span>${keys.map(k => `<span style="${heat(p[k], 3)}">${pc(p[k])}</span>`).join('')}</div>`), 'wide')}
    <div class="help">${esc(note || '')}單位：${esc(c.unit || '百分點')}。來源：${esc(c.src || '')}</div></div>`;
}
function sepCard(sep) {
  if (!sep?.rows) return '';
  const ks = Object.keys(sep.rows).filter(k => sep.rows[k]?.length), ys = [...new Set(ks.flatMap(k => sep.rows[k].map(x => x.y)))].sort().slice(-4);
  if (!ks.length) return '';
  return `<div class="card"><h3 class="gold-bar">🔮 Fed 經濟預測（SEP 中位數）</h3>${gtable(['', ...ys.map(y => y + ' 年')], ks.map(k => `<div class="gt-r"><span>${esc(k)}</span>${ys.map(y => { const v = sep.rows[k].find(x => x.y === y)?.v; return `<span>${v ?? '—'}</span>`; }).join('')}</div>`))}
    <div class="help">利率預測下降＝Fed 預期降息，通常有利股市評價；GDP 預測下修要留意企業獲利。來源：${esc(sep.src)}；下次更新：12 月 FOMC。</div></div>`;
}
const EO_AREA = { us: 'USA', eu: 'EA17', cn: 'CHN', jp: 'JPN', kr: 'KOR' };
function fcCard(id) {
  const e = ECON.find(x => x.id === id), eo = S.world?.oecdEO?.[EO_AREA[id]], G = S.world?.imf?.NGDP_RPCH?.[e?.imf], C = S.world?.imf?.PCPIPCH?.[e?.imf];
  if (!eo && !G) return '';
  const ys = ['2025', '2026', '2027'];
  const row = (l, o) => o ? `<div class="gt-r"><span>${l}</span>${ys.map(y => `<span style="${l.startsWith('成長') ? heat(o[y], 5) : ''}">${o[y] ?? '—'}</span>`).join('')}</div>` : '';
  const sep = id === 'us' ? S.world?.economies?.us?.sep?.rows : null;
  const sepRow = (l, k) => sep?.[k] ? row(l, Object.fromEntries(sep[k].map(x => [x.y, x.v]))) : '';
  return `<div class="card"><h3 class="gold-bar">📐 各機構預測比較（%）</h3>${gtable(['', ...ys], [row('成長 OECD', eo?.gdp), row('成長 IMF', G), sepRow('成長 Fed', 'GDP'), row('通膨 OECD', eo?.cpi), row('通膨 IMF', C), sepRow('通膨 Fed PCE', 'PCE 通膨')].filter(Boolean))}
    <div class="help">OECD 經濟展望每年 6、12 月發布（3、9 月期中更新）；IMF 世界經濟展望每年 4、10 月發布（1、7 月更新）。${S.world?.imf?.snapshot ? `IMF 數值為 ${S.world.imf.snapshot} 快照。` : ''}</div></div>`;
}
function ecoExtra(id) {
  const eco = S.world?.economies?.[id] || {};
  return cbCard(id) + fcCard(id)
    + (id === 'us' ? sepCard(eco.sep) + contribCard(eco.contrib, '美國經濟成長的來源（對 GDP 的貢獻）', '季增年率，各項加總約等於 GDP 成長。') : '')
    + (id === 'eu' ? contribCard(eco.contrib, '歐元區經濟成長的來源（對 GDP 年增的貢獻）', '淨出口＝輸出減輸入；存貨變動未列入，所以加總與官方 GDP 略有差異。') : '');
}

/* ---------- 台灣：央行、主計總處、外銷訂單（自動連動，失敗時用快照） ---------- */
function twCBC(off, cal) {
  const cb = off.cbc, dg = off.dgbas;
  if (!cb || cb.gdpY == null) return twCBCSnap();
  const qs = (dg?.quarters || []).filter(q => q.GDP != null && q.q >= `${cb.year}Q1`).slice(0, 8).map(q => [q.q.slice(2), q.GDP, q.f ? 1 : 0]);
  const r = cb.rates;
  const inst = (cb.inst?.gdp || []).filter(x => x.y1 != null);
  return `<div class="card"><div class="card-head"><h3 class="gold-bar">🏦 中央銀行理監事會</h3>${r ? `<span class="pill ${r.action === '升息' ? 'red' : r.action === '降息' ? 'green' : ''}">利率${r.action}</span>` : ''}</div>
    ${when(cb.date, cb.next, { nextNote: cb.nextNote })}
    ${r ? `<div class="w-rates"><span>重貼現率 <b>${r.discount}%</b></span><span>擔保放款融通 <b>${r.secured}%</b></span><span>短期融通 <b>${r.short}%</b></span></div>` : ''}
    <div class="w-fc">
      <div class="met wt pos"><div class="met-h"><span>${cb.year} 年經濟成長</span></div><div class="wt-v"><b>${cb.gdpY}</b><em>%</em></div>${cb.h1 != null ? `<div class="help">上半年 ${cb.h1}%・下半年 ${cb.h2 ?? '—'}%</div>` : ''}</div>
      ${cb.gdpNext != null ? `<div class="met wt"><div class="met-h"><span>${cb.year + 1} 年經濟成長</span></div><div class="wt-v"><b>${cb.gdpNext}</b><em>%</em></div></div>` : ''}
      ${cb.cpiY != null ? `<div class="met wt"><div class="met-h"><span>${cb.year} 年 CPI／核心</span></div><div class="wt-v"><b>${cb.cpiY}</b><em>% ／ ${cb.coreY ?? '—'}%</em></div></div>` : ''}
      ${cb.cpiNext != null ? `<div class="met wt"><div class="met-h"><span>${cb.year + 1} 年 CPI／核心</span></div><div class="wt-v"><b>${cb.cpiNext}</b><em>% ／ ${cb.coreNext ?? '—'}%</em></div></div>` : ''}
    </div>
    ${qs.length > 2 ? lineSVG(qs) + `<div class="help">逐季經濟成長率：實線為實際值，虛線為主計總處預測。</div>` : ''}
    ${inst.length ? `<details class="rc-sub" open><summary>📊 各機構 ${cb.year} 年經濟成長預測</summary>${hbars(inst.map(x => ({ l: `${esc(x.name)}<small> ${md(x.date)}</small>`, v: x.y1 })))}</details>` : ''}
    <div class="srclinks"><a href="${esc(cb.url)}" target="_blank" rel="noopener">決議新聞稿全文</a></div></div>`;
}
function twCBCSnap() {
  const c = TW_SNAP.cbc;
  return `<div class="card"><div class="card-head"><h3 class="gold-bar">🏦 央行經濟成長預測</h3><span class="pill">${esc(c.prevNote)}</span></div>
    ${when('2026-09-17', CB_TW.find(d => d >= todayTW()))}
    <div class="w-fc">${c.annual.map(([y, v, n], i) => `<div class="met wt ${i ? 'pos' : ''}"><div class="met-h"><span>${y} 年</span>${n ? `<span class="help">${n}</span>` : ''}</div><div class="wt-v"><b>${v}</b><em>%</em></div></div>`).join('')}</div>
    ${lineSVG(c.q)}
    <div class="help">實線為實際值，虛線為預測。${c.half.map(([l, v]) => `${l} ${v}%`).join('、')}。（快照：自動連動暫時失敗）來源：${esc(c.src)}</div></div>`;
}
const CB_TW = ['2026-03-19', '2026-06-18', '2026-09-17', '2026-12-17'];
function twComp(off, cal) {
  const dg = off.dgbas, nx = soonest(cal.gdp, cal.forecast, cal.gdpFull), pub = latest(cal.gdp?.last, cal.forecast?.last, cal.gdpFull?.last);
  const ck = [['民間消費', 'c1'], ['政府消費', 'c2'], ['資本形成', 'c3'], ['國外淨需求', 'c4']];
  const stack = rows => rows.map(r => { const tot = ck.reduce((s, [k]) => s + Math.max(0, r[k] || 0), 0) || 1;
    return `<div class="stk-r"><span>${esc(r.label)}</span><div class="stk">${ck.map(([k, cl]) => `<i class="${cl}" style="width:${Math.max(0, r[k] || 0) / tot * 100}%" title="${k} ${r[k]}">${r[k] >= 1 ? r[k] : ''}</i>`).join('')}</div><b>${r.GDP}%</b></div>`; }).join('');
  const legend = `<div class="w-legend">${ck.map(([l, cl]) => `<span><i class="${cl}"></i>${l}</span>`).join('')}</div>`;
  if (dg?.contrib?.length && dg?.quarters?.length) {
    const p = dg.contrib.filter(x => x.GDP != null), lead = p.find(x => /\(f\)/.test(x.label) && !/半年/.test(x.label)) || p[0];
    const top = ck.map(([k]) => k).sort((a, b) => (lead[b] || 0) - (lead[a] || 0));
    const neg = ck.map(([k]) => k).filter(k => (lead?.[k] || 0) < 0);
    const qcols = [['GDP', '經濟成長'], ['國內需求', '內需'], ['民間消費', '民間消費'], ['政府消費', '政府消費'], ['固定資本形成', '固定投資'], ['輸出', '輸出'], ['輸入', '輸入']];
    const qs = dg.quarters.filter(q => q.GDP != null).slice(-10).reverse();
    return `<div class="card"><h3 class="gold-bar">🧩 經濟成長的來源（貢獻度，百分點）</h3>
      ${when(pub, nx?.date, { time: nx?.time })}
      ${stack(p)}${legend}
      ${lead ? `<div class="help" style="margin:6px 0 10px">${esc(lead.label)} 成長 ${lead.GDP}% 中，${top[0]}貢獻 ${lead[top[0]]}、${top[1]} ${lead[top[1]]} 個百分點${neg.length ? `；${neg.join('、')}為負貢獻` : ''}。</div>` : ''}
      <details class="rc-sub"><summary>📋 逐季各項目成長率（%，f 為預測）</summary>${gtable(['季', ...qcols.map(x => x[1])], qs.map(q => `<div class="gt-r ${q.f ? '' : 'hl'}"><span>${q.q}${q.f ? '(f)' : ''}</span>${qcols.map(([k]) => `<span style="${heat(q[k], 15)}">${q[k] ?? '—'}</span>`).join('')}</div>`), 'wide')}</details>
      <div class="help">貢獻度以主計總處連鎖實質金額估算（負貢獻不畫在長條中）。${nx ? `下次發布：${esc(nx.name)}` : ''}</div>
      <div class="srclinks"><a href="${esc(dg.url)}" target="_blank" rel="noopener">主計總處國民所得統計</a></div></div>`;
  }
  const m = TW_SNAP.comp;
  const rows = m.rows.map(r => ({ label: r[0], GDP: r[1], 民間消費: r[3], 政府消費: r[4], 資本形成: r[5], 國外淨需求: r[6] }));
  return `<div class="card"><h3 class="gold-bar">🧩 經濟成長的來源（貢獻度，百分點）</h3>${when('', nx?.date, { time: nx?.time })}${stack(rows)}${legend}
    <details class="rc-sub"><summary>📋 各組成項目成長率</summary>${gtable(['', ...m.gcols], m.grows.map(r => `<div class="gt-r"><span>${r[0]}</span>${r.slice(1).map(v => `<span style="${heat(v, 20)}">${v}</span>`).join('')}</div>`), 'wide')}</details>
    <div class="help">（快照：自動連動暫時失敗）來源：${esc(m.src)}</div></div>`;
}
function twOrders(off, cal) {
  const o = off.orders, c = cal.orders;
  if (o?.products?.length) {
    const tot = o.products.reduce((s, x) => s + (x.amt || 0), 0) || 1;
    const p = o.products.slice(0, 10), rg = (o.regions || []).slice(0, 7);
    return `<div class="card"><h3 class="gold-bar">🚢 外銷訂單（${esc(o.period || o.title || '')}）</h3>
      ${when(o.released || c?.last, c?.date, { time: c?.time })}
      ${o.total?.amt != null ? `<div class="w-rates"><span>總額 <b>${o.total.amt} 億美元</b></span>${o.total.yoy != null ? `<span>年增 <b class="${o.total.yoy >= 0 ? 'up' : 'down'}">${pc(o.total.yoy)}%</b></span>` : ''}</div>` : ''}
      <div class="w-sub">按貨品：年增率（依金額排序，括號為占比）</div>
      ${hbars(p.map(x => ({ l: `${esc(x.name)}<small> ${Math.round(x.amt / tot * 100)}%</small>`, v: x.yoy })))}
      ${rg.length ? `<div class="w-sub">按地區：年增率</div>${hbars(rg.map(x => ({ l: esc(x.name), v: x.yoy })))}` : ''}
      <div class="help">資訊通信、電子產品的年增反映 AI 伺服器與半導體需求；外銷訂單約領先實際出口 1～3 個月。</div>
      <div class="srclinks"><a href="${esc(o.url)}" target="_blank" rel="noopener">經濟部新聞稿與附表</a></div></div>`;
  }
  const s = TW_SNAP.orders;
  return `<div class="card"><h3 class="gold-bar">🚢 外銷訂單：哪些產品在成長（${esc(s.date)}）</h3>${when('', c?.date, { time: c?.time })}
    ${hbars(s.items.map(([l, v]) => ({ l, v })))}<div class="help">（快照：自動連動暫時失敗）來源：${esc(s.src)}</div></div>`;
}
function twExtra() {
  const off = S.twOff || {}, cal = off.calendar || {};
  const up = Object.values(cal).filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const calCard = up.length ? `<div class="card"><h3 class="gold-bar">🗓️ 近期公布行事曆</h3>${gtable(['日期', '項目', '資料期'], up.map(x => `<div class="gt-r"><span>${md(x.date)}${x.time ? ' ' + esc(x.time) : ''}${x.approx ? ' 前' : ''}</span><span style="text-align:left">${esc(x.name)}</span><span>${esc(x.period || '')}</span></div>`), 'cal')}<div class="help">來源：國家統計預告發布時間表（${esc([...new Set(up.map(x => x.dept).filter(Boolean))].join('、'))}）</div></div>` : '';
  return twCBC(off, cal) + twComp(off, cal) + twOrders(off, cal) + calCard;
}

/* ---------- 其他投資標的 ---------- */
const ASSET_GROUPS = [
  { t: '🥇 貴金屬', syms: ['GC=F', 'SI=F', 'PL=F', 'PA=F', 'GLD', '00635U.TW'], note: '黃金是避險與抗通膨資產，實質利率下降、美元走弱、地緣風險升高時通常上漲；白銀、鉑金兼具工業需求。' },
  { t: '🛢️ 能源與原物料', syms: ['CL=F', 'BZ=F', 'NG=F', 'HG=F', 'ZS=F', 'ZW=F'], note: '油價影響通膨與航運、塑化成本；銅被稱為「銅博士」，常反映全球製造業景氣。' },
  { t: '📈 美國公債殖利率', syms: ['^IRX', '^TNX', '^TYX'], yld: true, note: '殖利率上升＝債券價格下跌、股票評價承壓；短天期高於長天期（殖利率倒掛）常被視為衰退前兆。變動以基點（bp）表示。' },
  { t: '🏛️ 債券 ETF', syms: ['TLT', 'IEF', 'LQD', 'HYG', 'EMB', '00679B.TWO'], note: '長天期公債對利率最敏感；高收益債與新興市場債的走勢較接近股市，反映信用風險偏好。' },
  { t: '🏢 房地產 REITs', syms: ['VNQ'], note: '不動產投資信託，以租金收益為主，對利率敏感。' },
  { t: '🪙 加密貨幣', syms: ['BTC-USD', 'ETH-USD'], note: '波動遠大於股市，可視為高風險的風險偏好指標。' },
];
const UNIT = { 'GC=F': '美元/盎司', 'SI=F': '美元/盎司', 'PL=F': '美元/盎司', 'PA=F': '美元/盎司', 'HG=F': '美元/磅', 'CL=F': '美元/桶', 'BZ=F': '美元/桶', 'NG=F': '美元/百萬英熱', 'ZS=F': '美分/英斗', 'ZW=F': '美分/英斗', '00635U.TW': '台幣', '00679B.TWO': '台幣' };
function assetsView() {
  const ms = Object.fromEntries((S.world?.economies?.assets?.markets || []).map(m => [m.sym, m]));
  if (!Object.keys(ms).length) return `<div class="card empty">${worldBusy ? '資料載入中…' : '還沒有資料，按右上角「更新」。'}</div>`;
  const bp = (s, n) => s?.length > n ? Math.round((s[s.length - 1] - s[s.length - 1 - n]) * 100) : null;
  const bpS = v => v == null ? '—' : `${v > 0 ? '+' : ''}${v}`;
  const cards = ASSET_GROUPS.map(g => {
    const list = g.syms.map(s => ms[s]).filter(Boolean); if (!list.length) return '';
    const rows = list.map(m => g.yld
      ? `<div class="gt-r"><span>${esc(m.name)}${spk(m.spark, 'lt')}</span><span>${m.price}%</span><span style="${heat(-bp(m.spark, 1), 8)}">${bpS(bp(m.spark, 1))}</span><span style="${heat(-bp(m.spark, 21), 30)}">${bpS(bp(m.spark, 21))}</span><span style="${heat(-bp(m.spark, 59), 50)}">${bpS(bp(m.spark, 59))}</span></div>`
      : `<div class="gt-r"><span>${esc(m.name)}<small class="w-u">${UNIT[m.sym] || '美元'}</small>${spk(m.spark, 'lt')}</span><span>${fmt(m.price, m.price < 100 ? 2 : 0)}</span><span style="${heat(m.chg1d, 2)}">${pc(m.chg1d)}</span><span style="${heat(m.chg1m, 8)}">${pc(m.chg1m)}</span><span style="${heat(m.ytd, 30)}">${pc(m.ytd)}</span></div>`);
    return `<div class="card"><h3 class="gold-bar">${g.t}</h3>${gtable(g.yld ? ['', '殖利率', '1 天 bp', '1 月', '3 月'] : ['', '價格', '1 天%', '1 月', '今年'], rows, 'mk as')}<div class="help">${esc(g.note)}</div></div>`;
  }).join('');
  const d = Object.values(ms).map(m => m.date).sort().pop();
  return `<div class="card"><h3 class="gold-bar">🧭 跨資產一覽</h3><div class="help">股票以外的常用投資標的：貴金屬、原物料、債券、房地產與加密貨幣。期貨為近月合約報價；資料日期 ${esc(d || '')}，來源 Yahoo Finance。想追蹤自己的部位，可在「資產」頁新增交易（例如 GLD、00635U、TLT）。</div></div>` + cards;
}

function globalView() {
  const w = S.world, list = ECON.slice(1), eco = id => w?.economies?.[id];
  const f = (id, k) => eco(id)?.indicators?.find(x => x.k === k);
  const us = k => { const r = S.macro.rows.find(x => x.key === k); return r?.latest ? num(r.latest) : null; };
  // 1. 股市報酬表
  const idx = Object.entries(w?.economies || {}).filter(([id]) => id !== 'assets').flatMap(([id, e]) => (e.markets || []).filter(m => !/=X$|DX-Y/.test(m.sym)).map(m => ({ ...m, id })));
  const order = ['^GSPC', '^IXIC', '^SOX', '^N225', '^HSI', '000300.SS', '000001.SS', 'BSE-100.BO', '^BSESN', '^TWII', '^KS11', '^STOXX50E'];
  idx.sort((a, b) => order.indexOf(a.sym) - order.indexOf(b.sym));
  const mkt = idx.length ? `<div class="card"><h3 class="gold-bar">📊 全球股市報酬（本地貨幣計價，%）</h3>${gtable(['指數', '水平', '1 天', '7 天', '1 個月', '年初至今'], idx.map(m => `<div class="gt-r ${m.sym === '^TWII' ? 'hl' : ''}"><span>${esc(m.name)}</span><span>${fmt(m.price, m.price < 100 ? 2 : 0)}</span><span style="${heat(m.chg1d, 2)}">${pc(m.chg1d)}</span><span style="${heat(m.chg1w, 4)}">${pc(m.chg1w)}</span><span style="${heat(m.chg1m, 8)}">${pc(m.chg1m)}</span><span style="${heat(m.ytd, 40)}">${pc(m.ytd)}</span></div>`), 'mk')}</div>` : '';
  // 2. 經濟體總覽表
  const rows = list.map(e => {
    const id = e.id, g = w?.imf?.NGDP_RPCH?.[e.imf]?.['2026'];
    const cpi = id === 'us' ? us('cpi') : f(id, 'cpi')?.v, un = id === 'us' ? us('unrate') : f(id, 'unemp')?.v;
    const rate = id === 'us' ? us('ffr') : f(id, 'rate')?.v, cli = f(id, 'cli');
    const cj = cli ? judge(cli) : null;
    return `<div class="gt-r click" data-wtab="${id}"><span>${e.flag} ${e.name}</span><span style="${heat(g, 6)}">${g ?? '—'}</span><span style="${cpi == null ? '' : heat(1 - Math.abs(cpi - 2), 1.5)}">${cpi ?? '—'}</span><span>${un ?? '—'}</span><span>${rate ?? '—'}</span><span>${cli ? `<i class="sigp ${cj.c}">${cj.l}</i>` : '—'}</span></div>`;
  });
  const ov = `<div class="card"><h3 class="gold-bar">🌏 主要經濟體一覽</h3>${gtable(['經濟體', '成長 IMF 2026', '通膨', '失業率', '政策利率', '領先指標'], rows, 'ov')}<div class="help">點任一列看該經濟體的完整指標。通膨格子越接近 2% 顏色越綠。美國數據取自「美國」分頁。</div></div>`;
  // 3. 圖表
  const G = w?.imf?.NGDP_RPCH; let imfChart = '';
  if (G) {
    const mx = Math.max(...list.flatMap(e => ['2025', '2026', '2027'].map(y => Math.abs(G[e.imf]?.[y] || 0))), 1);
    imfChart = `<div class="card"><h3 class="gold-bar">📈 經濟成長預測（IMF）</h3><div class="w-cmp">${list.map(e => { const v = G[e.imf] || {}; return `<div class="w-cmp-r"><span>${e.flag} ${e.name}</span><div class="w-cmp-b">${['2025', '2026', '2027'].map((y, i) => `<i class="y${i}" style="width:${Math.max(2, Math.min(100, (v[y] || 0) / mx * 100))}%" title="${y} ${v[y]}%"></i>`).join('')}</div><b>${v['2026'] ?? '—'}%</b></div>`; }).join('')}</div>
      <div class="w-legend"><span><i class="y0"></i>2025</span><span><i class="y1"></i>2026</span><span><i class="y2"></i>2027</span><span class="help">右側數字為 2026 年</span></div></div>`;
  }
  const cpiChart = `<div class="card"><h3 class="gold-bar">🛒 通膨比較（最新 CPI 年增率）</h3>${hbars(list.map(e => ({ l: `${e.flag} ${e.name}`, v: e.id === 'us' ? us('cpi') : f(e.id, 'cpi')?.v })), { target: 2, targetLabel: '多數央行的 2% 通膨目標' })}</div>`;
  const unChart = `<div class="card"><h3 class="gold-bar">👷 失業率比較</h3>${hbars(list.map(e => ({ l: `${e.flag} ${e.name}`, v: e.id === 'us' ? us('unrate') : f(e.id, 'unemp')?.v })).filter(r => r.v != null))}</div>`;
  // 4. 領先指標趨勢表
  const cliRows = list.map(e => ({ e, x: f(e.id, 'cli') })).filter(r => r.x?.spark?.length);
  const months = n => { const x = cliRows[0]?.x; if (!x) return []; const [y, m] = x.date.split('-').map(Number); return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)); return `${d.getUTCMonth() + 1}月`; }); };
  const cli = cliRows.length ? `<div class="card"><h3 class="gold-bar">🧭 領先指標趨勢（100 = 長期趨勢）</h3>${gtable(['經濟體', ...months(6), '判讀'], cliRows.map(({ e, x }) => { const v6 = x.spark.slice(-6); return `<div class="gt-r click" data-wtab="${e.id}"><span>${e.flag} ${e.name}</span>${v6.map((v, i) => `<span style="${heat(v - 100, 3)}">${(+v).toFixed(1)}${i && v6[i - 1] != null ? (v > v6[i - 1] ? '<small class="u">▲</small>' : v < v6[i - 1] ? '<small class="d">▼</small>' : '') : ''}</span>`).join('')}<span><i class="sigp ${judge(x).c}">${judge(x).l}</i></span></div>`; }), 'cli')}
    <div class="help">高於 100 且上升＝擴張；高於 100 但下降＝趨緩；低於 100 但上升＝復甦；低於 100 且下降＝收縮。台灣為國發會領先指標（不含趨勢），其他為 OECD 綜合領先指標。</div></div>` : '';
  // 5. 匯率表
  const fx = Object.entries(w?.economies || {}).filter(([id]) => id !== 'assets').map(([, e]) => e).flatMap(e => (e.markets || []).filter(m => /=X$|DX-Y/.test(m.sym)));
  const fxT = fx.length ? `<div class="card"><h3 class="gold-bar">💱 匯率（%）</h3>${gtable(['', '匯率', '1 天', '1 個月', '年初至今'], fx.map(m => `<div class="gt-r"><span>${esc(m.name)}</span><span>${m.price}</span><span>${pc(m.chg1d, 2)}</span><span>${pc(m.chg1m)}</span><span>${pc(m.ytd)}</span></div>`), 'fx')}<div class="help">「美元兌 X」上升＝美元變強、該貨幣貶值；歐元兌美元上升＝歐元升值。</div></div>` : '';
  // 6. 台灣預測
  const tw = eco('tw')?.official, t = w?.tier;
  const fc = `<div class="card"><h3 class="gold-bar">🇹🇼 台灣 2026 年經濟成長預測比較</h3>${hbars([{ l: '中央銀行', v: S.twOff?.cbc?.gdpY ?? TW_SNAP.cbc.annual[1][1] }, ...(tw?.gdp || []).filter(x => x.y === '2026').map(x => ({ l: '主計總處', v: x.v })), ...(t?.gdpValue ? [{ l: '台經院', v: t.gdpValue }] : []), { l: 'IMF', v: G?.TWN?.['2026'] ?? null }])}
    ${t?.gdp ? `<div class="note">台經院：${esc(t.gdp)}${t.cpi ? `<br>${esc(t.cpi)}` : ''}</div>` : ''}
    <div class="help">IMF 預測更新頻率較低，與國內機構差距大時，以最新公布的國內預測為主。</div>
    <div class="srclinks"><a href="https://www.tier.org.tw/forecast/macro_trends.aspx" target="_blank" rel="noopener">台經院</a><a href="https://www.stat.gov.tw/Point.aspx?sid=t.1&n=3580&sms=11480" target="_blank" rel="noopener">主計總處</a><a href="https://www.cbc.gov.tw/tw/lp-302-1.html" target="_blank" rel="noopener">中央銀行新聞稿</a></div></div>`;
  return mkt + ov + fc + imfChart + cpiChart + unChart + cli + fxT;
}
function ecoView(id) {
  const e = ECON.find(x => x.id === id), eco = S.world?.economies?.[id];
  if (!eco) return hero(e) + `<div class="card empty">${worldBusy ? '資料載入中…' : '還沒有資料，按右上角「更新」。'}</div>`;
  const cal = id === 'tw' ? S.twOff?.calendar || {} : {};
  const tiles = eco.indicators.map(x => tile({ ...x, nx: cal[TW_CAL[x.k]] })).join('');
  return hero(e) + `<div class="met-grid wide w-tiles">${tiles || '<div class="empty">這個經濟體的數據暫時取不到。</div>'}</div>` + (id === 'tw' ? twExtra() : ecoExtra(id));
}
const _macroUS = PAGES.macro;
PAGES.macro = () => {
  const tab = S.macroTab || 'global';
  setTimeout(() => loadWorld(false), 30);
  const tabs = `<div class="w-tabs">${[...ECON, { id: 'assets', flag: '🪙', name: '其他資產' }].map(e => `<button data-wtab="${e.id}" class="${e.id === tab ? 'on' : ''}"><span>${e.flag}</span>${e.name}</button>`).join('')}</div>`;
  const head = `<div class="w-head"><h2>總經</h2><div class="w-st"><span id="worldStatus">${worldStatus()}</span><button class="btn-small ghost" id="worldRefresh">↻ 更新</button></div></div>`;
  if (tab === 'us') {
    const e = ECON.find(x => x.id === 'us'), cli = S.world?.economies?.us?.indicators || [];
    return head + tabs + hero(e) + (cli.length ? `<div class="met-grid wide w-tiles">${cli.map(tile).join('')}</div>` : '') + ecoExtra('us') + _macroUS().replace(/<h2>[^<]*<\/h2>\s*<p class="lead">[^<]*<\/p>/, '');
  }
  return head + tabs + (tab === 'global' ? globalView() : tab === 'assets' ? assetsView() : ecoView(tab));
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-wtab],#worldRefresh'); if (!t) return;
  if (t.id === 'worldRefresh') { loadWorld(true); fetchMacro(S.macroTab !== 'us'); return; }
  S.macroTab = t.dataset.wtab; save(); render(); window.scrollTo(0, 0);
});
if (current === 'macro') render();
