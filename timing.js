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
  seaBusy = false; if (['season', 'timing', 'cycles'].includes(current)) { const y = scrollY; render(); scrollTo(0, y); }
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
  const mine = (S.metals || []).map(x => ({ x, m: metalVal(x) })), mv = mine.reduce((a, b) => a + b.m.v, 0), mc = mine.reduce((a, b) => a + (num(b.x.cost) || 0), 0);
  const myCard = `<div class="card"><div class="card-head"><h3 class="gold-bar">💰 我的貴金屬</h3><button class="btn-small" data-act="addMetal">＋ 記錄</button></div>
    ${mine.length ? mine.map(({ x, m }) => `<div class="arow" data-edit="metals" data-id="${x.id}"><span class="a-ic">${/白銀/.test(x.kind) ? '🥈' : '🥇'}</span><span class="a-t"><b>${esc(x.name)}</b><em>${fmt(m.g, 2)} 公克${x.where ? '｜' + esc(x.where) : ''}</em></span><span class="a-v">${fmt(m.v)}</span></div>`).join('') + `<div class="w-rates" style="margin-top:8px"><span>市值 <b>${fmt(mv)}</b></span>${mc ? `<span>成本 ${fmt(mc)}</span><span>損益 <b class="${mv >= mc ? 'up' : 'down'}">${mv >= mc ? '+' : ''}${fmt(mv - mc)}（${pct((mv / mc - 1) * 100)}）</b></span>` : ''}</div>`
      : '<div class="empty">黃金存摺、金條、金飾、白銀都可以記在這裡，會用即時國際金價換算市值並計入「資產」。黃金 ETF（例如 00635U、GLD）請用「買股票」記錄。</div>'}
    <div class="help">市值＝持有公克數 × 國際價格換算的每公克台幣；銀行黃金存摺的買回價通常再低 1～2%。</div></div>`;
  if (!g) return myCard + `<div class="card empty">${worldBusy ? '資料載入中…' : '還沒有資料，按「總經」頁右上角的更新。'}</div>`;
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
  return myCard + `<div class="card"><div class="card-head"><h3 class="gold-bar">🥇 黃金</h3><span class="sigp ${F.verdict[1]}">${F.verdict[0]}</span></div>
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
    <div class="card"><h3 class="gold-bar">📊 各國衰退統計</h3>${st}<div class="help">歐洲與日本沒有官方的衰退認定機構（歐元區有 CEPR 委員會），這裡統一用「實質 GDP 連續兩季下滑」認定，所以會比官方定義多出一些短而淺的技術性衰退。${(() => { const r = [...D.countries].filter(c => c.stats.perDecade != null).sort((a, b) => b.stats.perDecade - a.stats.perDecade); return r.length > 1 ? `以每 10 年的次數看，${r[0].name}最頻繁（${r[0].stats.perDecade} 次），${r[1].name}次之（${r[1].stats.perDecade} 次）；${r[r.length - 1].name}最少。` : ''; })()}</div></div>
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

/* ================= 週期研究：長週期（霸權）× 中週期（景氣）× 短週期（選舉與季節）整合 ================= */
const _seasonPage = PAGES.season, _empirePage = PAGES.empire;
const stripHead = h => h.replace(/^\s*<h2>[^<]*<\/h2>/, '').replace(/<div class="chips"><button class="chip" data-go="cycles">‹ 景氣循環<\/button><\/div>/, '');
const CYC_TABS = [['map', '🗺️ 總覽'], ['us', '🇺🇸 美國'], ['tw', '🇹🇼 台灣'], ['intl', '🌍 歐洲・日本'], ['season', '📅 選舉與季節'], ['empire', '👑 霸權輪替']];
let mapBusy = false;
async function loadMap() {
  if (mapBusy) return; mapBusy = true;
  for (const r of ['us', 'tw']) if (!S.cyc[r]) await loadCycles(false, r);
  if (!S.season['^GSPC']) await loadSeason('^GSPC', false);
  mapBusy = false; if (current === 'cycles' && (S.cycReg || 'map') === 'map') { const y = scrollY; render(); scrollTo(0, y); }
}
function scaleCard(o) {
  return `<div class="cm ${o.cls || ''}"><div class="cm-h"><span class="cm-tag">${o.tag}</span><b>${o.title}</b><em>${o.span}</em></div>
    <div class="cm-now">${o.now}</div>${o.bar || ''}
    <div class="cm-io"><div><i>📊</i><span>${o.data}</span></div><div><i>👉</i><span>${o.todo}</span></div></div>
    <button class="btn-small ghost" data-cycreg="${o.go}">看完整分析 ›</button></div>`;
}
function mapView() {
  setTimeout(loadMap, 30);
  const yr = new Date().getFullYear(), mo = new Date().getMonth(), U = S.cyc.us?.stats, T = S.cyc.tw?.stats, SD = S.season['^GSPC'];
  const usd = yr - 1920, avgEmp = 94;
  const long = scaleCard({ tag: '長週期', title: '霸權與貨幣', span: '數十年～百年', go: 'empire', cls: 'l',
    now: `美元當世界貨幣第 <b>${usd}</b> 年（過去五個霸權平均約 ${avgEmp} 年）`,
    bar: rangeBar(0, 150, usd, { label: `美元 ${usd} 年`, zones: [[80, 110, 'bad']], ticks: [[0, '0'], [avgEmp, `平均 ${avgEmp}`], [150, '150 年']] }),
    data: '中國經濟規模（購買力平價）約 2016 年已超過美國，但人民幣只占全球外匯存底約 2%，美元仍占 57%。',
    todo: '決定「資產配置比例」：不要只押單一貨幣，可配置一部分黃金與非美元資產；不用來決定買賣時點。' });
  const mid = scaleCard({ tag: '中週期', title: '景氣循環', span: '4～10 年', go: 'tw', cls: 'm',
    now: T && U ? `台灣擴張第 <b>${T.cur.months}</b> 個月（歷次平均 ${T.expPost}）・美國擴張第 <b>${U.cur.months}</b> 個月（戰後平均 ${U.expPost}）` : '資料載入中…',
    bar: T ? rangeBar(0, Math.max(100, T.maxExp + 4), Math.min(T.cur.months, 100), { label: `台灣 ${T.cur.months} 個月`, zones: [[T.expPost, Math.max(100, T.maxExp + 4), 'bad']], ticks: [[0, '0'], [T.expPost, `平均 ${T.expPost}`], [T.maxExp, `最長 ${T.maxExp}`]] }) : '',
    data: T && U ? `衰退時股市平均最大跌幅：台股 ${T.dd}%、美股 ${U.dd}%；股市多半比景氣谷底早幾個月見底，谷底後一年平均漲 ${T.after12}%（台股）。` : '',
    todo: '決定「股票放多少」：擴張已超過平均長度時不追高、守紀律；看到燈號轉藍、股市大跌時，反而是分批加碼的機會。' });
  let shortNow = '', shortBar = '', shortData = '';
  if (SD) {
    const m = SD.monthly.mid, cur = m[mo], best = m.map((x, i) => [i, x?.avg ?? -99]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0] + 1);
    shortNow = `${yr} 是${yr % 4 === 2 ? '<b>美國期中選舉年</b>' : yr % 4 === 0 ? '美國大選年' : yr % 4 === 1 ? '美國大選隔年' : '美國大選前一年'}，現在 ${mo + 1} 月（期中年歷史平均 ${pc(cur?.avg, 1)}%、上漲率 ${cur?.win ?? '—'}%）`;
    shortBar = `<div class="cm-mo">${m.map((x, i) => `<span class="${i === mo ? 'on' : ''} ${x?.avg >= 1 ? 'g' : x?.avg < 0 ? 'r' : ''}" title="${i + 1} 月 平均 ${x?.avg}%"><i style="height:${Math.min(100, Math.abs(x?.avg || 0) / 3.5 * 100)}%"></i><em>${i + 1}</em></span>`).join('')}</div>`;
    shortData = `期中選舉年最強的月份是 ${best.join('、')} 月；9 月底進場持有一年，歷史上 ${SD.midFwd.filter(x => x.r > 0).length}/${SD.midFwd.length} 次上漲，平均 ${pc(SD.midFwd.reduce((a, b) => a + b.r, 0) / SD.midFwd.length)}%。`;
  }
  const short = scaleCard({ tag: '短週期', title: '選舉與季節', span: '1 年內', go: 'season', cls: 's', now: shortNow || '資料載入中…', bar: shortBar, data: shortData,
    todo: '決定「進場節奏」：在歷史上偏弱的月份分批、偏強的月份不追；權重最低，只當背景風向。' });
  return `<div class="card cm-intro"><b>三種週期，各管一件事</b><div class="cm-flow"><span><i class="l"></i>長週期 → 配置比例</span><span><i class="m"></i>中週期 → 股票多寡</span><span><i class="s"></i>短週期 → 進場節奏</span></div>
      <div class="help">週期越長，影響越大但越慢；越短，越容易被雜訊干擾。判斷時從長到短，三者方向一致時最有把握。實際買賣請搭配「進出場時機」頁。</div></div>
    ${long}${mid}${short}
    <div class="card"><h3 class="gold-bar">🧭 一句話總結</h3><div class="tm-ph">${T && U ? `長期：美元霸權仍在但緩慢鬆動 → 分散配置、留一點黃金。中期：台灣與美國都在擴張後段（${T.cur.months > T.expPost ? '台灣已超過平均長度' : '台灣仍在平均長度內'}）→ 持有但不追高，準備好現金等下一次衰退。短期：${yr % 4 === 2 ? '期中選舉年第四季歷史上偏強' : '依季節性安排分批節奏'}。` : '資料載入中…'}</div><button class="btn-small" data-go="timing">到「進出場時機」看我的持股該怎麼做 ›</button></div>`;
}
PAGES.cycles = () => {
  const reg = S.cycReg || 'map';
  const tabs = `<div class="chips cyc-tabs">${CYC_TABS.map(([k, l]) => `<button class="chip ${k === reg ? 'on' : ''}" data-cycreg="${k}">${l}</button>`).join('')}</div>`;
  const head = `<h2>週期研究</h2>`;
  if (reg === 'map') return head + `<p class="lead">市場同時受三種週期影響：百年一次的<b>霸權更替</b>、幾年一次的<b>景氣循環</b>、每年重複的<b>選舉與季節</b>。這頁把它們放在一起，告訴你現在各在哪個位置、該怎麼用。</p>` + tabs + mapView();
  if (reg === 'season') return head + tabs + stripHead(_seasonPage());
  if (reg === 'empire') return head + tabs + stripHead(_empirePage());
  setTimeout(() => loadCycles(false, reg), 30);
  const C = S.cyc[reg];
  const lead = { us: '美國自 1920 年以來共經歷 18 次衰退與 18 段擴張（依美國國家經濟研究局 NBER 認定）。', tw: '台灣自 1954 年以來共經歷 15 次完整景氣循環，現在處於第 16 次循環的擴張期（依國家發展委員會認定）。', intl: '英國、德國、法國、歐元區、日本的衰退（以實質 GDP 連續兩季下滑認定），並與美國、台灣放在同一條時間軸比較。' }[reg];
  return head + `<p class="lead">${lead}</p>` + tabs + (!C ? `<div class="card empty">${cycBusy ? '計算中…（約 10～20 秒）' : '讀取中…'}</div>` : reg === 'intl' ? intlView(C) : cycView(C));
};
// 舊入口（季節性、霸權輪替）導向週期研究的分頁
const _goCyc = go;
go = function (page) { if (page === 'season' || page === 'empire') { S.cycReg = page; page = 'cycles'; } return _goCyc(page); };
if (typeof GROUPS !== 'undefined') GROUPS.market = [['timing', '進出場時機'], ['macro', '總經'], ['cycles', '週期研究'], ['metfx', '黃金・匯率'], ['monitor', '監控'], ['overview', '研究總覽']];
if (['cycles', 'season', 'empire'].includes(current)) go(current);

/* ================= 極端訊號：冰水區（左側逆勢）／滾水區（右側順勢） =================
   概念參考「投資癮的非常態投資學｜5% 極端訊號」課程公開簡介：市場約 5% 的時間處在極端行情，
   超跌＝冰水區、暴漲＝滾水區。以下指標、門檻與做法為本工具自行設計（課程 2026/10/19 開課，內容未納入）。 */
const EXT_SYMS = [['^TWII', '台股加權'], ['^GSPC', '標普 500'], ['^IXIC', '那斯達克'], ['^SOX', '費半']];
const EXT_Z = {
  ice: { n: '冰水區', ic: '🧊', c: 'ice', side: '左側逆勢', one: '歷史最冷的 5%：恐慌拋售，長線分批承接的機會' },
  cold: { n: '偏冷', ic: '❄️', c: 'cold', side: '留意', one: '比平常冷，接近極端區，準備好資金與清單' },
  mid: { n: '常溫', ic: '🌤️', c: 'mid', side: '照計畫', one: '約 60% 的時間在這裡：照原本的配置與定期定額' },
  hot: { n: '偏熱', ic: '🔥', c: 'hot', side: '留意', one: '比平常熱，新資金放慢、檢查停利線' },
  boil: { n: '滾水區', ic: '♨️', c: 'boil', side: '右側順勢', one: '歷史最熱的 5%：趨勢極強，抱住部位但用移動停利保護' },
};
S.ext = S.ext || {};
let extBusy = {};
async function loadExtreme(sym, force) {
  if (extBusy[sym] || !location.protocol.startsWith('http')) return;
  const c = S.ext[sym]; if (!force && c && Date.now() - (c.at || 0) < 6 * 3600e3) return;
  extBusy[sym] = 1; if (current === 'extreme') render();
  try { const j = await (await fetch('api/extreme?sym=' + encodeURIComponent(sym), { signal: AbortSignal.timeout(60000) })).json(); if (j.error) throw new Error(j.error); j.at = Date.now(); S.ext[sym] = j; save(); }
  catch (e) { if (current === 'extreme') toast('極端訊號讀取失敗：' + e.message); }
  delete extBusy[sym]; if (['extreme', 'timing'].includes(current)) { const y = scrollY; render(); scrollTo(0, y); }
}
// 溫度計：0～100，兩端 5% 為極端區
function extThermo(t, small) {
  const z = t == null ? null : t <= 5 ? 'ice' : t <= 20 ? 'cold' : t < 80 ? 'mid' : t < 95 ? 'hot' : 'boil';
  return `<div class="ex-th ${small ? 'sm' : ''}"><div class="ex-tr"><i class="ice" style="width:5%"></i><i class="cold" style="width:15%"></i><i class="mid" style="width:60%"></i><i class="hot" style="width:15%"></i><i class="boil" style="width:5%"></i>
    ${t != null ? `<b class="ex-dot ${z}" style="left:${Math.max(1, Math.min(99, t))}%">${small ? '' : `<span>${fmt(t, 0)}</span>`}</b>` : ''}</div>
    ${small ? '' : '<div class="ex-ax"><span>🧊 冰水 5</span><span style="left:20%">20</span><span style="left:50%">常溫</span><span style="left:80%">80</span><span style="left:100%">滾水 95 ♨️</span></div>'}</div>`;
}
// 指標條：歷史 5%／中位數／95% 刻度＋目前位置
function extMetric(m) {
  const X = v => Math.max(0, Math.min(100, (v - m.lo) / (m.hi - m.lo || 1) * 100));
  const z = m.pct <= 5 ? 'ice' : m.pct >= 95 ? 'boil' : m.pct <= 20 ? 'cold' : m.pct >= 80 ? 'hot' : 'mid';
  const u = m.unit, f = v => `${v > 0 && u ? '+' : ''}${v}${u}`;
  return `<div class="ex-m"><div class="ex-mh"><span>${esc(m.name)}</span><b class="${z}">${f(m.v)}</b><em>歷史第 ${fmt(m.pct, 0)} 百分位</em></div>
    <div class="ex-mb"><i class="z ice" style="left:0;width:${X(m.p5)}%"></i><i class="z boil" style="left:${X(m.p95)}%;width:${100 - X(m.p95)}%"></i><i class="tk" style="left:${X(m.p50)}%"></i><b class="${z}" style="left:${X(m.v)}%"></b></div>
    <div class="ex-ma"><span>最低 ${f(m.lo)}</span><span>冰水線 ${f(m.p5)}・中位 ${f(m.p50)}・滾水線 ${f(m.p95)}</span><span>最高 ${f(m.hi)}</span></div></div>`;
}
function extHist(d) {
  const h = d.hist || []; if (h.length < 10) return '';
  const W = 340, H = 110, L = 22, R = 4, T = 6, B = 16, X = i => L + i * (W - L - R) / (h.length - 1), Y = v => T + (100 - v) * (H - T - B) / 100;
  const yr = +d.histStart.slice(0, 4), m0 = +d.histStart.slice(5, 7);
  const ticks = []; for (let k = 0; k < h.length; k++) { const mo = (m0 - 1 + Math.round(k * 5 / 21)) % 12; if (k && mo === 0 && !ticks.some(t => Math.abs(t - k) < 8)) ticks.push(k); }
  return `<svg class="ex-hs" viewBox="0 0 ${W} ${H}"><rect x="${L}" y="${Y(100)}" width="${W - L - R}" height="${Y(95) - Y(100)}" class="boil"/><rect x="${L}" y="${Y(5)}" width="${W - L - R}" height="${Y(0) - Y(5)}" class="ice"/>
    ${[5, 50, 95].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 3}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
    <path d="${h.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}"/>
    ${h.map((v, i) => v <= 5 || v >= 95 ? `<circle cx="${X(i)}" cy="${Y(v)}" r="2.2" class="${v <= 5 ? 'ice' : 'boil'}"/>` : '').join('')}
    ${ticks.map(k => `<text x="${X(k)}" y="${H - 3}" text-anchor="middle">${yr + Math.floor((m0 - 1 + k * 5 / 21) / 12)}</text>`).join('')}</svg>`;
}
const EXT_PLAY = `<div class="ex-play"><div class="ex-pc ice"><b>🧊 冰水區：左側逆勢</b><ul>
    <li><b>先確認是「市場」冷，不是公司壞掉</b>：優先用大盤 ETF 承接；個股要回研究卡確認論點沒被推翻。</li>
    <li><b>事先切好子彈</b>：把預備金分 3～4 批，例如進入冰水區買第 1 批，之後每再跌 7～10% 或每隔 2～3 週再買 1 批。</li>
    <li><b>只用閒錢、不開槓桿</b>：冰水區常常更冷（下表「進入後再跌」），要撐得過再跌 15～20%。</li>
    <li><b>出場看時間與結構</b>：溫度回到常溫、站回季線後，依原本的配置比例再平衡。</li></ul></div>
  <div class="ex-pc boil"><b>♨️ 滾水區：右側順勢</b><ul>
    <li><b>不急著放空、不急著全賣</b>：極熱常常更熱，歷史上滾水區之後 3 個月多半仍上漲。</li>
    <li><b>用移動停利保護</b>：例如跌破月線（20 日線）或從高點回落 8～10% 才分批出場。</li>
    <li><b>新資金放慢</b>：定期定額照扣，但不單筆追高；超出配置上限的部位先再平衡。</li>
    <li><b>不加槓桿</b>：滾水區的波動也大，留現金給下一次冰水區。</li></ul></div></div>
  <div class="help">「左側」＝在下跌趨勢還沒結束前分批買（買在恐慌）；「右側」＝趨勢確立後跟隨（不預測頂部）。兩者都靠事先寫好的規則，而不是當下的情緒。</div>`;
const extZoneOf = d => d ? EXT_Z[d.zone] : null;
PAGES.extreme = () => {
  const sym = S.extSym || '^TWII', d = S.ext[sym]; setTimeout(() => loadExtreme(sym, false), 30);
  const head = `<h2>極端訊號</h2><p class="lead">市場大約只有 <b>5% 的時間</b>處在極端行情：<b>冰水區</b>（恐慌超跌）和<b>滾水區</b>（狂熱暴漲）。這頁把今天放進數十年的歷史分布（台股約 1997 年、美股 1988 年起），告訴你現在多冷、多熱，以及過去在同樣溫度時，之後通常怎麼走。</p>
    <div class="chips">${EXT_SYMS.map(([k, l]) => `<button class="chip ${k === sym ? 'on' : ''}" data-extsym="${k}">${l}${S.ext[k] ? ` ${EXT_Z[S.ext[k].zone].ic}` : ''}</button>`).join('')}</div>`;
  if (!d) return head + `<div class="card empty">${extBusy[sym] ? '計算中…（第一次約 5～10 秒）' : '讀取中…'}</div>`;
  const Z = extZoneOf(d), F = d.fwd, hz = F.all.map(x => x.h);
  const row = (k, l) => `<div class="gt-r ${d.zone === k ? 'hl' : ''}"><span>${l}</span>${F[k].map((x, i) => `<span style="${heat(x.avg - (F.all[i].avg || 0), 4)}">${x.avg == null ? '—' : pc(x.avg)}%<small>${x.win ?? '—'}%</small></span>`).join('')}</div>`;
  const ep = (list, k) => list.length ? list.map(e => `<div class="ex-ep ${k}"><b>${esc(e.d)}</b><span>${e.ongoing ? '<i class="pill gold">進行中</i>' : `${e.days} 天`}</span><span>${k === 'ice' ? '之後再跌' : '之後再漲'} <em class="${k === 'ice' ? 'down' : 'up'}">${pc(e.further)}%</em></span><span>3 個月 <em class="${e.m3 >= 0 ? 'up' : 'down'}">${e.m3 == null ? '—' : pc(e.m3) + '%'}</em></span><span>1 年 <em class="${e.m12 >= 0 ? 'up' : 'down'}">${e.m12 == null ? '—' : pc(e.m12) + '%'}</em></span></div>`).join('') : '<div class="empty">期間內沒有</div>';
  return head + `<div class="card ex-now ${Z.c}"><div class="ex-big"><i>${Z.ic}</i><div><b>${esc(d.name)}：${Z.n}</b><span>綜合溫度 ${fmt(d.temp, 0)}／100・已持續 ${d.daysIn} 個交易日・${esc(Z.side)}</span></div></div>
      ${extThermo(d.temp)}<div class="tm-ph">${esc(Z.one)}</div>
      <div class="help">綜合溫度＝下面四個指標在歷史上的百分位平均，再換算成歷史排名。≤5＝冰水區、≥95＝滾水區（各約占歷史 5% 的交易日）。收盤 ${fmt(d.price, 0)}（${esc(d.lastDate)}）。</div></div>
    <div class="card"><h3 class="gold-bar">📏 四個溫度計</h3>${d.metrics.map(extMetric).join('')}
      ${d.vix ? `<div class="ex-m"><div class="ex-mh"><span>VIX 恐慌指數（美股）</span><b class="${d.vix.pct >= 95 ? 'ice' : d.vix.pct <= 5 ? 'boil' : 'mid'}">${d.vix.v}</b><em>歷史第 ${fmt(d.vix.pct, 0)} 百分位</em></div><div class="help">VIX 越高＝越恐慌（和股價溫度相反）。歷史中位數 ${d.vix.p50}，高於 ${d.vix.p95} 屬極度恐慌、低於 ${d.vix.p5} 屬極度安逸。</div></div>` : ''}
      <div class="help">藍色區＝歷史最低 5%（冰水線以下）、紅色區＝最高 5%（滾水線以上），直線＝中位數。</div></div>
    <div class="card"><h3 class="gold-bar">📈 近兩年溫度</h3>${extHist(d)}<div class="help">每點＝一週。藍點進入冰水區、紅點進入滾水區。</div></div>
    <div class="card"><h3 class="gold-bar">🔁 歷史上，處在各溫度之後的報酬</h3>${gtable(['溫度', ...hz], [row('ice', '🧊 冰水'), row('cold', '❄️ 偏冷'), row('all', '全部日子'), row('hot', '🔥 偏熱'), row('boil', '♨️ 滾水')], 'ex-fw')}
      <div class="help">每格＝平均報酬，小字＝上漲機率。顏色比較的是「比全部日子好或差」。${esc(d.name)}自 ${esc(d.since.slice(0, 4))} 年起算。過去的統計不保證未來，樣本也會集中在少數幾次大事件。</div></div>
    <div class="card"><h3 class="gold-bar">🧊 歷次冰水區</h3>${ep(d.episodes.ice, 'ice')}<div class="help">「之後再跌」＝進入冰水區後一年內最多再跌多少：提醒你冰水區常常還會更冷，所以要分批。</div></div>
    <div class="card"><h3 class="gold-bar">♨️ 歷次滾水區</h3>${ep(d.episodes.boil, 'boil')}</div>
    <div class="card"><h3 class="gold-bar">🧭 遇到極端行情怎麼做</h3>${EXT_PLAY}</div>
    <div class="help">概念參考投資癮 Wade「非常態投資學｜5% 極端訊號」課程公開簡介；指標、門檻、做法為本工具自行設計，不是課程內容，也不是投資建議。資料：${esc(d.src)}。</div>`;
};
document.addEventListener('click', e => { const t = e.target.closest('[data-extsym]'); if (t) { S.extSym = t.dataset.extsym; save(); render(); } });
// 進出場時機頁：加一張極端訊號摘要
const _tmExt = PAGES.timing;
PAGES.timing = () => {
  setTimeout(() => { loadExtreme('^TWII', false); loadExtreme('^GSPC', false); }, 60);
  const card = `<div class="card"><h3 class="gold-bar">②-1 極端訊號（市場是否進入冰水區／滾水區）</h3>
    ${[['^TWII', '🇹🇼 台股'], ['^GSPC', '🇺🇸 美股']].map(([s, l]) => { const d = S.ext[s], Z = extZoneOf(d); return `<div class="ex-mini" data-extgo="${s}"><span>${l}</span>${extThermo(d?.temp, true)}<b class="${Z?.c || ''}">${Z ? `${Z.ic} ${Z.n} ${fmt(d.temp, 0)}` : '讀取中'}</b></div>`; }).join('')}
    <div class="help">平常（常溫）照計畫；只有進入兩端 5% 的極端區才改變做法：冰水區分批逆勢承接、滾水區順勢抱住並用移動停利。</div><button class="btn-small ghost" data-go="extreme">看完整極端訊號 ›</button></div>`;
  const h = _tmExt(), at = h.indexOf('<div class="card"><h3 class="gold-bar">③');
  const at2 = at >= 0 ? at : h.indexOf('<div class="card"><h3 class="gold-bar">④');
  return at2 >= 0 ? h.slice(0, at2) + card + h.slice(at2) : h + card;
};
document.addEventListener('click', e => { const t = e.target.closest('[data-extgo]'); if (t) { S.extSym = t.dataset.extgo; save(); go('extreme'); } });
if (typeof GROUPS !== 'undefined') GROUPS.market = [['timing', '進出場時機'], ['extreme', '極端訊號'], ['macro', '總經'], ['cycles', '週期研究'], ['metfx', '黃金・匯率'], ['monitor', '監控'], ['overview', '研究總覽']];
if (['extreme', 'timing'].includes(current)) render();

/* ================= 四層整合：週期 → 溫度 → 標的 → 監控 =================
   週期決定「股票放多少」、極端溫度決定「現在用哪種模式」、個股訊號決定「買賣哪一檔」、監控負責「條件到了提醒我」。 */
const MODE = {
  ice: { n: '逆勢承接模式', c: 'ice', ic: '🧊', short: '分批承接，不追殺' },
  cold: { n: '準備模式', c: 'cold', ic: '❄️', short: '列好清單、備好子彈' },
  mid: { n: '照計畫模式', c: 'mid', ic: '🌤️', short: '照配置與定期定額' },
  hot: { n: '放慢模式', c: 'hot', ic: '🔥', short: '新資金放慢，檢查停利線' },
  boil: { n: '順勢保護模式', c: 'boil', ic: '♨️', short: '抱住部位，移動停利' },
};
const EXT_OF = { tw: '^TWII', us: '^GSPC' };
const zoneOfMkt = id => S.ext[EXT_OF[id]]?.zone || null;
// 景氣階段 × 溫度 → 一句結論
function verdict(id) {
  const P = phaseOf(id)?.ph, z = zoneOfMkt(id), d = S.ext[EXT_OF[id]];
  if (!z) return null;
  const M = MODE[z]; let t;
  if (z === 'ice') t = P === '收縮' || P === '趨緩' ? '景氣偏弱又恐慌超跌：長線最好的承接區之一，但可能還會更冷，預備金分 3～4 批、拉長時間買。' : '景氣還不差卻恐慌超跌：常是錯殺，優先用大盤 ETF 分批承接。';
  else if (z === 'boil') t = P === '趨緩' || P === '收縮' ? '景氣已轉弱但股市極熱：最該保護獲利——超出配置上限的先減碼，其餘設移動停利。' : '景氣擴張加上極熱行情：趨勢可能延續，持股續抱、設移動停利，新資金不追高。';
  else if (z === 'hot') t = '偏熱但還不極端：定期定額照扣，單筆放慢，先把停利線寫好。';
  else if (z === 'cold') t = '偏冷、接近冰水區：準備好要買的清單與分批計畫，等進入冰水區或止跌再動。';
  else t = P === '收縮' ? '景氣收縮但市場還沒恐慌：保守、保留現金，等冰水區或領先指標回升。' : P === '趨緩' ? '景氣趨緩、市場常溫：不加碼高本益比股，逐步轉向防禦與債券。' : '常溫：照原本的配置比例與定期定額，不用特別做什麼。';
  return { P, z, M, t, temp: d.temp };
}
// 個股判斷加上「大盤模式」
const _assetCheck0 = assetCheck;
assetCheck = function (c) {
  const r = _assetCheck0(c), id = c.market === '美股' ? 'us' : 'tw', z = zoneOfMkt(id);
  if (!z || r.st[0] === '資料不足') return r;
  r.why.unshift([`大盤${EXT_Z[z].n}`, z === 'ice' ? 'pos' : z === 'boil' ? 'neg' : z === 'cold' ? 'pos' : z === 'hot' ? 'neg' : 'neu']);
  const etf = /^00\d/.test(r.code) || /ETF/i.test(c.name || '');
  if (z === 'boil' && r.h && r.pl > 0 && r.st[1] !== 'neg') r.st = ['續抱＋移動停利', 'gold', '大盤在滾水區：不加碼；跌破月線或從高點回落 8～10% 時分批停利，其餘續抱'];
  else if (z === 'boil' && !r.h && r.st[1] === 'pos') r.st = ['等回檔再買', 'gold', '個股條件不錯，但大盤在滾水區：設價格提醒，等回到月線或大盤降溫再分批'];
  else if (z === 'ice' && r.st[1] !== 'neg' && (etf || (r.why.find(w => /估值空間/.test(w[0]))?.[1] === 'pos'))) r.st = ['冰水區分批承接', 'pos', '大盤恐慌超跌、標的估值有空間：預備金分 3～4 批，每再跌 7～10% 或隔 2～3 週買一批'];
  else if (z === 'ice' && r.st[1] === 'neg') r.st[2] += '；大盤在冰水區：先確認是公司出問題還是市場錯殺，錯殺不急著停損';
  return r;
};
// 依目前判斷，建議要監控的條件
function suggestMon(x) {
  const t = `${x.code} ${x.c.name || ''}`.trim(), base = { target: t, code: x.code, notify: '網站內提醒', status: '啟用' };
  if (x.h && /停利|移動停利/.test(x.st[0])) return { ...base, metric: '距 20 日均線 %', op: '低於', value: '0', cond: '跌破月線（20 日均線）', action: '移動停利：先賣 1/3～1/2，其餘跌破季線再賣' };
  if (x.h && /停損/.test(x.st[0])) return { ...base, metric: '近 20 日漲跌 %', op: '低於', value: '-10', cond: '近 20 日跌超過 10%', action: '對照研究卡「證明我錯」條件，決定減碼或出場' };
  if (x.h) return { ...base, metric: '距 60 日均線 %', op: '低於', value: '-3', cond: '跌破季線 3% 以上', action: '停損檢查：基本面沒變就續抱，論點被推翻就出場' };
  if (/等回檔|好價/.test(x.st[0])) return { ...base, metric: 'RSI', op: '低於', value: '50', cond: 'RSI 降到 50 以下（降溫）', action: '回到研究卡確認估值，分 2～3 批買進' };
  if (/等趨勢/.test(x.st[0])) return { ...base, metric: '距 60 日均線 %', op: '高於', value: '0', cond: '站回季線', action: '趨勢轉強：分批買進第一批' };
  if (/承接/.test(x.st[0])) return { ...base, metric: 'RSI', op: '低於', value: '30', cond: 'RSI 跌破 30（超賣）', action: '冰水區分批：買下一批' };
  return { ...base, metric: '距 20 日均線 %', op: '高於', value: '10', cond: '離月線 10% 以上（短線過熱）', action: '不追高，等回檔' };
}
const hasMon = (m) => S.monitors.some(y => y.status !== '已觸發' && y.code === m.code && y.metric === m.metric && y.op === m.op);
// 系統自動監控：大盤溫度區、景氣階段改變時提醒
function sysWatch() {
  S.sysWatch = S.sysWatch || {}; const msgs = [];
  for (const id of ['tw', 'us']) {
    const z = zoneOfMkt(id), p = phaseOf(id)?.ph, nm = id === 'tw' ? '台股' : '美股', w = S.sysWatch[id] || {};
    if (z && w.z && z !== w.z && (['ice', 'boil'].includes(z) || ['ice', 'boil'].includes(w.z))) msgs.push(`${nm}溫度：${EXT_Z[w.z].n} → ${EXT_Z[z].n}（切換為「${MODE[z].n}」）`);
    if (p && w.p && p !== w.p) msgs.push(`${nm}景氣階段：${w.p} → ${p}`);
    S.sysWatch[id] = { z: z || w.z, p: p || w.p };
  }
  if (msgs.length) {
    S.monAlerts = [...(S.monAlerts || []), ...msgs]; save();
    if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.getRegistration().then(reg => { const o = { body: msgs.join('\n'), icon: 'icons/icon-192.png' }; reg ? reg.showNotification('市場狀態改變', o) : new Notification('市場狀態改變', o); }).catch(() => {});
  } else save();
}
PAGES.timing = () => {
  setTimeout(() => { loadWorld(false); loadSeason('^GSPC', false); loadExtreme('^TWII', false); loadExtreme('^GSPC', false); if (typeof refreshHoldQuotes === 'function') refreshHoldQuotes(false); sysWatch(); }, 30);
  const ecos = ['tw', 'us', 'cn', 'jp', 'eu', 'hk', 'kr'].map(id => ({ id, e: ECON.find(x => x.id === id), P: phaseOf(id), m: mktTemp(idxOf(id)), m0: idxOf(id) }));
  const V = { tw: verdict('tw'), us: verdict('us') }, yr = new Date().getFullYear(), mo = new Date().getMonth();
  // 0. 今天的結論
  const top = `<div class="card dc-top"><h3 class="gold-bar">🧭 今天的結論</h3>
    ${[['tw', '🇹🇼 台股'], ['us', '🇺🇸 美股']].map(([id, l]) => { const v = V[id], P = phaseOf(id); return `<div class="dc-v ${v?.M.c || ''}"><div class="dc-vh"><b>${l}</b>${P ? `<i class="sigp ${PHASE[P.ph].c}">景氣${P.ph}</i>` : ''}${v ? `<i class="dc-z ${v.z}">${EXT_Z[v.z].ic} ${EXT_Z[v.z].n} ${fmt(v.temp, 0)}</i>` : ''}</div>
      ${v ? `<div class="dc-mode">${v.M.ic} <b>${v.M.n}</b>：${esc(v.M.short)}</div><div class="dc-t">${esc(v.t)}</div>` : '<div class="help">讀取中…</div>'}</div>`; }).join('')}
    <div class="dc-flow"><span>① 週期<em>放多少</em></span><span>② 溫度<em>用哪種模式</em></span><span>③ 標的<em>買賣哪檔</em></span><span>④ 監控<em>到了提醒我</em></span></div></div>`;
  // ① 週期
  const P1 = [phaseOf('tw'), phaseOf('us')], sd = S.season['^GSPC'], sm = sd?.monthly?.mid;
  const cyc = `<div class="card"><h3 class="gold-bar">① 週期：決定股票放多少</h3>
    <div class="dc-rows">
      <div><span class="dc-k l">長週期</span><div>美元當世界貨幣第 <b>${yr - 1920}</b> 年（歷代平均約 94 年）→ 不必恐慌，但配置要分散：海外資產、黃金各留一點。</div></div>
      <div><span class="dc-k m">中週期</span><div>${[['🇹🇼 台灣', P1[0]], ['🇺🇸 美國', P1[1]]].filter(x => x[1]).map(([l, p]) => `${l}景氣<b>${p.ph}</b>：${esc(PHASE[p.ph].stock)}`).join('<br>') || '總經資料載入中…'}</div></div>
      <div><span class="dc-k s">短週期</span><div>${sm ? `${yr % 4 === 2 ? '美國期中選舉年' : '季節性'}：${mo + 1} 月歷史平均 <b>${pc(sm[mo]?.avg, 1)}%</b>、${(mo + 1) % 12 + 1} 月 <b>${pc(sm[(mo + 1) % 12]?.avg, 1)}%</b> → 只用來安排分批節奏。` : '季節性資料載入中…'}</div></div>
    </div>
    <div class="tm-clock">${Object.entries(PHASE).map(([k, v]) => `<div class="tm-q ${P1.some(p => p?.ph === k) ? 'on' : ''}"><b>${v.ic} ${k}</b>${P1[0]?.ph === k ? '<span class="pill">🇹🇼</span>' : ''}${P1[1]?.ph === k ? '<span class="pill">🇺🇸</span>' : ''}<em>${v.stock}</em></div>`).join('')}</div>
    <button class="btn-small ghost" data-go="cycles">看週期研究 ›</button></div>`;
  // ② 溫度
  const tmp = `<div class="card"><h3 class="gold-bar">② 溫度：決定現在用哪種模式</h3>
    ${[['^TWII', '🇹🇼 台股'], ['^GSPC', '🇺🇸 美股']].map(([s, l]) => { const d = S.ext[s], Z = d ? EXT_Z[d.zone] : null; return `<div class="ex-mini" data-extgo="${s}"><span>${l}</span>${extThermo(d?.temp, true)}<b class="${Z?.c || ''}">${Z ? `${Z.ic} ${Z.n} ${fmt(d.temp, 0)}` : '讀取中'}</b></div>`; }).join('')}
    <div class="dc-modes">${Object.entries(MODE).map(([k, m]) => `<span class="${k} ${[zoneOfMkt('tw'), zoneOfMkt('us')].includes(k) ? 'on' : ''}">${m.ic} ${m.n.replace('模式', '')}<em>${m.short}</em></span>`).join('')}</div>
    <div class="help">約 90% 的時間在中間三格，照計畫就好；只有進入兩端 5% 的極端區才換做法。</div>
    <details class="rc-sub"><summary>其他市場的短線溫度</summary>${gtable(['市場', '景氣', '溫度', '離季線', 'RSI'], ecos.filter(x => x.m).map(x => `<div class="gt-r click" data-wtab-go="${x.id}"><span>${x.e.flag} ${esc(x.m0.name)}</span><span>${x.P ? `<i class="sigp ${PHASE[x.P.ph].c}">${x.P.ph}</i>` : '—'}</span><span><i class="sigp ${x.m.t[1]}">${x.m.t[0]}</i></span><span style="${heat(-x.m.bias, 6)}">${pc(x.m.bias)}%</span><span>${x.m.rsi == null ? '—' : fmt(x.m.rsi, 0)}</span></div>`), 'ov')}<div class="help">這裡用近 60 日資料粗估：RSI ≥ 70 或高於均線 6% 為偏熱。</div></details>
    <button class="btn-small ghost" data-go="extreme">看完整極端訊號 ›</button></div>`;
  // ③ 標的
  const mine = S.cards.filter(c => c.code && !c.example).map(assetCheck).sort((a, b) => (!!b.h - !!a.h) || ['neg', 'gold', 'pos', 'neu', ''].indexOf(a.st[1]) - ['neg', 'gold', 'pos', 'neu', ''].indexOf(b.st[1]));
  const need = mine.filter(x => x.st[0] !== '資料不足').map(suggestMon).filter(m => !hasMon(m));
  const lst = `<div class="card"><h3 class="gold-bar">③ 標的：買賣哪一檔、什麼價位</h3>
    ${mine.length ? mine.map(x => { const sm = x.st[0] !== '資料不足' ? suggestMon(x) : null, on = sm && hasMon(sm); return `<div class="tm-a ${x.st[1]}" data-card="${x.c.id}" data-go-card="1"><div class="tm-ah"><b>${esc(x.code)} ${esc(x.c.name || '')}</b>${x.h ? '<span class="pill green">持有</span>' : ''}<span class="tm-st ${x.st[1]}">${x.st[0]}</span></div>
      <div class="tm-why">${x.why.map(([t, cl]) => `<i class="sigp ${cl}">${esc(t)}</i>`).join('')}</div><div class="tm-do">${esc(x.st[2])}</div>
      ${sm ? `<button class="dc-mon ${on ? 'on' : ''}" data-mkmon="${esc(x.code)}">${on ? '🔔 已監控' : '🔔 設監控'}：${esc(sm.cond)}</button>` : ''}</div>`; }).join('')
      : '<div class="empty">還沒有研究卡。持股會自動建立研究卡；也可以從「選股雷達」挑標的建卡。</div>'}
    <div class="help">判斷順序：景氣階段 → 大盤溫度（模式）→ 個股估值空間 → 趨勢（季線）→ 短線熱度。</div></div>`;
  // ④ 監控
  const act = S.monitors.filter(m => m.status === '啟用'), auto = act.filter(m => m.code && m.metric), hit = S.monitors.filter(m => m.status === '已觸發').slice(-3);
  const mon = `<div class="card"><h3 class="gold-bar">④ 監控：條件到了提醒我</h3>
    <div class="w-rates"><span>啟用中 <b>${act.length}</b> 條</span><span>自動檢查 <b>${auto.length}</b> 條</span><span>已觸發 <b>${S.monitors.filter(m => m.status === '已觸發').length}</b> 條</span></div>
    <div class="dc-sys"><b>系統自動盯著</b><span>🌡️ 台股、美股進出冰水區／滾水區</span><span>🔄 台灣、美國景氣階段改變</span><div class="help">每次打開網站時檢查，有變化會出現在首頁提醒（有開手機通知也會跳通知）。</div></div>
    ${hit.length ? `<div class="help">最近觸發：${hit.map(m => esc(`${m.target}：${m.cond || m.metric}`)).join('；')}</div>` : ''}
    <div class="btn-row" style="margin-top:8px">${need.length ? `<button class="btn-small" data-mkmon="__all">🔔 一次幫 ${need.length} 檔設好建議監控</button>` : ''}<button class="btn-small ghost" id="monCheck">立即檢查</button><button class="btn-small ghost" data-go="monitor">管理監控 ›</button></div></div>`;
  return `<h2>進出場時機</h2><p class="lead">把週期、極端訊號、個股判斷、監控串成同一套流程：<b>週期決定放多少</b>、<b>溫度決定用哪種模式</b>、<b>個股決定買賣哪檔</b>、<b>監控在條件到了時提醒你</b>。</p>
    ${top}${cyc}${tmp}${lst}${mon}
    <details class="card rc-sub" ${S.tmGuide ? 'open' : ''} id="tmGuide"><summary>📋 進場與退場時機清單</summary>${TIMING_GUIDE}</details>`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-mkmon]'); if (!t || t.dataset.mkmon === '__all') return; e.stopPropagation();
  const list = S.cards.filter(c => c.code && !c.example).map(assetCheck).filter(x => x.st[0] !== '資料不足' && (t.dataset.mkmon === '__all' || x.code === t.dataset.mkmon));
  let n = 0; list.forEach(x => { const m = suggestMon(x); if (!hasMon(m)) { S.monitors.push({ id: uid(), ...m }); n++; } });
  save(); toast(n ? `已建立 ${n} 條監控，打開網站時會自動檢查` : '這些條件已經在監控中'); const y = scrollY; render(); scrollTo(0, y);
}, true);
// 首頁也跑系統監控
const _homeDC = PAGES.home;
PAGES.home = () => { setTimeout(() => { loadExtreme('^TWII', false); loadExtreme('^GSPC', false); sysWatch(); }, 200); return _homeDC(); };
// 監控頁：加上系統自動監控說明與「從進出場時機產生」
const _monDC = PAGES.monitor;
PAGES.monitor = () => _monDC().replace('<div class="card"><div class="card-head"><h3 class="gold-bar">條件清單</h3>', `<div class="card"><h3 class="gold-bar">系統自動監控</h3><div class="dc-sys"><span>🌡️ 台股 ${S.ext['^TWII'] ? `${EXT_Z[S.ext['^TWII'].zone].ic} ${EXT_Z[S.ext['^TWII'].zone].n}` : '—'}・美股 ${S.ext['^GSPC'] ? `${EXT_Z[S.ext['^GSPC'].zone].ic} ${EXT_Z[S.ext['^GSPC'].zone].n}` : '—'}：進出冰水區／滾水區時提醒</span><span>🔄 景氣階段：🇹🇼 ${phaseOf('tw')?.ph || '—'}・🇺🇸 ${phaseOf('us')?.ph || '—'}：改變時提醒</span></div>
    <div class="help">個股的停利、停損、等回檔條件，可以到「進出場時機」按「🔔 設監控」自動產生。</div><button class="btn-small ghost" data-go="timing">到進出場時機產生建議監控 ›</button></div>
  <div class="card"><div class="card-head"><h3 class="gold-bar">條件清單</h3>`);
if (['timing', 'monitor'].includes(current)) render();

/* ---------- 研究卡直接顯示「現在該怎麼做」 ---------- */
const _cardsDC = PAGES.cards;
PAGES.cards = () => {
  let h = _cardsDC();
  if (openCardId) {
    const c = S.cards.find(x => x.id === openCardId); if (!c || !c.code) return h;
    const x = assetCheck(c), id = c.market === '美股' ? 'us' : 'tw', z = zoneOfMkt(id), P = phaseOf(id), sm = x.st[0] !== '資料不足' ? suggestMon(x) : null, on = sm && hasMon(sm);
    const ctx = [z ? `大盤 ${EXT_Z[z].ic} ${EXT_Z[z].n}（${MODE[z].n.replace('模式', '')}）` : '', P ? `${id === 'us' ? '美國' : '台灣'}景氣${P.ph}` : ''].filter(Boolean).join('・');
    const ev = x.why.filter(w => !/^大盤|景氣/.test(w[0]));
    const box = `<div class="card dcx ${x.st[1]}"><div class="dcx-h"><span>🎯 現在該怎麼做</span><button class="dcx-link" data-go="timing">看整體 ›</button></div>
      <div class="dcx-act ${x.st[1]}">${esc(x.st[0])}</div>
      <div class="dcx-do">${esc(x.st[2])}</div>
      ${ctx ? `<div class="dcx-ctx">${esc(ctx)}</div>` : ''}
      ${ev.length ? `<div class="dcx-ev">${ev.map(([t, cl]) => `<span class="${cl}">${esc(t)}</span>`).join('')}</div>` : ''}
      ${sm ? `<button class="dcx-mon ${on ? 'on' : ''}" data-mkmon="${esc(x.code)}">${on ? '🔔 已在監控' : '🔔 幫我盯著'}：${esc(sm.cond)}</button>` : ''}</div>`;
    const i = h.indexOf('</section>'); return i < 0 ? h : h.slice(0, i + 10) + box + h.slice(i + 10);
  }
  S.cards.filter(c => c.code && !c.example).forEach(c => {
    const x = assetCheck(c); if (x.st[0] === '資料不足') return;
    const k = `data-card="${c.id}">`, a = h.indexOf(k); if (a < 0) return; const sp = '<span class="spacer"></span>', b = h.indexOf(sp, a); if (b < 0) return;
    const e = h.indexOf('</div>', b); if (e < 0) return; // rc-i-top 結尾＝燈號之後
    h = h.slice(0, e) + `<span class="rc-act ${x.st[1]}">${esc(x.st[0])}</span>` + h.slice(e);
  });
  return h;
};
if (current === 'cards') render();

/* ================= 研究卡連動最新股價＋到價提醒價位 =================
   研究卡的財報、估值是「研究當下」的資料；股價與技術指標則每 30 分鐘自動更新（打開網站時），
   進出場建議與到價監控都用最新價計算。 */
S.cq = S.cq || {};
let cqBusy = false;
async function refreshCardQuotes(force) {
  if (cqBusy || !location.protocol.startsWith('http')) return;
  const codes = [...new Set(S.cards.filter(c => c.code && !c.example).map(c => String(c.code).toUpperCase()))].filter(k => force || !S.cq[k] || Date.now() - S.cq[k].t > 30 * 60e3);
  if (!codes.length) return; cqBusy = true; let n = 0;
  for (const k of codes) {
    try { const d = await quote(k); S.cq[k] = { n: d.num, px: d.price, d: d.priceDate, t: Date.now() }; n++;
      S.cards.filter(c => String(c.code).toUpperCase() === k && !c.example).forEach(c => { c.price = String(d.price); c.priceAt = d.priceDate; }); } catch (e) { S.cq[k] = Object.assign(S.cq[k] || {}, { t: Date.now() }); }
  }
  cqBusy = false; save();
  if (n && ['cards', 'timing', 'monitor'].includes(current)) { const y = scrollY; render(); scrollTo(0, y); }
}
const cqOf = code => S.cq[String(code || '').toUpperCase()];
// 判斷時改用最新股價與技術指標
const _assetCheck1 = assetCheck;
assetCheck = function (c) {
  const q = cqOf(c.code); if (!q?.n || c.example) return _assetCheck1(c);
  const n = q.n, c2 = Object.assign({}, c, { price: String(q.px), date: q.d, tech: [{ read: `價 ${n.last}｜MA20 ${n.ma20}｜MA60 ${n.ma60}` }, { read: `RSI(14) ${n.rsi}` }, ...c.tech.slice(2)] });
  const r = _assetCheck1(c2); r.c = c; r.live = q.d; return r;
};
// 台股升降單位
const tick = (p, tw) => !tw ? 0.01 : p < 10 ? 0.01 : p < 50 ? 0.05 : p < 100 ? 0.1 : p < 500 ? 0.5 : p < 1000 ? 1 : 5;
const rnd = (p, tw, up) => { const t = tick(p, tw); return Math.round((up ? Math.ceil(p / t) : Math.floor(p / t)) * t * 100) / 100; };
// 依現況算出可買、可賣的提醒價位；dyn＝跟著均線每天更新
function priceLevels(x) {
  const q = cqOf(x.code), n = q?.n; if (!n?.last) return [];
  const tw = /^\d/.test(x.code), px = n.last, vs = typeof valSummary === 'function' ? valSummary(x.c) : {}, out = [];
  const add = (kind, label, p, op, dyn, why) => { if (!p || !isFinite(p)) return; p = rnd(p, tw, op === '高於'); if (op === '低於' ? p >= px : p <= px) return; if (out.some(o => Math.abs(o.p / p - 1) < 0.01)) return; out.push({ kind, label, p, op, dyn, why }); };
  if (x.h) {
    const cost = x.h.cost / x.h.shares;
    if (vs.avg && vs.avg > px) add('tp', '分批停利', vs.avg, '高於', '', '到合理價均值');
    else if (n.resistance > px) add('tp', '分批停利', n.resistance, '高於', '', '近 60 日高點（壓力）');
    if (n.ma20 && px > n.ma20) add('trail', '移動停利', n.ma20, '低於', 'ma20', '跌破月線');
    add('stop', '停損檢查', Math.max(n.ma60 ? n.ma60 * 0.97 : 0, cost * 0.85), '低於', n.ma60 && n.ma60 * 0.97 > cost * 0.85 ? 'ma60' : '', n.ma60 && n.ma60 * 0.97 > cost * 0.85 ? '跌破季線 3%' : '虧損 15%');
  } else {
    if (n.ma20 && px > n.ma20) add('buy', '第一批買點', n.ma20, '低於', 'ma20', '回測月線');
    if (n.ma60 && px > n.ma60) add('buy', '第二批買點', n.ma60, '低於', 'ma60', '回測季線');
    if (vs.avg && vs.avg * 0.85 < px) add('buy', '便宜價', vs.avg * 0.85, '低於', '', '合理價打 85 折');
    if (!out.length && n.support < px) add('buy', '支撐買點', n.support, '低於', '', '近 60 日低點');
    if (n.ma60 && px < n.ma60) add('break', '趨勢轉強', n.ma60, '高於', 'ma60', '站回季線');
  }
  return out.slice(0, 3);
}
const VERB = { buy: '跌到', break: '站上', tp: '漲到', trail: '跌破', stop: '跌破' };
const LV_C = { buy: 'pos', break: 'pos', tp: 'gold', trail: 'gold', stop: 'neg' };
const fmtP = p => p >= 100 ? fmt(p, p % 1 ? 1 : 0) : fmt(p, 2);
function levelsHTML(x) {
  const L = priceLevels(x); if (!L.length) return '';
  const on = L.filter(l => hasLvl(x.code, l)).length;
  return `<div class="pl"><div class="pl-row">${L.map(l => `<span class="pl-i ${LV_C[l.kind]}"><em>${l.label}</em><b>${fmtP(l.p)}</b><small>${l.why}${l.dyn ? '・每日更新' : ''}</small></span>`).join('')}</div>
    <div class="pl-act"><button class="dcx-mon ${on === L.length ? 'on' : ''}" data-mklvl="${esc(x.code)}">${on === L.length ? '🔔 已設到價提醒' : `🔔 這 ${L.length} 個價位到了提醒我`}</button><button class="pl-copy" data-cplvl="${esc(x.code)}">📋 複製給券商</button></div></div>`;
}
const hasLvl = (code, l) => S.monitors.some(m => m.status === '啟用' && m.code === code && m.lvl === l.kind + l.label);
function mkLevelMons(x) {
  let n = 0;
  priceLevels(x).forEach(l => {
    const ex = S.monitors.find(m => m.status === '啟用' && m.code === x.code && m.lvl === l.kind + l.label);
    const m = { target: `${x.code} ${x.c.name || ''}`.trim(), code: x.code, metric: '收盤價', op: l.op, value: String(l.p), dyn: l.dyn, lvl: l.kind + l.label,
      cond: `${l.label}：收盤${VERB[l.kind]} ${fmtP(l.p)}（${l.why}${l.dyn ? '，價位每日跟著均線更新' : ''}）`,
      action: { buy: '依分批計畫買進一批，先回研究卡確認論點沒變', break: '趨勢轉強：買第一批', tp: '先賣 1/3～1/2 鎖住獲利', trail: '移動停利：賣出一部分，其餘跌破季線再賣', stop: '對照「證明我錯」條件，論點被推翻就出場' }[l.kind],
      notify: '網站內提醒', status: '啟用' };
    if (ex) Object.assign(ex, m); else { S.monitors.push({ id: uid(), ...m }); n++; }
  });
  return n;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-mklvl],[data-cplvl]'); if (!t) return; e.stopPropagation(); e.preventDefault();
  const code = t.dataset.mklvl || t.dataset.cplvl, c = S.cards.find(y => y.code === code && !y.example) || S.cards.find(y => y.code === code); if (!c) return;
  const x = assetCheck(c);
  if (t.dataset.cplvl) { const L = priceLevels(x); copy(`${code} ${c.name || ''}\n` + L.map(l => `${l.label}：${VERB[l.kind]} ${fmtP(l.p)}（${l.why}）`).join('\n')); return; }
  const n = mkLevelMons(x); save(); toast(n ? `已設 ${n} 個到價提醒` : '已更新到價提醒的價位'); const y = scrollY; render(); scrollTo(0, y);
}, true);
// 監控檢查：會跟著均線移動的價位，每次檢查前先更新
checkMonitors = async function (manual) {
  const list = S.monitors.filter(m => m.status === '啟用' && m.code && m.metric && num(m.value) != null);
  if (!list.length) { if (manual) toast('沒有可自動檢查的條件（需填代號、指標與數值）'); return; }
  if (!manual && S.monCheckedAt && Date.now() - S.monCheckedAt < 30 * 60e3) return;
  S.monCheckedAt = Date.now(); const hits = [];
  for (const m of list) {
    try {
      const d = await quote(m.code), n = d.num;
      if (m.dyn && n[m.dyn]) { const tw = /^\d/.test(m.code), p = rnd(n[m.dyn] * (m.lvl?.startsWith('stop') ? 0.97 : 1), tw, m.op === '高於'); m.value = String(p); m.cond = m.cond.replace(/(跌破|站上|跌到|漲到) [\d,.]+/, `$1 ${fmtP(p)}`); }
      const v = metricVal(m.metric, n); m.lastVal = v; m.lastCheck = d.priceDate;
      if (v != null && (m.op === '低於' ? v < num(m.value) : v > num(m.value))) { m.status = '已觸發'; m.triggeredAt = today(); hits.push(`${m.target || m.code}：${m.cond || `${m.metric} ${v}（${m.op} ${m.value}）`}，現價 ${v}`); }
    } catch (e) { m.lastVal = null; m.lastCheck = '檢查失敗'; }
  }
  save();
  if (hits.length) {
    S.monAlerts = [...(S.monAlerts || []), ...hits]; save();
    if ('Notification' in window && Notification.permission === 'granted') { try { const reg = await navigator.serviceWorker?.getRegistration(); const opt = { body: hits.join('\n'), icon: 'icons/icon-192.png' }; reg ? reg.showNotification('到價提醒', opt) : new Notification('到價提醒', opt); } catch (e) { /* ignore */ } }
  }
  if (manual) toast(hits.length ? `${hits.length} 個條件觸發` : '已檢查，沒有條件觸發');
  if (['monitor', 'home', 'timing'].includes(current)) render();
};
// 研究卡、進出場時機：顯示價位、自動更新股價
const _cardsLv = PAGES.cards;
PAGES.cards = () => {
  setTimeout(() => refreshCardQuotes(false), 50);
  let h = _cardsLv(); if (!openCardId) return h;
  const c = S.cards.find(x => x.id === openCardId); if (!c?.code) return h;
  const x = assetCheck(c), lv = levelsHTML(x), q = cqOf(c.code);
  const live = q?.d ? `<div class="dcx-live">股價與技術指標已更新到 ${esc(q.d)}；財報與估值是研究日 ${esc(c.date || '—')} 的資料</div>` : '';
  const i = h.indexOf('<button class="dcx-mon'), j = i >= 0 ? h.indexOf('</button>', i) + 9 : -1;
  if (j > 8 && lv) h = h.slice(0, i) + lv + h.slice(j); // 用到價價位取代原本單一條件
  const k = h.indexOf('<div class="dcx-do">'); if (k >= 0 && live) { const e2 = h.indexOf('</div>', k) + 6; h = h.slice(0, e2) + live + h.slice(e2); }
  return h;
};
const _tmLv = PAGES.timing;
PAGES.timing = () => {
  setTimeout(() => refreshCardQuotes(false), 80);
  let h = _tmLv();
  S.cards.filter(c => c.code && !c.example).forEach(c => {
    const x = assetCheck(c), lv = levelsHTML(x); if (!lv) return;
    const a = h.indexOf(`data-card="${c.id}" data-go-card="1"`); if (a < 0) return;
    const i = h.indexOf('<button class="dc-mon', a), nx = h.indexOf('class="tm-a ', a + 10);
    if (i < 0 || (nx >= 0 && i > nx)) return; const j = h.indexOf('</button>', i) + 9;
    h = h.slice(0, i) + lv + h.slice(j);
  });
  return h.replace('個股決定買賣哪檔</b>', '個股決定買賣哪檔、在什麼價位</b>');
};
// 全部一鍵：改為設定到價價位
document.addEventListener('click', e => {
  const t = e.target.closest('[data-mkmon="__all"]'); if (!t) return; e.stopPropagation(); e.preventDefault();
  let n = 0; S.cards.filter(c => c.code && !c.example).forEach(c => { n += mkLevelMons(assetCheck(c)); });
  save(); toast(n ? `已設 ${n} 個到價提醒` : '到價提醒已是最新價位'); const y = scrollY; render(); scrollTo(0, y);
}, true);
// 監控頁：說明到價通知能做到什麼、做不到什麼
const _monLv = PAGES.monitor;
PAGES.monitor = () => { setTimeout(() => checkMonitors(false), 100); return _monLv().replace('<div class="card"><h3 class="gold-bar">系統自動監控</h3>', `<div class="card"><h3 class="gold-bar">📣 到價通知做得到什麼</h3><div class="pl-note">
  <div class="ok">✅ <b>打開網站時</b>：自動抓最新收盤價檢查所有條件（最多 30 分鐘一次），觸發會出現在首頁，開了手機通知也會跳通知。</div>
  <div class="ok">✅ <b>價位會跟著走</b>：「移動停利」「回測月線／季線」這類價位，每次檢查前會依最新均線重算。</div>
  <div class="no">⚠️ <b>網站關著時收不到</b>：這是網頁 App 的限制。盤中即時提醒請按「📋 複製給券商」，貼到券商 App 的到價提醒。</div></div></div>
  <div class="card"><h3 class="gold-bar">系統自動監控</h3>`); };
if (['cards', 'timing', 'monitor'].includes(current)) render();

/* ================= DCF 折現率：依產業定位估算（CAPM） =================
   折現率 ＝ 無風險利率 ＋ beta × 股票風險溢酬 ＋ 規模溢酬
   beta：產業 beta 與個股近一年實際 beta 各半（只有一個時就用那一個）。 */
const IND_BETA = {
  ai: [1.15, 1.3, 1.1, 1.0, 1.25, 1.15, 1.3, 1.4, 1.2, 1.1, 1.3, 1.15],
  ev: [1.4, 1.3, 1.3, 1.2, 1.2, 1.0, 1.2], fin: [0.8, 1.0, 1.1, 1.0], cons: [0.5, 0.6, 0.7, 1.0],
  ship: [1.4, 1.2, 1.0, 0.9], sat: [1.5, 1.3, 1.3, 1.2, 1.2], champ: [1.2, 1.2, 1.1, 1.0, 0.9, 0.9], bio: [0.8, 1.5, 1.0, 0.9],
};
// 永續成長率：成熟內需低、科技成長高
const IND_TG = { ai: 3, ev: 2.5, fin: 2, cons: 1.5, ship: 1.5, sat: 3, champ: 2, bio: 2.5 };
const ERP = { tw: 6, us: 5 }; // 股票風險溢酬（假設值；台股含國家風險）
function rfOf(us) { const t = mkOf('^TNX'); return us ? (t?.price > 0 && t.price < 15 ? +t.price.toFixed(2) : 4.2) : 1.6; }
function discountRate(c, extra = {}) {
  const us = c.market === '美股', f = findLayer(c.layer), id = f?.ch.id;
  const bInd = f ? IND_BETA[id]?.[f.i] : null, bMe = c.beta?.b != null && c.beta.b > 0.2 && c.beta.b < 3 ? c.beta.b : null;
  const beta = bInd != null && bMe != null ? (bInd + bMe) / 2 : bInd ?? bMe ?? 1;
  const rf = rfOf(us), erp = us ? ERP.us : ERP.tw;
  const cap = extra.cap; // 市值（台幣元或美元）
  const size = cap == null ? 0 : us ? (cap < 2e9 ? 2 : cap < 1e10 ? 1 : 0) : (cap < 1e10 ? 2 : cap < 5e10 ? 1 : 0);
  const r = Math.max(7, Math.min(16, rf + beta * erp + size));
  const tg = Math.max(0.5, Math.min(id ? IND_TG[id] : 2.5, r - 5));
  const parts = `無風險利率 ${rf}%（${us ? '美國 10 年債' : '台灣 10 年公債約'}）＋ beta ${beta.toFixed(2)} × 風險溢酬 ${erp}%${size ? ` ＋ 小型股溢酬 ${size}%` : ''}`;
  const bWhy = [bInd != null ? `產業 ${bInd}（${f.l.n}）` : '', bMe != null ? `個股近一年 ${bMe}` : ''].filter(Boolean).join('、') || '未定位，用 1.0';
  return { r: Math.round(r * 10) / 10, tg, beta, fin: id === 'fin' && f.i < 2, why: `${parts}；beta 取${bWhy}${bInd != null && bMe != null ? '的平均' : ''}。永續成長 ${tg}%（${f ? f.ch.name : '一般'}）` };
}
function applyDR(c, extra) {
  const i = c.dcfIn; if (!i || !i.auto) return;
  const D = discountRate(c, extra); i.r = String(D.r); i.tg = String(D.tg); i.rWhy = D.why; i.fin = D.fin;
  const res = i.bad ? null : dcfCalc(i);
  if (i.bad && (isBlankish(c.val[1].assume) || c.val[1].auto)) c.val[1] = { assume: '【自動】近四季現金流暴增、前一年為負，看不出經常性現金流，DCF 暫不估算', fair: '', note: '查財報附註後，在 DCF 試算填入經常性自由現金流', auto: true };
  if (res && !res.neg && !D.fin && (isBlankish(c.val[1].assume) || c.val[1].auto)) c.val[1] = { assume: `【自動】${i.basis === 'eps' ? '近四季淨利（自由現金流為負，暫以獲利代替）' : i.basis === 'norm' ? '正常化自由現金流（排除一次性暴增）' : '近四季自由現金流'}、前 5 年成長 ${i.g}%、折現率 ${i.r}%（依產業估算）、永續成長 ${i.tg}%`, fair: String(Math.round(res.perShare * 10) / 10), note: '折現率＝無風險利率＋beta×風險溢酬，可在 DCF 試算調整', auto: true };
  if (D.fin && c.val[1].auto) c.val[1] = { assume: '【自動】銀行、壽險的現金流包含存放款與保費，DCF 不適用', fair: '', note: '改用股價淨值比與殖利率比較同業', auto: true };
}
const _afterAF = window.afterAutoFill;
window.afterAutoFill = (c, d) => {
  if (d.beta) c.beta = d.beta;
  _afterAF(c, d);
  if (c.dcfIn?.auto && d.dcf) {
    const D = d.dcf, k = d.market === '美股' ? 1e6 : 1e8, notes = [];
    // 一次性暴增偵測：近四季現金流是前一年的 2 倍以上（或前一年為負），或營收年增超過 80%
    const spike = D.fcfTTM > 0 && ((D.fcfPrev != null && (D.fcfPrev <= 0 || D.fcfTTM > 2 * D.fcfPrev)) || (D.revGttm ?? D.revG) > 80);
    let base = D.fcfTTM, basis = 'fcf', bad = false;
    const what = D.fcfPrev != null ? `前一年 ${fmt(D.fcfPrev / k, 1)}→近四季 ${fmt(D.fcfTTM / k, 1)}${k === 1e8 ? ' 億' : ' 百萬'}` : `營收年增 ${D.revGttm ?? D.revG}%`;
    if (spike) {
      if (D.fcfPrev > 0) { base = Math.min(D.fcfPrev, D.fcfAvg || D.fcfPrev); basis = 'norm'; notes.push(`近四季現金流暴增（${what}），可能含處分資產、建案入帳等一次性收入，改用暴增前一年的現金流`); }
      else { bad = true; notes.push(`近四季現金流暴增（${what}），前一年卻是負的，看不出哪些是經常性收入。DCF 先不估，請查財報附註的一次性收入，再在下方填入「經常性」自由現金流`); }
    }
    if (!bad && base <= 0 && d.epsTTM > 0) { base = d.epsTTM * D.shares; basis = 'eps'; }
    c.dcfIn.fcf = bad ? '' : String(Math.round(base / k * 10) / 10); c.dcfIn.basis = basis; c.dcfIn.note = notes.join('；'); c.dcfIn.bad = bad;
    // 成長率：用近四季營收年增的一半，限制在 2～12%；有暴增時最多 5%
    const gr = D.revGttm ?? D.revG, g0 = gr == null ? 6 : Math.max(2, Math.min(12, gr / 2));
    c.dcfIn.g = String(Math.round(spike ? Math.min(g0, 5) : g0));
    // 本益比法：獲利暴增時改用暴增前一年的 EPS
    if (spike && d.epsTTM > 0 && d.valuation?.peMedian && /^近四季 EPS/.test(c.val[0].assume || '')) {
      if (D.epsPrev > 0) { const e = Math.min(d.epsTTM, D.epsPrev); c.val[0] = { assume: `前一年 EPS ${e} 元（近四季 ${d.epsTTM} 元疑似含一次性收入）× 近 3 年本益比中位數 ${d.valuation.peMedian} 倍`, fair: String(Math.round(e * d.valuation.peMedian * 10) / 10), note: '近四季獲利暴增，改用暴增前的獲利估算', auto: true }; }
      else c.val[0] = { assume: `【自動】近四季 EPS ${d.epsTTM} 元暴增、前一年虧損，無法判斷經常性獲利`, fair: '', note: '請查財報附註扣除一次性收入後自行估算', auto: true };
    }
    applyDR(c, { cap: d.price && D.shares ? d.price * D.shares : null });
  }
};
// DCF 區塊：顯示折現率怎麼來的，並可依產業重算
const _dcfHTML0 = dcfHTML;
dcfHTML = function (c) {
  const h = _dcfHTML0(c), i = c.dcfIn || {}, D = discountRate(c);
  const note = `<div class="dr-box">${i.note ? `<div class="help">⚠️ ${esc(i.note)}。</div>` : ''}${i.basis === 'eps' ? '<div class="help">⚠️ 這家近四季資本支出大於營業現金流（擴產中），現金流欄位改用<b>近四季淨利</b>估算；擴產結束、現金流轉正後再按「⚡ 自動帶入」更新。</div>' : ''}<div><b>折現率建議 ${D.r}%</b>・永續成長 ${D.tg}%</div><div class="help">${esc(i.rWhy || D.why)}</div>
    ${D.fin ? '<div class="help down">金融股（銀行、壽險）不適合用 DCF，請看股價淨值比與殖利率。</div>' : ''}
    <button type="button" class="btn-small ghost" data-dcfre="1">套用建議折現率</button></div>`;
  return h.replace('<div class="result" id="dcfResult">', note + '<div class="result" id="dcfResult">');
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-dcfre]'); if (!t) return;
  const c = S.cards.find(x => x.id === openCardId); if (!c) return;
  const D = discountRate(c, { cap: num(c.price) && num(c.dcfIn?.shares) ? num(c.price) * num(c.dcfIn.shares) * (c.market === '美股' ? 1e6 : 1e8) : null });
  c.dcfIn = Object.assign(c.dcfIn || {}, { r: String(D.r), tg: String(D.tg), rWhy: D.why, auto: true }); applyDR(c);
  save(); toast(`折現率 ${D.r}%、永續成長 ${D.tg}%`); const y = scrollY; render(); scrollTo(0, y);
});

/* ================= 綜合公允價值：多種估值法加權平均（類似 InvestingPro Fair Value 的作法） =================
   DCF 只是其中一種；這裡把本益比、DCF、股價淨值比、殖利率、營收倍數、分析師／外部公允價值放在一起，
   依公司類型給權重、剔除離群值後取加權平均。 */
const FV_W = { pe: 1, dcf: 1, pb: 0.5, dy: 0.5, ps: 1, ext: 1 };
function fairComposite(c) {
  const f = findLayer(c.layer), fin = f?.ch.id === 'fin' && f.i < 2, X = c.valx || [];
  const dyRow = X.find(x => x.k === 'dy'), loss = !(num(c.val[0]?.fair) > 0);
  const W = Object.assign({}, FV_W, fin ? { pb: 2, dy: 1, dcf: 0 } : {}, dyRow?.dy >= 4 ? { dy: 1 } : {}, loss ? { ps: 1.5 } : {});
  const M = [
    { k: 'pe', name: '本益比法', fair: num(c.val[0]?.fair), assume: c.val[0]?.assume },
    { k: 'dcf', name: '現金流折現 DCF', fair: num(c.val[1]?.fair), assume: c.val[1]?.assume },
    ...X.map(x => ({ ...x, fair: num(x.fair) })),
    { k: 'ext', name: '分析師／外部公允價值', fair: num(c.val[2]?.fair), assume: c.val[2]?.assume || c.val[2]?.note },
  ].filter(m => m.fair > 0).map(m => ({ ...m, w: W[m.k] ?? 1 }));
  const fs = M.map(m => m.fair).sort((a, b) => a - b), med = fs.length ? fs[Math.floor((fs.length - 1) / 2)] : null;
  M.forEach(m => { m.out = M.length > 2 && (m.fair > med * 2.5 || m.fair < med / 2.5); m.used = m.w > 0 && !m.out; });
  const U = M.filter(m => m.used), sw = U.reduce((s, m) => s + m.w, 0);
  const avg = sw ? U.reduce((s, m) => s + m.fair * m.w, 0) / sw : null, p = num(c.price);
  return { M, U, avg, min: U.length ? Math.min(...U.map(m => m.fair)) : null, max: U.length ? Math.max(...U.map(m => m.fair)) : null, upside: avg && p ? (avg / p - 1) * 100 : null, fin, loss };
}
const FV_WHY = F => F.fin ? '金融股：股價淨值比 2、殖利率 1、本益比 1，DCF 不用（現金流含存放款）' : F.loss ? '虧損公司：營收倍數 1.5，其餘 1；股價淨值比、殖利率各 0.5' : '一般公司：本益比、DCF、營收倍數、分析師／外部各 1；股價淨值比、殖利率各 0.5（殖利率 4% 以上的高股息股提高到 1）';
valSummary = function (c) { const F = fairComposite(c); return { avg: F.avg, upside: F.upside, min: F.min, max: F.max }; };
function fairCardHTML(c) {
  const F = fairComposite(c), p = num(c.price); if (!F.M.length) return '';
  const all = F.M.map(m => m.fair).concat(p ? [p] : []), lo = Math.min(...all) * 0.9, hi = Math.max(...all) * 1.05, X = v => (v - lo) / (hi - lo) * 100;
  const sw = F.U.reduce((s, m) => s + m.w, 0);
  return `<div class="fv"><div class="fv-h"><b>⚖️ 綜合公允價值 ${F.avg ? fmt(F.avg, F.avg < 100 ? 2 : 1) : '—'}</b>${F.upside != null ? `<span class="${F.upside >= 0 ? 'up' : 'down'}">${F.upside >= 0 ? '低估' : '高估'} ${fmt(Math.abs(F.upside), 1)}%</span>` : ''}</div>
    <div class="fv-bar">${F.U.length ? `<i class="rng" style="left:${X(F.min)}%;width:${X(F.max) - X(F.min)}%"></i>` : ''}${F.M.map(m => `<i class="dot ${m.used ? '' : 'off'}" style="left:${X(m.fair)}%"></i>`).join('')}${p ? `<b class="px" style="left:${X(p)}%"><span>現價 ${fmt(p, p < 100 ? 2 : 0)}</span></b>` : ''}${F.avg ? `<b class="av" style="left:${X(F.avg)}%"></b>` : ''}</div>
    <div class="fv-list">${F.M.map(m => `<div class="${m.used ? '' : 'off'}"><span>${esc(m.name)}</span><b>${fmt(m.fair, m.fair < 100 ? 2 : 1)}</b><em>${m.used ? `權重 ${Math.round(m.w / sw * 100)}%` : m.out ? '離群，未納入' : '不適用'}</em>${m.assume ? `<small>${esc(String(m.assume).replace(/^【自動】/, ''))}</small>` : ''}</div>`).join('')}</div>
    ${F.U.length ? `<details class="fv-calc"><summary>🧮 計算過程</summary>
      <div><b>① 各方法的合理價</b>${F.M.map(m => `<div>・${esc(m.name)}：${esc(String(m.assume || '').replace(/^【自動】/, '') || '（自己填入）')} → <b>${fmt(m.fair, m.fair < 100 ? 2 : 1)}</b></div>`).join('')}</div>
      <div><b>② 權重</b><div>・${FV_WHY(F)}</div>${F.M.filter(m => m.out).map(m => `<div>・${esc(m.name)} ${fmt(m.fair, 1)} 跟其他方法的中位數差 2.5 倍以上，視為離群、不納入</div>`).join('')}</div>
      <div><b>③ 加權平均</b><div>（${F.U.map(m => `${fmt(m.fair, m.fair < 100 ? 2 : 1)} × ${m.w}`).join(' ＋ ')}）÷ ${F.U.reduce((s, m) => s + m.w, 0)} ＝ <b>${fmt(F.avg, F.avg < 100 ? 2 : 1)}</b></div></div>
      ${F.upside != null ? `<div><b>④ 跟現價比</b><div>${fmt(F.avg, 1)} ÷ ${fmt(num(c.price), 1)} − 1 ＝ ${F.upside >= 0 ? '+' : ''}${fmt(F.upside, 1)}%（正數＝低估）</div></div>` : ''}</details>` : ''}
    <div class="help">把多種估值法依公司類型加權平均${F.fin ? '（金融股以股價淨值比為主、不用 DCF）' : F.loss ? '（虧損公司以營收倍數為主）' : ''}；跟其他方法中位數差 2.5 倍以上的視為離群、不納入。InvestingPro 之類網站的「公允價值」也是多種模型的綜合結果，可以填在「分析師／外部公允價值」，並在備註寫上來源與日期。</div></div>`;
}
const _cardsFV = PAGES.cards;
PAGES.cards = () => {
  let h = _cardsFV(); if (!openCardId) return h;
  const c = S.cards.find(x => x.id === openCardId); if (!c) return h;
  h = h.replace("'👥 分析師共識'", '').replace('👥 分析師共識', '👥 分析師／外部公允價值').replace('⚖️ 三法平均', '⚖️ 綜合公允價值').replace('三法差距大時', '各方法差距大時');
  return h.replace('<div id="valResult" hidden>', fairCardHTML(c) + '<div id="valResult" hidden>');
};
const _afterFV = window.afterAutoFill;
window.afterAutoFill = (c, d) => { _afterFV(c, d); c.valx = d.valx || []; };

/* ================= 估值模型集錦（參考 InvestingPro 的模型分類） =================
   DCF：5 年／10 年 × 營收退出、EBITDA 退出、永續成長；同業倍數；盈利能力價值 EPV；杜邦 ROE。
   全部在瀏覽器端用「自動帶入」取得的財報數字計算，不增加伺服器負擔；同業資料一天抓一次。 */
const TGT_M = { ai: 30, ev: 15, fin: 30, cons: 22, ship: 15, sat: 35, champ: 18, bio: 25 }; // 成熟期 EBITDA 利潤率假設 %
const MAT = { evRev: 3, evEbitda: 10 }; // 10 年後的成熟倍數上限
const peersOf = c => { const tw = /^\d/.test(c.code); return Object.entries(CODE_LAYER).filter(([k, v]) => v === c.layer && k !== c.code && (tw ? /^\d{4}$/.test(k) : /^[A-Z.]+$/.test(k))).map(([k]) => k).slice(0, 10); };
let peerBusy = {};
async function loadPeers(c, force) {
  if (!c.code || peerBusy[c.id] || !location.protocol.startsWith('http')) return;
  if (!force && c.peers && Date.now() - (c.peers.at || 0) < 24 * 3600e3 && c.peers.layer === c.layer) return;
  peerBusy[c.id] = 1;
  try { const j = await (await fetch(`api/peers?code=${encodeURIComponent(c.code)}&peers=${peersOf(c).join(',')}`, { signal: AbortSignal.timeout(40000) })).json(); if (!j.error) { j.at = Date.now(); j.layer = c.layer; c.peers = j; save(); } } catch (e) { /* 略過 */ }
  delete peerBusy[c.id]; if (openCardId === c.id) { const y = scrollY; render(); scrollTo(0, y); }
}
function dcfProject(c, N, mode) {
  const F = c.fm, D = discountRate(c), mo = c.mo || {}; if (!F?.rev || !F.shares) return null;
  const f = findLayer(c.layer), id = f?.ch.id, r = (num(mo.r) || D.r) / 100, tg = Math.min(D.tg, r * 100 - 5) / 100;
  const spike = /暴增/.test(c.dcfIn?.note || '');
  const gRaw = F.revP > 0 ? F.rev / F.revP - 1 : F.revG != null ? F.revG / 100 : 0.06;
  const g0 = num(mo.g) != null ? num(mo.g) / 100 : Math.max(-0.1, Math.min(spike ? 0.1 : 0.6, gRaw));
  const m0 = Math.max(-0.5, Math.min(0.8, (F.ebitda ?? F.opInc ?? 0) / F.rev)), mT = num(mo.m) != null ? num(mo.m) / 100 : Math.max(m0, (TGT_M[id] ?? 20) / 100);
  const da0 = F.da > 0 ? F.da / F.rev : 0.05, cx0 = F.capex != null ? F.capex / F.rev : da0, tax = F.taxRate ?? 0.2;
  let rev = F.rev, pv = 0; const rows = [];
  for (let t = 1; t <= N; t++) {
    const k = N > 1 ? (t - 1) / (N - 1) : 1, g = g0 + (tg - g0) * k, m = m0 + (mT - m0) * (t / N);
    rev *= 1 + g; const ebitda = rev * m, da = rev * da0, cx = rev * (cx0 + (da0 - cx0) * (t / N)), taxes = Math.max(0, ebitda - da) * tax, fcf = ebitda - taxes - cx;
    pv += fcf / (1 + r) ** t; rows.push({ t, rev, g, m, ebitda, fcf });
  }
  const L = rows[N - 1], disc = (1 + r) ** N, nd = (F.debt || 0) - (F.cash || 0), P = c.peers?.med || {};
  const pePS = /^\d/.test(c.code) ? P.ps : (P.evRev || P.ps);
  const evRevX = Math.min(N >= 10 ? MAT.evRev : 99, pePS || 3), evEbX = Math.min(N >= 10 ? MAT.evEbitda : 99, P.evEbitda || (P.pe ? P.pe * 0.65 : 12));
  const tv = { gordon: L.fcf > 0 && r > tg ? L.fcf * (1 + tg) / (r - tg) : null, ebitda: L.ebitda > 0 ? L.ebitda * evEbX : null, rev: L.rev * evRevX };
  const ps = x => x == null ? null : (pv + x / disc - nd) / F.shares;
  return { N, r, tg, g0, m0, mT, rows, pv, nd, evRevX, evEbX, fair: { gordon: ps(tv.gordon), ebitda: ps(tv.ebitda), rev: ps(tv.rev) }, tvShare: tv.gordon ? tv.gordon / disc / (pv + tv.gordon / disc) : null };
}
function epvOf(c) {
  const F = c.fm, D = discountRate(c); if (!F?.rev || !F.shares) return null;
  const om = F.opMarginAvg ?? (F.opInc != null ? F.opInc / F.rev : null); if (!(om > 0)) return { na: '平均營業利益率不是正的（虧損公司），不適用' };
  const ebit = om * F.rev, r = (num(c.mo?.r) || D.r) / 100, v = (ebit * (1 - (F.taxRate ?? 0.2)) / r - ((F.debt || 0) - (F.cash || 0))) / F.shares;
  return { fair: v, om, ebit, r };
}
function dupontOf(c) {
  const F = c.fm; if (!F?.rev || !F.equity || !F.assets) return null;
  const avg = (a, b) => b ? (a + b) / 2 : a;
  const now = { roe: F.ni / avg(F.equity, F.equityP), margin: F.ni / F.rev, turn: F.rev / avg(F.assets, F.assetsP), lev: avg(F.assets, F.assetsP) / avg(F.equity, F.equityP) };
  const prev = F.niP != null && F.revP && F.equityP && F.assetsP ? { roe: F.niP / F.equityP, margin: F.niP / F.revP, turn: F.revP / F.assetsP, lev: F.assetsP / F.equityP } : null;
  return { now, prev, peerRoe: c.peers?.med?.roe ?? (c.peers?.med?.pb && c.peers?.med?.pe ? c.peers.med.pb / c.peers.med.pe * 100 : null) };
}
function peerFair(c) {
  const P = c.peers, F = c.fm || {}, px = num(c.price); if (!P?.med) return [];
  const M = P.med, S0 = P.self || {}, sh = F.shares, nd = (F.debt || 0) - (F.cash || 0), out = [];
  const eps = px && S0.pe > 0 ? px / S0.pe : (F.ni > 0 && sh ? F.ni / sh : null);
  const add = (k, name, fair, how) => { if (fair > 0 && isFinite(fair)) out.push({ k, name, fair: Math.round(fair * 100) / 100, assume: how }); };
  if (eps > 0 && M.pe) add('ppe', '同業本益比', eps * M.pe, `EPS ${fmt(eps, 2)} × 同業本益比中位數 ${M.pe} 倍`);
  if (S0.fpe > 0 && M.fpe && px) add('pfpe', '同業預估本益比', px / S0.fpe * M.fpe, `明年預估 EPS ${fmt(px / S0.fpe, 2)} × 同業預估本益比中位數 ${M.fpe} 倍`);
  const bps = px && S0.pb > 0 ? px / S0.pb : (F.equity && sh ? F.equity / sh : null);
  if (bps > 0 && M.pb) add('ppb', '同業股價淨值比', bps * M.pb, `每股淨值 ${fmt(bps, 2)} × 同業中位數 ${M.pb} 倍`);
  if (F.rev && sh && M.ps) add('pps', '同業股價營收比', F.rev / sh * M.ps, `每股營收 ${fmt(F.rev / sh, 2)} × 同業中位數 ${M.ps} 倍`);
  if (F.rev && sh && M.evRev) add('pevr', '同業企業價值／營收', (F.rev * M.evRev - nd) / sh, `營收 × 同業中位數 ${M.evRev} 倍 − 淨負債`);
  if (F.ebitda > 0 && sh && M.evEbitda) add('peve', '同業企業價值／EBITDA', (F.ebitda * M.evEbitda - nd) / sh, `EBITDA × 同業中位數 ${M.evEbitda} 倍 − 淨負債`);
  if (S0.dy > 0 && M.dy && px) add('pdy', '同業殖利率', px * S0.dy / M.dy, `股利 ${fmt(px * S0.dy / 100, 2)} ÷ 同業殖利率中位數 ${M.dy}%`);
  return out;
}
// 模型結果併入綜合公允價值
function modelRows(c) {
  const rows = [];
  for (const N of [5, 10]) { const p = dcfProject(c, N); if (!p) continue;
    [['rev', '營收退出'], ['ebitda', 'EBITDA 退出'], ['gordon', '永續成長']].forEach(([k, l]) => { const v = p.fair[k]; if (v > 0) rows.push({ k: `d${k}${N}`, name: `${N} 年 DCF ${l}`, fair: Math.round(v * 100) / 100, assume: `營收年增 ${fmt(p.g0 * 100, 0)}% 逐年降到 ${fmt(p.tg * 100, 1)}%、EBITDA 率 ${fmt(p.m0 * 100, 0)}%→${fmt(p.mT * 100, 0)}%、折現率 ${fmt(p.r * 100, 1)}%${k === 'rev' ? `、退出 ${fmt(p.evRevX, 1)} 倍營收` : k === 'ebitda' ? `、退出 ${fmt(p.evEbX, 1)} 倍 EBITDA` : ''}`, model: 1 }); }); }
  peerFair(c).forEach(x => rows.push({ ...x, model: 1 }));
  const e = epvOf(c); if (e?.fair > 0) rows.push({ k: 'epv', name: '盈利能力價值 EPV', fair: Math.round(e.fair * 100) / 100, assume: `平均營業利益率 ${fmt(e.om * 100, 1)}% × 近四季營收，稅後 ÷ 折現率 ${fmt(e.r * 100, 1)}%（假設不再成長）`, model: 1 });
  return rows;
}
Object.assign(FV_W, { drev5: 0.4, debitda5: 0.4, dgordon5: 0.4, drev10: 0.3, debitda10: 0.3, dgordon10: 0.3, ppe: 0.4, pfpe: 0.4, ppb: 0.3, pps: 0.4, pevr: 0.4, peve: 0.4, pdy: 0.3, epv: 0.3 });
const _fairComp0 = fairComposite;
fairComposite = function (c) {
  const extra = c.fm ? modelRows(c) : [];
  if (!extra.length) return _fairComp0(c);
  const saved = c.valx; c.valx = (saved || []).concat(extra.map(x => ({ ...x })));
  try { const R = _fairComp0(c); R.M.forEach(m => { if (m.k === 'epv' && R.loss) { m.w = 0; m.used = false; } }); return R; } finally { c.valx = saved; }
};
// 研究卡：模型集錦區塊
function modelGalleryHTML(c) {
  if (!c.fm) return `<details class="rc-sub mg"><summary>📚 估值模型集錦</summary><div class="help">按上方「⚡ 自動帶入」取得完整財報資料後，就會算出 DCF（5 年／10 年 × 三種終值）、同業倍數、盈利能力價值與杜邦分析。</div></details>`;
  const P5 = dcfProject(c, 5), P10 = dcfProject(c, 10), cur = c.fm.cur === '美元' ? '美元' : '元', px = num(c.price);
  const fv = v => v == null ? '<em>不適用</em>' : `<b class="${px ? (v >= px ? 'up' : 'down') : ''}">${fmt(v, v < 100 ? 2 : 1)}</b>`;
  const mo = c.mo || {}, D = discountRate(c);
  const dcf = P5 ? `<div class="mg-sec"><b>① 現金流折現 DCF</b>
    <div class="mg-in"><label>起始營收成長 %<input data-mo="g" inputmode="decimal" value="${esc(mo.g ?? '')}" placeholder="${fmt(P5.g0 * 100, 0)}"></label><label>成熟 EBITDA 率 %<input data-mo="m" inputmode="decimal" value="${esc(mo.m ?? '')}" placeholder="${fmt(P5.mT * 100, 0)}"></label><label>折現率 %<input data-mo="r" inputmode="decimal" value="${esc(mo.r ?? '')}" placeholder="${D.r}"></label></div>
    <div class="mg-t"><div class="h"><span>終值算法</span><span>5 年</span><span>10 年</span></div>
      ${[['rev', '營收退出'], ['ebitda', 'EBITDA 退出'], ['gordon', '永續成長']].map(([k, l]) => `<div><span>${l}</span><span>${fv(P5.fair[k])}</span><span>${fv(P10?.fair[k])}</span></div>`).join('')}</div>
    <div class="help">營收年增從 ${fmt(P5.g0 * 100, 0)}% 逐年降到永續 ${fmt(P5.tg * 100, 1)}%；EBITDA 率從 ${fmt(P5.m0 * 100, 0)}% 走向 ${fmt(P5.mT * 100, 0)}%；資本支出逐步降到折舊水準；折現率 ${fmt(P5.r * 100, 1)}%。退出倍數：5 年用同業中位數（營收 ${fmt(P5.evRevX, 1)} 倍、EBITDA ${fmt(P5.evEbX, 1)} 倍），10 年改用成熟倍數（最高 ${MAT.evRev}、${MAT.evEbitda} 倍）。5 年後營收約 ${fmt(P5.rows[4].rev / (cur === '元' ? 1e8 : 1e9), 1)} ${cur === '元' ? '億元' : '十億美元'}、10 年後 ${fmt(P10.rows[9].rev / (cur === '元' ? 1e8 : 1e9), 1)}。</div>
    <div class="help">留白＝用系統預設；改了數字會即時重算，並納入綜合公允價值。</div></div>` : '';
  const P = c.peers, pr = peerFair(c);
  const peer = `<div class="mg-sec"><b>② 同業倍數比較</b>${!P ? `<div class="help">${peerBusy[c.id] ? '同業資料讀取中…' : '同業資料讀取中（第一次約 5～10 秒）'}</div>` : `
    <div class="help">比較對象：${esc(P.basis || '')}</div>
    <div class="mg-peers"><div class="h"><span>公司</span><span>本益比</span><span>淨值比</span><span>${/^\d/.test(c.code) ? '營收比' : 'EV/營收'}</span><span>${/^\d/.test(c.code) ? '殖利率' : 'EV/EBITDA'}</span></div>
      ${[{ code: c.code, name: '本公司', ...P.self, me: 1 }, ...(P.peers || [])].map(x => `<div class="${x.me ? 'me' : ''}"><span>${esc(x.code)} ${esc((x.name || '').slice(0, 6))}</span><span>${x.pe > 0 ? fmt(x.pe, 1) : '—'}</span><span>${x.pb > 0 ? fmt(x.pb, 2) : '—'}</span><span>${/^\d/.test(c.code) ? (x.ps > 0 ? fmt(x.ps, 1) : '—') : (x.evRev > 0 ? fmt(x.evRev, 1) : '—')}</span><span>${/^\d/.test(c.code) ? (x.dy > 0 ? fmt(x.dy, 1) + '%' : '—') : (x.evEbitda > 0 ? fmt(x.evEbitda, 1) : '—')}</span></div>`).join('')}
      <div class="md"><span>同業中位數</span><span>${P.med.pe ?? '—'}</span><span>${P.med.pb ?? '—'}</span><span>${(/^\d/.test(c.code) ? P.med.ps : P.med.evRev) ?? '—'}</span><span>${/^\d/.test(c.code) ? (P.med.dy != null ? P.med.dy + '%' : '—') : (P.med.evEbitda ?? '—')}</span></div></div>
    ${pr.length ? `<div class="mg-imp">${pr.map(x => `<div><span>${esc(x.name)}</span>${fv(x.fair)}<small>${esc(x.assume)}</small></div>`).join('')}</div>` : '<div class="help">本公司缺少可比較的獲利或營收資料。</div>'}`}</div>`;
  const E = epvOf(c);
  const epv = `<div class="mg-sec"><b>③ 盈利能力價值 EPV</b>${E?.fair ? `<div class="mg-imp"><div><span>EPV（不成長的價值）</span>${fv(E.fair)}<small>平均營業利益率 ${fmt(E.om * 100, 1)}%（近 ${c.fm.years} 年）× 近四季營收，稅後 ÷ 折現率 ${fmt(E.r * 100, 1)}%，再扣淨負債</small></div></div><div class="help">假設公司維持現在的獲利、完全不成長，常當作估值的下限；股價低於 EPV 代表市場幾乎沒有替成長付錢。</div>` : `<div class="help">${esc(E?.na || '資料不足')}</div>`}</div>`;
  const DP = dupontOf(c), pc1 = v => v == null || !isFinite(v) ? '—' : fmt(v * 100, 1) + '%', x2 = v => v == null || !isFinite(v) ? '—' : fmt(v, 2);
  const arrow = (a, b) => a == null || b == null ? '' : a > b ? '<i class="up">▲</i>' : a < b ? '<i class="down">▼</i>' : '';
  const dup = `<div class="mg-sec"><b>④ 杜邦 ROE 分析</b>${DP ? `<div class="mg-t dp"><div class="h"><span></span><span>近四季</span><span>前一年</span></div>
      <div><span>股東權益報酬率 ROE</span><span>${pc1(DP.now.roe)} ${arrow(DP.now.roe, DP.prev?.roe)}</span><span>${pc1(DP.prev?.roe)}</span></div>
      <div><span>＝ 淨利率</span><span>${pc1(DP.now.margin)} ${arrow(DP.now.margin, DP.prev?.margin)}</span><span>${pc1(DP.prev?.margin)}</span></div>
      <div><span>× 資產週轉率</span><span>${x2(DP.now.turn)} ${arrow(DP.now.turn, DP.prev?.turn)}</span><span>${x2(DP.prev?.turn)}</span></div>
      <div><span>× 財務槓桿</span><span>${x2(DP.now.lev)} ${arrow(DP.now.lev, DP.prev?.lev)}</span><span>${x2(DP.prev?.lev)}</span></div></div>
      <div class="help">${DP.peerRoe != null ? `同業 ROE 中位數約 ${fmt(DP.peerRoe, 1)}%（由同業股價淨值比 ÷ 本益比推算）。` : ''}ROE 上升如果主要來自淨利率或週轉率，是體質變好；如果主要來自財務槓桿（借更多錢），風險也跟著變高。</div>` : '<div class="help">缺少資產或股東權益資料。</div>'}</div>`;
  return `<details class="rc-sub mg" id="mgBox" ${S.mgOpen ? 'open' : ''}><summary>📚 估值模型集錦</summary>${dcf}${peer}${epv}${dup}
    <div class="help">模型分類參考 InvestingPro 的模型集錦；假設由本工具自行設定，可以修改。所有算得出數字的模型都會出現在上方綜合公允價值，離群的自動剔除。</div></details>`;
}
const _cardsMG = PAGES.cards;
PAGES.cards = () => {
  let h = _cardsMG(); if (!openCardId) return h;
  const c = S.cards.find(x => x.id === openCardId); if (!c) return h;
  if (c.fm) setTimeout(() => loadPeers(c), 60);
  const i = h.indexOf('<details class="rc-sub"><summary>🧮 DCF 試算器');
  return i >= 0 ? h.slice(0, i) + modelGalleryHTML(c) + h.slice(i) : h;
};
const _afterMG = window.afterAutoFill;
window.afterAutoFill = (c, d) => { _afterMG(c, d); if (d.fm) { c.fm = Object.assign({}, d.fm, { revG: d.dcf?.revGttm ?? d.dcf?.revG ?? null }); c.peers = null; } };
document.addEventListener('change', e => {
  const k = e.target.dataset?.mo; if (!k) return; const c = S.cards.find(x => x.id === openCardId); if (!c) return;
  c.mo = Object.assign(c.mo || {}, { [k]: e.target.value.trim() }); if (!c.mo[k]) delete c.mo[k]; save(); const y = scrollY; render(); scrollTo(0, y);
});
document.addEventListener('toggle', e => { if (e.target.id === 'mgBox') { S.mgOpen = e.target.open; save(); } }, true);

/* ================= 策略組合（類似 InvestingPro ProPicks）：台股每月換股＋歷史回測 ================= */
S.picks = S.picks || null;
let picksBusy = false;
async function loadPicks(force) {
  if (picksBusy || !location.protocol.startsWith('http')) return;
  if (!force && S.picks && Date.now() - (S.picks.at || 0) < 12 * 3600e3) return;
  picksBusy = true; if (current === 'picks') render();
  try { const j = await (await fetch('api/strategy', { signal: AbortSignal.timeout(120000) })).json(); if (j.error) throw new Error(j.error); j.at = Date.now(); S.picks = j; save(); }
  catch (e) { if (current === 'picks') toast('策略資料讀取失敗：' + e.message); }
  picksBusy = false; if (current === 'picks') { const y = scrollY; render(); scrollTo(0, y); }
}
const PK_COL = { mom20: '#3b82c4', lowvol20: '#1e9e5a', div20: '#c9a24a', trend15: '#8b5cf6', tech15: '#e07b39', multi20: '#d64545' };
function pkSpark(cv, bc, col) {
  const W = 300, H = 70, all = cv.concat(bc).map(Math.log), lo = Math.min(...all), hi = Math.max(...all), X = i => i * W / (cv.length - 1), Y = v => H - 4 - (Math.log(v) - lo) / (hi - lo || 1) * (H - 8);
  const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  return `<svg class="pk-sp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${path(bc)}" class="b"/><path d="${path(cv)}" style="stroke:${col}"/></svg>`;
}
PAGES.picks = () => {
  setTimeout(() => loadPicks(false), 30);
  const D = S.picks, head = `<h2>策略組合</h2><p class="lead">像 InvestingPro 的 ProPicks：用固定規則每月從台股市值前 150 大挑股票、等權重持有，並用過去約 10 年的資料回測，跟 0050（含息）比較。</p><div class="note">⚠️ 回測報酬<b>明顯高估</b>：候選池是「今天」的市值前 150 大，等於事先知道哪些公司後來長大了（倖存者偏差），動能類策略特別嚴重。請把重點放在<b>策略之間的相對特性</b>（波動、回檔、跟大盤的差距）與<b>本月選出的股票</b>，不要把歷史年化報酬當成預期報酬。</div>`;
  if (!D) return head + `<div class="card empty">${picksBusy ? '回測計算中…（第一次約 10～30 秒）' : '讀取中…'}</div>`;
  const B = D.bench.stats, open = S.pkOpen || '', yr = s => `${s.slice(0, 4)}`;
  const box = (l, v, b) => `<div class="pk-b"><em>${l}</em><b class="${v >= 0 ? 'up' : 'down'}">${v == null ? '—' : pc(v) + '%'}</b>${b != null ? `<small>0050 ${pc(b)}%</small>` : ''}</div>`;
  const cards = D.strategies.map(s => `<div class="card pk">
      <div class="pk-h"><span class="pk-tag" style="background:${PK_COL[s.id]}">${esc(s.tag)}</span><span class="spacer"></span><button class="pk-see" data-pkopen="${s.id}">👁 ${open === s.id ? '收起' : '查看股票'}</button></div>
      <h3>${esc(s.name)}</h3><div class="help">${esc(s.desc)}</div>
      <div class="pk-mid"><div class="help">🕒 ${yr(D.from)}–${yr(D.to)}<br>🔁 每月換股・${s.n} 檔</div>${pkSpark(s.curve, D.bench.curve, PK_COL[s.id])}</div>
      <div class="pk-row">${box('總報酬（1 年）', s.stats.r1, B.r1)}${box('總報酬（5 年）', s.stats.r5, B.r5)}</div>
      <div class="pk-mini">年化 ${pc(s.stats.cagr)}%（0050 ${pc(B.cagr)}%）・最大回檔 ${s.stats.mdd}%（0050 ${B.mdd}%）・3 年 ${pc(s.stats.r3)}%</div>
      ${open === s.id ? `<div class="pk-list"><div class="pk-li h"><span>本月持股</span><span>12 月漲幅</span><span>波動</span><span>殖利率</span></div>
        ${s.holdings.map(x => { const m = S.cards.find(c => String(c.code) === x.code && !c.example); return `<div class="pk-li"><span><b>${esc(x.code)} ${esc(x.name)}</b>${x.isNew ? '<i class="pill gold">新進</i>' : ''}<small>${esc(x.ind || '')}・${m ? `<a class="pk-a" data-card="${m.id}" data-go-card="1">研究卡 ›</a>` : `<a class="pk-a" data-radarcard="${esc(x.code)}" data-n="${esc(x.name)}">＋ 研究卡</a>`}</small></span><span class="${x.mom >= 0 ? 'up' : 'down'}">${pc(x.mom)}%</span><span>${x.vol}%</span><span>${x.yld}%</span></div>`; }).join('')}
        ${s.out.length ? `<div class="help">本月移出：${s.out.map(x => esc(`${x.code} ${x.name}`)).join('、')}</div>` : ''}</div>` : ''}
    </div>`).join('');
  return head + `<div class="card pk-bench"><b>比較基準：0050（含息）</b><div class="pk-mini">1 年 ${pc(B.r1)}%・5 年 ${pc(B.r5)}%・年化 ${pc(B.cagr)}%・最大回檔 ${B.mdd}%</div><div class="help">每月月底依規則重新選股、等權重，已扣除換股成本（手續費＋證交稅，約換掉部分的 0.6%）。候選池 ${D.universe} 檔，資料到 ${esc(D.to)}。</div></div>
    <div class="pk-grid">${cards}</div>
    <div class="card"><div class="help">⚠️ ${esc(D.note)} 另外，回測沒有考慮滑價與停牌。策略是「規則」不是「建議」：放進研究卡、確認基本面，再依自己的配置決定要不要買。</div><button class="btn-small ghost" id="pkRefresh">重新計算</button></div>`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-pkopen],#pkRefresh'); if (!t) return;
  if (t.id === 'pkRefresh') return loadPicks(true);
  S.pkOpen = S.pkOpen === t.dataset.pkopen ? '' : t.dataset.pkopen; save(); const y = scrollY; render(); scrollTo(0, y);
});
if (typeof GROUPS !== 'undefined') GROUPS.research = [['radar', '選股雷達'], ['picks', '策略組合'], ['cards', '研究卡'], ['industry', '產業定位'], ['etf', 'ETF 健檢'], ['claims', '待驗主張'], ['learn', '技術教學']];
if (current === 'picks') render();
if (typeof FLOWS !== 'undefined' && !FLOWS[0].steps.some(s => s[0] === 'picks')) FLOWS[0].steps.splice(1, 0, ['picks', '策略組合']);

/* ================= 研究卡清單：搜尋、產業、動作篩選與排序 ================= */
const RC_SORT = [['date', '研究日（新→舊）'], ['up', '估值空間（大→小）'], ['chg', '近 20 日漲幅'], ['code', '代號']];
const rcInfo = c => { const f = findLayer(c.layer), x = c.example ? null : assetCheck(c); return { c, f, chain: f ? f.ch.name : '未定位', layer: f ? `${f.ch.name}｜${f.i + 1} ${f.l.n}` : '未定位', act: x && x.st[0] !== '資料不足' ? x.st[0] : '', up: valSummary(c).upside, chg: chg20(c) }; };
const _cardsRC = PAGES.cards;
PAGES.cards = () => {
  const h = _cardsRC(); if (openCardId) return h;
  const F = S.rcF = S.rcF || {}, all = S.cards.map(rcInfo);
  // 抽出每張卡片的 HTML
  const blocks = {}, re = /<button class="rc-item" data-card="([^"]+)">[\s\S]*?<\/button>/g; let m, first = -1, last = -1;
  while ((m = re.exec(h))) { blocks[m[1]] = m[0]; if (first < 0) first = m.index; last = m.index + m[0].length; }
  if (first < 0) return h;
  const q = (F.q || '').trim().toLowerCase();
  const ok = i => (!F.chain || i.chain === F.chain) && (!F.layer || i.layer === F.layer) && (!F.act || i.act === F.act);
  let list = all.filter(i => blocks[i.c.id] && ok(i));
  const key = { date: i => i.c.date || '', up: i => i.up ?? -1e9, chg: i => i.chg ?? -1e9, code: i => String(i.c.code) }[F.sort || 'date'];
  const order = Object.keys(blocks); // 原本的順序（持有中優先）
  if (F.sort && F.sort !== 'date') list.sort((a, b) => F.sort === 'code' ? key(a).localeCompare(key(b)) : key(b) - key(a)); else list.sort((a, b) => order.indexOf(a.c.id) - order.indexOf(b.c.id));
  const qOf = i => `${i.c.code} ${i.c.name || ''} ${i.layer} ${i.act}`.toLowerCase();
  const body = list.map(i => blocks[i.c.id].replace('<button class="rc-item"', `<button class="rc-item" data-q="${esc(qOf(i))}"${q && !qOf(i).includes(q) ? ' hidden' : ''}`)).join('');
  const opt = (arr, cur, none) => `<option value="">${none}</option>` + [...new Set(arr)].filter(Boolean).sort().map(v => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const layers = all.filter(i => !F.chain || i.chain === F.chain).map(i => i.layer);
  const bar = `<div class="rc-tools"><input type="search" id="rcQ" placeholder="🔍 搜尋代號、名稱、產業" value="${esc(F.q || '')}" autocomplete="off">
    <div class="rc-sel"><select data-rcf2="chain">${opt(all.map(i => i.chain), F.chain, '全部產業鏈')}</select>
      <select data-rcf2="layer">${opt(layers, F.layer, '全部層級')}</select>
      <select data-rcf2="act">${opt(all.map(i => i.act), F.act, '全部動作')}</select>
      <select data-rcf2="sort">${RC_SORT.map(([k, l]) => `<option value="${k}" ${k === (F.sort || 'date') ? 'selected' : ''}>排序：${l}</option>`).join('')}</select></div>
    ${F.chain || F.layer || F.act || F.q ? `<div class="help">顯示 ${list.length} 張・<a class="pk-a" id="rcClear">清除篩選</a></div>` : ''}</div>`;
  const newBtn = h.indexOf('<button class="rc-new"'), gridStart = h.lastIndexOf('<div class="rc-grid">', newBtn);
  const pre = h.slice(0, gridStart), mid = h.slice(gridStart, first), post = h.slice(last);
  return pre + bar + mid + (body || '') + post + (list.length ? '' : '<div class="card empty">沒有符合條件的研究卡。</div>');
};
document.addEventListener('input', e => {
  if (e.target.id !== 'rcQ') return;
  const q = e.target.value.trim().toLowerCase(); S.rcF = Object.assign(S.rcF || {}, { q: e.target.value }); save();
  document.querySelectorAll('.rc-item[data-q]').forEach(b => { b.hidden = !!q && !b.dataset.q.includes(q); });
});
document.addEventListener('change', e => {
  const k = e.target.dataset?.rcf2; if (!k) return;
  S.rcF = Object.assign(S.rcF || {}, { [k]: e.target.value }); if (k === 'chain') S.rcF.layer = ''; save(); render();
});
document.addEventListener('click', e => { if (e.target.id === 'rcClear') { S.rcF = { sort: S.rcF?.sort }; save(); render(); } });
if (current === 'cards') render();
