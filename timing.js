/* 進出場時機（總經 → 市場 → 個股／ETF 串成一條線）與季節性分析 */
'use strict';

/* ================= 季節性：選舉週期 ================= */
const SEA_SYMS = [['^GSPC', '標普 500'], ['^TWII', '台股加權'], ['^IXIC', '那斯達克'], ['^SOX', '費半']];
const SEA_COL = { all: '#3b82c4', mid: '#1e9e5a', sixth: '#d64545', rep2: '#c9a24a', post: '#8b5cf6', pre: '#98a4b8', elec: '#f59e0b', twelec: '#d64545' };
const SEA_DEF = { '^GSPC': ['all', 'mid', 'sixth', 'rep2'], '^TWII': ['all', 'mid', 'twelec'], '^IXIC': ['all', 'mid'], '^SOX': ['all', 'mid'] };
S.season = S.season || {};
let seaBusy = false;
async function loadSeason(sym, force) {
  if (seaBusy || !location.protocol.startsWith('http')) return;
  const c = S.season[sym]; if (!force && c && Date.now() - (c.at || 0) < 24 * 3600e3) return;
  seaBusy = true; if (current === 'season') render();
  try { const j = await (await fetch('api/season?sym=' + encodeURIComponent(sym), { signal: AbortSignal.timeout(60000) })).json(); if (j.error) throw new Error(j.error); j.at = Date.now(); S.season[sym] = j; save(); }
  catch (e) { toast('季節性資料讀取失敗：' + e.message); }
  seaBusy = false; if (current === 'season' || current === 'timing') { const y = scrollY; render(); scrollTo(0, y); }
}
const MSTART = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
function seasonChart(d, show) {
  const W = 340, H = 230, L = 30, B = 22, T = 10, R = 6, step = d.step || 2, n = Math.ceil(366 / step);
  const ser = d.series.filter(s => show.includes(s.k)), cur = show.includes('cur') ? d.current : [];
  const vals = ser.flatMap(s => s.v).concat(cur); if (!vals.length) return '';
  let lo = Math.floor(Math.min(0, ...vals) / 2) * 2, hi = Math.ceil(Math.max(...vals) / 2) * 2; if (hi - lo < 4) hi = lo + 4;
  const X = i => L + i * (W - L - R) / (n - 1), Y = v => T + (hi - v) * (H - T - B) / (hi - lo);
  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const gStep = (hi - lo) > 24 ? 6 : (hi - lo) > 12 ? 4 : 2, grid = []; for (let v = lo; v <= hi; v += gStep) grid.push(v);
  const today = cur.length ? cur.length - 1 : null;
  // 期中選舉年：歷史低點常出現的區間
  const mid = d.series.find(s => s.k === 'mid'); let lowNote = '';
  if (mid && show.includes('mid')) { const a = Math.floor(152 / step), b = Math.floor(304 / step); let mi = a; for (let i = a; i <= b; i++) if (mid.v[i] < mid.v[mi]) mi = i; const mo = MSTART.filter(s => s <= mi * step + 1).length;
    lowNote = `<rect x="${X(Math.floor(152 / step))}" y="${Y(mid.v[mi]) - 6}" width="${X(b) - X(a)}" height="${Math.max(10, Y(lo) - Y(mid.v[mi]) - 4 > 30 ? 26 : 16)}" class="sea-box"/><text x="${X(mi)}" y="${Y(mid.v[mi]) + 30}" text-anchor="middle" class="sea-note">期中年低點常在 ${mo} 月</text>`; }
  return `<svg class="sea" viewBox="0 0 ${W} ${H}">
    ${grid.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 ? 'z' : ''}"/><text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`).join('')}
    ${MSTART.map((s, m) => `<text x="${X((s - 1) / step + 7)}" y="${H - 6}" text-anchor="middle">${m + 1}月</text>`).join('')}
    ${lowNote}
    ${ser.map(s => `<path d="${path(s.v)}" stroke="${SEA_COL[s.k] || '#888'}" class="sl"/>`).join('')}
    ${cur.length ? `<path d="${path(cur)}" class="sl cur"/><circle cx="${X(today)}" cy="${Y(cur[today])}" r="3.5" class="cur"/><text x="${X(today)}" y="${Y(cur[today]) - 8}" text-anchor="middle" class="curt">今年 ${cur[today] >= 0 ? '+' : ''}${cur[today].toFixed(1)}%</text>` : ''}
    ${today != null ? `<line x1="${X(today)}" x2="${X(today)}" y1="${T}" y2="${H - B}" class="today"/>` : ''}
  </svg>`;
}
PAGES.season = () => {
  const sym = S.seaSym || '^GSPC', d = S.season[sym]; setTimeout(() => loadSeason(sym, false), 30);
  const show = S.seaShow?.[sym] || [...(SEA_DEF[sym] || ['all', 'mid']), 'cur'];
  const head = `<h2>季節性與選舉週期</h2><p class="lead">把過去幾十年同類年份的走勢平均起來，看今年走在哪裡。${new Date().getFullYear() % 4 === 2 ? `<b>${new Date().getFullYear()} 年是美國期中選舉年</b>：歷史上常見上半年震盪、9～10 月落底，選後到隔年走強。` : ''}</p>
    <div class="chips">${SEA_SYMS.map(([k, l]) => `<button class="chip ${k === sym ? 'on' : ''}" data-seasym="${k}">${l}</button>`).join('')}</div>`;
  if (!d) return head + `<div class="card empty">${seaBusy ? '計算中…（第一次約 5～10 秒）' : '讀取中…'}</div>`;
  const leg = [...d.series.map(s => [s.k, `${s.name}（${s.n} 年）`, SEA_COL[s.k]]), ['cur', `${d.thisYear} 年實際`, 'var(--text)']];
  const M = d.monthly, mo = new Date().getMonth();
  const mrow = (m, i) => `<div class="gt-r ${i === mo ? 'hl' : ''}"><span>${i + 1} 月</span><span style="${heat(m.all[i]?.avg, 3)}">${pc(m.all[i]?.avg, 2)}</span><span>${m.all[i]?.win ?? '—'}%</span><span style="${heat(m.mid[i]?.avg, 3)}">${pc(m.mid[i]?.avg, 2)}</span><span>${m.mid[i]?.win ?? '—'}%</span></div>`;
  const f = d.midFwd || [], fa = f.length ? f.reduce((s, x) => s + x.r, 0) / f.length : null;
  return head + `<div class="card"><h3 class="gold-bar">📅 ${esc(d.name)}：年初至今累積漲跌（%）</h3>
      ${seasonChart(d, show)}
      <div class="sea-leg">${leg.map(([k, l, c]) => `<button class="${show.includes(k) ? 'on' : ''}" data-seak="${k}"><i style="background:${c}"></i>${esc(l)}</button>`).join('')}</div>
      <div class="help">每條線＝該類年份「相對前一年年底收盤」的平均累積漲跌；黑粗線是今年實際走勢，直線是今天。點圖例可開關。樣本數少（期中選舉年約 19 次），只代表歷史傾向，不保證重演。</div></div>
    <div class="card"><h3 class="gold-bar">🗓️ 各月平均報酬與上漲機率</h3>${gtable(['月份', '全部年份', '勝率', '期中年', '勝率'], M.all.map((_, i) => mrow(M, i)), 'wide')}
      <div class="help">數字為該月平均漲跌 %；「勝率」＝該月收紅的年份比例。綠色越深代表歷史平均越好；這個月以金色底線標示。</div></div>
    ${f.length ? `<div class="card"><h3 class="gold-bar">🎯 期中選舉年 9 月底進場、持有一年</h3>
      <div class="w-rates"><span>平均報酬 <b class="${fa >= 0 ? 'up' : 'down'}">${pc(fa)}%</b></span><span>上漲 <b>${f.filter(x => x.r > 0).length}/${f.length}</b> 次</span></div>
      ${hbars(f.slice(-12).map(x => ({ l: String(x.y), v: x.r })))}
      <div class="help">歷史上這是選舉週期中最常被提到的進場窗口：選前不確定性消除後，接下來一年通常是四年週期中表現最好的一段。仍要搭配總經與估值判斷。</div></div>` : ''}
    <div class="help">資料：${esc(d.src)}，至 ${esc(d.lastDate)}。期中選舉年＝美國大選後第 2 年（${d.thisYear % 4 === 2 ? '今年' : '下一次 ' + (d.thisYear + (6 - d.thisYear % 4) % 4) + ' 年'}）。</div>`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-seasym],[data-seak]'); if (!t) return;
  if (t.dataset.seasym) { S.seaSym = t.dataset.seasym; save(); return render(); }
  const sym = S.seaSym || '^GSPC'; S.seaShow = S.seaShow || {};
  const cur = S.seaShow[sym] || [...(SEA_DEF[sym] || ['all', 'mid']), 'cur'], k = t.dataset.seak;
  S.seaShow[sym] = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k]; save(); const y = scrollY; render(); scrollTo(0, y);
});

/* ================= 進出場時機：總經 → 市場溫度 → 我的標的 ================= */
const rsi14 = a => { if (!a || a.length < 16) return null; let g = 0, l = 0; for (let i = a.length - 14; i < a.length; i++) { const d = a[i] - a[i - 1]; if (d > 0) g += d; else l -= d; } return l === 0 ? 100 : 100 - 100 / (1 + g / l); };
const PHASE = {
  復甦: { c: 'pos', ic: '🌱', stock: '提高股票比重', what: '景氣循環股、中小型成長股、半導體與電子領先反彈', bond: '債券比重可降低' },
  擴張: { c: 'pos', ic: '☀️', stock: '股票為主、持有', what: '科技、工業、原物料跟著景氣走強', bond: '少量債券即可' },
  趨緩: { c: 'neu', ic: '🍂', stock: '降低高本益比與景氣循環股，不追高', what: '轉向防禦：電信、民生、公用事業、高股息', bond: '逐步增加投資級債與長天期公債' },
  收縮: { c: 'neg', ic: '❄️', stock: '保守、保留現金，等燈號落底分批布局', what: '債券、現金；藍燈與領先指標止跌回升時是長線布局點', bond: '長天期公債表現通常最好' },
};
function phaseOf(id) {
  const eco = S.world?.economies?.[id], f = k => eco?.indicators?.find(x => x.k === k);
  if (id === 'tw') { // 台灣用景氣對策信號分數（9～45）與方向判斷
    const x = f('signal'); if (!x) return null; const v = x.v, up = x.prev != null ? v - x.prev : 0;
    const ph = v >= 32 ? (up < 0 ? '趨緩' : '擴張') : v >= 23 ? (up > 0 ? '擴張' : up < 0 ? '趨緩' : '擴張') : (up > 0 ? '復甦' : '收縮');
    return { ph, x, note: '' };
  }
  const x = f('cli'); if (!x) return null;
  const j = judge({ ...x, kind: x.kind || 'cli' }); const ph = { 擴張: '擴張', 趨緩: '趨緩', 復甦: '復甦', 收縮: '收縮' }[j.l]; if (!ph) return null;
  return { ph, x, note: j.t };
}
function mktTemp(m) {
  if (!m?.spark?.length) return null;
  const s = m.spark, last = s[s.length - 1], ma = s.reduce((a, b) => a + b, 0) / s.length, r = rsi14(s), hi = Math.max(...s);
  const bias = (last / ma - 1) * 100, dist = (last / hi - 1) * 100;
  const t = r >= 70 || bias > 6 ? ['偏熱', 'neg', '短線漲多，新資金分批、不追高'] : r <= 35 || bias < -6 ? ['偏冷', 'pos', '短線超跌，可留意分批承接'] : ['中性', 'neu', '依計畫定期定額或分批'];
  return { last, bias, dist, rsi: r, t };
}
// 個股／ETF 判斷
function assetCheck(c) {
  const code = String(c.code || '').toUpperCase(), h = holdings().find(x => x.shares > 0 && x.code === code);
  const tr = c.tech?.[0]?.read || '', g = re => { const m = tr.match(re); return m ? num(m[1].replace(/,/g, '')) : null; };
  const px = S.quotes?.[code]?.price ?? num(c.price) ?? g(/價\s*([\d.,]+)/), ma20 = g(/MA20\s*([\d.,]+)/), ma60 = g(/MA60\s*([\d.,]+)/);
  const r = num((c.tech?.[1]?.read || '').match(/RSI\(?\d*\)?\s*([\d.]+)/)?.[1]);
  const vs = typeof valSummary === 'function' ? valSummary(c) : {}, up = vs.upside;
  const pl = h && px ? (px * h.shares / h.cost - 1) * 100 : null, bias20 = px && ma20 ? (px / ma20 - 1) * 100 : null;
  const up60 = px && ma60 ? px >= ma60 : null, down = up60 === false && ma20 && ma60 && ma20 < ma60;
  const eco = c.market === '美股' ? 'us' : 'tw', P = phaseOf(eco), f = findLayer?.(c.layer), defensive = f && /內需|金融|電信|民生/.test(f.ch.name + f.l.n);
  const why = [];
  if (P) why.push([`${eco === 'us' ? '美國' : '台灣'}景氣${P.ph}`, PHASE[P.ph].c]);
  if (up != null) why.push([`估值空間 ${pct(up, 0)}`, up >= 10 ? 'pos' : up <= -10 ? 'neg' : 'neu']);
  if (up60 != null) why.push([up60 ? '站上季線' : '跌破季線', up60 ? 'pos' : 'neg']);
  if (r != null) why.push([`RSI ${fmt(r, 0)}`, r >= 70 ? 'neg' : r <= 30 ? 'pos' : 'neu']);
  if (pl != null) why.push([`持有損益 ${pct(pl, 0)}`, pl >= 0 ? 'pos' : 'neg']);
  let st;
  if (px == null || (up == null && up60 == null && r == null)) st = ['資料不足', '', '打開研究卡按「⚡ 自動帶入」，取得技術與估值資料'];
  else if (h && down && pl != null && pl < -10) st = ['停損／減碼檢查', 'neg', '跌破季線且月線下彎、虧損超過 10%：對照研究卡的「證明我錯」條件決定是否出場'];
  else if (h && ((r != null && r >= 75) || (up != null && up <= -15) || (bias20 != null && bias20 >= 15))) st = ['分批停利', 'gold', `${r >= 75 ? 'RSI 過熱' : up <= -15 ? '股價已高於合理價' : '離月線過遠'}：可先賣一部分鎖住獲利，其餘用移動停利（例如跌破月線再賣）`];
  else if (up != null && up >= 10 && up60 && (r == null || r < 70)) st = P && P.ph === '收縮' && !defensive ? ['小量分批', 'pos', '估值便宜、趨勢向上，但景氣在收縮期：先小量分批，等領先指標回升再加碼'] : ['可分批買進', 'pos', '估值有空間、站上季線、未過熱：可依部位計算分 2～3 批進場'];
  else if (up != null && up >= 10 && (r >= 70 || bias20 > 10)) st = ['好價等回檔', 'gold', '基本面便宜但短線漲多：設價格提醒，回到月線或 RSI 降到 50 左右再買'];
  else if (up != null && up >= 10 && up60 === false) st = ['等趨勢轉強', 'neu', '便宜但仍在季線下（左側）：等站回季線、或分小批承接並設停損'];
  else if (up != null && up < 0) st = [h ? '續抱觀察' : '偏貴觀望', 'neu', h ? '估值已不便宜：不加碼，守住停利／停損線' : '目前價格高於合理價，等回檔或基本面上修'];
  else st = [h ? '續抱' : '觀察', 'neu', '訊號不一致，維持原計畫'];
  return { c, code, h, px, pl, st, why, date: c.date };
}
const idxOf = id => (S.world?.economies?.[id]?.markets || []).find(m => !/=X$|DX-Y/.test(m.sym));
PAGES.timing = () => {
  setTimeout(() => { loadWorld(false); loadSeason('^GSPC', false); if (typeof refreshHoldQuotes === 'function') refreshHoldQuotes(false); }, 30);
  const W = S.world;
  const ecos = ['tw', 'us', 'cn', 'jp', 'eu', 'hk', 'kr'].map(id => ({ id, e: ECON.find(x => x.id === id), P: phaseOf(id), m: mktTemp(idxOf(id)), m0: idxOf(id) }));
  const tw = ecos[0], us = ecos[1];
  // 1. 景氣位置
  const ph = `<div class="card"><h3 class="gold-bar">① 景氣在哪個階段（決定股票要多還是少）</h3>
    <div class="tm-clock">${Object.entries(PHASE).map(([k, v]) => `<div class="tm-q ${[tw.P?.ph, us.P?.ph].includes(k) ? 'on' : ''}"><b>${v.ic} ${k}</b>${tw.P?.ph === k ? '<span class="pill">🇹🇼 台灣</span>' : ''}${us.P?.ph === k ? '<span class="pill">🇺🇸 美國</span>' : ''}<em>${v.stock}</em></div>`).join('')}</div>
    ${[tw, us].filter(x => x.P).map(x => `<div class="tm-ph"><b>${x.e.flag} ${x.e.name}：${x.P.ph}</b>　${esc(PHASE[x.P.ph].stock)}；${esc(PHASE[x.P.ph].what)}；${esc(PHASE[x.P.ph].bond)}。<span class="help">（依據：${esc(x.P.x.name)} ${x.P.x.v}，前值 ${x.P.x.prev ?? '—'}）</span></div>`).join('') || '<div class="empty">總經資料載入中…</div>'}
    <div class="help">景氣四階段由領先指標判斷：高於趨勢且上升＝擴張、高於但下降＝趨緩、低於但上升＝復甦、低於且下降＝收縮。股市通常領先景氣 3～6 個月，所以「收縮後段、領先指標剛止跌」往往是長線最好的買點，「擴張後段、燈號紅燈」反而要開始保守。</div></div>`;
  // 2. 市場溫度
  const mt = `<div class="card"><h3 class="gold-bar">② 大盤溫度（決定現在進場要快還是慢）</h3>
    ${gtable(['市場', '景氣', '溫度', '離季線', 'RSI'], ecos.filter(x => x.m).map(x => `<div class="gt-r click" data-wtab-go="${x.id}"><span>${x.e.flag} ${esc(x.m0.name)}</span><span>${x.P ? `<i class="sigp ${PHASE[x.P.ph].c}">${x.P.ph}</i>` : '—'}</span><span><i class="sigp ${x.m.t[1]}">${x.m.t[0]}</i></span><span style="${heat(-x.m.bias, 6)}">${pc(x.m.bias)}%</span><span>${x.m.rsi == null ? '—' : fmt(x.m.rsi, 0)}</span></div>`), 'ov')}
    <div class="help">偏熱：RSI ≥ 70 或高於 60 日均線 6% 以上；偏冷：RSI ≤ 35 或低於 6% 以上。<b>景氣好＋大盤偏冷</b>是最舒服的加碼時機；<b>景氣轉弱＋大盤偏熱</b>最該減碼。</div></div>`;
  // 3. 季節性
  const sd = S.season['^GSPC']; let sea = '';
  if (sd) { const mo = new Date().getMonth(), a = sd.monthly.mid[mo], b = sd.monthly.mid[(mo + 1) % 12], c2 = sd.monthly.mid[(mo + 2) % 12];
    sea = `<div class="card"><h3 class="gold-bar">③ 季節性（美股期中選舉年）</h3><div class="w-rates">${[[mo, a], [(mo + 1) % 12, b], [(mo + 2) % 12, c2]].map(([m, x]) => `<span>${m + 1} 月 <b class="${x?.avg >= 0 ? 'up' : 'down'}">${pc(x?.avg, 1)}%</b><small>上漲率 ${x?.win ?? '—'}%</small></span>`).join('')}</div><button class="btn-small ghost" data-go="season">看完整季節性圖 ›</button><div class="help">季節性只是「背景風向」，權重最低；用來安排分批的節奏，不單獨作為買賣理由。</div></div>`; }
  // 4. 我的標的
  const mine = S.cards.filter(c => c.code && !c.example).map(assetCheck).sort((a, b) => (!!b.h - !!a.h) || ['neg', 'gold', 'pos', 'neu', ''].indexOf(a.st[1]) - ['neg', 'gold', 'pos', 'neu', ''].indexOf(b.st[1]));
  const lst = `<div class="card"><h3 class="gold-bar">④ 我的持股與研究標的：現在該做什麼</h3>
    ${mine.length ? mine.map(x => `<div class="tm-a ${x.st[1]}" data-card="${x.c.id}" data-go-card="1"><div class="tm-ah"><b>${esc(x.code)} ${esc(x.c.name || '')}</b>${x.h ? '<span class="pill green">持有</span>' : ''}<span class="tm-st ${x.st[1]}">${x.st[0]}</span></div>
      <div class="tm-why">${x.why.map(([t, cl]) => `<i class="sigp ${cl}">${esc(t)}</i>`).join('')}</div><div class="tm-do">${esc(x.st[2])}</div><div class="help">研究卡資料日 ${esc(x.date || '—')}${x.px ? `・現價 ${fmt(x.px, x.px < 100 ? 2 : 1)}` : ''}</div></div>`).join('')
      : '<div class="empty">還沒有研究卡。持股會自動建立研究卡；也可以從「選股雷達」挑標的建卡。</div>'}
    <div class="help">判斷順序：景氣階段 → 大盤溫度 → 個股估值空間 → 趨勢（季線）→ 短線熱度（RSI、離月線）。ETF 也一樣：在研究卡填好合理價（或用本益比區間）就會納入。</div></div>`;
  return `<h2>進出場時機</h2><p class="lead">把總經、大盤、個股串成同一套判斷：<b>總經決定股票放多少</b>、<b>大盤溫度決定進場快慢</b>、<b>個股估值與趨勢決定買哪一檔、什麼價位</b>。</p>
    ${ph}${mt}${sea}${lst}
    <details class="card rc-sub" ${S.tmGuide ? 'open' : ''} id="tmGuide"><summary>📋 進場與退場時機清單</summary>${TIMING_GUIDE}</details>`;
};
const TIMING_GUIDE = (() => {
  const blk = (t, rows) => `<div class="tg"><b>${t}</b><ul>${rows.map(r => `<li>${r}</li>`).join('')}</ul></div>`;
  return `<div class="tg-h">🟢 進場時機</div>
    ${blk('總經面', ['台灣景氣燈號在藍燈／黃藍燈，且領先指標連 2～3 個月回升', 'OECD 領先指標低於 100 但開始上升（復甦期）', '央行開始降息或停止升息；殖利率曲線由倒掛轉正常並伴隨降息', '外銷訂單、出口年增率由負轉正'])}
    ${blk('估值面', ['股價低於三法平均合理價 10～20% 以上', '本益比落在自己歷史區間的下緣（河流圖下兩條線）', '殖利率高於歷史平均（存股、高股息 ETF）'])}
    ${blk('技術面', ['站回季線（60 日線）且季線走平或上揚', '均線多頭排列（股價 > 月線 > 季線）後的第一次回測月線', '突破整理區間或 52 週新高，且成交量放大 1.5 倍以上', 'RSI 跌到 30 以下後回升、MACD 柱狀體由負翻正'])}
    ${blk('籌碼與事件', ['外資、投信連續買超，融資沒有同步暴增', '法說會上修財測、月營收年增創新高', '市場恐慌（VIX 高、大盤 RSI < 30）但公司基本面沒變'])}
    ${blk('季節性與資金', ['美國期中選舉年 9～10 月的弱勢區（歷史上隔年表現佳）', '定期定額：不看時機，固定日期扣款，下跌時可加碼一期'])}
    <div class="tg-h">🔴 退場時機</div>
    ${blk('停損（看錯）', ['觸發研究卡寫的「證明我錯」條件（例如毛利率連兩季下滑）', '跌破季線且月線下彎，或跌破買進理由的關鍵支撐', '虧損達到事先設定的比例（例如 −10%～−15%）就執行，不攤平'])}
    ${blk('停利（漲多）', ['股價高於合理價 15～20% 以上、本益比到歷史上緣', 'RSI 75 以上且出現背離（價創高、指標沒創高）', '離月線 15～20% 以上：先賣一部分，其餘用移動停利（跌破月線再賣）'])}
    ${blk('基本面轉弱', ['月營收連續 2～3 個月年減、法說會下修財測', '產業瓶頸解除（產能開出、報價下跌）', '外資連續大賣、融資大增（散戶接手）'])}
    ${blk('總經轉弱', ['景氣燈號由紅燈往下、領先指標連續下滑（趨緩→收縮）', '央行意外升息、長天期殖利率快速上升', '大盤跌破年線且月線、季線死亡交叉：降低整體持股比例'])}
    ${blk('資金與配置', ['單一持股超過資產配置上限：再平衡', '需要用錢、或有更好的標的（機會成本）'])}
    <div class="help">原則：進場前先寫好出場條件；分批進、分批出；同一時間只用一個主要理由做決定，其他當佐證。</div>`;
})();
document.addEventListener('click', e => {
  const t = e.target.closest('[data-wtab-go]'); if (!t) return;
  S.macroTab = t.dataset.wtabGo; save(); go('macro');
});
document.addEventListener('toggle', e => { if (e.target.id === 'tmGuide') { S.tmGuide = e.target.open; save(); } }, true);

/* ---------- 導覽：市場分頁加入「進出場時機」「季節性」 ---------- */
if (typeof GROUPS !== 'undefined') GROUPS.market = [['timing', '進出場時機'], ['macro', '總經'], ['season', '季節性'], ['monitor', '監控'], ['overview', '研究總覽']];
if (current === 'timing' || current === 'season') render();
