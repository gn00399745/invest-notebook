// Vercel Serverless Function：台灣官方資料（自動連動）
// GET /api/twofficial → { cbc, dgbas, orders, calendar, errors }
//  cbc：中央銀行理監事會決議新聞稿（經濟成長／CPI 預測、政策利率、主要機構預測表）
//  dgbas：主計總處國民所得（逐季經濟成長與各支出項目，含預測季）
//  orders：經濟部外銷訂單（按貨品、按地區）
//  calendar：國家統計預告發布時間表（下次公布日）
'use strict';
const { readXlsx } = require('./_xlsx');

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36', 'Accept-Language': 'zh-TW,zh;q=0.9' };
const T = ms => AbortSignal.timeout(ms || 15000);
async function text(url, ms) { const r = await fetch(url, { headers: UA, signal: T(ms) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }
async function bin(url, ms) { const r = await fetch(url, { headers: UA, signal: T(ms || 25000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
const strip = h => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const num = s => { const n = parseFloat(String(s ?? '').replace(/[,*\s]/g, '')); return Number.isFinite(n) ? n : null; };
const r2 = n => n == null ? null : Math.round(n * 100) / 100;
const ns = s => String(s || '').replace(/\s+/g, '');
const pad = n => String(n).padStart(2, '0');

/* ---------- 中央銀行 ---------- */
// 央行公布之 115 年理監事會日期（2027 年日程通常於年底公布）
const CBC_MEET = ['2026-03-19', '2026-06-18', '2026-09-17', '2026-12-17'];
async function cbc() {
  const base = 'https://www.cbc.gov.tw';
  const list = await text(base + '/tw/lp-302-1.html');
  const m = list.match(/href="([^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*中央銀行理監事聯席會議決議新聞稿/) || list.match(/href="([^"]+)"[^>]*title="[^"]*理監事聯席會議決議新聞稿/);
  if (!m) throw new Error('找不到央行決議新聞稿');
  const url = m[1].startsWith('http') ? m[1] : base + (m[1].startsWith('/') ? '' : '/tw/') + m[1];
  const h = await text(url); const t = strip(h);
  const g = re => { const x = t.match(re); return x ? x.slice(1).map(num) : []; };
  const out = { url, src: '中央銀行理監事聯席會議決議' };
  [out.h1] = g(/上半年經濟成長(?:率)?(?:為)?\s*([\d.]+)\s*%/);
  [out.h2] = g(/下半年經濟成長率(?:預測值)?(?:為|至)?\s*([\d.]+)\s*%/);
  [out.gdpY] = g(/全年(?:經濟成長率)?(?:為|至)?\s*([\d.]+)\s*%/);
  [out.gdpNext] = g(/(?:明年|明\(\d{4}\)年)經濟成長率(?:為|至)?\s*([\d.]+)\s*%/);
  [out.cpiY, out.coreY] = g(/本年(?:台灣)?CPI及核心CPI年增率(?:預測值)?[^0-9]{0,12}([\d.]+)\s*%\s*、\s*([\d.]+)\s*%/);
  [out.cpiNext, out.coreNext] = g(/明年(?:台灣)?CPI及核心CPI年增率[^0-9]{0,12}([\d.]+)\s*%\s*、\s*([\d.]+)\s*%/);
  const rate = t.match(/重貼現率、擔保放款融通利率及短期融通利率[，,]?\s*分別(維持|調升|調降|升為|降為)?[^0-9]{0,8}([\d.]+)%\s*、\s*([\d.]+)%\s*及\s*([\d.]+)%/);
  if (rate) out.rates = { action: /調升|升為/.test(rate[1] || '') ? '升息' : /調降|降為/.test(rate[1] || '') ? '降息' : '維持', discount: num(rate[2]), secured: num(rate[3]), short: num(rate[4]) };
  const yr = t.match(/本\((\d{4})\)年/); out.year = yr ? +yr[1] : new Date().getFullYear();
  // 主要機構預測表
  const tables = [...h.matchAll(/<table[\s\S]*?<\/table>/gi)].map(x => x[0]).filter(x => /預測機構/.test(x));
  const parse = tb => [...tb.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(tr => [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => strip(c[1]).trim()))
    .filter(c => c.length >= 3 && /（|\(/.test(c[c.length - 3])).map(c => { const lab = c[c.length - 3]; const mm = lab.match(/^(.*?)[（(]\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s*[）)]/); return mm ? { name: mm[1].trim(), date: `${mm[2]}-${pad(mm[3])}-${pad(mm[4])}`, y1: num(c[c.length - 2]), y2: num(c[c.length - 1]) } : null; }).filter(Boolean);
  out.inst = { gdp: tables[0] ? parse(tables[0]) : [], cpi: tables[1] ? parse(tables[1]) : [] };
  out.date = out.inst.gdp.find(x => x.name === '中央銀行')?.date || (h.match(/(\d{4})[-/](\d{2})[-/](\d{2})/) || []).slice(1).join('-');
  const today = new Date().toISOString().slice(0, 10);
  out.next = CBC_MEET.find(d => d > (out.date || today) && d >= today) || null;
  out.nextNote = out.next ? '' : '下一年度理監事會日期將由央行於年底公布（通常為 3、6、9、12 月）';
  return out;
}

/* ---------- 主計總處：逐季經濟成長與各支出項目 ---------- */
async function dgbas() {
  const page = await text('https://www.stat.gov.tw/cp.aspx?n=2674');
  const href = (page.match(/href="([^"]*webdata2008yoy[^"]*\.xlsx)"/i) || [])[1];
  if (!href) throw new Error('找不到主計總處支出面統計表');
  const url = href.startsWith('http') ? href : 'https://www.stat.gov.tw' + href;
  const wb = readXlsx(await bin(encodeURI(decodeURI(url))), [/Growth rates/i, /chained/i]);
  const sheet = k => Object.entries(wb).find(([n]) => k.test(n))?.[1] || [];
  const colsOf = rows => { const hr = rows.find(r => r && r.some(c => /民間消費/.test(c)) && r.some(c => /GDP/.test(c))) || []; const map = {}; hr.forEach((c, i) => { const k = ns(c); if (k && map[k] == null) map[k] = i; }); return map; };
  const qRows = rows => rows.filter(r => r && /^\d{4}Q[1-4]/.test(String(r[2] || ''))).map(r => ({ q: String(r[2]).slice(0, 6), f: /\(f\)/.test(r[2]) || /\(f\)/.test(r[1] || ''), r }));
  const G = sheet(/Growth rates/i), C = sheet(/chained/i);
  const gc = colsOf(G), cc = colsOf(C);
  const keys = [['民間消費', '民間消費'], ['政府消費', '政府消費'], ['資本形成', '資本形成'], ['固定資本形成', '固定資本形成'], ['輸出', '商品及服務輸出'], ['輸入', '商品及服務輸入'], ['國內需求', '國內需求'], ['GDP', 'GDP']];
  const gq = qRows(G);
  const quarters = gq.filter(x => x.q >= '2024Q1').map(x => { const o = { q: x.q, f: x.f }; keys.forEach(([k, col]) => { o[k] = r2(num(x.r[gc[col]])); }); return o; });
  // 以連鎖實質金額估算各項目對成長的貢獻（百分點）
  const cq = qRows(C); const val = (x, col) => num(x.r[cc[col]]);
  const sumBy = (pred, col) => cq.filter(pred).reduce((s, x) => s + (val(x, col) || 0), 0);
  const contrib = (pred, prevPred) => {
    const gdp0 = sumBy(prevPred, 'GDP'); if (!gdp0) return null;
    const d = col => (sumBy(pred, col) - sumBy(prevPred, col)) / gdp0 * 100;
    const o = { 民間消費: d('民間消費'), 政府消費: d('政府消費'), 資本形成: d('資本形成'), 輸出: d('商品及服務輸出'), 輸入: -d('商品及服務輸入'), GDP: d('GDP') };
    o.國外淨需求 = o.輸出 + o.輸入; o.國內需求 = o.民間消費 + o.政府消費 + o.資本形成;
    Object.keys(o).forEach(k => { o[k] = r2(o[k]); }); return o;
  };
  const years = [...new Set(cq.map(x => +x.q.slice(0, 4)))].filter(y => y >= 2025);
  const periods = [];
  years.forEach(y => {
    const inY = (yy, qs) => x => +x.q.slice(0, 4) === yy && qs.includes(+x.q[5]);
    const f = cq.some(x => +x.q.slice(0, 4) === y && x.f);
    if (cq.filter(x => +x.q.slice(0, 4) === y).length === 4) periods.push({ label: `${y}${f ? '(f)' : ''}`, ...contrib(inY(y, [1, 2, 3, 4]), inY(y - 1, [1, 2, 3, 4])) });
    if (y === new Date().getFullYear()) {
      const h1f = cq.some(x => +x.q.slice(0, 4) === y && x.f && +x.q[5] <= 2), h2f = cq.some(x => +x.q.slice(0, 4) === y && x.f && +x.q[5] >= 3);
      periods.push({ label: `${y} 上半年${h1f ? '(f)' : ''}`, ...contrib(inY(y, [1, 2]), inY(y - 1, [1, 2])) });
      periods.push({ label: `${y} 下半年${h2f ? '(f)' : ''}`, ...contrib(inY(y, [3, 4]), inY(y - 1, [3, 4])) });
    }
  });
  return { url: 'https://www.stat.gov.tw/cp.aspx?n=2674', file: decodeURI(url).split('/').pop(), src: '主計總處 國內生產毛額依支出分', quarters, contrib: periods };
}

/* ---------- 經濟部：外銷訂單 ---------- */
async function orders() {
  const base = 'https://www.moea.gov.tw';
  const list = await text(base + '/Mns/dos/bulletin/Bulletin.aspx?kind=5&html=1&menu_id=6724');
  const m = list.match(/bull_id=(\d+)[^>]*>\s*(?:<[^>]+>\s*)*(\d{2,3}年\d{1,2}月外銷訂單統計)/);
  if (!m) throw new Error('找不到外銷訂單新聞稿');
  const after = strip(list.slice(list.indexOf(m[0])));
  const rel = (after.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/) || []);
  const pageUrl = `${base}/Mns/dos/bulletin/Bulletin.aspx?kind=5&html=1&menu_id=6724&bull_id=${m[1]}`;
  const page = await text(pageUrl);
  const fid = (page.match(/file_id=(\d+)"[^>]*title="[^"]*全部附表[^"]*\.xlsx/) || page.match(/title="[^"]*全部附表[^"]*\.xlsx[^"]*"[^>]*href="[^"]*file_id=(\d+)/) || [])[1];
  const out = { title: m[2], url: pageUrl, released: rel[1] ? `${rel[1]} ${rel[2]}` : '', src: '經濟部統計處' };
  const t = strip(page);
  const tot = t.match(/外銷訂單([\d,.]+)億美元/); const yy = t.match(/與上年同月比較[^。]*?(增|減)([\d.]+)%/);
  out.total = { amt: tot ? num(tot[1]) : null, yoy: yy ? (yy[1] === '減' ? -1 : 1) * num(yy[2]) : null };
  if (!fid) return out;
  const wb = readXlsx(await bin(`${base}/Mns/DOS/bulletin/wHandBulletin_File.ashx?file_id=${fid}`), [/^表2/, /^表3$/]);
  const take = rows => {
    const hi = rows.findIndex(r => r && /年/.test(ns(r[0])) && /月/.test(ns(r[0]))); if (hi < 0) return [];
    const hdr = rows[hi]; const end = rows.findIndex((r, i) => i > hi && r && /金額/.test(ns(r[2])));
    const last = rows[end > 0 ? end - 1 : rows.length - 1]; if (!last) return [];
    out.period = out.period || ns(last[1]);
    const res = [];
    for (let c = 2; c < hdr.length; c += 2) if (hdr[c]) res.push({ name: ns(hdr[c]), amt: r2(num(last[c])), yoy: r2(num(last[c + 1])) });
    return res;
  };
  const prod = [...take(wb['表2p1'] || []), ...take(wb['表2p2'] || [])].filter(x => x.name !== '總計');
  const reg = take(wb['表3'] || []).filter(x => x.name !== '總計');
  out.products = prod.sort((a, b) => (b.amt || 0) - (a.amt || 0)); out.regions = reg.sort((a, b) => (b.amt || 0) - (a.amt || 0));
  return out;
}

/* ---------- 國家統計預告發布時間表 ---------- */
const CAL_PICK = { cpi: /^消費者物價指數$/, unemp: /失業率/, export: /海關進出口貿易初步統計/, ip: /^工業生產統計$/, orders: /^外銷訂單統計$/, signal: /景氣對策信號/, cli: /景氣動向指標/, gdp: /^國民所得概估統計$/, forecast: /^經濟預測$/, gdpFull: /國內生產毛額、國民所得、經濟成長率/ };
async function calendar() {
  const h = await text('https://www.stat.gov.tw/News_NoticeCalendar.aspx?n=3717&IsControl=0&_Hide=1&Dept=all&PageSize=1000', 20000);
  const i = h.indexOf('var VueData'); if (i < 0) throw new Error('時間表格式改變');
  const v = JSON.parse(h.slice(h.indexOf('{', i), h.indexOf('</script>', i)).trim().replace(/;$/, ''));
  const y0 = +v.year + 1911, m0 = +v.month, today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const out = {};
  Object.entries(CAL_PICK).forEach(([k, re]) => {
    const it = v.list.find(x => re.test(x.name)); if (!it) return;
    const all = [];
    it.timedatas.forEach((cell, j) => (cell || []).forEach(t => { const d = num(String(t.date).match(/\d+/)?.[0]); if (!d) return; const mm = m0 + j, y = y0 + Math.floor((mm - 1) / 12), mo = (mm - 1) % 12 + 1; all.push({ date: `${y}-${pad(mo)}-${pad(d)}`, time: t.time || '', period: (t.notice || '').replace(/[()]/g, ''), approx: /以前/.test(t.date) }); }));
    all.sort((a, b) => a.date.localeCompare(b.date));
    const nx = all.find(x => x.date >= today), pv = [...all].reverse().find(x => x.date < today);
    if (nx || pv) out[k] = { name: it.name, dept: it.DeptName, ...(nx || {}), last: pv ? pv.date : null };
  });
  return out;
}

module.exports = async (req, res) => {
  const errors = [];
  const safe = async (label, f) => { try { return await f(); } catch (e) { errors.push(`${label}：${e.message}`); return null; } };
  const [c, d, o, cal] = await Promise.all([safe('中央銀行', cbc), safe('主計總處', dgbas), safe('外銷訂單', orders), safe('發布時間表', calendar)]);
  const ok = c || d || o;
  res.setHeader('Cache-Control', ok ? 's-maxage=21600, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), cbc: c, dgbas: d, orders: o, calendar: cal, errors }));
};
