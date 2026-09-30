/* AI 投資筆記：擴充功能
   多條供應鏈、自動歸層、查詢連結、DCF 試算、走勢圖、ETF 自動帶入、
   部位計算教學、監控自動檢查、回測工具、交易紀錄與持倉損益。 */
'use strict';

/* ================= 一、多條供應鏈 ================= */
const CHAINS = [
  { id: 'ai', name: 'AI 供應鏈', prefix: '', layers: LAYERS.map(([n, d, b], i) => ({ n, d, b, bottleneck: [7, 8, 9, 10].includes(i) })) },
  { id: 'ev', name: '電動車與能源', prefix: '電動車', layers: [
    { n: '整車品牌', d: '設計與銷售電動車', b: '價格戰激烈、毛利受壓', ex: 'Tesla（TSLA）、BYD、鴻華先進 2258' },
    { n: '電池芯與材料', d: '電芯、正負極、電解液', b: '中國業者寡占產能', ex: 'CATL、LG Energy、美琪瑪 4721' },
    { n: '功率半導體與電驅', d: 'SiC／IGBT、馬達、電控', b: '碳化矽產能是瓶頸', ex: 'Infineon、ON Semi（ON）、富田 2221、台達電 2308' },
    { n: '車用電子與感測', d: 'ADAS、車用鏡頭、車載電腦', b: '', ex: 'Mobileye（MBLY）、同致 3552、和碩 4938' },
    { n: '充電與儲能', d: '充電樁、儲能系統', b: '', ex: '台達電 2308、Tesla Energy、華城 1519' },
    { n: '電網與重電', d: '變壓器、配電、電網升級', b: '變壓器交期長，重電廠訂單滿', ex: '華城 1519、士電 1503、中興電 1513、GE Vernova（GEV）', bottleneck: true },
    { n: '再生能源', d: '太陽能、風電', b: '', ex: 'First Solar（FSLR）、世紀鋼 9958' },
  ] },
  { id: 'fin', name: '金融', prefix: '金融', layers: [
    { n: '銀行（利差）', d: '存放款利差、手續費', b: '升息初期利差擴大', ex: '中信金 2891、玉山金 2884、兆豐金 2886、第一金 2892、JPMorgan（JPM）' },
    { n: '壽險（投資收益與匯率）', d: '保費收入、海外債券投資', b: '匯率與利率變動影響大', ex: '國泰金 2882、富邦金 2881、新光併入台新新光金 2887' },
    { n: '證券與資產管理', d: '經紀手續費、投信 ETF 管理費', b: '成交量越大越受惠', ex: '元大金 2885、凱基金 2883、統一證 2855' },
    { n: '支付與金融科技', d: '刷卡、跨境支付', b: '網路效應寡占', ex: 'Visa（V）、Mastercard（MA）、PayPal（PYPL）', bottleneck: true },
  ] },
  { id: 'cons', name: '內需民生與電信', prefix: '內需', layers: [
    { n: '電信', d: '行動、寬頻、企業網路', b: '寡占、現金流穩定', ex: '中華電 2412、台灣大 3045、遠傳 4904' },
    { n: '食品與民生', d: '食品、飲料、日用品', b: '', ex: '統一 1216、大成 1210、Coca-Cola（KO）' },
    { n: '零售通路', d: '超商、量販、電商', b: '通路規模優勢', ex: '統一超 2912、全家 5903、Costco（COST）、Walmart（WMT）' },
    { n: '觀光餐飲', d: '飯店、餐飲、旅遊', b: '景氣與出國人潮敏感', ex: '王品 2727、雄獅 2731、晶華 2707' },
  ] },
  { id: 'ship', name: '航運與原物料', prefix: '原物料', layers: [
    { n: '貨櫃航運', d: '海運運價', b: '運價波動極大、景氣循環', ex: '長榮 2603、陽明 2609、萬海 2615' },
    { n: '航空', d: '客運、貨運', b: '油價與匯率敏感', ex: '長榮航 2618、華航 2610、星宇航空 2646' },
    { n: '石化塑膠', d: '塑膠原料、煉油', b: '中國產能過剩壓價', ex: '台塑 1301、南亞 1303、台化 1326、台塑化 6505' },
    { n: '鋼鐵水泥', d: '基礎建材', b: '', ex: '中鋼 2002、台泥 1101、亞泥 1102' },
  ] },
  { id: 'bio', name: '生技醫療', prefix: '生技', layers: [
    { n: '國際大藥廠', d: '減重藥、癌症藥等', b: '專利保護期', ex: 'Eli Lilly（LLY）、Novo Nordisk（NVO）' },
    { n: '新藥研發', d: '臨床試驗、授權', b: '臨床成敗決定股價', ex: '藥華藥 6446' },
    { n: '學名藥與 CDMO', d: '代工生產、學名藥', b: '', ex: '保瑞 6472' },
    { n: '醫材與通路', d: '醫療器材、藥局', b: '', ex: 'Intuitive Surgical（ISRG）、大樹 6469' },
  ] },
];
// AI 供應鏈範例公司沿用範例資料
CHAINS[0].layers.forEach((l, i) => { l.ex = window.EXAMPLES?.layers?.[i] || ''; });
const layerValue = (chain, i) => chain.prefix ? `${chain.prefix}｜${i + 1} ${chain.layers[i].n}` : `${i + 1} ${chain.layers[i].n}`;
function findLayer(v) {
  for (const ch of CHAINS) for (let i = 0; i < ch.layers.length; i++) if (layerValue(ch, i) === v) return { ch, i, l: ch.layers[i] };
  return null;
}
function layerSelectHTML(cur) {
  const groups = CHAINS.map(ch => `<optgroup label="${esc(ch.name)}">${ch.layers.map((l, i) => { const v = layerValue(ch, i); return `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}</option>`; }).join('')}</optgroup>`).join('');
  return `<select data-card-f="layer"><option value="">—</option>${groups}<option ${cur === '其他' ? 'selected' : ''}>其他</option></select>`;
}
// 代號 → 所在層（由各層範例公司與常見美股代號建立）
const CODE_LAYER = (() => {
  const m = {};
  CHAINS.forEach(ch => ch.layers.forEach((l, i) => {
    const v = layerValue(ch, i);
    (l.ex || '').replace(/（([A-Z.]{1,6})）/g, (_, t) => { if (!m[t]) m[t] = v; });
    (l.ex || '').replace(/\b(\d{4})\b/g, (_, t) => { if (!m[t]) m[t] = v; });
  }));
  Object.assign(m, { NVDA: '7 AI 晶片設計', AMD: '7 AI 晶片設計', AVGO: '7 AI 晶片設計', TSM: '10 晶圓代工', MU: '8 記憶體', ASML: '11 半導體設備', AMAT: '11 半導體設備', LRCX: '11 半導體設備', KLAC: '11 半導體設備', MSFT: '3 AI 平台與雲端', AMZN: '3 AI 平台與雲端', GOOGL: '2 模型與 AI 實驗室', GOOG: '2 模型與 AI 實驗室', META: '1 終端需求與變現', ORCL: '3 AI 平台與雲端', CRWV: '3 AI 平台與雲端', DELL: '4 資料中心與系統整合', SMCI: '4 資料中心與系統整合', ANET: '5 網通與光通訊', MRVL: '5 網通與光通訊', COHR: '5 網通與光通訊', LITE: '5 網通與光通訊', VRT: '6 電力與散熱', ETN: '6 電力與散熱', PLTR: '1 終端需求與變現', CRM: '1 終端需求與變現', ADBE: '1 終端需求與變現', SPCX: '2 模型與 AI 實驗室', AAPL: '1 終端需求與變現', INTC: '10 晶圓代工', QCOM: '7 AI 晶片設計', ARM: '7 AI 晶片設計', '2330': '10 晶圓代工', '2454': '7 AI 晶片設計', '2317': '4 資料中心與系統整合', '2308': '6 電力與散熱', '3711': '9 先進封裝' });
  return m;
})();
const INDUSTRY_LAYER = [
  [/金融|保險|銀行/, '金融｜1 銀行（利差）'], [/證券/, '金融｜3 證券與資產管理'], [/航運/, '原物料｜1 貨櫃航運'],
  [/塑膠|化學/, '原物料｜3 石化塑膠'], [/鋼鐵|水泥/, '原物料｜4 鋼鐵水泥'], [/食品/, '內需｜2 食品與民生'],
  [/貿易百貨|百貨/, '內需｜3 零售通路'], [/觀光|餐飲/, '內需｜4 觀光餐飲'], [/生技|醫療/, '生技｜2 新藥研發'],
  [/汽車/, '電動車｜1 整車品牌'], [/電機/, '電動車｜6 電網與重電'], [/綠能|環保/, '電動車｜7 再生能源'],
  [/半導體/, '7 AI 晶片設計'], [/電腦及週邊/, '4 資料中心與系統整合'], [/通信網路/, '5 網通與光通訊'],
  [/電子零組件/, '12 材料與零組件'], [/光電/, '5 網通與光通訊'], [/其他電子|電子通路/, '4 資料中心與系統整合'],
];
function guessLayer(code, industry, name) {
  if (CODE_LAYER[code]) return { v: CODE_LAYER[code], sure: true };
  if (/電信/.test(name || '') || /^(2412|3045|4904)$/.test(code)) return { v: '內需｜1 電信', sure: true };
  const hit = INDUSTRY_LAYER.find(([re]) => re.test(industry || ''));
  return hit ? { v: hit[1], sure: false } : null;
}

