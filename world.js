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
function globalView() {
  const w = S.world, list = ECON.slice(1);
  const cards = list.map(e => {
    const h = headline(e.id), j = h.cli ? judge(h.cli) : null;
    return `<button class="w-eco ${j?.c || ''}" data-wtab="${e.id}"><div class="w-eco-h"><span>${e.flag} <b>${e.name}</b></span>${j ? `<span class="sigp ${j.c}">${j.l}</span>` : ''}</div>
      <div class="w-eco-g"><span><em>成長（IMF 2026）</em><b>${h.gdp != null ? h.gdp + '%' : '—'}</b></span><span><em>通膨（最新）</em><b>${h.cpi != null ? h.cpi + '%' : '—'}</b></span>
      <span><em>${esc(h.mkt?.name || '股市')}</em><b>${h.mkt ? chg(h.mkt.chg1m) : '—'}</b></span><span><em>${esc(h.fx?.name || '匯率')}</em><b>${h.fx ? chg(h.fx.chg1m) : '—'}</b></span></div></button>`;
  }).join('');
  const g = w?.imf?.NGDP_RPCH; const max = g ? Math.max(...list.map(e => g[e.imf]?.['2026'] || 0), 1) : 1;
  const imfChart = g ? `<div class="card"><h3 class="gold-bar">IMF 經濟成長預測比較</h3><div class="w-cmp">${list.map(e => { const v = g[e.imf] || {}; return `<div class="w-cmp-r"><span>${e.flag} ${e.name}</span><div class="w-cmp-b">${['2025', '2026', '2027'].map((y, i) => `<i class="y${i}" style="width:${Math.max(2, (v[y] || 0) / max * 100)}%" title="${y}"></i>`).join('')}</div><b>${v['2026'] ?? '—'}%</b></div>`; }).join('')}</div>
    <div class="w-legend"><span><i class="y0"></i>2025</span><span><i class="y1"></i>2026</span><span><i class="y2"></i>2027</span><span class="help">數字為 2026 年預測</span></div></div>` : '';
  const tw = w?.economies?.tw?.official, t = w?.tier;
  const fc = (tw?.gdp?.length || t?.gdp) ? `<div class="card"><h3 class="gold-bar">🇹🇼 台灣經濟預測</h3><div class="w-fc">
      ${(tw?.gdp || []).map(x => `<div class="met wt pos"><div class="met-h"><span>主計總處 ${esc(x.y)} 年</span></div><div class="wt-v"><b>${x.v}</b><em>% 經濟成長</em></div></div>`).join('')}
      ${(tw?.cpi || []).map(x => `<div class="met wt"><div class="met-h"><span>主計總處 ${esc(x.y)} 年</span></div><div class="wt-v"><b>${x.v}</b><em>% CPI</em></div></div>`).join('')}
      ${t?.gdpValue ? `<div class="met wt pos"><div class="met-h"><span>台經院預測</span></div><div class="wt-v"><b>${t.gdpValue}</b><em>% 經濟成長</em></div></div>` : ''}</div>
      ${t?.gdp ? `<div class="note">台經院：${esc(t.gdp)}${t.cpi ? `<br>${esc(t.cpi)}` : ''}</div>` : ''}
      <div class="srclinks"><a href="https://www.tier.org.tw/forecast/macro_trends.aspx" target="_blank" rel="noopener">台經院景氣動向與預測</a><a href="https://www.stat.gov.tw/Point.aspx?sid=t.1&n=3580&sms=11480" target="_blank" rel="noopener">主計總處經濟成長率</a><a href="https://index.ndc.gov.tw/n/zh_tw" target="_blank" rel="noopener">國發會景氣燈號</a></div></div>` : '';
  return `<div class="w-grid">${cards}</div>${fc}${imfChart}
    <div class="note">看法：先看「領先指標」判斷各經濟體是擴張還是收縮，再看通膨決定央行能不能降息；台股最受美國需求、台灣出口與 Fed 利率影響。</div>`;
}
function ecoView(id) {
  const e = ECON.find(x => x.id === id), eco = S.world?.economies?.[id];
  if (!eco) return hero(e) + `<div class="card empty">${worldBusy ? '資料載入中…' : '還沒有資料，按右上角「更新」。'}</div>`;
  const tiles = eco.indicators.map(tile).join('');
  return hero(e) + `<div class="met-grid wide w-tiles">${tiles || '<div class="empty">這個經濟體的數據暫時取不到。</div>'}</div>`;
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
