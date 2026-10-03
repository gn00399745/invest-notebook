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

/* ================= 美國總經指標：刻度圖（一眼看出高低與方向） ================= */
const MVIZ = {
  cpi: { lo: 0, hi: 6, ref: [2, 'Fed 目標 2%'], zones: [[0, 2.5, 'good'], [3.5, 6, 'bad']], short: 'CPI', note: '越接近 2% 越好；高於 3.5% 降息空間小' },
  ppi: { lo: -2, hi: 8, ref: [2, '2%'], zones: [[0, 3, 'good'], [5, 8, 'bad']], short: 'PPI', note: '生產成本；持續走高會推升 CPI' },
  pce: { lo: 0, hi: 5, ref: [2, 'Fed 目標 2%'], zones: [[1.5, 2.5, 'good'], [3, 5, 'bad']], short: '核心 PCE', note: 'Fed 最看重的通膨指標' },
  nfp: { lo: -100, hi: 400, ref: [150, '健康 150K'], zones: [[100, 250, 'good'], [-100, 50, 'bad']], short: '非農就業', note: '每月新增就業（千人）；低於 50K 代表轉弱', unit: 'K' },
  unrate: { lo: 3, hi: 6.5, ref: [4.2, '長期均衡 ≈4.2%'], zones: [[3, 4.5, 'good'], [5, 6.5, 'bad']], short: '失業率', note: '上升太快是衰退警訊' },
  claims: { lo: 180, hi: 320, ref: [250, '警戒 250K'], zones: [[180, 230, 'good'], [260, 320, 'bad']], short: '初領失業金', note: '每週公布，最快反映裁員', unit: 'K' },
  ffr: { lo: 0, hi: 6, ref: [3, '中性利率 ≈3%'], zones: [[4.5, 6, 'bad']], short: '聯邦基金利率', note: '高於中性利率＝緊縮，壓抑估值' },
  us10y: { lo: 2.5, hi: 6, ref: [4.5, '4.5%'], zones: [[2.5, 4, 'good'], [4.75, 6, 'bad']], short: '10 年債殖利率', note: '高於 4.5% 對成長股評價壓力大' },
  usdtwd: { lo: 27, hi: 35, ref: [31, '31'], zones: [], short: '美元兌台幣', note: '上升＝台幣貶值，出口股受惠', dp: 2 },
};
function mGauge(r, small) {
  const z = MVIZ[r.key], v = num(r.latest), p = num(r.prev); if (!z || v == null) return '';
  const X = x => Math.max(0, Math.min(100, (x - z.lo) / (z.hi - z.lo) * 100)), f = x => (z.dp ? (+x).toFixed(z.dp) : x) + (z.unit || (r.key === 'usdtwd' ? '' : '%'));
  const zone = z.zones.find(([a, b]) => v >= a && v <= b)?.[2] || '';
  return `<div class="mg ${small ? 'sm' : ''} ${zone}"><div class="tv-tr">${z.zones.map(([a, b, c]) => `<i class="tv-z ${c}" style="left:${X(a)}%;width:${X(b) - X(a)}%"></i>`).join('')}
      <i class="tv-tk ref" style="left:${X(z.ref[0])}%"></i>${p != null && p !== v ? `<i class="mg-prev" style="left:${X(p)}%"></i><i class="mg-arr ${v > p ? 'r' : 'l'}" style="left:${Math.min(X(p), X(v))}%;width:${Math.abs(X(v) - X(p))}%"></i>` : ''}<i class="tv-dot ${zone}" style="left:${X(v)}%">${small ? '' : `<span>${f(v)}</span>`}</i></div>
    ${small ? '' : `<div class="tv-ax"><span style="left:0">${f(z.lo)}</span><span style="left:${X(z.ref[0])}%">${esc(z.ref[1])}</span><span style="left:100%">${f(z.hi)}</span></div><div class="tv-cap">${p != null && p !== v ? `空心圈＝前值 ${f(p)}，箭頭＝變化方向。` : p === v ? '與前值相同。' : ''}${esc(z.note)}</div>`}</div>`;
}
if (typeof indCard === 'function') {
  const _indCard = indCard;
  indCard = function (r, i) { const h = _indCard(r, i), g = mGauge(r); return g ? h.replace('<div class="ind-vals">', g + '<div class="ind-vals">') : h; };
}
if (typeof inflationHint === 'function') {
  const _infH = inflationHint;
  inflationHint = function () {
    const rows = S.macro.rows.filter(r => MVIZ[r.key] && num(r.latest) != null);
    const sum = rows.length ? `<div class="mg-sum"><div class="mg-sh">一眼看完：每條刻度上的圓點是最新值，虛線是參考線，綠區＝健康、紅區＝警訊</div>${rows.map(r => { const v = num(r.latest), p = num(r.prev), z = MVIZ[r.key];
      return `<div class="mg-r"><span>${esc(z.short)}</span>${mGauge(r, true)}<b class="${(z.zones.find(([a, b]) => v >= a && v <= b) || [])[2] || ''}">${z.dp ? v.toFixed(z.dp) : v}${z.unit || (r.key === 'usdtwd' ? '' : '%')}<small>${p == null || p === v ? '＝' : v > p ? '▲' : '▼'}</small></b></div>`; }).join('')}</div>` : '';
    return sum + _infH();
  };
}