PAGES.industry = () => {
  const cid = S.chainTab || 'ai', ch = CHAINS.find(x => x.id === cid) || CHAINS[0];
  S.chainLayers = S.chainLayers || {};
  const store = cid === 'ai' ? S.layers : (S.chainLayers[cid] = S.chainLayers[cid] || []);
  return `
  <h2>產業定位</h2>
  <p class="lead">投資前先確認公司站在哪條供應鏈的哪一層：收入來自哪一層的支出，產能又受哪一層限制。</p>
  <div class="chips">${CHAINS.map(x => `<button class="chip ${x.id === cid ? 'on' : ''}" data-chain="${x.id}">${esc(x.name)}</button>`).join('')}</div>
  <div class="card">
    <h3 class="gold-bar">${esc(ch.name)}</h3>
    ${ch.layers.map((l, i) => `<div class="layer"><div class="n">${i + 1}</div><div>
      <div class="nm">${esc(l.n)}${l.bottleneck ? ' <span class="pill red">瓶頸</span>' : ''}</div><div class="ds">${esc(l.d)}</div>${l.b ? `<div class="bn">${esc(l.b)}</div>` : ''}
      ${cid === 'ai' ? '' : `<div class="help">範例：${esc(l.ex || '')}</div>`}
      <textarea class="cell-ta" rows="1" placeholder="我關注的公司" data-chain-layer="${cid}" data-i="${i}">${esc(store[i] ?? (cid === 'ai' ? '' : ''))}</textarea>
    </div></div>`).join('')}
    <div class="note">${cid === 'ai' ? '需求與金流由第 1 層往下拉動。上層支出（例如雲端資本支出）轉向時，先看它沿哪條路徑往下傳到哪幾層。' : '標「瓶頸」的層通常議價能力較強，研究卡的「產業位置」燈號會因此給綠燈。'}</div>
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">標的卡位紀錄</h3>${addBtn('positions')}</div>
    ${recordList('positions')}
  </div>`;
};
SCHEMAS.positions.fields[1] = { k: 'layer', l: '所在層', t: 'select', o: [''].concat(CHAINS.flatMap(ch => ch.layers.map((l, i) => layerValue(ch, i)))) };

