/* ================= 整併頁（給理財新手看的入口） =================
   選股、趨勢與產業的分頁｜ETF 健檢｜市場總覽（決策地圖＋溫度走勢＋五個問題）｜理財體檢｜投資覆盤 */
'use strict';

const hubTabs = (cur, a) => `<div class="chips hub-tabs">${a.map(([k, l]) => `<button class="chip ${k === cur ? 'on' : ''}" data-go="${k}">${l}</button>`).join('')}</div>`;
const hubLight = { g: '🟢', y: '🟡', r: '🔴', n: '⚪' };
const hubBar = (l, w, v, cls = '') => `<div class="hub-b"><span>${l}</span><i><b class="${cls}" style="width:${Math.max(1, Math.min(100, w))}%"></b></i><em>${v}</em></div>`;

/* ---------- 研究：把策略組合併進選股、產業定位併進趨勢 ---------- */
const hubThemeTabs = c => hubTabs(c, [['themes', '🔥 趨勢主題'], ['industry', '🏭 產業定位']]);
const _picksHub = PAGES.picks, _indHub = PAGES.industry;
PAGES.picks = () => _picksHub().replace('<h2>策略組合</h2>', `<h2>選股</h2>${vrTabs('picks')}`);
PAGES.industry = () => _indHub().replace('<h2>產業定位</h2>', `<h2>趨勢與產業</h2>${hubThemeTabs('industry')}`);