/* ================= 貴金屬與匯率研究 ================= */
const OZ_G = 31.1035;
const mkOf = sym => Object.values(S.world?.economies || {}).flatMap(e => e.markets || []).find(m => m.sym === sym);
const sparkSVG = (arr, cls = '') => arr?.length > 2 ? `<svg class="mf-sp ${cls}" viewBox="0 0 100 30" preserveAspectRatio="none"><path d="${sparkPath(arr.map((v, i) => [i, v]), 100, 30)}"/></svg>` : '';
const pos52 = m => m?.hi52 > m?.lo52 ? (m.price - m.lo52) / (m.hi52 - m.lo52) * 100 : null;
function rng52(m, dp = 2, label) {
  if (!m?.hi52) return '';
  return `${rangeBar(m.lo52, m.hi52, m.price, { label: label || fmt(m.price, dp), ticks: [[m.lo52, '52 週低 ' + fmt(m.lo52, dp)], [m.hi52, '52 週高 ' + fmt(m.hi52, dp)]] })}`;
}
function factorList(fs) {
  const p = fs.filter(f => f[1] === 'pos').length, n = fs.filter(f => f[1] === 'neg').length;
  return { html: `<div class="mf-f">${fs.map(([t, c, d]) => `<div class="mf-fr ${c}"><i>${c === 'pos' ? '＋' : c === 'neg' ? '－' : '・'}</i><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>`, p, n,
    verdict: p - n >= 2 ? ['偏多', 'pos'] : n - p >= 2 ? ['偏空', 'neg'] : ['中性', 'neu'] };
}
function goldView() {
  const g = mkOf('GC=F'), si = mkOf('SI=F'), pl = mkOf('PL=F'), tw = mkOf('TWD=X'), dx = mkOf('DX-Y.NYB'), gld = mkOf('00635U.TW');
  const A = S.world?.economies?.assets || {}, ry = A.realYield, be = A.breakeven;
  if (!g) return `<div class="card empty">${worldBusy ? '資料載入中…' : '還沒有資料，按「總經」頁右上角的更新。'}</div>`;
  const twd = tw?.price || fx(), gG = g.price * twd / OZ_G;
  const gsr = si ? g.price / si.price : null, gsrS = si?.spark?.length === g.spark?.length ? g.spark.map((v, i) => v / si.spark[i]) : null;
  const r = rsi14(g.spark), p52 = pos52(g);
  const ffr = S.macro.rows.find(x => x.key === 'ffr');
  const fs = [];
  if (ry) fs.push(['實質利率 ' + ry.v + '%', ry.m1 != null ? (ry.v < ry.m1 ? 'pos' : ry.v > ry.m1 ? 'neg' : 'neu') : 'neu', `一個月前 ${ry.m1 ?? '—'}%。實質利率下降＝持有黃金的機會成本降低，是金價最重要的驅動力`]);
  if (dx) fs.push(['美元指數 近 1 月 ' + pc(dx.chg1m) + '%', dx.chg1m < -0.5 ? 'pos' : dx.chg1m > 0.5 ? 'neg' : 'neu', '黃金以美元計價，美元走弱通常有利金價']);
  if (ffr && num(ffr.latest) != null) fs.push([`Fed 利率 ${ffr.latest}%`, num(ffr.latest) < num(ffr.prev) ? 'pos' : num(ffr.latest) > num(ffr.prev) ? 'neg' : 'neu', num(ffr.latest) < num(ffr.prev) ? '剛降息，資金成本下降' : '利率不變或上升，對金價中性偏空']);
  if (be) fs.push(['通膨預期 ' + be.v + '%', be.m1 != null && be.v > be.m1 ? 'pos' : 'neu', '通膨預期上升時，黃金的抗通膨需求增加']);
  if (r != null) fs.push([`金價 RSI ${fmt(r, 0)}`, r >= 75 ? 'neg' : r <= 35 ? 'pos' : 'neu', r >= 75 ? '短線過熱，追高風險大' : r <= 35 ? '短線超賣' : '短線動能正常']);
  if (p52 != null) fs.push([`位於 52 週區間 ${fmt(p52, 0)}%`, p52 >= 90 ? 'neu' : p52 <= 20 ? 'pos' : 'neu', p52 >= 90 ? '接近一年高點：趨勢強，但新資金宜分批' : p52 <= 20 ? '接近一年低點' : '區間中段']);
  const F = factorList(fs);
  return `<div class="card"><div class="card-head"><h3 class="gold-bar">🥇 黃金</h3><span class="sigp ${F.verdict[1]}">${F.verdict[0]}</span></div>
      <div class="mf-big"><div><em>國際金價（美元／盎司）</em><b>${fmt(g.price, 1)}</b><span>${chg(g.chg1d, 2)}今日　近 1 月 ${pc(g.chg1m)}%　今年 ${pc(g.ytd)}%</span></div>
        <div><em>台幣計價（每公克）</em><b>${fmt(gG, 0)}</b><span>每台兩（37.5g）約 ${fmt(gG * 37.5, 0)} 元</span></div></div>
      ${sparkSVG(g.wk, 'gold')}<div class="help" style="margin:-2px 0 6px">近一年週線</div>
      ${rng52(g, 0)}
      <div class="mf-sub">影響金價的因素（${F.p} 個利多、${F.n} 個利空）</div>${F.html}
      <div class="help">台幣金價＝國際金價 × 美元兌台幣 ÷ 31.1035；銀行黃金存摺另有買賣價差約 1～2%。央行買金、地緣風險屬於難以量化的長期支撐，未列入計分。</div></div>
    <div class="card"><h3 class="gold-bar">⚖️ 金銀比與其他貴金屬</h3>
      ${gsr ? `<div class="w-rates"><span>金銀比 <b>${fmt(gsr, 1)}</b></span><span class="help">一盎司黃金可換幾盎司白銀</span></div>
      ${rangeBar(40, 110, Math.min(110, gsr), { label: '金銀比 ' + fmt(gsr, 1), zones: [[40, 60, 'bad'], [85, 110, 'good']], ticks: [[40, '40'], [60, '60 白銀偏貴'], [85, '85 白銀偏便宜'], [110, '110']] })}
      ${gsrS ? sparkSVG(gsrS) + '<div class="help" style="margin-top:-2px">近 3 個月金銀比走勢</div>' : ''}
      <div class="help">長期金銀比多在 50～90 之間。比值高＝白銀相對便宜，景氣回升時白銀（兼具工業用途）常漲得比黃金多；比值低則反之。</div>` : ''}
      ${gtable(['', '價格', '1 月', '今年', '1 年'], [g, si, pl, mkOf('PA=F'), mkOf('HG=F'), gld].filter(Boolean).map(m => `<div class="gt-r"><span>${esc(m.name)}</span><span>${fmt(m.price, m.price < 100 ? 2 : 0)}</span><span style="${heat(m.chg1m, 8)}">${pc(m.chg1m)}</span><span style="${heat(m.ytd, 30)}">${pc(m.ytd)}</span><span style="${heat(m.chg1y, 40)}">${pc(m.chg1y)}</span></div>`), 'wide')}
      <div class="help">銅不是貴金屬，列出來作對照：銅漲代表製造業需求強（風險偏好），黃金漲但銅跌則偏向避險。</div></div>
    ${ry ? `<div class="card"><h3 class="gold-bar">📉 實質利率 vs 金價</h3><div class="mf-two"><div><em>實質利率（%）</em>${sparkSVG(ry.wk, 'neg')}<b>${ry.v}%</b></div><div><em>金價</em>${sparkSVG(g.wk, 'gold')}<b>${fmt(g.price, 0)}</b></div></div>
      <div class="help">兩條線通常反向：實質利率往下，金價往上。若兩者同時上升，代表有其他買盤（例如各國央行買金、避險需求）在支撐金價。資料：${esc(ry.src)}，${esc(ry.d)}。</div></div>` : ''}`;
}
function fxView() {
  const W = S.world?.economies || {}, R = id => W[id]?.indicators?.find(x => x.k === 'rate')?.v, Y = id => W[id]?.indicators?.find(x => x.k === 'y10')?.v;
  const ffr = num(S.macro.rows.find(x => x.key === 'ffr')?.latest), us10 = num(S.macro.rows.find(x => x.key === 'us10y')?.latest), cbc = S.twOff?.cbc?.rates?.discount;
  const tw = mkOf('TWD=X'), jp = mkOf('JPY=X'), eu = mkOf('EURUSD=X'), cn = mkOf('CNY=X'), kr = mkOf('KRW=X'), dx = mkOf('DX-Y.NYB');
  if (!tw) return `<div class="card empty">${worldBusy ? '資料載入中…' : '還沒有資料，按「總經」頁右上角的更新。'}</div>`;
  const pair = (m, o) => {
    if (!m) return '';
    const p = pos52(m), dp = m.price < 10 ? 4 : 2, fs = [];
    if (o.diff != null) fs.push([`利差 ${o.diff >= 0 ? '+' : ''}${fmt(o.diff, 2)} 個百分點`, o.diff >= 1.5 ? o.wideIs : o.diff <= 0.5 ? (o.wideIs === 'pos' ? 'neg' : 'pos') : 'neu', o.diffNote]);
    if (m.chg1m != null) fs.push([`近 1 月 ${pc(m.chg1m)}%`, 'neu', o.trend(m.chg1m)]);
    if (p != null) fs.push([`52 週區間位置 ${fmt(p, 0)}%`, 'neu', o.posNote(p)]);
    return `<div class="card"><div class="card-head"><h3 class="gold-bar">${o.ic} ${esc(o.title)}</h3><span class="mf-px">${fmt(m.price, dp)}</span></div>
      ${sparkSVG(m.wk)}${rng52(m, dp)}
      <div class="mf-f">${fs.map(([t, c, d]) => `<div class="mf-fr ${c}"><i>・</i><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>
      <div class="mf-do">${esc(o.action(p))}</div></div>`;
  };
  const usd = pair(tw, { ic: '🇺🇸🇹🇼', title: '美元兌台幣', diff: ffr != null && cbc != null ? ffr - cbc : null, wideIs: 'neu',
    diffNote: `Fed ${ffr ?? '—'}% − 台灣央行 ${cbc ?? '—'}%。美國利率越高於台灣，資金越傾向留在美元，台幣較難大幅升值`,
    trend: c => c > 0.5 ? '美元走強、台幣貶值：出口股受惠，外資可能匯出' : c < -0.5 ? '台幣升值：外資匯入時常見，出口商匯損' : '匯率大致持平',
    posNote: p => p >= 80 ? '美元在一年區間高檔（台幣偏弱）' : p <= 20 ? '美元在一年區間低檔（台幣偏強）' : '區間中段',
    action: p => p == null ? '' : p <= 25 ? '有美元需求（美股、美元保單、出國）：台幣相對強，可分批換美元。' : p >= 75 ? '美元偏貴：換美元可再等等或少量分批；持有美元資產者，換回台幣的價位相對有利。' : '區間中段：有需求就分批換，不必刻意等。' });
  const yen = pair(jp, { ic: '🇯🇵', title: '美元兌日圓', diff: ffr != null && R('jp') != null ? ffr - R('jp') : null, wideIs: 'neu',
    diffNote: `美日利差（Fed − 日本短期利率 ${R('jp') ?? '—'}%）。利差縮小（日本升息或美國降息）時日圓傾向升值，並可能引發套利交易平倉、亞洲股市震盪`,
    trend: c => c > 0.5 ? '日圓走弱' : c < -0.5 ? '日圓走強（留意套利交易平倉）' : '大致持平',
    posNote: p => p >= 80 ? '日圓在一年區間的弱勢端' : p <= 20 ? '日圓在一年區間的強勢端' : '區間中段',
    action: p => `日圓兌台幣約 ${fmt(tw.price / jp.price, 4)}（1 萬日圓 ≈ ${fmt(tw.price / jp.price * 10000, 0)} 台幣）。${p >= 75 ? '日圓偏弱：旅遊或日圓資產換匯相對划算。' : p <= 25 ? '日圓偏強：換日圓較貴。' : ''}` });
  const eur = pair(eu, { ic: '🇪🇺', title: '歐元兌美元', diff: ffr != null && R('eu') != null ? R('eu') - ffr : null, wideIs: 'pos',
    diffNote: `ECB ${R('eu') ?? '—'}% − Fed ${ffr ?? '—'}%。歐洲利率相對越高，越支撐歐元`,
    trend: c => c > 0.5 ? '歐元升值（美元相對弱）' : c < -0.5 ? '歐元貶值' : '大致持平',
    posNote: p => p >= 80 ? '歐元在一年高檔' : p <= 20 ? '歐元在一年低檔' : '區間中段',
    action: () => `歐元兌台幣約 ${fmt(eu.price * tw.price, 2)}。` });
  const cny = pair(cn, { ic: '🇨🇳', title: '美元兌人民幣', diff: null, wideIs: 'neu', diffNote: '',
    trend: c => c > 0.3 ? '人民幣走弱' : c < -0.3 ? '人民幣走強' : '人民幣由中國央行管理，波動較小',
    posNote: p => p >= 80 ? '人民幣在一年弱勢端' : p <= 20 ? '人民幣在一年強勢端' : '區間中段',
    action: () => '人民幣升值通常反映中國資金面與出口改善，對港股、陸股與台灣對中出口股偏正面。' });
  const tbl = [dx, tw, jp, eu, cn, kr, mkOf('HKD=X')].filter(Boolean);
  const rates = [['🇺🇸 美國', ffr, us10], ['🇹🇼 台灣', cbc, null], ['🇯🇵 日本', R('jp'), Y('jp')], ['🇪🇺 歐元區', R('eu'), Y('eu')]];
  return `<div class="card"><h3 class="gold-bar">💱 匯率總覽</h3>${gtable(['', '匯率', '1 月', '今年', '52 週位置'], tbl.map(m => `<div class="gt-r"><span>${esc(m.name)}</span><span>${fmt(m.price, m.price < 10 ? 4 : 2)}</span><span style="${heat(m.chg1m, 3)}">${pc(m.chg1m)}</span><span style="${heat(m.ytd, 8)}">${pc(m.ytd)}</span><span>${pos52(m) == null ? '—' : fmt(pos52(m), 0) + '%'}</span></div>`), 'wide')}
      <div class="help">「美元兌 X」上升＝美元變強、X 貶值。52 週位置：0%＝一年最低、100%＝一年最高。</div></div>
    <div class="card"><h3 class="gold-bar">🏦 各國利率（匯率的根本）</h3>${hbars(rates.filter(r => r[1] != null).map(r => ({ l: r[0], v: r[1] })), { unit: '%' })}
      <div class="help">政策利率：美國聯邦基金利率上限、台灣重貼現率、日本短期利率、歐洲央行存款利率。資金會往利率高、貨幣預期升值的地方流，利差變化常領先匯率。${us10 != null ? ` 美國 10 年債 ${us10}%${Y('jp') != null ? `、日本 ${Y('jp')}%` : ''}${Y('eu') != null ? `、德國 ${Y('eu')}%` : ''}。` : ''}</div></div>
    ${usd}${yen}${eur}${cny}`;
}
PAGES.metfx = () => {
  setTimeout(() => { loadWorld(false); if (!S.twOff) loadWorld(false); }, 30);
  const tab = S.mfTab || 'gold';
  return `<h2>貴金屬與匯率</h2><p class="lead">黃金看<b>實質利率、美元、避險需求</b>；匯率看<b>利差、資金流向、景氣相對強弱</b>。下面把這些因素整理成加減分，並附上換匯參考。</p>
    <div class="chips">${[['gold', '🥇 貴金屬'], ['fx', '💱 匯率']].map(([k, l]) => `<button class="chip ${k === tab ? 'on' : ''}" data-mftab="${k}">${l}</button>`).join('')}<button class="chip" data-go="season" data-seapick="${tab === 'gold' ? 'GC=F' : 'TWD=X'}">📅 季節性</button></div>
    ${tab === 'gold' ? goldView() : fxView()}
    <div class="help">資料：Yahoo Finance、FRED、各國央行；${S.world?.updated ? '更新於 ' + new Date(S.world.updated).toLocaleString('zh-TW', { hour12: false }) : ''}。僅供研究參考，不構成投資建議。</div>`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-mftab],[data-seapick]'); if (!t) return;
  if (t.dataset.mftab) { S.mfTab = t.dataset.mftab; save(); return render(); }
  if (t.dataset.seapick) { S.seaSym = t.dataset.seapick; save(); }
}, true);
SEA_SYMS.push(['GC=F', '黃金'], ['TWD=X', '美元兌台幣'], ['JPY=X', '美元兌日圓']);
SEA_DEF['GC=F'] = ['all', 'mid']; SEA_DEF['TWD=X'] = ['all']; SEA_DEF['JPY=X'] = ['all'];
if (typeof GROUPS !== 'undefined') GROUPS.market = [['timing', '進出場時機'], ['macro', '總經'], ['metfx', '金屬・匯率'], ['season', '季節性'], ['monitor', '監控'], ['overview', '研究總覽']];
if (current === 'metfx') render();