/* ================= 二、研究卡：查詢連結、DCF、走勢圖、自動燈號 ================= */
function srcLinks(c, kind) {
  const code = c.code || '', tw = /^\d/.test(code);
  if (!code) return '';
  const L = {
    industry: tw ? [['公司基本資料（Goodinfo）', `https://goodinfo.tw/tw/BasicInfo.asp?STOCK_ID=${code}`], ['產業與營收組成（MoneyDJ）', `https://www.moneydj.com/KMDJ/Search/list.aspx?_Query_=${code}&_QueryType_=NW`], ['個股新聞與簡介（鉅亨）', `https://www.cnyes.com/twstock/${code}`]]
      : [['公司簡介（Yahoo）', `https://finance.yahoo.com/quote/${code}/profile/`], ['年報 10-K（SEC）', `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${code}&type=10-K`]],
    guide: tw ? [['法說會日期（Yahoo 行事曆）', `https://tw.stock.yahoo.com/quote/${code}.TW/calendar`], ['法說會簡報與影音（集保 IR 平台）', 'https://irplatform.tdcc.com.tw/ir/zh/event/list'], ['重大訊息與財報（公開資訊觀測站）', 'https://mops.twse.com.tw/mops/#/web/home']]
      : [['財報電話會議與新聞（Yahoo）', `https://finance.yahoo.com/quote/${code}/`], ['季報 10-Q／8-K（SEC）', `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${code}&type=8-K`]],
    val: tw ? [['分析師預估與目標價（鉅亨）', `https://www.cnyes.com/twstock/${code}`], ['本益比河流圖（Goodinfo）', `https://goodinfo.tw/tw/ShowK_ChartFlow.asp?RPT_CAT=PER&STOCK_ID=${code}`]]
      : [['分析師預估與目標價（Yahoo）', `https://finance.yahoo.com/quote/${code}/analysis/`], ['歷年財報（Yahoo）', `https://finance.yahoo.com/quote/${code}/financials/`]],
  }[kind] || [];
  const tip = { industry: '產業位置：看公司營收來自哪些客戶與產品、是否為少數供應商。', guide: '管理層指引：看法說會簡報中的「下一季展望」頁，把營收、毛利率區間抄下來。', val: '分析師共識：看平均目標價與家數；DCF 可用下方試算。' }[kind];
  return `<div class="srclinks"><span class="help">${tip} 查詢：</span>${L.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`).join('')}<button class="linkbtn" data-ai="card">或複製 AI 研究提示</button></div>`;
}

function dcfCalc(i) {
  const fcf = num(i.fcf), sh = num(i.shares), g = num(i.g) / 100, r = num(i.r) / 100, tg = num(i.tg) / 100;
  if (!fcf || !sh || !(r > tg)) return null;
  if (fcf <= 0) return { neg: true };
  let pv = 0, f = fcf;
  for (let t = 1; t <= 5; t++) { f *= 1 + g; pv += f / (1 + r) ** t; }
  const tv = (f * (1 + tg)) / (r - tg) / (1 + r) ** 5;
  return { perShare: (pv + tv) / sh, pv, tv };
}
function dcfHTML(c) {
  const i = c.dcfIn || {};
  const u = c.market === '美股' ? { f: '百萬美元', s: '百萬股' } : { f: '億元', s: '億股' };
  const res = dcfCalc(i);
  const out = !res ? '<span class="help">填入自由現金流與股數即可試算（按「⚡ 自動帶入資料」會自動填入）。</span>'
    : res.neg ? '<span class="down">近四季自由現金流為負，DCF 不適用；可改看營收成長與股價營收比。</span>'
      : `每股合理價約 <b>${fmt(res.perShare, 1)}</b>${c.price ? `（目前股價 ${c.price}，${pct((res.perShare / num(c.price) - 1) * 100)}）` : ''}；其中未來 5 年現金流現值佔 ${fmt(res.pv / (res.pv + res.tv) * 100, 0)}%，永續價值佔 ${fmt(res.tv / (res.pv + res.tv) * 100, 0)}%。`;
  const f = (k, l, ph) => `<label class="f"><span>${l}</span><input type="text" inputmode="decimal" data-dcf="${k}" value="${esc(i[k] ?? '')}" placeholder="${ph}"></label>`;
  return `<div class="dcf"><div class="sec-title" style="margin-top:4px">DCF 試算（現金流折現）</div>
    <div class="help">把公司未來 5 年賺到的自由現金流，用「折現率」換算回今天的價值，再加上第 5 年之後的永續價值。成長率越高、折現率越低，合理價越高——所以結果只是區間參考。</div>
    <div class="inline">${f('fcf', `近四季自由現金流（${u.f}）`, '例如 11000')}${f('shares', `流通股數（${u.s}）`, '例如 259.3')}${f('g', '未來 5 年成長率 %', '例如 12')}${f('r', '折現率 %', '台股約 9、美股約 10')}${f('tg', '永續成長率 %', '約 2～3')}</div>
    <div class="result" id="dcfResult">${out}</div>
    <div class="btn-row" style="margin-top:6px"><button class="btn-small ghost" id="dcfToVal">把結果填入估值表</button></div></div>`;
}

function sma(a, n) { return a.map((_, i) => (i < n - 1 ? null : a.slice(i - n + 1, i + 1).reduce((s, x) => s + x, 0) / n)); }
function chartHTML(c) {
  const sp = c.spark; if (!sp || sp.length < 30) return '<div class="help" style="margin-bottom:8px">按「⚡ 自動帶入資料」後會顯示近一年走勢圖。</div>';
  const W = 640, H = 200, P = 6, cl = sp.map(x => x[1]);
  const m20 = sma(cl, 20), m60 = sma(cl, 60);
  const all = cl.concat(m20.filter(Boolean), m60.filter(Boolean)), lo = Math.min(...all), hi = Math.max(...all);
  const X = i => P + (i * (W - 2 * P)) / (cl.length - 1), Y = v => H - P - ((v - lo) * (H - 2 * P)) / (hi - lo || 1);
  const path = arr => arr.map((v, i) => (v == null ? '' : `${arr[i - 1] == null ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).join('');
  const last = cl[cl.length - 1];
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="近一年股價走勢">
      <path d="${path(cl)}" fill="none" stroke="var(--navy-2)" stroke-width="1.8" class="c-price"/>
      <path d="${path(m20)}" fill="none" stroke="#c9a24a" stroke-width="1.4"/>
      <path d="${path(m60)}" fill="none" stroke="#d64545" stroke-width="1.4" stroke-dasharray="4 3"/>
    </svg>
    <div class="legend"><span><i style="background:var(--navy-2)"></i>收盤價 ${fmt(last, last < 100 ? 2 : 0)}</span><span><i style="background:#c9a24a"></i>20 日均線（月線）</span><span><i style="background:#d64545"></i>60 日均線（季線）</span><span class="help">${esc(sp[0][0])} ～ ${esc(sp[sp.length - 1][0])}</span></div>
    <div class="help">看圖重點：股價在兩條均線之上、且月線在季線之上＝多頭；反過來＝空頭。</div></div>`;
}

// 自動帶入後的擴充處理（由 app.js 呼叫）
window.afterAutoFill = (c, d) => {
  if (d.spark) c.spark = d.spark;
  if (!c.layer) { const g = guessLayer(c.code, d.industry, d.name); if (g) { c.layer = g.v; c.layerGuess = !g.sure; } }
  if (d.dcf && (!c.dcfIn || c.dcfIn.auto)) {
    const us = d.market === '美股', k = us ? 1e6 : 1e8;
    const g0 = d.dcf.revG == null ? 8 : Math.max(3, Math.min(20, d.dcf.revG / 2));
    c.dcfIn = { fcf: String(Math.round(d.dcf.fcfTTM / k * 10) / 10), shares: String(Math.round(d.dcf.shares / k * 100) / 100), g: String(Math.round(g0)), r: us ? '10' : '9', tg: '2.5', auto: true };
    const res = dcfCalc(c.dcfIn);
    if (res && !res.neg && (isBlankish(c.val[1].assume) || c.val[1].auto)) {
      c.val[1] = { assume: `【自動】近四季自由現金流、前 5 年成長 ${c.dcfIn.g}%、折現率 ${c.dcfIn.r}%、永續成長 ${c.dcfIn.tg}%`, fair: String(Math.round(res.perShare * 10) / 10), note: '假設可在下方 DCF 試算調整', auto: true };
    }
  }
  const setL = (i, color, note) => { if (!color) return; const l = c.lights[i]; if (!l.c || isBlankish(l.note) || l.auto) { l.c = color; l.note = '【自動】' + note; l.auto = true; } };
  const fl = findLayer(c.layer);
  if (fl) setL(0, fl.l.bottleneck ? '綠' : c.layerGuess ? '黃' : '黃', `${c.layer}${fl.l.bottleneck ? '，屬瓶頸層，議價能力較強' : '，非瓶頸層，競爭者較多'}${c.layerGuess ? '（所在層依產業分類推估，請確認）' : ''}`);
  setL(2, d.guideLight, d.guideNote);
};

/* ================= 三、ETF 自動帶入 ================= */
async function etfAutoFill(code, existingId) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return;
  toast('ETF 資料抓取中…');
  try {
    const r = await fetch('api/etf?code=' + encodeURIComponent(code), { signal: AbortSignal.timeout(45000) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || d.errors?.join('；') || 'HTTP ' + r.status);
    const name = `${code} ${d.name || ''}`.trim();
    let e = existingId ? S.etfs.find(x => x.id === existingId) : S.etfs.find(x => hKey(x.name) === code);
    if (!e) { e = { id: uid() }; S.etfs.push(e); }
    Object.assign(e, {
      name, holdings: d.holdings.map(h => `${h.code} ${h.name} ${h.w}`).join('\n'),
      sector: d.sectors.slice(0, 3).map(s => `${s.name} ${s.w}%`).join('、'), country: '台灣',
      fee: d.fee ? `${d.fee}%${d.totalFee ? `（總費用 ${d.totalFee}）` : ''}` : '', auto: { at: new Date().toISOString(), date: d.date },
    });
    const st = etfStats(e);
    const autoNote = `【自動｜MoneyDJ 資料日期 ${d.date}】\n發行：${d.issuer || '—'}；成立：${d.since || '—'}\n追蹤指數：${d.index || '—'}\n規模：${d.size || '—'}；淨值：${d.nav || '—'}\n經理費：${d.fee || '—'}%；總管理費用：${d.totalFee || '尚無'}；配息：${d.dividend || '—'}；殖利率：${d.yield || '—'}\n成分股 ${st.h.length} 檔，前十大合計 ${st.top10.toFixed(1)}%，有效檔數 ${st.neff ? st.neff.toFixed(1) : '—'}\n產業：${d.sectors.slice(0, 5).map(s => `${s.name} ${s.w}%`).join('、')}`;
    e.note = e.note && !e.note.startsWith('【自動') ? `${autoNote}\n\n${e.note}` : autoNote;
    save(); render(); toast(`已帶入 ${name}（${d.holdings.length} 檔成分股）`);
  } catch (err) { toast('ETF 帶入失敗：' + (err.name === 'TimeoutError' ? '逾時' : err.message)); }
}
const _etfPage = PAGES.etf;
PAGES.etf = () => _etfPage().replace('<button class="btn-small" id="addEtf">＋ 新增 ETF</button>',
  '<div class="btn-row"><button class="btn-small" id="etfAuto">⚡ 輸入代號自動帶入</button><button class="btn-small ghost" id="addEtf">手動新增</button></div>')
  .replace('<div class="card"><h3 class="gold-bar">環境對照</h3>', `<div class="card"><div class="help">ETF 資料來自 MoneyDJ 公開頁面（目前支援台股 ETF）。成分股每天會變動，建議每季健檢時按一次「更新成分股」。${S.etfs.length ? ` <button class="linkbtn" id="etfRefreshAll">更新全部成分股</button>` : ''}</div></div>
  <div class="card"><h3 class="gold-bar">環境對照</h3>`);

/* ================= 四、策略：部位計算教學與帶入 ================= */
const _stratPage = PAGES.strategy;
PAGES.strategy = () => _stratPage().replace('<h3 class="gold-bar">二、部位計算器（固定風險法）</h3>', `<h3 class="gold-bar">二、部位計算器（固定風險法）</h3>
    <div class="note"><b>三步驟就會用：</b><br>
    ① <b>總資金</b>：你打算拿來投資股票的總金額。<br>
    ② <b>單筆可承受虧損 %</b>：這一筆最多願意虧掉總資金的幾 %，新手建議 1%（100 萬就是最多虧 1 萬）。<br>
    ③ <b>進場價、停損價</b>：打算買的價格，以及「跌到這裡就認錯賣出」的價格。停損可以參考研究卡技術面的「支撐」，或進場價下方 8%。<br>
    計算器會告訴你最多買幾股：<b>可承受虧損 ÷ 每股虧損</b>。這樣就算停損出場，也只會虧掉你事先決定的金額。<br>
    <span class="help">也可以在研究卡按「用這檔算部位」，自動帶入現價、支撐與合理價。</span></div>`);

/* ================= 五、監控條件：結構化與自動檢查 ================= */
const METRICS = ['', '收盤價', 'RSI', '距 20 日均線 %', '距 60 日均線 %', '近 20 日漲跌 %'];
SCHEMAS.monitors.fields = [
  { k: 'target', l: '標的名稱' },
  { k: 'code', l: '代號（填了才能自動檢查）' },
  { k: 'metric', l: '自動檢查指標（可不選，只記文字條件）', t: 'select', o: METRICS },
  { k: 'op', l: '條件', t: 'select', o: ['低於', '高於'] },
  { k: 'value', l: '數值' },
  { k: 'cond', l: '條件（白話說明）', t: 'textarea' }, { k: 'action', l: '觸發後我要做什麼', t: 'textarea' },
  { k: 'notify', l: '通知方式', t: 'select', o: ['網站內提醒', '手機推播（需開啟網站）', '券商到價提醒', 'Email', '盤後報告'] },
  { k: 'status', l: '狀態', t: 'select', o: ['啟用', '暫停', '已觸發'] },
];
const _monBody = SCHEMAS.monitors.body;
SCHEMAS.monitors.body = r => `${r.metric ? `自動：${r.code || '?'} ${r.metric} ${r.op} ${r.value}${r.lastVal != null ? `（最新 ${r.lastVal}，${r.lastCheck || ''}）` : ''}\n` : ''}${_monBody(r)}`;
function metricVal(m, n) {
  if (!n) return null;
  return m === '收盤價' ? n.last : m === 'RSI' ? n.rsi : m === '距 20 日均線 %' ? (n.ma20 ? Math.round((n.last / n.ma20 - 1) * 1000) / 10 : null)
    : m === '距 60 日均線 %' ? (n.ma60 ? Math.round((n.last / n.ma60 - 1) * 1000) / 10 : null) : m === '近 20 日漲跌 %' ? n.chg20 : null;
}
const quoteCache = {};
async function quote(code) {
  const k = code.toUpperCase();
  if (quoteCache[k] && Date.now() - quoteCache[k].t < 10 * 60e3) return quoteCache[k].d;
  const r = await fetch('api/stock?quote=1&code=' + encodeURIComponent(k), { signal: AbortSignal.timeout(30000) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  quoteCache[k] = { t: Date.now(), d }; return d;
}
async function checkMonitors(manual) {
  const list = S.monitors.filter(m => m.status === '啟用' && m.code && m.metric && num(m.value) != null);
  if (!list.length) { if (manual) toast('沒有可自動檢查的條件（需填代號、指標與數值）'); return; }
  if (!manual && S.monCheckedAt && Date.now() - S.monCheckedAt < 30 * 60e3) return;
  S.monCheckedAt = Date.now();
  const hits = [];
  for (const m of list) {
    try {
      const d = await quote(m.code); const v = metricVal(m.metric, d.num);
      m.lastVal = v; m.lastCheck = d.priceDate;
      if (v != null && (m.op === '低於' ? v < num(m.value) : v > num(m.value))) { m.status = '已觸發'; m.triggeredAt = today(); hits.push(`${m.target || m.code}：${m.metric} ${v}（條件 ${m.op} ${m.value}）`); }
    } catch (e) { m.lastVal = null; m.lastCheck = '檢查失敗'; }
  }
  save();
  if (hits.length) {
    S.monAlerts = hits; save();
    if ('Notification' in window && Notification.permission === 'granted') {
      try { const reg = await navigator.serviceWorker?.getRegistration(); const opt = { body: hits.join('\n'), icon: 'icons/icon-192.png' }; reg ? reg.showNotification('監控條件觸發', opt) : new Notification('監控條件觸發', opt); } catch (e) { /* ignore */ }
    }
  }
  if (manual) toast(hits.length ? `${hits.length} 個條件觸發` : '已檢查，沒有條件觸發');
  if (current === 'monitor' || current === 'home') render();
}
const _monPage = PAGES.monitor;
PAGES.monitor = () => _monPage().replace('<p class="lead">', `<div class="card"><h3 class="gold-bar">怎麼提醒我？</h3>
    <div class="help" style="font-size:13px">・填了<b>代號＋指標＋數值</b>的條件，每次打開網站（首頁或這頁）會自動檢查，最多每 30 分鐘一次；觸發時首頁會出現提醒。<br>
    ・按「開啟手機通知」並允許後，網站開著時觸發會跳出系統通知。網站關閉時無法推播（這是純網頁的限制）。<br>
    ・想在沒開網站時也收到通知：把條件設到<b>券商 App 的到價提醒</b>；或請 Claude 幫你建立每日排程報告。</div>
    <div class="btn-row" style="margin-top:8px"><button class="btn-small" id="monCheck">立即檢查</button><button class="btn-small ghost" id="notifyOn">開啟手機通知</button></div></div>
  <p class="lead">`);
const _homePage = PAGES.home;
PAGES.home = () => {
  const html = _homePage();
  const alerts = S.monAlerts?.length ? `<div class="card alert"><div class="card-head"><h3 class="gold-bar">⚠ 監控條件觸發</h3><button class="btn-small ghost" id="clearAlerts">知道了</button></div>${S.monAlerts.map(a => `<div>${esc(a)}</div>`).join('')}<div class="help" style="margin-top:6px">到「監控」頁查看觸發後要做的動作。</div></div>` : '';
  return html.replace('<div class="grid grid-4"', alerts + '<div class="grid grid-4"');
};

/* ================= 六、待驗主張：回測工具 ================= */
const BT_RULES = [
  ['rsiLow', 'RSI(14) 跌破', 30], ['rsiHigh', 'RSI(14) 突破', 70], ['crossUp', '收盤由下往上站上 N 日均線', 20],
  ['crossDown', '收盤由上往下跌破 N 日均線', 20], ['newHigh', '創 N 日新高', 250], ['drop', '單日跌幅超過 N%', 3],
];
function rsiSeries(c, n = 14) {
  const out = Array(c.length).fill(null); if (c.length <= n) return out;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; d > 0 ? (g += d) : (l -= d); }
  g /= n; l /= n; out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  return out;
}
function backtest(bars, rule, N, hold) {
  const c = bars.map(b => b[1]); const ma = sma(c, N), rs = rsiSeries(c);
  const sig = i => {
    switch (rule) {
      case 'rsiLow': return rs[i - 1] != null && rs[i - 1] >= N && rs[i] < N;
      case 'rsiHigh': return rs[i - 1] != null && rs[i - 1] <= N && rs[i] > N;
      case 'crossUp': return ma[i - 1] != null && c[i - 1] <= ma[i - 1] && c[i] > ma[i];
      case 'crossDown': return ma[i - 1] != null && c[i - 1] >= ma[i - 1] && c[i] < ma[i];
      case 'newHigh': return i >= N && c[i] >= Math.max(...c.slice(i - N, i));
      case 'drop': return (c[i] / c[i - 1] - 1) * 100 <= -N;
    }
    return false;
  };
  const rets = []; const dates = [];
  for (let i = 1; i < c.length - hold; i++) { if (sig(i)) { rets.push((c[i + hold] / c[i] - 1) * 100); dates.push(bars[i][0]); i += hold - 1; } }
  const base = []; for (let i = 0; i < c.length - hold; i++) base.push((c[i + hold] / c[i] - 1) * 100);
  const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  return { n: rets.length, avg: avg(rets), med: med(rets), win: rets.filter(x => x > 0).length / (rets.length || 1) * 100, base: avg(base), baseWin: base.filter(x => x > 0).length / (base.length || 1) * 100, from: bars[0][0], to: bars[bars.length - 1][0], dates };
}
const _claimsPage = PAGES.claims;
PAGES.claims = () => {
  const b = S.bt || { code: '2330', rule: 'rsiLow', N: 30, hold: 20 };
  const res = S.btResult;
  return _claimsPage().replace('<div class="card checklist">', `<div class="card">
    <h3 class="gold-bar">回測工具（技術面主張）</h3>
    <div class="help">把「某個訊號出現後，股價通常會漲／跌」這類主張，用過去 3 年（美股 5 年）的歷史股價驗證。確認有效的，就可以轉成監控條件，當作自己的線型指標使用。</div>
    <div class="inline" style="margin-top:8px">
      <label class="f"><span>代號</span><input type="text" id="bt_code" value="${esc(b.code)}"></label>
      <label class="f"><span>訊號</span><select id="bt_rule">${BT_RULES.map(([k, l]) => `<option value="${k}" ${k === b.rule ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="f"><span>N</span><input type="number" id="bt_N" value="${esc(b.N)}"></label>
      <label class="f"><span>持有天數（交易日）</span><input type="number" id="bt_hold" value="${esc(b.hold)}"></label>
    </div>
    <button class="btn-small" id="btRun">開始回測</button>
    ${res ? `<div class="result">
      <div><b>${esc(res.label)}</b>（${esc(res.from)}～${esc(res.to)}）</div>
      <dl class="kv" style="margin-top:6px"><dt>訊號次數</dt><dd>${res.n} 次</dd>
      <dt>訊號後 ${res.hold} 日平均報酬</dt><dd class="${res.avg >= 0 ? 'up' : 'down'}">${pct(res.avg, 2)}</dd>
      <dt>中位數</dt><dd>${pct(res.med, 2)}</dd><dt>勝率</dt><dd>${res.win.toFixed(0)}%</dd>
      <dt>對照：任意一天買進持有 ${res.hold} 日</dt><dd>${pct(res.base, 2)}（勝率 ${res.baseWin.toFixed(0)}%）</dd></dl>
      <div class="note">${esc(res.verdict)}</div>
      <div class="btn-row"><button class="btn-small" id="btToClaim">寫入待驗主張</button>${res.monitorable ? '<button class="btn-small ghost" id="btToMonitor">轉成監控條件</button>' : ''}</div>
    </div>` : ''}
  </div>
  <div class="card checklist">`);
};

