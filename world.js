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
  if (!force && S.world && Date.now() - (S.worldAt || 0) < 6 * 3600e3) return;
  worldBusy = true; if (current === 'macro') { const st = $('#worldStatus'); if (st) st.textContent = '更新中…（約 10～30 秒）'; }
  try {
    const r = await fetch('api/world', { signal: AbortSignal.timeout(90000) });
    const j = await r.json(); if (!j.economies) throw new Error('格式錯誤');
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
function twExtra() {
  const c = TW_SNAP.cbc, m = TW_SNAP.comp, o = TW_SNAP.orders;
  const contribKeys = [[2, '民間消費', 'c1'], [3, '政府消費', 'c2'], [4, '資本形成', 'c3'], [5, '國外淨需求', 'c4']];
  const stack = m.rows.map(r => { const tot = contribKeys.reduce((s, [i]) => s + Math.max(0, r[i + 1]), 0);
    return `<div class="stk-r"><span>${r[0]}</span><div class="stk">${contribKeys.map(([i, l, cl]) => `<i class="${cl}" style="width:${Math.max(0, r[i + 1]) / tot * 100}%" title="${l} ${r[i + 1]}">${r[i + 1] >= 1 ? r[i + 1] : ''}</i>`).join('')}</div><b>${r[1]}%</b></div>`; }).join('');
  return `
  <div class="card"><div class="card-head"><h3 class="gold-bar">🏦 央行經濟成長預測</h3><span class="pill">${esc(c.prevNote)}</span></div>
    <div class="w-fc">${c.annual.map(([y, v, n], i) => `<div class="met wt ${i ? 'pos' : ''}"><div class="met-h"><span>${y} 年</span>${n ? `<span class="help">${n}</span>` : ''}</div><div class="wt-v"><b>${v}</b><em>%</em></div></div>`).join('')}</div>
    ${lineSVG(c.q.map(([l, v, f]) => [l, v, f]))}
    <div class="help">實線為實際值，虛線為預測。${c.half.map(([l, v]) => `${l} ${v}%`).join('、')}；成長動能預期逐季放緩，2027 年回到 5～6% 區間。來源：${esc(c.src)}</div></div>
  <div class="card"><h3 class="gold-bar">🧩 經濟成長的來源（貢獻度，百分點）</h3>
    ${stack}<div class="w-legend">${contribKeys.map(([, l, cl]) => `<span><i class="${cl}"></i>${l}</span>`).join('')}</div>
    <div class="help" style="margin:6px 0 10px">2026 年成長 11.48% 中，資本形成（企業投資）貢獻 4.40、國外淨需求 4.28 個百分點；下半年改由投資撐起成長，出口貢獻明顯縮小。</div>
    <details class="rc-sub"><summary>📋 各組成項目成長率</summary>${gtable(['', ...m.gcols], m.grows.map(r => `<div class="gt-r"><span>${r[0]}</span>${r.slice(1).map(v => `<span style="${heat(v, 20)}">${v}</span>`).join('')}</div>`), 'wide')}</details>
    <div class="help">來源：${esc(m.src)}</div></div>
  <div class="card"><h3 class="gold-bar">🚢 外銷訂單：哪些產品在成長（${esc(o.date)}）</h3>
    ${hbars(o.items.map(([l, v]) => ({ l, v })), { unit: '%' })}
    <div class="help">資訊通信、電子產品年增最多，反映 AI 伺服器與半導體需求；來源：${esc(o.src)}。總額與年增率在上方圖卡自動更新，產品別為快照，新數據公布後可請我更新。</div></div>`;
}

function globalView() {
  const w = S.world, list = ECON.slice(1), eco = id => w?.economies?.[id];
  const f = (id, k) => eco(id)?.indicators?.find(x => x.k === k);
  const us = k => { const r = S.macro.rows.find(x => x.key === k); return r?.latest ? num(r.latest) : null; };
  // 1. 股市報酬表
  const idx = Object.entries(w?.economies || {}).flatMap(([id, e]) => (e.markets || []).filter(m => !/=X$|DX-Y/.test(m.sym)).map(m => ({ ...m, id })));
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
  const fx = Object.values(w?.economies || {}).flatMap(e => (e.markets || []).filter(m => /=X$|DX-Y/.test(m.sym)));
  const fxT = fx.length ? `<div class="card"><h3 class="gold-bar">💱 匯率（%）</h3>${gtable(['', '匯率', '1 天', '1 個月', '年初至今'], fx.map(m => `<div class="gt-r"><span>${esc(m.name)}</span><span>${m.price}</span><span>${pc(m.chg1d, 2)}</span><span>${pc(m.chg1m)}</span><span>${pc(m.ytd)}</span></div>`), 'fx')}<div class="help">「美元兌 X」上升＝美元變強、該貨幣貶值；歐元兌美元上升＝歐元升值。</div></div>` : '';
  // 6. 台灣預測
  const tw = eco('tw')?.official, t = w?.tier;
  const fc = `<div class="card"><h3 class="gold-bar">🇹🇼 台灣 2026 年經濟成長預測比較</h3>${hbars([{ l: '中央銀行', v: TW_SNAP.cbc.annual[1][1] }, ...(tw?.gdp || []).filter(x => x.y === '2026').map(x => ({ l: '主計總處', v: x.v })), ...(t?.gdpValue ? [{ l: '台經院', v: t.gdpValue }] : []), { l: 'IMF', v: G?.TWN?.['2026'] ?? null }])}
    ${t?.gdp ? `<div class="note">台經院：${esc(t.gdp)}${t.cpi ? `<br>${esc(t.cpi)}` : ''}</div>` : ''}
    <div class="help">IMF 預測更新頻率較低，與國內機構差距大時，以最新公布的國內預測為主。</div>
    <div class="srclinks"><a href="https://www.tier.org.tw/forecast/macro_trends.aspx" target="_blank" rel="noopener">台經院</a><a href="https://www.stat.gov.tw/Point.aspx?sid=t.1&n=3580&sms=11480" target="_blank" rel="noopener">主計總處</a><a href="https://www.cbc.gov.tw/tw/lp-302-1.html" target="_blank" rel="noopener">中央銀行新聞稿</a></div></div>`;
  return mkt + ov + fc + imfChart + cpiChart + unChart + cli + fxT;
}
function ecoView(id) {
  const e = ECON.find(x => x.id === id), eco = S.world?.economies?.[id];
  if (!eco) return hero(e) + `<div class="card empty">${worldBusy ? '資料載入中…' : '還沒有資料，按右上角「更新」。'}</div>`;
  const tiles = eco.indicators.map(tile).join('');
  return hero(e) + `<div class="met-grid wide w-tiles">${tiles || '<div class="empty">這個經濟體的數據暫時取不到。</div>'}</div>` + (id === 'tw' ? twExtra() : '');
}
const _macroUS = PAGES.macro;
PAGES.macro = () => {
  const tab = S.macroTab || 'global';
  setTimeout(() => loadWorld(false), 30);
  const tabs = `<div class="w-tabs">${ECON.map(e => `<button data-wtab="${e.id}" class="${e.id === tab ? 'on' : ''}"><span>${e.flag}</span>${e.name}</button>`).join('')}</div>`;
  const head = `<div class="w-head"><h2>總經</h2><div class="w-st"><span id="worldStatus">${worldStatus()}</span><button class="btn-small ghost" id="worldRefresh">↻ 更新</button></div></div>`;
  if (tab === 'us') {
    const e = ECON.find(x => x.id === 'us'), cli = S.world?.economies?.us?.indicators || [];
    return head + tabs + hero(e) + (cli.length ? `<div class="met-grid wide w-tiles">${cli.map(tile).join('')}</div>` : '') + _macroUS().replace(/<h2>[^<]*<\/h2>\s*<p class="lead">[^<]*<\/p>/, '');
  }
  return head + tabs + (tab === 'global' ? globalView() : ecoView(tab));
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-wtab],#worldRefresh'); if (!t) return;
  if (t.id === 'worldRefresh') { loadWorld(true); fetchMacro(S.macroTab !== 'us'); return; }
  S.macroTab = t.dataset.wtab; save(); render(); window.scrollTo(0, 0);
});
if (current === 'macro') render();