/* ---------- ETF 健檢 ---------- */
const etfFee = e => { const m = String(e.fee || '').match(/[\d.]+/); return m ? +m[0] : null; };
function etfWeights() {
  const E = S.etfs, hs = wealth().hs, mv = e => hs.find(h => h.code === hKey(e.name))?.mvT || 0, tot = E.reduce((s, e) => s + mv(e), 0);
  if (tot) return { w: id => mv(E.find(e => e.id === id)) / tot, src: '依你目前持有的市值計算' };
  const set = E.reduce((s, e) => s + (num(S.etfAlloc[e.id]) || 0), 0);
  if (set) return { w: id => (num(S.etfAlloc[id]) || 0) / set, src: '依下方「進階」設定的比重試算' };
  return { w: () => 1 / (E.length || 1), src: '假設每檔買一樣多' };
}
PAGES.etf = () => {
  const E = S.etfs, W = etfWeights(), full = E.filter(e => parseHoldings(e.holdings).length);
  const miss = wealth().hs.filter(h => /^00/.test(h.code) && !E.some(e => hKey(e.name) === h.code)).map(h => h.code);
  const add = `<div class="btn-row"><button class="btn-small" id="etfAuto">＋ 輸入代號加入</button>${E.length ? '<button class="btn-small ghost" id="etfRefreshAll">更新成分股</button>' : ''}</div>`;
  const head = `<h2>ETF 健檢</h2><p class="lead">幫你看穿 ETF 裡面到底買了什麼：<b>有沒有買重複、錢是不是太集中、費用貴不貴</b>。每季看一次就好。</p>`;
  if (!E.length) return head + `<div class="card empty-steps"><h3 class="gold-bar">三步驟開始</h3><ol><li>按下面的按鈕，輸入你買的 ETF 代號（例如 0050）。</li><li>網站會自動抓成分股和費用。</li><li>回來這裡看體檢結果。</li></ol>${add}</div>`;
  // 合併穿透
  const M = new Map();
  full.forEach(e => parseHoldings(e.holdings).forEach(x => { const k = hKey(x.name), m = M.get(k) || { name: x.name, w: 0, from: new Set() }; m.w += W.w(e.id) * x.w; m.from.add(hKey(e.name)); M.set(k, m); }));
  const top = [...M.values()].sort((a, b) => b.w - a.w), t1 = top[0], t10 = top.slice(0, 10).reduce((s, x) => s + x.w, 0);
  // 重疊
  const pairs = []; for (let i = 0; i < full.length; i++) for (let j = i + 1; j < full.length; j++) pairs.push({ a: full[i], b: full[j], o: overlap(full[i], full[j]) });
  pairs.sort((x, y) => y.o - x.o); const P = pairs[0];
  const fees = E.map(e => ({ f: etfFee(e), w: W.w(e.id) })).filter(x => x.f != null), feeW = fees.reduce((s, x) => s + x.w, 0), fee = feeW ? fees.reduce((s, x) => s + x.f * x.w, 0) / feeW : null;
  const allTW = E.every(e => /^\s*(台灣|中華民國)/.test(e.country || '台灣'));
  const items = [
    P ? { c: P.o >= 50 ? 'r' : P.o >= 25 ? 'y' : 'g', t: '有沒有買重複？', v: `${hKey(P.a.name)} 和 ${hKey(P.b.name)} 有 ${fmt(P.o, 0)}% 一樣`, d: P.o >= 50 ? '兩檔幾乎是同一份東西，留一檔就好，手續費和管理費都省下來。' : P.o >= 25 ? '有一部分重複，還可以接受，但別再加同類型的。' : '內容差異夠大，分散效果不錯。' } : { c: 'n', t: '有沒有買重複？', v: '只有一檔，不用比', d: '加入第二檔 ETF 才看得出重複。' },
    t1 ? { c: t1.w >= 30 ? 'r' : t1.w >= 15 ? 'y' : 'g', t: '錢太集中嗎？', v: `${fmt(t1.w, 0)}% 押在 ${esc(t1.name)}`, d: t1.w >= 30 ? '一家公司出事影響很大。台股 ETF 常見這個狀況，想分散可以加美股或全球 ETF。' : t1.w >= 15 ? '有點集中，但還在常見範圍。' : '分散得不錯。' } : { c: 'n', t: '錢太集中嗎？', v: '還沒有成分股', d: '按「更新成分股」。' },
    { c: fee == null ? 'n' : fee <= 0.5 ? 'g' : fee <= 1 ? 'y' : 'r', t: '費用貴嗎？', v: fee == null ? '還沒有資料' : `平均每年 ${fmt(fee, 2)}%`, d: fee == null ? '按「更新成分股」取得費用率。' : fee <= 0.5 ? '很便宜，長期省很多。' : fee <= 1 ? '普通，可以比較同類型有沒有更便宜的。' : '偏貴，長期會吃掉不少報酬。' },
    { c: allTW ? 'y' : 'g', t: '只押台灣嗎？', v: allTW ? '全部都在台灣' : '有海外分散', d: allTW ? '台股表現好時很舒服，但如果想降低單一市場風險，可以考慮放一部分在美股或全球 ETF。' : '不同市場可以互相緩衝。' },
  ];
  const bad = items.filter(x => x.c === 'r').length, warn = items.filter(x => x.c === 'y').length;
  const say = bad ? `有 ${bad} 件事建議處理` : warn ? `整體還可以，有 ${warn} 件事留意` : '很健康，繼續放著';
  const cards = E.map(e => { const s = etfStats(e), t = s.h[0], w = W.w(e.id) * 100; return `<div class="etf-c" data-etf="${e.id}"><div class="etf-h"><b>${esc(e.name)}</b>${e.example ? '<i class="pill gold">範例</i>' : ''}<em>占 ${fmt(w, 0)}%</em></div>
    ${s.h.length ? `<dl><div><dt>最大持股</dt><dd>${esc(String(t.name).replace(/^\S+\s+/, '') || t.name)} ${fmt(t.w, 0)}%</dd></div><div><dt>前十大</dt><dd>${fmt(s.top10, 0)}%</dd></div><div><dt>等於分散在</dt><dd>${s.neff ? fmt(s.neff, 0) : '—'} 檔</dd></div><div><dt>每年費用</dt><dd>${etfFee(e) != null ? fmt(etfFee(e), 2) + '%' : '—'}</dd></div></dl>` : '<div class="help">還沒有成分股，按「更新成分股」。</div>'}</div>`; }).join('');
  return head + `<div class="card wide hub-hero"><div class="hub-k">體檢結果</div><div class="hub-t">${bad ? '🔴' : warn ? '🟡' : '🟢'} ${say}</div>
    <div class="hub-q">${items.map(x => `<div><span>${hubLight[x.c]}</span><div><em>${x.t}</em><b>${x.v}</b><small>${x.d}</small></div></div>`).join('')}</div>
    ${miss.length ? `<div class="help">你還持有 ${esc(miss.join('、'))}，沒有加入健檢。</div>` : ''}${add}</div>
  ${top.length ? `<div class="card"><h3 class="gold-bar">你實際買到哪些公司</h3><div class="help">把所有 ETF 拆開合併後的前 10 大，${W.src}。前 10 大合計 <b>${fmt(t10, 0)}%</b>。</div>
    <div class="hub-bars">${top.slice(0, 10).map(x => hubBar(esc(x.name), x.w / top[0].w * 100, fmt(x.w, 1) + '%')).join('')}</div></div>` : ''}
  <div class="card"><h3 class="gold-bar">每一檔的小檔案</h3><div class="help">點一下可以編輯或刪除。</div><div class="etf-g">${cards}</div></div>
  ${pairs.length > 1 ? `<div class="card"><h3 class="gold-bar">兩兩比較：內容重複多少</h3><div class="hub-bars">${pairs.slice(0, 8).map(p => hubBar(`${esc(hKey(p.a.name))} × ${esc(hKey(p.b.name))}`, p.o, fmt(p.o, 0) + '%', p.o >= 50 ? 'r' : p.o >= 25 ? 'y' : 'g')).join('')}</div><div class="help">超過 50% 就算買重複。</div></div>` : ''}
  <details class="card rc-sub"><summary>進階：試算比重、環境筆記、健檢紀錄</summary>
    <div class="pl-lbl">還沒持有時，用這裡的比重試算（%）</div><div class="inline">${E.map(e => `<label class="f"><span>${esc(e.name)}</span><input type="number" inputmode="decimal" data-alloc="${e.id}" value="${esc(S.etfAlloc[e.id] ?? '')}"></label>`).join('')}</div>
    ${typeof quadrant === 'function' && quadrant() ? `<div class="note">目前總經象限：<b>${quadrant().name}</b>　${quadrant().tilt}</div>` : ''}
    <label class="f"><span>環境筆記：現在什麼因素對這些 ETF 不利？</span><textarea data-bind="etfEnv">${esc(S.etfEnv)}</textarea></label>
    <div class="card-head"><b>健檢紀錄</b>${addBtn('etfLog')}</div>${recordList('etfLog')}
    <div class="help">有效檔數 ＝ 1 ÷ Σ(權重²)。成分股資料來自 MoneyDJ 公開頁面。</div></details>`;
};

