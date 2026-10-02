// Vercel Serverless Function：主要經濟體總經數據
// GET /api/world → { updated, economies: { tw, cn, jp, eu, hk, kr, us }, imf, tier, errors }
// 來源：中華民國統計資訊網（主計總處重要經社指標）、OECD SDMX、FRED、Eurostat、日本統計局、香港統計處、IMF、Yahoo Finance、台經院
'use strict';

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' };
const T = (ms = 12000) => AbortSignal.timeout(ms);
const num = s => { const n = parseFloat(String(s ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const r2 = (n, d = 2) => n == null ? null : Math.round(n * 10 ** d) / 10 ** d;
async function getText(url, ms) {
  const res = await fetch(url, { headers: UA, signal: T(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const cs = (res.headers.get('content-type') || '').match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
  let s = new TextDecoder(cs && cs !== 'utf8' ? cs : 'utf-8').decode(buf);
  const meta = s.slice(0, 3000).match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase();
  if (!cs && meta && !/utf-?8/.test(meta)) { try { s = new TextDecoder(meta).decode(buf); } catch (e) { /* keep */ } }
  return s;
}
const getJSON = async (url, ms) => JSON.parse(await getText(url, ms));
const unesc = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// 民國年 → 西元
const roc = s => {
  let m = String(s).match(/(\d{2,3})年第(\d)季/); if (m) return `${+m[1] + 1911}Q${m[2]}`;
  m = String(s).match(/(\d{2,3})年(\d{1,2})月/); if (m) return `${+m[1] + 1911}-${String(m[2]).padStart(2, '0')}`;
  m = String(s).match(/(\d{2,3})年/); if (m) return `${+m[1] + 1911}`;
  return s;
};
const ind = (k, name, pts, o = {}) => {
  // pts：由新到舊 [{d, v}]
  pts = (pts || []).filter(p => p.v != null);
  if (!pts.length) return null;
  return { k, name, v: r2(pts[0].v, o.dp ?? 2), prev: pts[1] ? r2(pts[1].v, o.dp ?? 2) : null, date: pts[0].d, prevDate: pts[1]?.d || '', unit: o.unit || '%', spark: pts.slice(0, o.n || 24).map(p => p.v).reverse(), src: o.src || '', url: o.url || '', kind: o.kind || k };
};

/* ---------- 台灣：主計總處 重要經社指標 ---------- */
async function twPoint(sid, n) {
  const h = await getText(`https://www.stat.gov.tw/Point.aspx?sid=${sid}&n=${n}&sms=11480`, 15000);
  const grab = id => { const m = h.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`)) || h.match(new RegExp(`value="([^"]*)"[^>]*id="${id}"`)); return m ? JSON.parse(unesc(m[1])) : null; };
  return { items: grab('ContentPlaceHolder1_hidData') || [], charts: grab('ContentPlaceHolder1_hidChartData') || [] };
}
const chartPts = (charts, re, type) => { const c = charts.find(x => re.test(x.Title) && (!type || String(x.Type) === String(type))); return c ? c.data.map(p => ({ d: roc(p.Title), v: num(p.Value) })) : []; };
async function taiwan(errors) {
  const src = '主計總處／國發會（中華民國統計資訊網）';
  const pages = { gdp: ['t.1', 3580], cpi: ['t.2', 3581], un: ['t.3', 3582], trade: ['t.8', 3587], ip: ['t.6', 3584], cyc: ['t.11', 3590] };
  const got = {};
  await Promise.all(Object.entries(pages).map(async ([k, [sid, n]]) => { try { got[k] = await twPoint(sid, n); } catch (e) { errors.push(`台灣 ${k}：${e.message}`); } }));
  const out = []; const U = (sid, n) => `https://www.stat.gov.tw/Point.aspx?sid=${sid}&n=${n}&sms=11480`;
  const add = x => x && out.push(x);
  if (got.gdp) add(ind('gdp', '經濟成長率（年增）', chartPts(got.gdp.charts, /經濟成長率\(yoy\)/, 1).filter(p => /Q/.test(p.d)), { src, url: U('t.1', 3580), n: 12 }));
  if (got.cpi) {
    add(ind('cpi', 'CPI 年增率', chartPts(got.cpi.charts, /^消費者物價指數年增率/, 2), { src, url: U('t.2', 3581) }));
    add(ind('core', '核心 CPI 年增率', chartPts(got.cpi.charts, /核心CPI/, 2), { src, url: U('t.2', 3581), kind: 'cpi' }));
  }
  if (got.un) add(ind('unemp', '失業率（季調）', chartPts(got.un.charts, /失業率\(經季節調整後\)/), { src, url: U('t.3', 3582) }));
  if (got.trade) add(ind('export', '出口年增率', chartPts(got.trade.charts, /出口年增率/), { src: '財政部（中華民國統計資訊網）', url: U('t.8', 3587), dp: 1 }));
  if (got.ip) {
    add(ind('ip', '工業生產年增率', chartPts(got.ip.charts, /^工業生產指數年增率/), { src: '經濟部（中華民國統計資訊網）', url: U('t.6', 3584) }));
    const ord = chartPts(got.ip.charts, /^外銷訂單/);
    add(ind('orders', '外銷訂單年增率', ord.slice(0, ord.length - 12).map((p, i) => ({ d: p.d, v: ord[i + 12]?.v ? (p.v / ord[i + 12].v - 1) * 100 : null })), { src: '經濟部統計處（中華民國統計資訊網）', url: U('t.6', 3584), dp: 1, kind: 'export' }));
    if (ord[0]) add({ k: 'ordersAmt', name: '外銷訂單金額', v: Math.round(ord[0].v / 10) / 10, prev: ord[1] ? Math.round(ord[1].v / 10) / 10 : null, date: ord[0].d, prevDate: ord[1]?.d, unit: '億美元', spark: ord.slice(0, 24).map(p => Math.round(p.v / 10) / 10).reverse(), src: '經濟部統計處', url: U('t.6', 3584), kind: 'amt' });
  }
  if (got.cyc) {
    add(ind('signal', '景氣對策信號', chartPts(got.cyc.charts, /景氣對策信號/), { src: '國發會', url: 'https://index.ndc.gov.tw/n/zh_tw', unit: '分', dp: 0 }));
    add(ind('cli', '景氣領先指標', chartPts(got.cyc.charts, /領先指標/), { src: '國發會', url: U('t.11', 3590), unit: '點', kind: 'cliTW' }));
  }
  const fc = (got.gdp?.items || []).filter(x => /經濟成長率\(yoy\)/.test(x.Title) && /預測/.test(x.Remark)).map(x => ({ y: roc(x.Remark), v: num(x.Value) }));
  const cpiF = (got.cpi?.items || []).filter(x => /年增率/.test(x.Title) && /預測/.test(x.Remark)).map(x => ({ y: roc(x.Remark), v: num(x.Value) }));
  return { indicators: out, official: { gdp: fc, cpi: cpiF, src: '主計總處' } };
}

/* ---------- OECD ---------- */
async function oecd(flow, key, n = 24) {
  const o = await getJSON(`https://sdmx.oecd.org/public/rest/data/${flow}/${key}?lastNObservations=${n}&format=jsondata`, 20000);
  const ds = o.data.dataSets[0].series, st = o.data.structures?.[0] || o.data.structure, dims = st.dimensions;
  const pos = dims.series.findIndex(d => d.id === 'REF_AREA'), ref = dims.series[pos].values, times = dims.observation[0].values.map(v => v.id);
  const out = {};
  Object.entries(ds).forEach(([k, v]) => { const a = ref[+k.split(':')[pos]].id; out[a] = Object.entries(v.observations).map(([i, x]) => ({ d: times[+i], v: num(x[0]) })).sort((p, q) => q.d.localeCompare(p.d)); });
  return out;
}

/* ---------- FRED ---------- */
async function fred(id, n = 40) {
  const key = process.env.FRED_API_KEY;
  if (key) {
    const j = await getJSON(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=${n}`, 12000);
    return (j.observations || []).map(o => ({ d: o.date, v: num(o.value) })).filter(p => p.v != null);
  }
  const t = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, 8000);
  return t.trim().split('\n').slice(1).map(l => l.split(',')).map(([d, v]) => ({ d, v: num(v) })).filter(p => p.v != null).reverse().slice(0, n);
}
const monthly = pts => pts.map(p => ({ d: p.d.slice(0, 7), v: p.v }));
const yoy = pts => { const m = monthly(pts); return m.slice(0, Math.max(0, m.length - 12)).map((p, i) => ({ d: p.d, v: m[i + 12] && m[i + 12].v ? (p.v / m[i + 12].v - 1) * 100 : null })); };
// 日資料：取每次變動（政策利率）
const changes = pts => { const out = []; pts.forEach(p => { if (!out.length || out[out.length - 1].v !== p.v) out.push(p); }); return out; };

/* ---------- Yahoo 市場 ---------- */
async function yq(sym) {
  const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`, 10000);
  const R = j.chart.result[0], c = R.indicators.quote[0].close.map((v, i) => [R.timestamp[i], v]).filter(x => x[1] != null);
  const last = c[c.length - 1][1], prev = c[c.length - 2]?.[1], m1 = c[Math.max(0, c.length - 22)][1];
  return { sym, price: r2(last, last < 10 ? 4 : 2), chg1d: prev ? r2((last / prev - 1) * 100) : null, chg1m: m1 ? r2((last / m1 - 1) * 100) : null, spark: c.slice(-60).map(x => r2(x[1], 4)), date: new Date(c[c.length - 1][0] * 1000).toISOString().slice(0, 10) };
}
const MARKETS = {
  tw: [['^TWII', '加權指數'], ['TWD=X', '美元兌台幣']], us: [['^GSPC', '標普 500'], ['^IXIC', '那斯達克綜合'], ['^SOX', '費城半導體'], ['DX-Y.NYB', '美元指數']],
  cn: [['000300.SS', '滬深 300'], ['CNY=X', '美元兌人民幣'], ['000001.SS', '上證指數']], jp: [['^N225', '日經 225'], ['JPY=X', '美元兌日圓']],
  eu: [['^STOXX50E', '歐洲斯托克 50'], ['EURUSD=X', '歐元兌美元']], hk: [['^HSI', '恒生指數'], ['HKD=X', '美元兌港幣']], kr: [['^KS11', '韓國綜合'], ['KRW=X', '美元兌韓元']], in: [['BSE-100.BO', '印度 BSE 100'], ['^BSESN', '印度 Sensex']],
  assets: [['GC=F', '黃金'], ['SI=F', '白銀'], ['PL=F', '鉑金'], ['PA=F', '鈀金'], ['HG=F', '銅'], ['CL=F', 'WTI 原油'], ['BZ=F', '布蘭特原油'], ['NG=F', '天然氣'], ['ZS=F', '黃豆'], ['ZW=F', '小麥'],
    ['^TNX', '美國 10 年債殖利率'], ['^IRX', '美國 3 個月國庫券殖利率'], ['^TYX', '美國 30 年債殖利率'], ['TLT', '美國 20 年以上公債 ETF'], ['IEF', '美國 7–10 年公債 ETF'], ['LQD', '投資級公司債 ETF'], ['HYG', '高收益債 ETF'], ['EMB', '新興市場債 ETF'],
    ['VNQ', '美國 REITs ETF'], ['BTC-USD', '比特幣'], ['ETH-USD', '以太幣'], ['GLD', 'SPDR 黃金 ETF'], ['00635U.TW', '元大 S&P 黃金'], ['00679B.TWO', '元大美債 20 年']],
};

const YUA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)' };
async function yjson(url) { const r = await fetch(url, { headers: YUA, signal: T(12000) }); if (!r.ok) throw new Error('Yahoo HTTP ' + r.status); return r.json(); }
async function yspark(syms) {
  let j;
  try { // spark 一次最多約 16 檔，分批查詢
    j = {}; for (let i = 0; i < syms.length; i += 10) Object.assign(j, await yjson(`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${syms.slice(i, i + 10).map(encodeURIComponent).join(',')}&range=1y&interval=1d`));
  }
  catch (e) {
    j = {}; // 備援：逐檔查詢
    for (const sym of syms) { try { const c = (await yjson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`)).chart.result[0]; j[sym] = { timestamp: c.timestamp, close: c.indicators.quote[0].close }; } catch (err) { /* 略過 */ } }
    if (!Object.keys(j).length) throw e;
  }
  // spark 沒回的代號改逐檔查
  for (const sym of syms.filter(x => !j[x]?.close?.length)) { try { const c = (await yjson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`)).chart.result[0]; j[sym] = { timestamp: c.timestamp, close: c.indicators.quote[0].close }; } catch (err) { /* 略過 */ } }
  const out = {};
  Object.entries(j).forEach(([sym, v]) => {
    const c = (v.close || []).map((x, i) => [v.timestamp[i], x]).filter(x => x[1] != null); if (c.length < 2) return;
    const last = c[c.length - 1][1], prev = c[c.length - 2][1], m1 = c[Math.max(0, c.length - 22)][1];
    const yr = new Date(c[c.length - 1][0] * 1000).getUTCFullYear(), fi = c.findIndex(x => new Date(x[0] * 1000).getUTCFullYear() === yr);
    const ybase = fi > 0 ? c[fi - 1][1] : null, w1 = c[Math.max(0, c.length - 6)][1];
    out[sym] = { sym, price: r2(last, last < 10 ? 4 : 2), chg1d: r2((last / prev - 1) * 100), chg1w: r2((last / w1 - 1) * 100), chg1m: r2((last / m1 - 1) * 100), ytd: ybase ? r2((last / ybase - 1) * 100) : null, spark: c.slice(-60).map(x => r2(x[1], 4)), date: new Date(c[c.length - 1][0] * 1000).toISOString().slice(0, 10) };
  });
  return out;
}
// IMF 擋雲端主機時的備援：世界經濟展望數值快照（2026-10-02 擷取）
const IMF_SNAPSHOT = {
  NGDP_RPCH: { TWN: { 2025: 8.7, 2026: 5.2, 2027: 3 }, USA: { 2025: 2.1, 2026: 2.3, 2027: 2.1 }, CHN: { 2025: 5, 2026: 4.4, 2027: 4 }, JPN: { 2025: 1.2, 2026: 0.7, 2027: 0.6 }, EURO: { 2025: 1.4, 2026: 1.1, 2027: 1.2 }, HKG: { 2025: 3.5, 2026: 2.4, 2027: 2.4 }, KOR: { 2025: 1, 2026: 1.9, 2027: 2.1 } },
  PCPIPCH: { TWN: { 2025: 1.7, 2026: 1.5, 2027: 1.6 }, USA: { 2025: 2.7, 2026: 3.2, 2027: 2.1 }, CHN: { 2025: 0, 2026: 1.2, 2027: 1.5 }, JPN: { 2025: 3.2, 2026: 2.2, 2027: 2.3 }, EURO: { 2025: 2.1, 2026: 2.6, 2027: 2.2 }, HKG: { 2025: 1.4, 2026: 2.1, 2027: 1.8 }, KOR: { 2025: 2.1, 2026: 2.5, 2027: 1.9 } },
  snapshot: '2026-10-02',
};

/* ---------- 其他官方來源 ---------- */
async function hkTable(id) { const j = await getJSON(`https://www.censtatd.gov.hk/api/get.php?id=${id}&lang=en&full_series=1`, 20000); return j.dataSet || []; }
const hkPts = (rows, f) => rows.filter(f).map(x => ({ d: /^\d{6}$/.test(x.period) ? `${x.period.slice(0, 4)}-${x.period.slice(4)}` : x.period, v: num(x.figure) })).filter(p => p.v != null).sort((a, b) => b.d.localeCompare(a.d));
const qtr = d => /^\d{4}-\d{2}$/.test(d) ? `${d.slice(0, 4)}Q${Math.ceil(+d.slice(5) / 3)}` : d;
async function eurostat(ds, q) {
  const j = await getJSON(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${ds}?${q}`, 15000);
  const idx = j.dimension.time.category.index; const times = Object.keys(idx).sort((a, b) => idx[a] - idx[b]);
  return times.map((t, i) => ({ d: t, v: j.value[i] ?? null })).filter(p => p.v != null).reverse();
}
async function japanCPI() {
  const h = await getText('https://www.stat.go.jp/data/cpi/sokuhou/tsuki/index-z.html', 12000);
  const t = h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const ym = t.match(/(\d{4})年（令和\d+年）(\d{1,2})月分/);
  const rates = [...t.matchAll(/前年同月比は\s*([\d.]+)\s*[%％]の(上昇|下落)/g)].map(m => (m[2] === '下落' ? -1 : 1) * num(m[1]));
  if (!ym || rates.length < 1) throw new Error('日本 CPI 頁面格式改變');
  return { d: `${ym[1]}-${String(ym[2]).padStart(2, '0')}`, all: rates[0], core: rates[1], coreCore: rates[2] };
}
async function imf() {
  const pick = ['TWN', 'USA', 'CHN', 'JPN', 'EURO', 'HKG', 'KOR'], out = {};
  await Promise.all(['NGDP_RPCH', 'PCPIPCH'].map(async k => {
    const j = await getJSON(`https://www.imf.org/external/datamapper/api/v1/${k}/${pick.join('/')}`, 20000);
    const v = j.values[k]; out[k] = {}; pick.forEach(c => { if (v[c]) out[k][c] = v[c]; });
  }));
  return out;
}
async function tier() {
  const h = await getText('https://www.tier.org.tw/forecast/macro_trends.aspx', 15000);
  const t = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const sent = re => (t.match(re) || [])[0]?.trim().slice(0, 160) || '';
  const gdp = sent(/預估\s*\d{4}\s*年[^。]{0,40}經濟成長率[^。]{0,80}/);
  const cpi = sent(/(預估|預測)[^。]{0,30}(CPI|消費者物價)[^。]{0,80}/);
  const date = (t.match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})\s*(發布|發表|記者會)?/) || [])[0] || '';
  const g = gdp.match(/(上修|下修|調整)?至?\s*([\d.]+)\s*%/g);
  return { gdp, cpi, date, gdpValue: g ? num(g[g.length - 1].replace(/[^\d.]/g, '')) : null, url: 'https://www.tier.org.tw/forecast/macro_trends.aspx' };
}