/* ================= 七、交易紀錄與持倉 ================= */
SCHEMAS.trades = {
  title: '交易紀錄', fields: [
    { k: 'date', l: '日期', t: 'date', d: today }, { k: 'code', l: '代號' }, { k: 'name', l: '名稱' },
    { k: 'side', l: '買賣', t: 'select', o: ['買進', '賣出'] }, { k: 'price', l: '成交價' }, { k: 'shares', l: '股數（台股 1 張 = 1000 股）' },
    { k: 'fee', l: '手續費＋稅（留白自動估算）' }, { k: 'reason', l: '為什麼買／賣（覆盤會用到）', t: 'textarea' },
  ],
  head: r => `${r.side || ''}　${r.code || ''} ${r.name || ''}`, meta: r => `${r.date || ''} · ${fmt(num(r.shares))} 股 @ ${r.price || ''}${r.fee ? ` · 費用 ${fmt(num(r.fee))}` : ''}`,
  body: r => r.reason || '', sort: (a, b) => (b.date || '').localeCompare(a.date || ''),
};
S.trades = S.trades || [];
function estFee(t) {
  const amt = num(t.price) * num(t.shares); if (!amt) return 0;
  if (!/^\d/.test(t.code || '')) return 0;
  const fee = Math.max(20, Math.round(amt * 0.001425));
  const tax = t.side === '賣出' ? Math.round(amt * (/^00/.test(t.code) ? 0.001 : 0.003)) : 0;
  return fee + tax;
}
function holdings() {
  const pos = {};
  [...S.trades].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
    const k = String(t.code || '').toUpperCase(); if (!k) return;
    const p = pos[k] = pos[k] || { code: k, name: t.name, shares: 0, cost: 0, realized: 0, market: /^\d/.test(k) ? '台股' : '美股' };
    const sh = num(t.shares) || 0, px = num(t.price) || 0, fee = t.fee !== '' && t.fee != null ? num(t.fee) || 0 : estFee(t);
    if (t.side === '賣出') {
      const avg = p.shares ? p.cost / p.shares : 0, q = Math.min(sh, p.shares);
      p.realized += q * px - fee - avg * q; p.cost -= avg * q; p.shares -= q;
    } else { p.shares += sh; p.cost += sh * px + fee; }
    if (t.name) p.name = t.name;
  });
  return Object.values(pos);
}
const fx = () => num(S.macro.rows.find(r => r.key === 'usdtwd')?.latest) || 32;
PAGES.trades = () => {
  const hs = holdings(), live = hs.filter(h => h.shares > 0);
  const val = h => (S.quotes?.[h.code]?.price ?? null);
  const twd = (h, v) => v * (h.market === '美股' ? fx() : 1);
  const tot = live.reduce((s, h) => s + (val(h) != null ? twd(h, val(h) * h.shares) : twd(h, h.cost)), 0);
  const realized = hs.reduce((s, h) => s + twd(h, h.realized), 0);
  const rows = live.map(h => {
    const v = val(h), mv = v != null ? v * h.shares : null, pl = mv != null ? mv - h.cost : null;
    return `<tr><td><b>${esc(h.code)}</b> ${esc(h.name || '')}</td><td class="num">${fmt(h.shares)}</td><td class="num">${fmt(h.cost / h.shares, 2)}</td>
      <td class="num">${v != null ? fmt(v, 2) : '—'}</td><td class="num">${mv != null ? fmt(mv) : '—'}</td>
      <td class="num ${pl >= 0 ? 'up' : 'down'}">${pl != null ? `${fmt(pl)}（${pct(pl / h.cost * 100)}）` : '—'}</td>
      <td class="num">${tot ? pct(twd(h, mv ?? h.cost) / tot * 100).replace('+', '') : '—'}</td></tr>`;
  }).join('');
  return `
  <h2>交易紀錄與持倉</h2>
  <p class="lead">每次實際買賣都記一筆，網站會自動算出持倉、平均成本、損益，並提醒你寫覆盤。</p>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">目前持倉</h3><div class="btn-row"><button class="btn-small ghost" id="refreshQuotes">更新現價</button><button class="btn-small ghost" id="holdToAlloc">帶入策略頁資產配置</button></div></div>
    ${live.length ? `<div class="tbl-wrap"><table><thead><tr><th>標的</th><th class="num">股數</th><th class="num">平均成本</th><th class="num">現價</th><th class="num">市值</th><th class="num">未實現損益</th><th class="num">佔比</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="help" style="margin-top:6px">總市值約 ${fmt(tot)} 元（美股以 1 美元兌 ${fx()} 元換算）；已實現損益合計 <span class="${realized >= 0 ? 'up' : 'down'}">${fmt(realized)}</span> 元。平均成本含手續費；台股手續費以 0.1425%、證交稅股票 0.3%／ETF 0.1% 估算。</div>`
      : '<div class="empty">還沒有持倉。按下方「＋ 記一筆交易」開始。</div>'}
  </div>
  <div class="card">
    <div class="card-head"><h3 class="gold-bar">交易紀錄</h3>${addBtn('trades', '＋ 記一筆交易')}</div>
    ${recordList('trades', '例如：2026-09-30 買進 2330 台積電 1000 股 @ 2475')}
  </div>`;
};
const _reviewPage = PAGES.review;
PAGES.review = () => _reviewPage().replace('<p class="lead">', `<div class="card"><h3 class="gold-bar">怎麼覆盤？</h3>
    <ol class="help" style="font-size:13px;padding-left:18px;margin:0">
      <li>每次實際買賣，先到「交易」頁記一筆（為什麼買／賣一定要寫）。</li>
      <li>存檔後網站會問你要不要建立覆盤，按確定就會帶入日期、標的、決策與理由。</li>
      <li>賣出後或每月一次，回來補上「結果」與「學到什麼」；賣出時會自動算好已實現損益。</li>
      <li>如果教訓是「某個訊號常常有效／無效」，登記到「待驗主張」用回測工具驗證。</li>
    </ol></div>
  <p class="lead">`);