/* ---------- 市場總覽 ---------- */
const MK_X = ['收縮', '復甦', '擴張', '趨緩'], MK_Y = [['boil', '滾水'], ['hot', '偏熱'], ['mid', '常溫'], ['cold', '偏冷'], ['ice', '冰水']];
function mkCell(p, z) {
  if (z === 'ice') return ['分批買', 'buy'];
  if (z === 'cold') return ['備清單', 'ready'];
  if (z === 'hot') return ['放慢', 'slow'];
  if (z === 'boil') return p === '收縮' || p === '趨緩' ? ['減碼', 'guard'] : ['抱住', 'guard'];
  return p === '收縮' ? ['保守', 'slow'] : p === '趨緩' ? ['轉防禦', 'slow'] : ['照計畫', 'ok'];
}
function mkActs(z, lv) {
  return { ice: ['照扣，別停', '可分 3～4 批買', '別恐慌賣出'], cold: ['照扣', '先列好清單', '續抱'], mid: ['照扣', lv === 'r' ? '先放慢' : '照計畫', '續抱'], hot: ['照扣', '放慢、別追', '寫好停利線'], boil: ['照扣', '不追高', '設移動停利'] }[z];
}
function mkMap(pts) {
  const at = (p, z) => pts.filter(x => x.p === p && x.z === z).map(x => x.f).join('');
  return `<div class="mk-map"><span></span>${MK_X.map(p => `<b class="mk-x">${PHASE[p].ic} ${p}</b>`).join('')}
    ${MK_Y.map(([z, l]) => `<b class="mk-y">${l}</b>${MK_X.map(p => { const [t, c] = mkCell(p, z), me = at(p, z); return `<div class="mk-c ${c} ${me ? 'me' : ''}">${me ? `<i>${me}</i>` : ''}<span>${t}</span></div>`; }).join('')}`).join('')}</div>
    <div class="mk-cap"><span>景氣循環：由左到右依序發生，趨緩之後回到收縮</span></div>`;
}
function mkTrend() {
  const A = S.ext['^TWII'], B = S.ext['^GSPC']; if (!A?.hist?.length) return '<div class="empty">溫度資料讀取中…</div>';
  const W = 360, H = 168, L = 26, R = 12, T = 8, Bm = 18, n = Math.max(A.hist.length, B?.hist?.length || 0);
  const x = (i, len) => L + (i + n - len) / (n - 1) * (W - L - R), y = v => T + (100 - v) / 100 * (H - T - Bm);
  const band = (a, b, c) => `<rect x="${L}" width="${W - L - R}" y="${y(b)}" height="${y(a) - y(b)}" class="${c}"/>`;
  const path = h => h.map((v, i) => v == null ? '' : `${i && h[i - 1] != null ? 'L' : 'M'}${x(i, h.length).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const ym = String(A.histStart || '').slice(0, 7);
  return `<svg class="mk-tr" viewBox="0 0 ${W} ${H}" role="img" aria-label="台股與美股近兩年的市場溫度">
    ${band(95, 100, 'boil')}${band(80, 95, 'hot')}${band(20, 80, 'mid')}${band(5, 20, 'cold')}${band(0, 5, 'ice')}
    ${[['滾水', 97.5], ['偏熱', 87], ['常溫', 50], ['偏冷', 12], ['冰水', 2]].slice(1, 4).map(([t, v]) => `<text x="${L - 3}" y="${y(v) + 3}" text-anchor="end">${t}</text>`).join('')}
    ${B?.hist?.length ? `<path d="${path(B.hist)}" class="l-us"/>` : ''}<path d="${path(A.hist)}" class="l-tw"/>
    <circle cx="${x(A.hist.length - 1, A.hist.length)}" cy="${y(A.hist[A.hist.length - 1])}" r="3.4" class="d-tw"/>
    <text x="${L}" y="${H - 5}">${ym}</text><text x="${W - R}" y="${H - 5}" text-anchor="end">今天</text></svg>
    <div class="rt-leg"><span><i class="k-tw"></i>台股 ${fmt(A.temp, 0)}</span>${B ? `<span><i class="k-us"></i>美股 ${fmt(B.temp, 0)}</span>` : ''}<span>0＝歷史最冷、100＝歷史最熱</span></div>`;
}
const MK_Q = [
  ['😨', '大家害怕嗎？', ['^VIX'], { g: '不怕，市場平靜', y: '有點緊張', r: '很害怕，波動會變大', o: '極度恐慌，歷史上常是長線買點' }],
  ['💵', '錢還往股市流嗎？', ['DX-Y.NYB', '^GSPC', '^DJI'], { g: '資金還在股市', y: '方向不明', r: '資金正在撤出' }],
  ['💻', '科技股好嗎？', ['^IXIC', '^SOX'], { g: '科技股強，台股電子有撐', y: '科技股方向不明', r: '科技股轉弱，台股電子有壓力' }],
  ['⛽', '物價壓力大嗎？', ['GC=F', 'CL=F'], { g: '沒有明顯壓力', y: '有一點壓力', r: '壓力大，利率可能維持高檔' }],
  ['🇹🇼', '台股內部健康嗎？', ['TW'], { g: '大小股一起漲', y: '整體回檔，但沒有分歧', r: '大小股走勢分歧，要小心' }],
];
function mkWind(M) {
  if (!M.rows.length) return '<div class="empty">指標讀取中…</div>';
  const n = M.rows.length, seg = (k, v) => v ? `<i class="${k}" style="width:${v / n * 100}%">${v}</i>` : '';
  const rows = MK_Q.map(([ic, q, syms, say]) => {
    const R = M.rows.filter(r => syms.includes(r.sym)); if (!R.length) return '';
    const s = R.reduce((a, r) => a + (r.c === 'g' ? 1 : r.c === 'r' ? -1 : 0), 0) / R.length, o = R.some(r => r.c === 'o'), c = o ? 'o' : s > 0.3 ? 'g' : s < -0.3 ? 'r' : 'y';
    return `<details class="mk-q"><summary><span class="mk-ic">${ic}</span><span class="mk-qt"><em>${q}</em><b>${say[c]}</b></span><span class="mk-w"><i class="${c}" style="left:${o ? 96 : 50 + s * 46}%"></i></span></summary>
      ${R.map(r => `<div class="mk-d"><b>${SIG_IC[r.c]} ${esc(r.n)}</b>${r.v ? `<span>${esc(r.v)}</span>` : ''}<p>${esc(r.t)}</p></div>`).join('')}</details>`;
  }).join('');
  return `<div class="mk-stack">${seg('g', M.g)}${seg('y', M.y)}${seg('r', M.red + (M.vix40 ? 1 : 0))}</div><div class="mk-cap"><span>順風 ${M.g}</span><span>中性 ${M.y}</span><span>逆風 ${M.red}</span></div>
    <div class="mk-wh"><span>逆風</span><span>順風</span></div>${rows}<div class="help">點每一列可以看背後的指標。</div>`;
}
let mkBusy = false, mkDone = 0;
function mkLoad() {
  if (mkBusy || Date.now() - mkDone < 3e5 || !location.protocol.startsWith('http')) return;
  mkBusy = true;
  Promise.all([loadWorld(false), loadExtreme('^TWII', false), loadExtreme('^GSPC', false), typeof refreshHoldQuotes === 'function' ? refreshHoldQuotes(false) : null]).catch(() => {}).finally(() => {
    mkBusy = false; mkDone = Date.now(); try { sysWatch(); } catch (e) { /* 資料不全 */ }
    if (current === 'market') { const y = scrollY; render(); scrollTo(0, y); }
  });
}
PAGES.market = () => {
  setTimeout(mkLoad, 30);
  const V = verdict('tw'), U = verdict('us'), M = mktSignals(), Pt = phaseOf('tw')?.ph, Pu = phaseOf('us')?.ph;
  const pts = [V && Pt && { f: '🇹🇼', p: Pt, z: V.z }, U && Pu && { f: '🇺🇸', p: Pu, z: U.z }].filter(Boolean);
  const A = V ? mkActs(V.z, M.lv[0]) : null;
  const hero = `<div class="card wide hub-hero"><div class="hub-k">今天該怎麼做・台股</div>
    ${V ? `<div class="hub-t">${V.M.ic} ${esc(V.M.n)}</div><p class="hub-p">${esc(V.t)}</p>
    <div class="hub-acts"><div><em>定期定額</em><b>${A[0]}</b></div><div><em>單筆加碼</em><b>${A[1]}</b></div><div><em>手上持股</em><b>${A[2]}</b></div></div>
    <div class="hub-sub">${Pt ? `景氣 ${PHASE[Pt].ic} ${Pt}・` : ''}溫度 ${EXT_Z[V.z].ic} ${EXT_Z[V.z].n} ${fmt(V.temp, 0)}・外部環境 ${SIG_IC[M.lv[0]] || ''} ${M.lv[1] || '讀取中'}${U ? `<br>🇺🇸 美股：${U.M.ic} ${esc(U.M.short)}（溫度 ${fmt(U.temp, 0)}）` : ''}</div>` : '<div class="hub-t">讀取市場資料中…</div><p class="hub-p">第一次約需 20 秒。</p>'}</div>`;
  const map = `<div class="card wide"><h3 class="gold-bar">🧭 市場地圖：現在在哪一格</h3><div class="help">直的看股市冷熱，橫的看景氣。<b>國旗所在的格子，就是現在該用的做法。</b></div>
    <div class="mk-two"><div>${mkMap(pts)}</div><div><div class="pl-lbl">近兩年的溫度走勢</div>${mkTrend()}</div></div></div>`;
  const list = S.cards.filter(c => c.code && !c.example).map(assetCheck).filter(x => x.h), act = list.filter(x => ['neg', 'gold'].includes(x.st[1]));
  const my = `<div class="card"><div class="card-head"><h3 class="gold-bar">📋 我的持股</h3><button class="btn-small ghost" data-go="timing">全部 ›</button></div>
    ${list.length ? (act.length ? act.slice(0, 5).map(x => `<div class="mk-h" data-card="${x.c.id}" data-go-card="1"><b>${esc(x.code)} ${esc(x.c.name || '')}</b><i class="tm-st ${x.st[1]}">${esc(x.st[0])}</i><p>${esc(x.st[2])}</p></div>`).join('') : `<div class="mk-ok">✅ ${list.length} 檔持股都不需要動作，續抱就好。</div>`) : (wealth().hs.length ? '<div class="empty">持股的研究卡還在準備資料，稍後再回來看。</div>' : '<div class="empty">還沒有持股資料。到「資產」記一筆交易，這裡就會告訴你該怎麼做。</div>')}</div>`;
  const deep = [['timing', '🎯', '進出場時機', '每一檔要買、要賣還是抱'], ['extreme', '🌡️', '極端訊號', '股市是不是跌過頭或漲過頭'], ['macro', '📊', '總經數據', '各國景氣、利率的原始數字'], ['cycles', '🔄', '週期研究', '長短週期與季節性'], ['metfx', '🪙', '黃金・匯率', '黃金、美元、台幣走勢']];
  return `<h2>市場總覽</h2><p class="lead">不用看一堆指標，先看結論。想知道為什麼，再往下看。</p>${hero}${map}
    <div class="card"><h3 class="gold-bar">🌬️ 順風還是逆風</h3>${mkWind(M)}</div>${my}
    <div class="card wide"><h3 class="gold-bar">想再深入</h3><div class="help">平常不用看，想研究時再點。</div><div class="mk-links">${deep.map(([k, ic, t, d]) => `<button data-go="${k}"><span>${ic}</span><b>${t}</b><em>${d}</em></button>`).join('')}</div></div>`;
};

/* ---------- 財務計畫：理財體檢 ---------- */
function planCheck() {
  const p = plP(), W = wealth(), L = plLedgerExp(), exp = L?.v || plExpense(p).v;
  const cur = ym(today()), ms = [...new Set(S.ledger.map(e => ym(e.date || '')))].filter(m => m && m < cur).sort().slice(-6).map(monthStats).filter(m => m.inc > 0);
  const rate = ms.length ? ms.reduce((s, m) => s + m.net, 0) / ms.reduce((s, m) => s + m.inc, 0) * 100 : null;
  const mo = exp ? W.cash / exp : null, stockV = W.tw + W.us + W.invIns, R = plCalc(p), ok = !R.err;
  const stockP = W.invest ? stockV / W.invest * 100 : null, tgt = ok ? plGlide(R.n) : 70;
  const sg = W.hs.filter(h => !/^00/.test(h.code) && !/ETF/i.test(h.name || '')).sort((a, b) => b.mvT - a.mvT)[0], tot = W.tw + W.us, sgP = sg && tot ? sg.mvT / tot * 100 : null, dca = plCurDca();
  const hasIns = S.insurance.some(i => /^保障/.test(i.kind || ''));
  const go = (l, k) => [l, `data-go="${k}"`], view = (l, v) => [l, `data-planview="${v}"`];
  return [
    { ic: '💸', t: '每個月存得下錢嗎？', n: '提高儲蓄率', c: rate == null ? 'n' : rate >= 20 ? 'g' : rate >= 10 ? 'y' : 'r', v: rate == null ? '還不知道' : `存下收入的 ${fmt(rate, 0)}%`, d: rate == null ? '記帳一個月，就知道錢花到哪裡。' : rate >= 20 ? '很好，存 20% 以上就在正軌。' : '目標是存下收入的 20%，先看最大筆的支出能不能砍。', a: go(rate == null ? '開始記帳' : '看收支', 'ledger') },
    { ic: '🛟', t: '突然沒收入撐得住嗎？', n: '存好緊急預備金', c: mo == null ? 'n' : mo >= 6 ? 'g' : mo >= 3 ? 'y' : 'r', v: mo == null ? '還不知道' : `現金夠用 ${fmt(mo, 1)} 個月`, d: mo >= 6 ? '緊急預備金夠了，多的錢可以拿去投資。' : `先存到 6 個月生活費（約 ${fmt(Math.round(exp * 6 / 1000) * 1000)} 元），這筆錢不要拿去投資。`, a: go('更新存款', 'home') },
    { ic: '💳', t: '有卡費要繳嗎？', n: '繳清卡費', c: W.cardD > 0 ? 'y' : 'g', v: W.cardD > 0 ? `未繳 ${fmt(W.cardD)} 元` : '沒有', d: W.cardD > 0 ? '一定要全額繳清，循環利息比投資報酬還高。' : '很好，沒有高利息負債的壓力。', a: go('看資產', 'home') },
    { ic: '🛡️', t: '萬一生病受傷有保障嗎？', n: '確認基本保障', c: hasIns ? 'g' : 'y', v: hasIns ? '已有保障型保險' : '還沒記錄', d: hasIns ? '記得每年看一次保額夠不夠。' : '先確認有醫療、意外險；儲蓄險不算保障。', a: go('記錄保單', 'home') },
    { ic: '🔁', t: '有固定在投資嗎？', n: '開始定期定額', c: dca > 0 ? 'g' : 'y', v: dca > 0 ? `每月約 ${fmt(dca)} 元` : '還沒設定', d: dca > 0 ? '讓時間幫你賺錢，下跌時也別停。' : '設定每月自動買 0050 這類指數 ETF，是最簡單有效的方法。', a: go('設定定期定額', 'home') },
    { ic: '🥚', t: '雞蛋放太集中嗎？', n: '分散持股', c: sgP == null ? (W.hs.length ? 'g' : 'n') : sgP > 30 ? 'r' : sgP > 15 ? 'y' : 'g', v: sgP == null ? (W.hs.length ? '都是 ETF' : '還沒持股') : `最大個股 ${esc(sg.code)} 占 ${fmt(sgP, 0)}%`, d: sgP == null ? (W.hs.length ? 'ETF 已經幫你分散了。' : '記錄交易後才能判斷。') : sgP > 30 ? '單一個股太大，一出事就傷很重，建議降到 15% 以內。' : sgP > 15 ? '有點集中，不要再加碼這檔。' : '分散得不錯。', a: go('看持股', 'home') },
    { ic: '⚖️', t: '股票比例適合你嗎？', n: '調整股票比例', c: stockP == null ? 'n' : Math.abs(stockP - tgt) <= 15 ? 'g' : 'y', v: stockP == null ? '還不知道' : `目前 ${fmt(stockP, 0)}%，建議約 ${tgt}%`, d: stockP == null ? '記錄存款和持股後才能判斷。' : stockP < tgt - 15 ? '現金偏多，通膨會慢慢吃掉購買力，可以分批多投一點。' : stockP > tgt + 15 ? '股票偏多，股市大跌時波動會很大，要確定自己撐得住。' : `離退休越遠，股票可以放越多。`, a: go('看資產配置', 'home') },
    { ic: '🏖️', t: '退休金夠嗎？', n: '算一下退休金', c: !ok ? 'n' : R.prog >= 1 ? 'g' : R.prog >= 0.7 ? 'y' : 'r', v: !ok ? '還沒試算' : `完成 ${fmt(R.prog * 100, 0)}%`, d: !ok ? '填出生年和退休制度，一分鐘算出要存多少。' : R.ok ? '照現在的速度夠用。' : `照現在的速度還差一些，再多投約每月 ${fmt(Math.max(0, R.per[12] - R.cur))} 元就夠。`, a: view(ok ? '看退休計畫' : '開始試算', 'retire') },
  ];
}
function planCheckHTML() {
  const Q = planCheck(), g = Q.filter(x => x.c === 'g').length, n = Q.length, next = Q.find(x => x.c === 'r') || Q.find(x => x.c === 'y') || Q.find(x => x.c === 'n');
  const col = g / n >= 0.75 ? 'var(--green)' : g / n >= 0.4 ? 'var(--yellow)' : 'var(--red)';
  return `<div class="card wide hub-hero pc-hero"><div class="pc-ring" style="background:conic-gradient(${col} ${g / n * 360}deg, rgba(127,127,127,.2) 0)"><div><b>${g}</b><span>/ ${n}</span></div></div>
    <div><div class="hub-k">你的理財體檢</div><div class="hub-t">${g === n ? '🎉 全部及格' : next ? `下一步：${next.n}` : ''}</div>
    ${next ? `<p class="hub-p">${next.d}</p><button class="btn-small" ${next.a[1]}>${next.a[0]}</button>` : '<p class="hub-p">照現在的方式繼續，每半年回來看一次。</p>'}</div></div>
    <div class="card wide"><h3 class="gold-bar">八個問題，看懂你的財務</h3><div class="help">照順序來：先顧好生活，再談投資。</div>
    <div class="pc-list">${Q.map((x, i) => `<div class="pc-i ${x.c}"><span class="pc-n">${i + 1}</span><div class="pc-b"><em>${x.ic} ${x.t}</em><b>${hubLight[x.c]} ${x.v}</b><small>${x.d}</small></div><button class="btn-small ghost" ${x.a[1]}>${x.a[0]}</button></div>`).join('')}</div></div>
    <div class="help">這是依常見理財原則的簡單檢查，不構成投資或保險建議。</div>`;
}
const _planHub = PAGES.plan;
PAGES.plan = () => {
  const v = S.planView || 'check', tabs = `<div class="chips hub-tabs">${[['check', '🩺 理財體檢'], ['retire', '🏖️ 退休試算'], ['goal', '🎯 存到目標']].map(([k, l]) => `<button class="chip ${k === v ? 'on' : ''}" data-planview="${k}">${l}</button>`).join('')}</div>`;
  if (v === 'check') return `<h2>財務計畫</h2>${tabs}${planCheckHTML()}`;
  return _planHub().replace(/<div class="pl-mode">[\s\S]*?<\/div>/, tabs);
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-planview]'); if (!t) return;
  const v = t.dataset.planview; S.planView = v; if (v !== 'check') plSet('mode', v);
  save(); if (current !== 'plan') go('plan'); else render(); window.scrollTo(0, 0);
});

/* ---------- 投資覆盤：成績單＋想法驗證 ---------- */
const hubReviewTabs = c => hubTabs(c, [['review', '📒 我的成績單'], ['claims', '🧪 驗證想法']]);
function hubRounds() {
  const pos = {}, out = [];
  [...S.trades].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
    const k = String(t.code || '').toUpperCase(); if (!k) return;
    const p = pos[k] = pos[k] || { sh: 0, cost: 0 }, sh = num(t.shares) || 0, px = num(t.price) || 0, fee = t.fee !== '' && t.fee != null ? num(t.fee) || 0 : estFee(t);
    if (t.side === '賣出') {
      const avg = p.sh ? p.cost / p.sh : 0, q = Math.min(sh, p.sh); if (!q) return;
      const pnl = q * px - fee - avg * q; out.push({ date: t.date, code: k, name: t.name || '', pnl: toTWD(pnl, ccyOf(k)), pct: avg ? pnl / (avg * q) * 100 : 0 });
      p.cost -= avg * q; p.sh -= q; if (p.sh <= 0) { p.sh = 0; p.cost = 0; }
    } else { p.sh += sh; p.cost += sh * px + fee; }
  });
  return out;
}
PAGES.review = () => {
  const R = hubRounds(), win = R.filter(x => x.pnl > 0), lose = R.filter(x => x.pnl <= 0), tot = R.reduce((s, x) => s + x.pnl, 0), avg = a => a.length ? a.reduce((s, x) => s + x.pct, 0) / a.length : null;
  const pend = S.reviews.filter(r => !r.result).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const L = {}; S.reviews.forEach(r => String(r.lesson || '').split(/[、,，]/).map(s => s.trim()).filter(Boolean).forEach(k => { L[k] = (L[k] || 0) + 1; }));
  const good = '判斷正確，紀律執行', errs = Object.entries(L).filter(([k]) => k !== good).sort((a, b) => b[1] - a[1]), max = errs[0]?.[1] || 1, rec = R.slice(-24), big = Math.max(...rec.map(x => Math.abs(x.pnl)), 1);
  const hero = `<div class="card wide hub-hero"><div class="hub-k">已賣出的成績</div>${R.length ? `<div class="hub-t ${tot >= 0 ? 'up' : 'down'}">${tot >= 0 ? '+' : ''}${fmt(tot)} 元</div>
    <div class="hub-acts"><div><em>賺錢／賠錢</em><b>${win.length} 次／${lose.length} 次</b></div><div><em>勝率</em><b>${fmt(win.length / R.length * 100, 0)}%</b></div><div><em>平均賺／賠</em><b>${win.length ? '+' + fmt(avg(win), 0) + '%' : '—'}／${lose.length ? fmt(avg(lose), 0) + '%' : '—'}</b></div></div>
    <div class="rv-bars">${rec.map(x => `<i class="${x.pnl >= 0 ? 'up' : 'down'}" style="height:${Math.max(4, Math.abs(x.pnl) / big * 100)}%" title="${esc(`${x.date} ${x.code} ${fmt(x.pnl)}`)}"></i>`).join('')}</div><div class="hub-sub">每一根是一筆賣出（紅賺綠賠），最右邊是最近一筆。</div>` : '<div class="hub-t">還沒有賣出紀錄</div><p class="hub-p">賣出後，這裡會自動算出你賺賠幾次、勝率多少。</p>'}</div>`;
  return `<h2>投資覆盤</h2>${hubReviewTabs('review')}${hero}
    <div class="card"><div class="card-head"><h3 class="gold-bar">✍️ 待補的功課</h3>${addBtn('reviews', '＋ 寫一筆')}</div>
      ${pend.length ? `<div class="help">買了之後結果如何？點一下補上就好，一筆 30 秒。</div>${pend.slice(0, 6).map(r => `<div class="rec" data-edit="reviews" data-id="${r.id}"><div class="r-top"><span class="r-title">${esc(r.target || '')} ${esc(r.decision || '')}</span><span class="pill gold">補結果</span></div><div class="r-meta">${esc(r.date || '')}</div></div>`).join('')}${pend.length > 6 ? `<div class="help">還有 ${pend.length - 6} 筆。</div>` : ''}` : '<div class="mk-ok">✅ 沒有待補的覆盤。</div>'}</div>
    <div class="card"><h3 class="gold-bar">🪞 你最常犯的錯</h3>${errs.length ? `<div class="hub-bars">${errs.slice(0, 5).map(([k, v]) => hubBar(esc(k), v / max * 100, v + ' 次', 'r')).join('')}</div>${L[good] ? `<div class="help">做對的次數：<b>${L[good]}</b> 次。</div>` : ''}` : '<div class="empty">覆盤時勾選「學到什麼」，這裡就會統計你的習慣。</div>'}</div>
    <details class="card rc-sub"><summary>全部紀錄（${S.reviews.length} 筆）</summary>${recordList('reviews')}</details>
    <details class="card rc-sub"><summary>覆盤怎麼做？</summary><ol class="help" style="padding-left:18px;margin:6px 0 0"><li>每次買賣到「交易紀錄」記一筆，寫下為什麼。</li><li>存檔時選「建立覆盤」，日期和理由會自動帶入。</li><li>賣出後或每月一次，回來補「結果」和「學到什麼」。</li><li>想確認某個訊號準不準，到「驗證想法」測一次。</li></ol></details>`;
};
const BT_PRE = [['rsiLow', 30, 20, '跌很多時買（RSI 低於 30）'], ['crossUp', 60, 20, '站上季線時買'], ['newHigh', 250, 20, '創一年新高時買'], ['drop', 3, 20, '單日大跌 3% 時買']];
const _claimsHub = PAGES.claims;
PAGES.claims = () => {
  const b = S.bt || {};
  let h = _claimsHub().replace('<h2>待驗主張清冊</h2>', `<h2>投資覆盤</h2>${hubReviewTabs('claims')}`)
    .replace(/<p class="lead">還沒被數據檢驗[\s\S]*?<\/p>/, '<p class="lead">聽到「某個訊號很準」時，先用歷史資料測一次再相信。</p>')
    .replace('<h3 class="gold-bar">回測工具（技術面主張）</h3>', `<h3 class="gold-bar">🧪 測一個想法</h3><div class="chips sm hub-pre">${BT_PRE.map(([r, n, d, l]) => `<button class="chip ${b.rule === r && +b.N === n ? 'on' : ''}" data-btp="${r},${n},${d}">${l}</button>`).join('')}</div>`)
    .replace('<h3 class="gold-bar">主張清單</h3>', '<h3 class="gold-bar">我記下的想法</h3>')
    .replace('<span>N</span>', '<span>數值 N</span>').replace('<span>持有天數（交易日）</span>', '<span>買進後抱幾天</span>').replace('<button class="btn-small" id="btRun">開始回測</button>', '<button class="btn-small" id="btRun">開始測試</button>');
  // 測試工具放最前面，清單在後
  const a = h.indexOf('<h3 class="gold-bar">🧪'), from = h.lastIndexOf('<div class="card">', a), end = h.indexOf('<div class="card checklist">'), list = h.indexOf('<div class="card"><div class="card-head"><h3 class="gold-bar">我記下的想法');
  if (a >= 0 && list >= 0 && list < from) h = h.slice(0, list) + h.slice(from, end) + h.slice(list, from) + h.slice(end);
  const i = h.indexOf('<div class="card checklist">');
  if (i >= 0) { const j = h.lastIndexOf('</div>'); h = h.slice(0, i) + '<details class="card checklist rc-sub"><summary>測試前的注意事項</summary>' + h.slice(i + 28, j).replace('<h3 class="gold-bar">回測前檢查</h3>', '') + '</details>' + h.slice(j + 6); }
  return h;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-btp]'); if (!t) return;
  const [rule, N, hold] = t.dataset.btp.split(','); S.bt = Object.assign(S.bt || { code: '2330' }, { rule, N: +N, hold: +hold }); save(); const y = scrollY; render(); scrollTo(0, y);
});