module.exports = async (req, res) => {
  const errors = [];
  const safe = async (label, f) => { try { return await f(); } catch (e) { if (label !== 'IMF') errors.push(`${label}：${e.message}`); return null; } };
  const [tw, cpiO, cliO, imfD, tierD, jpCPI, jpUn, jpRate, jp10, euHICP, euUn, euRate, eu10, euGDP, hkCPI, hkLF, hkGDP, krUn] = await Promise.all([
    safe('台灣', () => taiwan(errors)),
    safe('OECD CPI', () => oecd('OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0', 'CHN+KOR+USA.M.N.CPI.PA._T.N.GY', 24)),
    safe('OECD 領先指標', () => oecd('OECD.SDD.STES,DSD_STES@DF_CLI,4.1', 'CHN+JPN+USA+KOR+G4E.M.LI...AA...H', 24)),
    safe('IMF', imf).then(x => x || IMF_SNAPSHOT), safe('台經院', tier), safe('日本 CPI', japanCPI),
    safe('日本失業率', () => fred('LRHUTTTTJPM156S')), safe('日本短期利率', () => fred('IRSTCI01JPM156N')), safe('日本 10 年債', () => fred('IRLTLT01JPM156N')),
    safe('歐元區 HICP', () => fred('CP0000EZ19M086NEST', 40)), safe('歐元區失業率', () => eurostat('une_rt_m', 'geo=EA21&s_adj=SA&age=TOTAL&sex=T&unit=PC_ACT&lastTimePeriod=24')),
    safe('ECB 利率', () => fred('ECBDFR', 800)), safe('德國 10 年債', () => fred('IRLTLT01DEM156N')),
    safe('歐元區 GDP', () => eurostat('namq_10_gdp', 'geo=EA21&unit=CLV_PCH_SM&s_adj=SCA&na_item=B1GQ&lastTimePeriod=12')),
    safe('香港 CPI', () => hkTable('510-60001')), safe('香港失業率', () => hkTable('210-06101')), safe('香港 GDP', () => hkTable('310-31001')),
    safe('韓國失業率', () => fred('LRHUTTTTKRM156S')),
  ]);
  // 經濟成長貢獻（美國：BEA 經 FRED；歐元區：Eurostat）、Fed 經濟預測（SEP）、OECD 經濟展望
  const [usC, sep, euC, eo] = await Promise.all([
    safe('美國 GDP 貢獻', async () => {
      const ids = { GDP: 'A191RL1Q225SBEA', 民間消費: 'DPCERY2Q224SBEA', 民間投資: 'A006RY2Q224SBEA', 政府支出: 'A822RY2Q224SBEA', 淨出口: 'A019RY2Q224SBEA' };
      const got = {}; await Promise.all(Object.entries(ids).map(async ([k, id]) => { got[k] = await fred(id, 6); }));
      return { unit: '季增年率（SAAR）／百分點', periods: got.GDP.map(p => p.d).reverse().map(d => { const o = { label: `${d.slice(0, 4)}Q${Math.ceil(+d.slice(5, 7) / 3)}` }; Object.keys(ids).forEach(k => { o[k] = got[k].find(p => p.d === d)?.v ?? null; }); return o; }), src: '美國經濟分析局 BEA（FRED）' };
    }),
    safe('Fed 經濟預測', async () => {
      const ids = { GDP: 'GDPC1MD', 'PCE 通膨': 'PCECTPIMD', 失業率: 'UNRATEMD', 聯邦基金利率: 'FEDTARMD' }; const out = {};
      await Promise.all(Object.entries(ids).map(async ([k, id]) => { out[k] = (await fred(id, 8)).map(p => ({ y: p.d.slice(0, 4), v: p.v })).sort((a, b) => a.y.localeCompare(b.y)); }));
      return { src: 'Fed 經濟預測摘要（SEP，中位數）', rows: out };
    }),
    safe('歐元區 GDP 貢獻', async () => {
      const j = await getJSON('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/namq_10_gdp?geo=EA21&unit=CON_PPCH_SM&s_adj=SCA&na_item=P31_S14_S15&na_item=P3_S13&na_item=P5G&na_item=P6&na_item=P7&lastTimePeriod=6', 15000);
      const it = j.dimension.na_item.category.index, tm = j.dimension.time.category.index, nt = Object.keys(tm).length;
      const v = (k, t) => j.value[it[k] * nt + tm[t]] ?? null;
      const periods = Object.keys(tm).sort((a, b) => tm[a] - tm[b]).map(t => { const o = { label: t.replace('-', ''), 民間消費: v('P31_S14_S15', t), 政府消費: v('P3_S13', t), 資本形成: v('P5G', t), 淨出口: v('P6', t) != null && v('P7', t) != null ? r2(v('P6', t) + v('P7', t)) : null }; o.GDP = r2(['民間消費', '政府消費', '資本形成', '淨出口'].reduce((s, k) => s + (o[k] || 0), 0)); return o; });
      return { unit: '年增率貢獻（百分點）', periods, src: 'Eurostat' };
    }),
    safe('OECD 經濟展望', async () => {
      const o = await getJSON('https://sdmx.oecd.org/public/rest/data/OECD.ECO.MAD,DSD_EO@DF_EO,/USA+EA17+CHN+JPN+KOR.GDPV_ANNPCT+CPIH_YTYPCT.A?startPeriod=2025&format=jsondata', 25000);
      const ds = o.data.dataSets[0].series, st = o.data.structures?.[0] || o.data.structure, dims = st.dimensions;
      const pa = dims.series.findIndex(d => d.id === 'REF_AREA'), pm = dims.series.findIndex(d => d.id === 'MEASURE'), times = dims.observation[0].values.map(x => x.id);
      const out = { name: st.name || 'OECD Economic Outlook' };
      Object.entries(ds).forEach(([k, s]) => { const ks = k.split(':'), a = dims.series[pa].values[+ks[pa]].id, m = dims.series[pm].values[+ks[pm]].id; ((out[a] = out[a] || {})[m.startsWith('GDP') ? 'gdp' : 'cpi'] = {}); Object.entries(s.observations).forEach(([i, x]) => { out[a][m.startsWith('GDP') ? 'gdp' : 'cpi'][times[+i]] = r2(num(x[0])); }); });
      return out;
    }),
  ]);
  const mk = {};
  const spark = await safe('市場行情', () => yspark(Object.values(MARKETS).flat().map(m => m[0])));
  Object.entries(MARKETS).forEach(([e, list]) => { mk[e] = list.map(([sym, name]) => spark?.[sym] && { ...spark[sym], name }).filter(Boolean); });
  const L = arr => arr.filter(Boolean);
  const O = 'OECD', OCLI = 'OECD 綜合領先指標（100 為長期趨勢）';
  const eco = {
    tw: { indicators: tw?.indicators || [], official: tw?.official },
    cn: { indicators: L([ind('cpi', 'CPI 年增率', cpiO?.CHN, { src: O, url: 'https://data-explorer.oecd.org/' }), ind('cli', '領先指標（OECD）', cliO?.CHN, { src: OCLI, unit: '點' })]) },
    jp: { indicators: L([
      jpCPI && { k: 'cpi', name: 'CPI 年增率', v: jpCPI.all, prev: null, date: jpCPI.d, unit: '%', spark: [], src: '日本總務省統計局', url: 'https://www.stat.go.jp/data/cpi/sokuhou/tsuki/index-z.html', kind: 'cpi' },
      jpCPI?.coreCore != null && { k: 'core', name: '核心核心 CPI（扣生鮮及能源）', v: jpCPI.coreCore, prev: null, date: jpCPI.d, unit: '%', spark: [], src: '日本總務省統計局', url: 'https://www.stat.go.jp/data/cpi/sokuhou/tsuki/index-z.html', kind: 'cpi' },
      ind('unemp', '失業率', monthly(jpUn || []), { src: 'OECD（FRED）' }), ind('rate', '短期利率（無擔保隔夜拆款）', monthly(jpRate || []), { src: 'OECD（FRED）', kind: 'rate' }),
      ind('y10', '10 年期公債殖利率', monthly(jp10 || []), { src: 'OECD（FRED）' }), ind('cli', '領先指標（OECD）', cliO?.JPN, { src: OCLI, unit: '點' })]) },
    eu: { indicators: L([
      ind('cpi', 'HICP 年增率', yoy(monthly(euHICP || [])), { src: 'Eurostat（FRED）', dp: 1 }), ind('gdp', 'GDP 年增率', (euGDP || []).map(p => ({ d: p.d.replace('-', ''), v: p.v })), { src: 'Eurostat', n: 12 }),
      ind('unemp', '失業率', euUn || [], { src: 'Eurostat' }), ind('rate', 'ECB 存款利率', changes([...(euRate || [])].reverse()).reverse(), { src: '歐洲央行（FRED）', kind: 'rate' }),
      ind('y10', '德國 10 年期公債殖利率', monthly(eu10 || []), { src: 'OECD（FRED）' }), ind('cli', '領先指標（歐洲四大國）', cliO?.G4E, { src: OCLI, unit: '點' })]) },
    hk: { indicators: L([
      hkGDP && ind('gdp', 'GDP 年增率', hkPts(hkGDP, x => x.sv === 'CON' && x.freq === 'Q' && /Year-on-year/.test(x.svDesc)).map(p => ({ d: qtr(p.d), v: p.v })), { src: '香港政府統計處', n: 12 }),
      hkCPI && ind('cpi', '綜合 CPI 年增率', hkPts(hkCPI, x => x.sv === 'CC_CM_1920' && x.freq === 'M' && /Year-on-year/.test(x.svDesc)), { src: '香港政府統計處' }),
      hkLF && ind('unemp', '失業率（季調）', hkPts(hkLF, x => x.sv === 'SAUR' && !x.SEX && x.freq === 'M3M'), { src: '香港政府統計處' })]) },
    kr: { indicators: L([ind('cpi', 'CPI 年增率', cpiO?.KOR, { src: O }), ind('unemp', '失業率', monthly(krUn || []), { src: 'OECD（FRED）' }), ind('cli', '領先指標（OECD）', cliO?.KOR, { src: OCLI, unit: '點' })]) },
    in: { indicators: [] },
    us: { indicators: L([ind('cli', '領先指標（OECD）', cliO?.USA, { src: OCLI, unit: '點' })]) },
  };
  eco.assets = { indicators: [] };
  if (usC) eco.us.contrib = usC; if (sep) eco.us.sep = sep; if (euC) eco.eu.contrib = euC;
  Object.keys(eco).forEach(k => { eco[k].markets = mk[k] || []; });
  const ok = (tw?.indicators?.length || 0) + Object.values(eco).reduce((s, e) => s + e.indicators.length, 0) > 5;
  res.setHeader('Cache-Control', ok ? 's-maxage=21600, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), fredKey: !!process.env.FRED_API_KEY, economies: eco, imf: imfD, oecdEO: eo, tier: tierD, errors }));
};