/* ================= 事件處理 ================= */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-chain]'); if (!t) return;
  if (t.dataset.chain) { S.chainTab = t.dataset.chain; save(); render(); return; }
  const card = () => S.cards.find(x => x.id === openCardId);
  switch (t.id) {
    case 'relight': { const c = card(); if (!c) return; c.lights.forEach(l => { if (isBlankish(l.note) || l.auto) { l.c = ''; l.note = ''; l.auto = false; } }); await autoFillCard(c); break; }
    case 'dcfToVal': { const c = card(); const res = c && dcfCalc(c.dcfIn || {}); if (!res || res.neg) { toast('DCF 無法計算'); return; } const i = c.dcfIn;
      c.val[1] = { assume: `近四季自由現金流 ${i.fcf}、前 5 年成長 ${i.g}%、折現率 ${i.r}%、永續成長 ${i.tg}%`, fair: String(Math.round(res.perShare * 10) / 10), note: 'DCF 試算' }; save(); render(); toast('已填入估值表'); break; }
    case 'cardToSize': { const c = card(); if (!c) return;
      const sup = num((c.tech[5]?.read || '').match(/支撐\s*([\d.]+)/)?.[1]); const p = num(c.price);
      const stop = sup && p && sup < p && sup > p * 0.8 ? sup : p ? Math.round(p * 0.92 * 100) / 100 : '';
      const vs = valSummary(c);
      S.ps = Object.assign({ cap: '1000000', risk: '1', lot: c.market === '台股' ? '1000' : '1' }, S.ps || {}, { entry: String(p || ''), stop: String(stop), target: vs.avg && p && vs.avg > p ? String(Math.round(vs.avg * 100) / 100) : '', lot: c.market === '台股' ? '1000' : '1' });
      save(); go('strategy'); setTimeout(() => $('#psResult')?.scrollIntoView({ block: 'center' }), 100); toast('已帶入現價與停損建議'); break; }
    case 'cardToTrade': { const c = card(); if (!c) return; go('trades'); editRecord('trades'); setTimeout(() => { const f = $('#modalBody'); f.querySelector('[name=code]').value = c.code; f.querySelector('[name=name]').value = c.name; f.querySelector('[name=price]').value = c.price || ''; f.querySelector('[name=shares]').value = c.market === '台股' ? '1000' : ''; f.querySelector('[name=reason]').value = c.verdict ? c.verdict.replace(/^【[^】]+】/, '') : ''; }, 30); break; }
    case 'etfAuto': openModal({ title: 'ETF 自動帶入', body: '<label class="f"><span>台股 ETF 代號</span><input type="text" name="code" placeholder="例如 0050、00878、009816" required></label><div class="help">會自動抓成分股權重、產業分布、規模、費用率與配息資訊。</div>', saveText: '帶入', onSave: d => { setTimeout(() => etfAutoFill(d.code), 10); } }); break;
    case 'etfRefreshAll': for (const x of S.etfs) { const code = hKey(x.name); if (/^\d/.test(code)) await etfAutoFill(code, x.id); } break;
    case 'monCheck': checkMonitors(true); break;
    case 'notifyOn': if (!('Notification' in window)) { toast('這個瀏覽器不支援通知（iPhone 需先「加入主畫面」再從主畫面開啟）'); return; }
      Notification.requestPermission().then(p => toast(p === 'granted' ? '已開啟通知' : '沒有取得通知權限')); break;
    case 'clearAlerts': S.monAlerts = []; save(); render(); break;
    case 'btRun': {
      const b = S.bt = { code: $('#bt_code').value.trim().toUpperCase(), rule: $('#bt_rule').value, N: num($('#bt_N').value) || 20, hold: Math.max(1, num($('#bt_hold').value) || 20) };
      save(); toast('下載歷史股價並回測中…');
      try {
        const r = await fetch('api/stock?history=1&code=' + encodeURIComponent(b.code), { signal: AbortSignal.timeout(45000) });
        const d = await r.json(); if (!r.ok || !d.bars?.length) throw new Error(d.error || '沒有歷史資料');
        const x = backtest(d.bars, b.rule, b.N, b.hold);
        const lbl = `${b.code}：${BT_RULES.find(y => y[0] === b.rule)[1].replace('N', b.N)}，持有 ${b.hold} 日`;
        const good = x.n >= 8 && x.avg > x.base && x.win >= 55, bad = x.n >= 8 && x.avg <= x.base;
        x.verdict = x.n < 8 ? `樣本只有 ${x.n} 次，太少，不足以下結論（至少 8～10 次）。` : good ? `訊號後的平均報酬與勝率都優於「任意一天買進」，這個主張在 ${b.code} 上暫時成立。仍要換幾檔股票、不同期間再驗證，避免只是巧合。` : bad ? `訊號後的表現沒有比「任意一天買進」好，這個主張在 ${b.code} 上不成立。` : '結果介於兩者之間，差異不明顯，建議換其他股票或持有天數再驗證。';
        x.status = x.n < 8 ? '待驗' : good ? '確認' : bad ? '證偽' : '待驗';
        x.monitorable = ['rsiLow', 'rsiHigh'].includes(b.rule);
        S.btResult = { ...x, label: lbl, hold: b.hold, code: b.code, rule: b.rule, N: b.N }; save(); render();
      } catch (err) { toast('回測失敗：' + err.message); }
      break;
    }
    case 'btToClaim': { const x = S.btResult; if (!x) return;
      S.claims.push({ id: uid(), date: today(), claim: x.label.replace(/^[^：]+：/, '') + ' 後股價表現優於平均', def: x.label, method: `歷史股價回測（${x.from}～${x.to}）`, status: x.status, conclusion: `${x.n} 次訊號，平均 ${pct(x.avg, 2)}、勝率 ${x.win.toFixed(0)}%；對照任意一天 ${pct(x.base, 2)}。${x.verdict}` });
      save(); render(); toast('已寫入待驗主張'); break; }
    case 'btToMonitor': { const x = S.btResult; if (!x) return;
      S.monitors.push({ id: uid(), target: x.code, code: x.code, metric: 'RSI', op: x.rule === 'rsiLow' ? '低於' : '高於', value: String(x.N), cond: x.label, action: `回測：平均 ${pct(x.avg, 2)}、勝率 ${x.win.toFixed(0)}%。觸發後檢查基本面再決定`, notify: '網站內提醒', status: '啟用' });
      save(); go('monitor'); toast('已建立監控條件'); break; }
    case 'refreshQuotes': {
      const codes = holdings().filter(h => h.shares > 0).map(h => h.code); S.quotes = S.quotes || {};
      toast('更新現價中…');
      for (const c of codes) { try { const d = await quote(c); S.quotes[c] = { price: d.price, date: d.priceDate }; } catch (err) { /* skip */ } }
      save(); render(); toast('已更新現價'); break; }
    case 'holdToAlloc': {
      const hs = holdings().filter(h => h.shares > 0); const by = {};
      hs.forEach(h => { const v = (S.quotes?.[h.code]?.price ?? h.cost / h.shares) * h.shares * (h.market === '美股' ? fx() : 1); const cat = /^00/.test(h.code) ? '台股' : h.market; by[cat] = (by[cat] || 0) + v; });
      Object.entries(by).forEach(([cat, v]) => { let a = S.alloc.find(x => x.name === cat); if (!a) { a = { name: cat, target: 0, value: '' }; S.alloc.push(a); } a.value = String(Math.round(v)); });
      save(); go('strategy'); toast('已帶入持倉市值（現金、債券請自行填寫）'); break; }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.chainLayer) { const cid = t.dataset.chainLayer, i = +t.dataset.i; if (cid === 'ai') S.layers[i] = t.value; else { S.chainLayers[cid] = S.chainLayers[cid] || []; S.chainLayers[cid][i] = t.value; } save(); return; }
  if (t.dataset.dcf) {
    const c = S.cards.find(x => x.id === openCardId); if (!c) return;
    c.dcfIn = c.dcfIn || {}; c.dcfIn[t.dataset.dcf] = t.value; c.dcfIn.auto = false; save();
    const res = dcfCalc(c.dcfIn), el = $('#dcfResult');
    if (el) el.innerHTML = !res ? '<span class="help">資料不足或折現率需大於永續成長率。</span>' : res.neg ? '<span class="down">自由現金流為負，DCF 不適用。</span>' : `每股合理價約 <b>${fmt(res.perShare, 1)}</b>${c.price ? `（目前股價 ${c.price}，${pct((res.perShare / num(c.price) - 1) * 100)}）` : ''}`;
  }
});

