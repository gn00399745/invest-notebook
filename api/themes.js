// Vercel Serverless Function：趨勢主題雷達
// GET /api/themes
// 先進科技主題 → 供應鏈個股；用「股價動能、營收成長、新聞熱度」判斷哪個主題正在升溫、哪些公司真的吃到紅利。
// 資料：證交所／櫃買中心 OpenAPI（月營收）、Yahoo Finance（股價、美股季營收）、Google 新聞 RSS（新聞熱度）。
'use strict';
const { UA, T, num, twse, tpex } = require('./_market');

// 主題清單：why＝為什麼現在值得看；chain＝供應鏈位置與代表公司（台股代號／美股代號）
const THEMES = [
  { id: 'aisrv', name: 'AI 伺服器', ic: '🖥️', q: 'AI伺服器 出貨', why: '雲端大廠持續擴大 AI 資本支出，GPU 伺服器、機櫃組裝訂單直接反映在台廠營收。',
    chain: [['GPU／加速器', ['NVDA', 'AMD']], ['伺服器組裝（ODM）', ['2317', '2382', '3231', '6669', '2356', '2376']], ['品牌', ['SMCI', 'DELL']]] },
  { id: 'chip', name: 'AI 晶片與先進製程', ic: '🧠', q: 'AI晶片 先進製程 台積電', why: 'AI 晶片幾乎都要用最先進製程，晶圓代工與 ASIC 設計服務是最直接的受惠者。',
    chain: [['晶圓代工', ['2330']], ['ASIC／設計服務', ['3661', '3443', '3035', 'AVGO', 'MRVL']], ['IC 設計', ['2454']]] },
  { id: 'cowos', name: '先進封裝 CoWoS', ic: '🧩', q: 'CoWoS 先進封裝 擴產', why: 'AI 晶片要把運算晶片和 HBM 封在一起，先進封裝產能是瓶頸，設備與封測廠訂單滿載。',
    chain: [['封裝產能', ['2330', '3711']], ['封裝設備', ['3131', '6187', '3583', '2467']], ['測試介面', ['6515', '6223']]] },
  { id: 'cpo', name: 'CPO 矽光子', ic: '💡', q: 'CPO 矽光子', why: '資料中心傳輸速度往 1.6T 走，電訊號耗電太高，改用光通訊與共同封裝光學（CPO）。',
    chain: [['光元件／雷射', ['3081', '4979', '3363', '4977']], ['光收發模組', ['3450', 'COHR', 'LITE']], ['交換器', ['2345', 'ANET']]] },
  { id: 'hbm', name: 'HBM 與記憶體', ic: '💾', q: 'HBM 記憶體 漲價', why: 'AI 需要大量高頻寬記憶體，排擠一般 DRAM 產能，記憶體進入漲價循環。',
    chain: [['記憶體原廠', ['MU', '2408', '2344']], ['模組／控制晶片', ['8299', '3260']]] },
  { id: 'cool', name: '液冷散熱', ic: '❄️', q: '液冷 散熱 AI伺服器', why: '新一代 AI 晶片功耗破千瓦，氣冷不夠用，水冷板、分歧管、冷卻分配單元需求大增。',
    chain: [['水冷板／模組', ['3017', '3324', '3653']], ['風扇／機構', ['2421', '8996']], ['機房散熱', ['VRT']]] },
  { id: 'power', name: 'AI 電源與 BBU', ic: '🔋', q: 'AI 電源 BBU 資料中心', why: 'AI 機櫃用電倍增，高瓦數電源供應器與備援電池（BBU）是新的成長來源。',
    chain: [['電源供應器', ['2308', '2301', '6409']], ['電池模組', ['3211']], ['電力設備', ['ETN', 'VRT']]] },
  { id: 'grid', name: '重電與電網', ic: '⚡', q: '重電 電網 強韌', why: '資料中心與電動化帶動用電，各國電網更新、變壓器長期缺貨。',
    chain: [['變壓器／配電', ['1519', '1503', '1513', '1514']], ['馬達／電機', ['1504']], ['國際電網', ['GEV', 'ETN']]] },
  { id: 'pcb', name: 'AI 高階 PCB 與載板', ic: '🟩', q: 'AI PCB 銅箔基板 載板', why: 'AI 伺服器板層數多、材料規格高，銅箔基板（CCL）與 ABF 載板量價齊揚。',
    chain: [['銅箔基板', ['2383', '6274']], ['PCB', ['2368', '3044']], ['ABF 載板', ['3037', '8046']]] },
  { id: 'robot', name: '機器人與人形機器人', ic: '🤖', q: '人形機器人 供應鏈', why: '車廠與科技大廠投入人形機器人，減速機、線性滑軌、致動器是關鍵零件。',
    chain: [['傳動元件', ['2049', '4583', '1590']], ['系統整合／視覺', ['2359', '8374']], ['整機與應用', ['TSLA', 'ISRG']]] },
  { id: 'leo', name: '低軌衛星', ic: '🛰️', q: '低軌衛星 台廠', why: '低軌衛星星系持續發射，地面接收設備、射頻元件與衛星板材需求成長。',
    chain: [['衛星板材', ['2313']], ['射頻／天線', ['3491', '2314']], ['地面設備', ['6285', '3380']], ['衛星營運', ['ASTS', 'RKLB']]] },
  { id: 'nuke', name: '核能與小型模組化反應爐', ic: '☢️', q: '核能 SMR 資料中心 用電', why: 'AI 資料中心需要穩定基載電力，核電延役與小型模組化反應爐（SMR）重新受重視。',
    chain: [['核電營運', ['CEG', 'VST']], ['SMR 開發', ['OKLO', 'SMR']], ['燃料與設備', ['CCJ', 'BWXT']]] },
  { id: 'quantum', name: '量子運算', ic: '⚛️', q: '量子電腦 量子運算', why: '量子硬體陸續有技術突破，但離大規模商用還遠，屬於高風險的長期題材。',
    chain: [['量子硬體', ['IONQ', 'RGTI', 'QBTS']], ['科技大廠', ['IBM', 'GOOGL']]] },
  { id: 'drone', name: '無人機與國防', ic: '🛩️', q: '無人機 國防 台灣', why: '各國提高國防預算，無人機與「非紅供應鏈」受政策支持。',
    chain: [['台灣無人機', ['8033', '2634']], ['國際國防', ['AVAV', 'KTOS']]] },
];