/* ================= 百年景氣循環：擴張與衰退統計 ================= */
let cycBusy = false;
S.cyc = S.cyc || {};
async function loadCycles(force, reg = S.cycReg || 'us') {
  if (cycBusy || !location.protocol.startsWith('http')) return;
  const c = S.cyc[reg]; if (!force && c && Date.now() - (c.at || 0) < 7 * 864e5) return;
  cycBusy = true; if (current === 'cycles') render();
  try { const j = await (await fetch('api/cycles' + (reg === 'us' ? '' : '?region=' + reg), { signal: AbortSignal.timeout(80000) })).json(); if (j.error || !(j.recessions || j.countries)) throw new Error(j.error || '格式錯誤'); j.at = Date.now(); S.cyc[reg] = j; delete S.cycles; save(); }
  catch (e) { toast('景氣循環資料讀取失敗：' + e.message); }
  cycBusy = false; if (current === 'cycles') { const y = scrollY; render(); scrollTo(0, y); }
}
const ymNum = s => +s.slice(0, 4) + (+s.slice(5, 7) - 1) / 12;
const yrLab = s => `${s.slice(0, 4)}/${+s.slice(5, 7)}`;
function cycTimeline(C) {
  const W = 340, H = 64, L = 4, R = 4, x0 = C.since || 1920, x1 = new Date().getFullYear() + 1, X = v => L + (v - x0) / (x1 - x0) * (W - L - R);
  return `<svg class="cy" viewBox="0 0 ${W} ${H}">
    ${C.expansions.map(e => `<rect x="${X(ymNum(e.start))}" y="10" width="${Math.max(1, X(ymNum(e.end || new Date().toISOString().slice(0, 7))) - X(ymNum(e.start)))}" height="22" class="ex"><title>擴張 ${yrLab(e.start)}–${e.end ? yrLab(e.end) : '至今'}：${e.months} 個月${e.name ? '（' + e.name + '）' : ''}</title></rect>`).join('')}
    ${C.recessions.map(r => `<rect x="${X(ymNum(r.peak))}" y="6" width="${Math.max(1.5, X(ymNum(r.trough)) - X(ymNum(r.peak)))}" height="30" class="rc"><title>衰退 ${yrLab(r.peak)}–${yrLab(r.trough)}：${r.months} 個月（${r.name}）</title></rect>`).join('')}
    ${[1920, 1940, 1960, 1980, 2000, 2020].filter(y => y >= x0).map((y, i) => `<line x1="${X(y)}" x2="${X(y)}" y1="38" y2="42" class="tk"/><text x="${X(y)}" y="54" text-anchor="${i || X(y) > 20 ? 'middle' : 'start'}">${y}</text>`).join('')}
  </svg>`;
}
function cycSpx(C) {
  const pts = C.spx; if (!pts?.length) return '';
  const W = 340, H = 210, L = 34, R = 6, T = 14, B = 20, x0 = ymNum(pts[0][0]), x1 = ymNum(pts[pts.length - 1][0]);
  const lv = pts.map(p => Math.log10(p[1])), lo = Math.floor(Math.min(...lv)), hi = Math.ceil(Math.max(...lv));
  const X = v => L + (v - x0) / (x1 - x0) * (W - L - R), Y = v => T + (hi - Math.log10(v)) / (hi - lo) * (H - T - B);
  const big = { 經濟大蕭條: '大蕭條', 第一次石油危機: '石油危機', '網路泡沫・911': '網路泡沫', 全球金融海嘯: '金融海嘯', 新冠疫情: '疫情', 亞洲金融風暴: '亞洲金融風暴', 網路泡沫: '網路泡沫', 歐債危機: '歐債', '疫後庫存調整・升息': '升息' }; let bi = 0;
  return `<svg class="cy" viewBox="0 0 ${W} ${H}">
    ${Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map(e => `<line x1="${L}" x2="${W - R}" y1="${Y(10 ** e)}" y2="${Y(10 ** e)}" class="gl"/><text x="${L - 4}" y="${Y(10 ** e) + 3}" text-anchor="end">${10 ** e >= 1000 ? fmt(10 ** e / 1000, 0) + 'k' : fmt(10 ** e, 0)}</text>`).join('')}
    ${C.recessions.filter(r => ymNum(r.trough) >= x0).map(r => `<rect x="${X(Math.max(x0, ymNum(r.peak)))}" y="${T}" width="${Math.max(1.5, X(ymNum(r.trough)) - X(Math.max(x0, ymNum(r.peak))))}" height="${H - T - B}" class="rcs"><title>${r.name}：${yrLab(r.peak)}–${yrLab(r.trough)}${r.dd != null ? `，股市最大跌幅 ${r.dd}%` : ''}</title></rect>${big[r.name] ? `<text x="${X(ymNum(r.peak))}" y="${T + 8 + (bi++ % 2) * 10}" text-anchor="${ymNum(r.peak) > x1 - 8 ? 'end' : 'middle'}" class="ev">${big[r.name]}</text>` : ''}`).join('')}
    <path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(ymNum(p[0])).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('')}" class="ln2"/>
    ${(x1 - x0 > 50 ? [1930, 1950, 1970, 1990, 2010] : [2000, 2005, 2010, 2015, 2020, 2025]).filter(y => y >= x0 && y <= x1).map(y => `<text x="${X(y)}" y="${H - 5}" text-anchor="middle">${y}</text>`).join('')}
  </svg>`;
}
function cycGdp(C) {
  const d = C.gdpY; if (!d?.length) return '';
  const W = 340, H = 180, L = 28, R = 4, T = 12, B = 20, mx = Math.max(...d.map(x => Math.abs(x[1]))), lim = Math.ceil(mx / 5) * 5;
  const n = d.length, bw = (W - L - R) / n, Y = v => T + (lim - v) / (2 * lim) * (H - T - B);
  const ext = [d.reduce((a, b) => (b[1] < a[1] ? b : a)), d.reduce((a, b) => (b[1] > a[1] ? b : a))];
  return `<svg class="cy" viewBox="0 0 ${W} ${H}">
    ${[-lim, -lim / 2, 0, lim / 2, lim].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 ? 'z' : 'gl'}"/><text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`).join('')}
    ${d.map(([y, v], i) => `<rect x="${(L + i * bw + 0.4).toFixed(1)}" y="${Math.min(Y(v), Y(0)).toFixed(1)}" width="${Math.max(0.8, bw - 0.8).toFixed(1)}" height="${Math.max(0.5, Math.abs(Y(v) - Y(0))).toFixed(1)}" rx="0.8" class="${v < 0 ? 'neg' : 'pos'}"><title>${y} 年：${v}%</title></rect>`).join('')}
    ${ext.map(([y, v]) => `<text x="${L + d.findIndex(x => x[0] === y) * bw + bw / 2}" y="${v < 0 ? Y(v) + 10 : Y(v) - 3}" text-anchor="middle" class="ev">${y}：${v > 0 ? '+' : ''}${v}%</text>`).join('')}
    ${d.filter(([y]) => y % 20 === 0).map(([y]) => `<text x="${L + d.findIndex(x => x[0] === y) * bw}" y="${H - 5}" text-anchor="middle">${y}</text>`).join('')}
  </svg>`;
}
function cycPairs(C) {
  // 每個循環一列：擴張（綠）＋接著的衰退（紅），同一刻度（月）
  const rows = C.expansions.map((e, i) => ({ e, r: C.recessions[i + 1] }));
  const mx = Math.max(...C.expansions.map(e => e.months), 1);
  return `<div class="cyp">${rows.map(({ e, r }) => `<div class="cyp-r"><span>${e.start.slice(0, 4)}</span><div class="cyp-b"><i class="ex" style="width:${e.months / mx * 100}%" title="擴張 ${e.months} 個月"></i>${r ? `<i class="rc" style="width:${Math.max(1.2, r.months / mx * 100)}%" title="衰退 ${r.months} 個月"></i>` : '<i class="now">進行中</i>'}</div><b>${e.months}${r ? `<small>/${r.months}</small>` : ''}</b></div>`).join('')}</div>`;
}
function cycDd(C) {
  const rs = C.recessions.filter(r => r.dd != null), mx = Math.max(...rs.map(r => Math.abs(r.dd)), 1);
  return `<div class="cyd">${rs.map(r => `<div class="cyd-r"><span>${/^\d/.test(r.name) ? '' : r.peak.slice(0, 4) + ' '}${esc(r.name)}</span><div class="cyd-t"><i style="width:${Math.abs(r.dd) / mx * 100}%" title="${esc(r.name)}：股市高點 ${yrLab(r.spxTop)} → 低點 ${yrLab(r.spxBottom)}"></i></div><b>${r.dd}%</b></div>`).join('')}</div>`;
}
function cycLead(C) {
  const rs = C.recessions.filter(r => r.bottomLead != null), mx = Math.max(...rs.map(r => Math.abs(r.bottomLead)), 1);
  return `<div class="tv-dv">${rs.map(r => `<div class="tv-dr"><span>${r.peak.slice(0, 4)}</span><div class="tv-dt"><i class="tv-0"></i><i class="tv-db ${r.bottomLead > 0 ? 'p' : 'n'}" style="${r.bottomLead > 0 ? `right:50%;width:${r.bottomLead / mx * 50}%` : `left:50%;width:${Math.abs(r.bottomLead) / mx * 50}%`}" title="股市低點 ${yrLab(r.spxBottom)}、景氣谷底 ${yrLab(r.trough)}"></i></div><b>${r.bottomLead > 0 ? '早 ' + r.bottomLead : r.bottomLead < 0 ? '晚 ' + Math.abs(r.bottomLead) : '同月'}</b></div>`).join('')}</div>`;
}
function cycView(C) {
  const tw = C.region === 'tw', era = tw ? '歷次' : '二戰後', ix = C.index || '標普 500', head = '';
  const s = C.stats, cur = s.cur;
  const tiles = [['平均擴張', `${s.expPost} 個月`, tw ? `最長 ${s.maxExp} 個月（1956–64）` : `二戰後；含戰前平均 ${s.expAll} 個月`], ['平均衰退', `${s.recPost} 個月`, tw ? '國發會認定的收縮期' : `二戰後；含戰前平均 ${s.recAll} 個月`], ['衰退期間股市最大跌幅', `${s.dd}%`, tw ? `平均（加權指數 1997 年起）` : `平均；二戰後 ${s.ddPost}%`], ['股市比景氣谷底', s.bottomLead >= 0 ? `早 ${s.bottomLead} 個月` : `晚 ${Math.abs(s.bottomLead)} 個月`, `${s.ddWins}/${s.ddN} 次在衰退結束前見底`], ['景氣谷底後 12 個月', `${s.after12 >= 0 ? '+' : ''}${s.after12}%`, `${ix} 平均報酬`], ['目前這段擴張', `${cur.months} 個月`, `自 ${yrLab(cur.start)} 起${cur.spx != null ? `，股市 ${pc(cur.spx)}%` : ''}`]];
  const curPos = rangeBar(0, 130, Math.min(130, cur.months), { label: `目前 ${cur.months} 個月`, ticks: [[0, '0'], [s.expPost, `${era}平均 ${s.expPost}`], [s.maxExp || 128, `最長 ${s.maxExp || 128}`]] });
  return `
    <div class="cy-tiles">${tiles.map(([t, v, d]) => `<div><em>${t}</em><b>${v}</b><span>${d}</span></div>`).join('')}</div>
    <div class="card"><h3 class="gold-bar">🗓️ ${tw ? '台灣景氣循環時間軸' : '百年時間軸'}</h3>${cycTimeline(C)}<div class="w-legend"><span><i class="cy-ex"></i>擴張</span><span><i class="cy-rc"></i>衰退</span><span class="help">點色塊看期間</span></div>
      <div class="help">${tw ? '台灣是出口導向經濟，景氣循環比美國更頻繁（約 4～5 年一次），而且多半跟著全球電子業庫存與美國景氣起伏：石油危機、亞洲金融風暴、網路泡沫、金融海嘯都是外部衝擊。' : '衰退通常短而急（平均不到一年），擴張則越來越長：二戰前平均約 2～3 年，1980 年代以後動輒 8～10 年，原因是央行與財政政策更積極地「熨平」景氣。'}</div></div>
    <div class="card"><h3 class="gold-bar">📈 ${ix}（對數刻度）與衰退期間</h3>${cycSpx(C)}<div class="w-legend"><span><i class="cy-rc"></i>衰退期間</span><span><i class="cy-ln"></i>${ix}</span></div>
      <div class="help">${tw ? '加權指數在 1990 年泡沫破裂（12,682 → 2,485 點）後花了 30 年才站回高點；網路泡沫與金融海嘯也都腰斬。台股波動遠大於美股，景氣收縮期常伴隨 40% 以上跌幅。' : '對數刻度下，同樣高度代表同樣的漲跌百分比。每次衰退都留下一段下跌，但長期趨勢一路向上：衰退是「暫時的」，持有優質資產度過衰退的人最終都賺回來，只是大蕭條花了 25 年。'}</div></div>
    ${C.gdpY?.length ? `<div class="card"><h3 class="gold-bar">🏭 ${tw ? '台灣' : '美國'}每年實質 GDP 成長率</h3>${cycGdp(C)}<div class="help">${tw ? '台灣 1980 年以來只有 2001（網路泡沫）與 2009（金融海嘯）兩年負成長；成長率從 80 年代的 8～12% 逐步降到 2～4%，2021 與 2025 年因半導體與 AI 需求再度跳升。' : '紅色是負成長的年份。1930 年代大蕭條、1946 年戰後軍需驟減是最深的谷底；1980 年代以後負成長變得少而淺，2020 年疫情是例外的急跌急彈。'}</div></div>` : ''}
    <div class="card"><h3 class="gold-bar">⏱️ 每段擴張與接著的衰退（月）</h3>${cycPairs(C)}<div class="w-legend"><span><i class="cy-ex"></i>擴張</span><span><i class="cy-rc"></i>衰退</span></div><div class="help">左邊是擴張開始的年份；右側數字為「擴張月數 / 衰退月數」。</div></div>
    <div class="card"><h3 class="gold-bar">📉 每次衰退的股市最大跌幅</h3>${cycDd(C)}<div class="help">從衰退前 18 個月內的股市高點，到景氣谷底後 12 個月內的低點。${tw ? '' : '跌幅超過 40% 的幾乎都伴隨金融危機（1929、1937、1973、2001、2008）。'}</div></div>
    <div class="card"><h3 class="gold-bar">🔭 股市比景氣早幾個月見底</h3>${cycLead(C)}<div class="help">綠色（向左）＝股市在衰退結束「之前」就見底；平均${s.bottomLead >= 0 ? '提早' : '晚'} ${Math.abs(s.bottomLead)} 個月，${s.ddWins}/${s.ddN} 次提前。等到經濟數據確認好轉才進場，往往已錯過最低點。</div></div>
    <div class="card"><h3 class="gold-bar">📍 現在在哪裡</h3>${curPos}
      <div class="help">目前的擴張始於 ${yrLab(cur.start)}，已 ${cur.months} 個月，${cur.months > s.expPost ? '超過' : '短於'}${era}平均 ${s.expPost} 個月。擴張不會因為「年紀大」而結束，真正終結擴張的通常是：央行為壓通膨而過度升息、資產泡沫破裂、或外部衝擊（石油、疫情）。可搭配「進出場時機」頁的景氣階段一起看。</div></div>
    <div class="card"><h3 class="gold-bar">💡 給投資人的 5 個規律</h3><ol class="cy-l">
      <li>衰退平均約 ${s.recPost} 個月，擴張平均約 ${s.expPost} 個月：時間站在多頭這邊，長期持有的勝率高。</li>
      <li>衰退期間股市平均最大跌幅約 ${Math.abs(s.dd)}%：配置時要先確定自己撐得住這種跌幅（或保留現金與債券）。</li>
      <li>多數衰退（${s.ddWins}/${s.ddN} 次）股市在景氣谷底之前就見底：在壞消息最多、失業率還在上升時分批買進，歷史上報酬最好。</li>
      <li>景氣谷底後一年，${ix}平均 ${s.after12 >= 0 ? '+' : ''}${s.after12}%：衰退結束初期往往是一輪多頭最肥的一段。</li>
      <li>擴張後段的警訊：殖利率曲線倒掛、失業率從低點回升 0.5 個百分點以上（薩姆規則）、領先指標連續下滑、央行持續升息。</li>
    </ol></div>
    <details class="card rc-sub"><summary>📋 ${C.count || C.recessions.length} 次衰退明細</summary>${gtable(['期間', '月', 'GDP', '失業率高點', '股市跌幅', '谷底後 1 年'], C.recessions.map(r => `<div class="gt-r"><span>${r.peak.slice(0, 4)} ${esc(r.name)}</span><span>${r.months}</span><span>${r.gdpDrop != null ? r.gdpDrop + '%' : '—'}</span><span>${r.unPeak != null ? r.unPeak + '%' : '—'}</span><span style="${heat(r.dd, 40)}">${r.dd != null ? r.dd + '%' : '—'}</span><span style="${heat(r.after12, 40)}">${r.after12 != null ? pc(r.after12) + '%' : '—'}</span></div>`), 'cyt')}
      <div class="help">${tw ? '台灣的收縮期多為成長放緩而非負成長，因此不列 GDP 與失業率。' : 'GDP＝衰退期間實質 GDP 從高點到低點的跌幅（1947 年後才有季資料）；失業率高點取衰退開始後 2 年內（1948 年後）。'}</div></details>
    <div class="help">${esc(C.src)}。${C.errors?.length ? '<span class="down">' + C.errors.map(esc).join('；') + '</span>' : ''}</div>`;
};
if (typeof GROUPS !== 'undefined') GROUPS.market = [['timing', '進出場時機'], ['macro', '總經'], ['cycles', '景氣循環'], ['metfx', '金屬・匯率'], ['season', '季節性'], ['monitor', '監控'], ['overview', '研究總覽']];
if (current === 'cycles') render();

/* ---------- 景氣循環：地區切換、國際比較 ---------- */
function intlView(D) {
  const x0 = 1955, x1 = new Date().getFullYear() + 1, W = 340, L = 52, R = 4, X = v => L + (v - x0) / (x1 - x0) * (W - L - R);
  const rows = [{ flag: '🇺🇸', name: '美國', recs: D.us }, { flag: '🇹🇼', name: '台灣', recs: D.tw }, ...D.countries.map(c => ({ flag: c.flag, name: c.name, recs: c.recessions, since: +c.since }))];
  const H = rows.length * 22 + 26;
  const sync = `<svg class="cy" viewBox="0 0 ${W} ${H}">
    ${[1960, 1980, 2000, 2020].map(y => `<line x1="${X(y)}" x2="${X(y)}" y1="4" y2="${H - 18}" class="gl"/><text x="${X(y)}" y="${H - 5}" text-anchor="middle">${y}</text>`).join('')}
    ${[[2008, 2009.5, '金融海嘯'], [2020, 2020.6, '疫情']].map(([a, b, t]) => `<rect x="${X(a)}" y="2" width="${X(b) - X(a) + 2}" height="${H - 20}" class="rcs"/><text x="${X(a)}" y="${H - 14}" text-anchor="middle" class="ev">${t}</text>`).join('')}
    ${rows.map((r, i) => { const y = 6 + i * 22; return `<text x="2" y="${y + 11}" class="cy-rl">${r.flag} ${r.name}</text>${r.since > x0 ? `<rect x="${X(x0)}" y="${y + 3}" width="${X(r.since) - X(x0)}" height="10" class="nod"><title>${r.name} 季資料自 ${r.since} 年起</title></rect>` : ''}<line x1="${X(Math.max(x0, r.since || x0))}" x2="${W - R}" y1="${y + 8}" y2="${y + 8}" class="base"/>${r.recs.filter(z => ymNum(z.trough) >= x0).map(z => `<rect x="${X(Math.max(x0, ymNum(z.peak)))}" y="${y + 1}" width="${Math.max(2, X(ymNum(z.trough)) - X(Math.max(x0, ymNum(z.peak))))}" height="14" rx="2" class="rc"><title>${r.name} ${yrLab(z.peak)}–${yrLab(z.trough)}${z.name ? '：' + z.name : ''}</title></rect>`).join('')}`; }).join('')}
  </svg>`;
  const st = gtable(['', '次數', '每 10 年', '平均月數', 'GDP 跌幅', '股市跌幅', '谷底後 1 年'], D.countries.map(c => `<div class="gt-r"><span>${c.flag} ${c.name}<small class="w-u">${c.since} 年起</small></span><span>${c.stats.n}</span><span>${c.stats.perDecade ?? '—'}</span><span>${c.stats.months ?? '—'}</span><span style="${heat(c.stats.gdpDrop, 5)}">${c.stats.gdpDrop ?? '—'}%</span><span style="${heat(c.stats.dd, 40)}">${c.stats.dd ?? '—'}%</span><span style="${heat(c.stats.after12, 30)}">${c.stats.after12 != null ? pc(c.stats.after12) + '%' : '—'}</span></div>`), 'cyi');
  const dd = D.countries.map(c => { const rs = c.recessions.filter(r => r.dd != null); if (!rs.length) return ''; const mx = Math.max(...rs.map(r => Math.abs(r.dd)), 1);
    return `<details class="rc-sub"><summary>${c.flag} ${c.name}：${c.recessions.length} 次衰退（${esc(c.idxName)}）</summary><div class="cyd">${rs.map(r => `<div class="cyd-r"><span>${yrLab(r.peak)} ${esc(r.name || '')}</span><div class="cyd-t"><i style="width:${Math.abs(r.dd) / mx * 100}%" title="GDP ${r.gdpDrop}%"></i></div><b>${r.dd}%</b></div>`).join('')}</div><div class="help">右側為股市最大跌幅；GDP 跌幅依序：${c.recessions.map(r => `${r.peak.slice(0, 4)} ${r.gdpDrop}%`).join('、')}</div></details>`; }).join('');
  return `<div class="card"><h3 class="gold-bar">🌍 各國衰退同步圖</h3>${sync}<div class="w-legend"><span><i class="cy-rc"></i>衰退</span><span class="help">點色塊看期間；灰色＝尚無季資料</span></div>
      <div class="help">全球化之後，衰退越來越「同步」：2008 金融海嘯與 2020 疫情，所有主要經濟體幾乎同時衰退；歐洲與日本另外多了 2011–12 歐債危機、2022–23 能源危機的獨立衰退。台灣的循環則最貼近美國與全球電子業。</div></div>
    <div class="card"><h3 class="gold-bar">📊 各國衰退統計</h3>${st}<div class="help">歐洲與日本沒有官方的衰退認定機構（歐元區有 CEPR 委員會），這裡統一用「實質 GDP 連續兩季下滑」認定，所以會比官方定義多出一些短而淺的技術性衰退。日本自 1990 年代起長期低成長，衰退最頻繁；德國次之。</div></div>
    <div class="card"><h3 class="gold-bar">📉 各國衰退時的股市跌幅</h3>${dd}</div>
    <div class="help">${esc(D.src)}。${D.errors?.length ? '<span class="down">' + D.errors.map(esc).join('；') + '</span>' : ''}</div>`;
}
PAGES.cycles = () => {
  const reg = S.cycReg || 'us'; setTimeout(() => loadCycles(false, reg), 30);
  const C = S.cyc[reg];
  const lead = { us: '美國自 1920 年以來共經歷 18 次衰退與 18 段擴張（依美國國家經濟研究局 NBER 認定）。', tw: '台灣自 1954 年以來共經歷 15 次完整景氣循環，現在處於第 16 次循環的擴張期（依國家發展委員會認定）。', intl: '英國、德國、法國、歐元區、日本的衰退（以實質 GDP 連續兩季下滑認定），並與美國、台灣放在同一條時間軸比較。' }[reg];
  const head = `<h2>景氣循環</h2><p class="lead">${lead}把每一次的長度、GDP 與股市表現放在一起看，找出可以用在投資上的規律。</p>
    <div class="chips">${[['us', '🇺🇸 美國百年'], ['tw', '🇹🇼 台灣'], ['intl', '🌍 英國・歐洲・日本']].map(([k, l]) => `<button class="chip ${k === reg ? 'on' : ''}" data-cycreg="${k}">${l}</button>`).join('')}<button class="chip" data-go="empire">👑 霸權輪替</button></div>`;
  if (!C) return head + `<div class="card empty">${cycBusy ? '計算中…（約 10～20 秒）' : '讀取中…'}</div>`;
  return head + (reg === 'intl' ? intlView(C) : cycView(C));
};
document.addEventListener('click', e => { const t = e.target.closest('[data-cycreg]'); if (!t) return; S.cycReg = t.dataset.cycreg; save(); render(); });

/* ================= 霸權輪替：財富與權力如何流動 ================= */
const EMPIRES = [['葡萄牙', 1450, 1530, '#3b82c4', '大航海時代開端，控制香料貿易航線'], ['西班牙', 1530, 1640, '#c9a24a', '美洲白銀，西班牙銀元通行全球'], ['荷蘭', 1640, 1720, '#e8833a', '東印度公司、阿姆斯特丹交易所、世界最早的現代金融中心'],
  ['法國', 1720, 1815, '#8b5cf6', '歐陸最大經濟體，拿破崙戰爭後衰落'], ['英國', 1815, 1920, '#d64545', '工業革命、殖民帝國、英鎊與倫敦金融城'], ['美國', 1920, null, '#1e9e5a', '二戰後布列敦森林體系，美元成為世界貨幣']];
// 占全球 GDP 比重（%）：1500–1973 為 Maddison 歷史估計（購買力平價），2000 年起為 IMF 購買力平價（2030 為預測）
const GDP_SH = { years: [1500, 1600, 1700, 1820, 1870, 1913, 1950, 1973, 2000, 2010, 2025, 2030],
  s: [['中國', '#d64545', [25.0, 29.2, 22.3, 32.9, 17.2, 8.9, 4.5, 4.6, 6.7, 12.7, 19.6, 20.4]], ['印度', '#e8833a', [24.5, 22.6, 24.4, 16.0, 12.2, 7.6, 4.2, 3.1, 3.9, 5.3, 8.2, 9.7]],
    ['英國', '#8b5cf6', [1.1, 1.8, 2.9, 5.2, 9.1, 8.3, 6.5, 4.2, 3.3, 2.7, 2.2, 2.0]], ['美國', '#1e9e5a', [0.3, 0.2, 0.1, 1.8, 8.9, 19.1, 27.3, 22.1, 20.4, 17.1, 14.6, 13.9]]] };
function empTimeline() {
  const W = 340, H = 92, L = 4, R = 4, x0 = 1450, x1 = 2030, X = v => L + (v - x0) / (x1 - x0) * (W - L - R);
  return `<svg class="cy" viewBox="0 0 ${W} ${H}">${EMPIRES.map(([n, a, b, c], i) => { const e = b || new Date().getFullYear(), y = 8 + (i % 2) * 26; return `<rect x="${X(a)}" y="${y}" width="${X(e) - X(a) - 1}" height="20" rx="4" fill="${c}" opacity=".85"><title>${n} ${a}–${b || '至今'}：約 ${e - a} 年</title></rect><text x="${(X(a) + X(e)) / 2}" y="${y + 14}" text-anchor="middle" class="emp-t">${n}</text>`; }).join('')}
    ${[1500, 1600, 1700, 1800, 1900, 2000].map(y => `<line x1="${X(y)}" x2="${X(y)}" y1="62" y2="66" class="tk"/><text x="${X(y)}" y="78" text-anchor="middle">${y}</text>`).join('')}</svg>`;
}
function empShare() {
  const W = 340, H = 220, L = 26, R = 6, T = 10, B = 22, ys = GDP_SH.years, x0 = 1500, x1 = 2030, X = v => L + (v - x0) / (x1 - x0) * (W - L - R), Y = v => T + (35 - v) / 35 * (H - T - B);
  return `<svg class="cy" viewBox="0 0 ${W} ${H}">
    ${[0, 10, 20, 30].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="${v ? 'gl' : 'z'}"/><text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${v}%</text>`).join('')}
    <rect x="${X(2025)}" y="${T}" width="${X(2030) - X(2025)}" height="${H - T - B}" class="fc"><title>IMF 預測</title></rect>
    ${GDP_SH.s.map(([n, c, v]) => `<path d="${v.map((x, i) => `${i ? 'L' : 'M'}${X(ys[i]).toFixed(1)},${Y(x).toFixed(1)}`).join('')}" stroke="${c}" class="sl2"/>${v.map((x, i) => `<circle cx="${X(ys[i])}" cy="${Y(x)}" r="2.6" fill="${c}"><title>${n} ${ys[i]}：${x}%</title></circle>`).join('')}<text x="${X(2030) + 1}" y="${Y(v[v.length - 1]) + 3}" class="ev" fill="${c}" text-anchor="end" dx="-6" dy="${n === '英國' ? 9 : n === '美國' ? -4 : 0}">${n}</text>`).join('')}
    ${[1500, 1600, 1700, 1800, 1900, 2000].map(y => `<text x="${X(y)}" y="${H - 6}" text-anchor="middle">${y}</text>`).join('')}
  </svg>`;
}
PAGES.empire = () => {
  const cur = new Date().getFullYear(), dur = EMPIRES.filter(e => e[2]).map(e => e[2] - e[1]), avg = Math.round(dur.reduce((a, b) => a + b, 0) / dur.length);
  const score = [['經濟規模（購買力平價，2025）', [14.6, 19.6, 14.0, 8.2], '%', 'IMF'], ['經濟規模（名目美元，2025）', [26.0, 16.6, 18.0, 3.3], '%', 'IMF'], ['2030 年預測（購買力平價）', [13.9, 20.4, 12.9, 9.7], '%', 'IMF'],
    ['全球外匯存底中的貨幣占比', [56.7, 2.1, 21.1, null], '%', 'IMF COFER'], ['軍費占全球（2025）', [33.0, 11.6, null, 3.2], '%', 'SIPRI']];
  const who = [['🇺🇸 美國', '#1e9e5a'], ['🇨🇳 中國', '#d64545'], ['🇪🇺 歐盟', '#3b82c4'], ['🇮🇳 印度', '#e8833a']];
  const card = score.map(([t, v, u, src]) => { const mx = Math.max(...v.filter(x => x != null)); return `<div class="emp-s"><div class="emp-sh">${t}<small>${src}</small></div>${who.map(([n, c], i) => `<div class="emp-r"><span>${n}</span><div class="emp-b"><i style="width:${v[i] == null ? 0 : Math.max(1, v[i] / mx * 100)}%;background:${c}"></i></div><b>${v[i] == null ? '—' : v[i] + u}</b></div>`).join('')}</div>`; }).join('');
  return `<h2>霸權輪替</h2>
    <p class="lead">「財富是流動的」這個說法有歷史根據，但時間點要修正一下：<b>15 世紀是葡萄牙</b>開啟大航海，<b>16 世紀是西班牙</b>（美洲白銀），<b>17 世紀是荷蘭</b>（不是英國），<b>19 世紀才是英國</b>，<b>20 世紀是美國</b>。以下用「誰的貨幣是世界貨幣」與「占全球經濟比重」兩把尺來看規律。</p>
    <div class="chips"><button class="chip" data-go="cycles">‹ 景氣循環</button></div>
    <div class="card"><h3 class="gold-bar">👑 世界儲備貨幣霸權（約 600 年）</h3>${empTimeline()}
      ${EMPIRES.map(([n, a, b, c, d]) => `<div class="emp-l"><i style="background:${c}"></i><b>${n}</b><span>${a}–${b || '至今'}（${(b || cur) - a} 年）</span><em>${d}</em></div>`).join('')}
      <div class="help">年份是學界常用的大致劃分（各家略有不同），以「哪一國的貨幣在國際貿易與儲備中居主導」為準。過去五個霸權平均維持約 <b>${avg} 年</b>；美國從 1920 年代算起已 ${cur - 1920} 年。</div></div>
    <div class="card"><h3 class="gold-bar">🌐 500 年來各國占全球 GDP 比重</h3>${empShare()}
      <div class="w-legend">${GDP_SH.s.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}<span class="help">右側淺色區＝IMF 預測</span></div>
      <div class="help">工業革命前，中國與印度靠人口占全球產出一半；英國在 1870 年前後達到頂峰，隨即被美國超越；美國在 1950 年占全球 27%。依購買力平價計算，中國約在 2016 年超過美國。1500–1973 為 Maddison 歷史估計，2000 年後為 IMF 數據，兩者口徑接近但不完全相同。</div></div>
    <div class="card"><h3 class="gold-bar">🔁 霸權興衰的固定順序</h3>
      <div class="emp-seq"><div><b>崛起</b>${['教育普及', '科技創新', '產業競爭力', '經濟產出', '全球貿易', '軍事實力', '金融中心', '儲備貨幣'].map((x, i) => `<span>${i + 1} ${x}</span>`).join('')}</div>
      <div><b>衰落</b>${['債務累積', '印鈔還債', '貧富差距', '內部分裂', '新強權崛起', '貨幣地位流失'].map((x, i) => `<span class="d">${i + 1} ${x}</span>`).join('')}</div></div>
      <div class="help">歷史規律（橋水基金達利歐《變化中的世界秩序》整理）：教育與創新最先起來，<b>儲備貨幣總是最後一個得到、也最後一個失去</b>。英國的經濟規模約 1872 年被美國超越，但英鎊直到 1920 年代才失去首位、1944 年布列敦森林會議才正式交棒，落後了 <b>50～70 年</b>。</div></div>
    <div class="card"><h3 class="gold-bar">⚖️ 現在的競爭者：四強計分卡</h3>${card}
      <div class="help">歐盟軍費未合併計算；印度盧比在外匯存底中的占比極小，IMF 未單獨列出。外匯存底占比：美元為 2026 年第 2 季，歐元、人民幣為 2025 年第 2 季；2000 年時美元占約 7 成。</div></div>
    <div class="card"><h3 class="gold-bar">🔮 推算：下一個霸權？</h3>
      <div class="emp-calc"><div><em>中國經濟規模超越美國（購買力平價）</em><b>約 2016 年</b></div><div><em>英國模式：產出被超越 → 貨幣交棒</em><b>50～70 年</b></div><div><em>若照英國的節奏</em><b>約 2066～2086 年</b></div></div>
      <ol class="cy-l">
        <li><b>中國</b>：製造業與經濟規模已具備，但人民幣只占外匯存底約 2%，資本管制、法治與資產可自由進出的信任度、人口快速老化，是成為「貨幣霸權」最大的障礙。依名目美元計算，美國（26%）仍明顯大於中國（17%）。</li>
        <li><b>印度</b>：人口最多、最年輕，IMF 預測占比持續上升（2030 年近 10%），但目前規模約為中國的四成，是更長期（本世紀後半）的候選。</li>
        <li><b>歐盟</b>：歐元是第二大儲備貨幣（約 21%），但政治與財政不統一，占比逐年下滑。</li>
        <li><b>最可能的近 10～20 年</b>：不是單一新霸權，而是「多極化」—美元仍是第一但比重緩慢下降，各國央行增持黃金（2022–2024 年連續三年每年買超 1,000 公噸），區域貨幣與數位支付分食部分角色。</li>
      </ol>
      <div class="help">歷史規律只能提供方向，不能精準預測時間點；過去的霸權交替幾乎都伴隨大型戰爭或金融危機，過程可能比推算更快或更慢。</div></div>
    <div class="card"><h3 class="gold-bar">💡 對投資的意涵</h3><ol class="cy-l">
      <li>資產不要只放單一貨幣：台幣、美元之外，可適度配置其他市場與貨幣的資產。</li>
      <li>黃金是「沒有發行國」的儲備資產，在霸權過渡期通常受惠；可參考「金屬・匯率」頁的金價因素。</li>
      <li>霸權交替是數十年的過程，對個人投資更重要的仍是景氣循環與估值；長期趨勢用來決定配置比例，不用來決定買賣時點。</li>
      <li>關注領先指標：外匯存底中的美元占比、各國央行買金量、美國財政赤字與利息支出、科技領先（AI、半導體）的歸屬。</li>
    </ol></div>
    <div class="help">資料：歷史 GDP 比重為 Angus Maddison《世界經濟千年史》估計；現代 GDP 與預測為 IMF 世界經濟展望（2026 年 10 月版）；外匯存底為 IMF COFER；軍費為斯德哥爾摩國際和平研究所（SIPRI）2026 年報告。</div>`;
};
if (typeof GROUPS !== 'undefined') GROUPS.market = [['timing', '進出場時機'], ['macro', '總經'], ['cycles', '景氣循環'], ['empire', '霸權輪替'], ['metfx', '金屬・匯率'], ['season', '季節性'], ['monitor', '監控'], ['overview', '研究總覽']];
if (current === 'cycles' || current === 'empire') render();