// 新增交易後提示建立覆盤
const _editRecord = editRecord;
editRecord = function (key, id) {
  _editRecord(key, id);
  if (key !== 'trades' || id) return;
  const form = $('#modalForm'), orig = form.onsubmit;
  form.onsubmit = ev => {
    orig(ev);
    const t = S.trades[S.trades.length - 1]; if (!t || t._asked) return; t._asked = true; save();
    setTimeout(() => openModal({
      title: '要順便建立覆盤紀錄嗎？',
      body: `<div class="help" style="font-size:14px">會帶入：${esc(t.date)}｜${esc(t.side)} ${esc(t.code)} ${esc(t.name || '')}｜理由：${esc(t.reason || '（未填）')}。<br>結果與心得之後再補。</div>`,
      saveText: '建立覆盤',
      onSave: () => {
        const h = holdings().find(x => x.code === String(t.code).toUpperCase());
        S.reviews.push({ id: uid(), date: t.date, target: `${t.code} ${t.name || ''}`.trim(), decision: t.side, reason: t.reason || '', result: t.side === '賣出' && h ? `已實現損益累計 ${fmt(h.realized)}` : '', lesson: '', writeback: '' });
        toast('已建立覆盤，稍後記得補上結果與心得');
      },
    }), 200);
  };
};

/* ================= 分頁與啟動 ================= */
(function addTradesTab() {
  const nav = $('#tabs'); if (!nav || nav.querySelector('[data-go="trades"]')) return;
  const b = document.createElement('button'); b.dataset.go = 'trades'; b.textContent = '交易';
  nav.insertBefore(b, nav.querySelector('[data-go="monitor"]'));
})();

window.addEventListener('hashchange', () => { const p = location.hash.slice(1); if (p && p !== current) go(p); });
if (S.examplesSeeded !== window.EXAMPLES?.version) { seedExamples(); save(); }
S.trades = S.trades || [];
macroAutoFill(); save();
if (location.protocol.startsWith('http') && (!S.macro.fetchedAt || Date.now() - new Date(S.macro.fetchedAt) > 6 * 3600e3)) { render._tried = true; setTimeout(() => fetchMacro(true), 300); }
setTimeout(async () => {
  if (!location.protocol.startsWith('http')) return;
  for (const c of S.cards.filter(c => c.example && (!c.auto || !c.spark))) { await autoFillCard(c, true); }
  checkMonitors(false);
}, 1500);
go(location.hash.slice(1) || 'home');