const pool = async (items, n, f) => { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await f(items[k]); } catch (e) { out[k] = null; } } })); return out; };
const r1 = v => v == null || !isFinite(v) ? null : Math.round(v * 10) / 10;
const med = a => { const b = a.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
async function getJ(u, ms = 9000) { const r = await fetch(u, { headers: UA, signal: T(ms) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }

async function px(sym) {
  const j = await getJ(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`);
  const R = j.chart?.result?.[0]; const c = (R?.indicators?.quote?.[0]?.close || []).filter(v => v != null); if (c.length < 70) throw new Error('資料不足');
  const L = R.meta.regularMarketPrice || c[c.length - 1]; c[c.length - 1] = L;
  const back = d => c.length > d ? (L / c[c.length - 1 - d] - 1) * 100 : null, ma60 = c.slice(-60).reduce((a, b) => a + b, 0) / 60;
  return { price: L, name: R.meta.shortName || R.meta.longName, r1m: r1(back(21)), r3m: r1(back(63)), r6m: r1(back(126)), r1y: r1(back(c.length - 1)), above: L > ma60, ma60: r1((L / ma60 - 1) * 100), hi: r1((L / Math.max(...c) - 1) * 100), spark: c.filter((_, i) => i % 5 === 0 || i === c.length - 1).slice(-52).map(v => Math.round(v * 100) / 100) };
}
// 美股：最近一季營收比去年同季
async function usRev(sym) {
  const p2 = Math.floor(Date.now() / 1000), p1 = p2 - 800 * 86400;
  const j = await getJ(`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}?type=quarterlyTotalRevenue&period1=${p1}&period2=${p2}`);
  const a = (j.timeseries?.result?.[0]?.quarterlyTotalRevenue || []).filter(Boolean).map(x => x.reportedValue?.raw).filter(v => v > 0);
  return a.length >= 5 ? r1((a[a.length - 1] / a[a.length - 5] - 1) * 100) : null;
}
// 新聞熱度：Google 新聞近 7 天、30 天篇數與最新標題
async function news(q) {
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:30d')}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`, { headers: { 'User-Agent': UA['User-Agent'] }, signal: T(8000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const x = await r.text(), items = [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
  const tag = (s, t) => (new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`).exec(s)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  const L = items.map(s => ({ t: tag(s, 'title'), u: tag(s, 'link'), d: new Date(tag(s, 'pubDate')).getTime(), src: tag(s, 'source') })).filter(o => o.t && o.d).sort((a, b) => b.d - a.d);
  const now = Date.now();
  return { n7: L.filter(o => now - o.d < 7 * 864e5).length, n30: L.length, top: L.slice(0, 4).map(o => ({ t: o.t.replace(/ - [^-]+$/, ''), u: o.u, src: o.src, d: new Date(o.d + 8 * 3600e3).toISOString().slice(0, 10) })) };
}
// 個股判讀：營收與股價誰先跑
function tag(s) {
  const rv = s.rev, m = s.r3m;
  if (rv == null || m == null) return ['neu', '資料不足'];
  if (rv >= 20 && m >= 15) return ['hot', '正在吃紅利'];
  if (rv >= 20 && m < 5) return ['gem', '營收起飛、股價未反映'];
  if (m >= 25 && rv < 5) return ['spec', '股價先跑、營收待驗證'];
  if (rv < -5 && m < 0) return ['cold', '還沒受惠'];
  return ['neu', '觀察'];
}
const rankPct = (vals, v) => { const a = vals.filter(x => x != null); if (v == null || !a.length) return 0.3; return a.filter(x => x < v).length / Math.max(1, a.length - 1); };

module.exports = async (req, res) => {
  try {
    const errors = [], [L, O] = await Promise.all([twse(errors), tpex(errors)]), TW = { ...O, ...L };
    const syms = [...new Set(THEMES.flatMap(t => t.chain.flatMap(c => c[1])))];
    const yfs = s => /^\d/.test(s) ? s + (TW[s]?.mkt === '上櫃' ? '.TWO' : '.TW') : s;
    const [P, R, N] = await Promise.all([
      pool(syms, 16, s => px(yfs(s)).catch(e => /^\d/.test(s) && TW[s]?.mkt !== '上櫃' ? px(s + '.TWO') : Promise.reject(e))),
      pool(syms.filter(s => !/^\d/.test(s)), 10, usRev),
      pool(THEMES, 8, t => news(t.q)),
    ]);
    const S = {}; syms.forEach((s, i) => { if (P[i]) S[s] = P[i]; });
    syms.filter(s => !/^\d/.test(s)).forEach((s, i) => { if (S[s]) S[s].rev = R[i]; });
    syms.filter(s => /^\d/.test(s)).forEach(s => { if (S[s] && TW[s]) Object.assign(S[s], { name: TW[s].name, rev: TW[s].revYoY != null ? r1(TW[s].revYoY) : null, cum: r1(TW[s].cumYoY), revYM: TW[s].revYM, pe: TW[s].pe, ind: TW[s].ind }); });
    const out = THEMES.map((t, i) => {
      const chain = t.chain.map(([role, list]) => ({ role, list: list.filter(s => S[s]).map(s => { const x = S[s]; const [cl, lb] = tag(x); return { code: s, name: x.name, mkt: /^\d/.test(s) ? '台股' : '美股', price: x.price, r1m: x.r1m, r3m: x.r3m, r6m: x.r6m, r1y: x.r1y, ma60: x.ma60, hi: x.hi, rev: x.rev, cum: x.cum, revYM: x.revYM, pe: x.pe, tag: lb, cls: cl, spark: x.spark }; }) })).filter(c => c.list.length);
      const all = chain.flatMap(c => c.list);
      return { id: t.id, name: t.name, ic: t.ic, why: t.why, q: t.q, chain, n: all.length,
        m1: r1(med(all.map(x => x.r1m))), m3: r1(med(all.map(x => x.r3m))), m6: r1(med(all.map(x => x.r6m))), breadth: all.length ? Math.round(all.filter(x => x.ma60 > 0).length / all.length * 100) : null,
        rev: r1(med(all.map(x => x.rev))), news: N[i] || null };
    }).filter(t => t.n);
    // 熱度分數：各項在所有主題中的排名（0～100）
    const col = k => out.map(t => k(t));
    const M3 = col(t => t.m3), M1 = col(t => t.m1), BR = col(t => t.breadth), RV = col(t => t.rev), NW = col(t => t.news?.n7 ?? null);
    out.forEach(t => {
      t.score = Math.round(100 * (0.3 * rankPct(M3, t.m3) + 0.15 * rankPct(M1, t.m1) + 0.15 * rankPct(BR, t.breadth) + 0.25 * rankPct(RV, t.rev) + 0.15 * rankPct(NW, t.news?.n7 ?? null)));
      const rv = t.rev ?? 0, m = t.m3 ?? 0;
      t.stage = rv >= 15 && m >= 10 ? ['hot', '🔥 紅利兌現中', '營收和股價都在漲，主題正被市場買單；追高要分批'] : rv >= 15 && m <= -10 ? ['gem', '💎 營收強、股價修正中', '營收還在成長、股價卻回檔，等止跌（站回季線）再分批，是撿便宜的候選'] : rv >= 15 ? ['gem', '💎 基本面先行', '營收已經成長，股價還沒跟上，值得優先研究'] : m >= 15 ? ['spec', '🚀 題材先行', '股價先漲、營收還沒跟上，要等月營收驗證'] : m < -5 ? ['cold', '❄️ 降溫中', '股價轉弱，先觀察，等止跌再看'] : ['neu', '🌱 醞釀中', '還在早期，持續追蹤新聞與營收'];
    });
    out.sort((a, b) => b.score - a.score);
    res.setHeader('Cache-Control', errors.length ? 's-maxage=600' : 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ updated: new Date().toISOString(), themes: out, errors,
      note: '主題與公司清單是人工整理的起點，不代表推薦；分數只反映「最近」股價、營收與新聞的熱度。台股營收為最新月營收年增率，美股為最新一季營收年增率。' });
  } catch (e) { res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ error: e.message }); }
};
