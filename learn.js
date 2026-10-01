/* 技術分析教學：9 堂課＋用真實股票練習＋小測驗 */
'use strict';

const LESSONS = [
  {
    id: 'kline', title: 'K 線（蠟燭圖）', sub: '一根 K 線看懂一天的多空拉鋸', panel: 'candle',
    body: [
      '每一根 K 線記錄一段時間（通常是一天）的四個價格：<b>開盤價、最高價、最低價、收盤價</b>。',
      '中間粗的部分叫「實體」，是開盤到收盤的距離；上下細線叫「影線」，代表盤中曾經到過、但最後沒守住的價格。',
      '台股習慣<b>紅色＝收盤比開盤高（上漲）</b>、<b>綠色＝收盤比開盤低（下跌）</b>。美股軟體常常相反（綠漲紅跌），看圖前先確認。',
    ],
    how: ['長紅實體：買方整天占上風', '長上影線：曾經衝高但被賣壓打回來，上方有壓力', '長下影線：曾經急跌但被買盤撐回來，下方有支撐', '十字線（實體很小）：多空僵持，常出現在轉折前後'],
    trap: '單一根 K 線的意義有限，要搭配它出現的位置（高檔還是低檔）和成交量一起看。',
    quiz: [
      { q: '一根 K 線有很長的上影線，通常代表什麼？', o: ['上方有賣壓', '下方有支撐', '成交量很小'], a: 0, e: '上影線代表股價曾經衝高，但收盤前被賣壓打回來。' },
      { q: '在台股，紅色 K 線代表？', o: ['收盤價比開盤價高', '股價比昨天低', '成交量放大'], a: 0, e: '台股的紅 K 是收盤高於開盤；要注意它不一定代表比昨天漲。' },
    ],
  },
  {
    id: 'ma', title: '移動平均線（均線）', sub: '看趨勢最常用的工具', panel: 'ma',
    body: [
      '均線就是「過去 N 天收盤價的平均」，把每天的上下波動磨平，讓你看出大方向。',
      '常用的有：<b>5 日（週線）、20 日（月線）、60 日（季線）、120 日（半年線）、240 日（年線）</b>。天數越長，越代表長期成本與趨勢。',
      '股價在均線之上，代表最近買進的人平均是賺錢的，比較不急著賣；跌破均線則相反。',
    ],
    how: ['多頭排列：股價＞月線＞季線，且均線向上', '空頭排列：股價＜月線＜季線，且均線向下', '黃金交叉：短均線由下往上穿過長均線，轉強訊號（圖上▲）', '死亡交叉：短均線由上往下穿過長均線，轉弱訊號（圖上▼）'],
    trap: '均線是「落後指標」，交叉出現時股價通常已經走一段了；盤整時會反覆交叉，產生很多假訊號。',
    quiz: [
      { q: '「季線」通常指幾日均線？', o: ['20 日', '60 日', '240 日'], a: 1, e: '一季大約 60 個交易日，所以 60 日均線叫季線。' },
      { q: '月線由下往上穿過季線，叫做？', o: ['死亡交叉', '黃金交叉', '背離'], a: 1, e: '短期均線向上穿越長期均線是黃金交叉，代表短期動能轉強。' },
    ],
  },
  {
    id: 'trend', title: '趨勢、支撐與壓力', sub: '先判斷方向，再決定進出', panel: 'sr',
    body: [
      '<b>上升趨勢</b>：高點一個比一個高、低點也一個比一個高。<b>下降趨勢</b>則反過來。',
      '<b>支撐</b>是過去股價跌到那裡就有買盤進場的價位；<b>壓力</b>是漲到那裡就有人賣的價位（例如之前套牢的人想解套）。',
      '支撐被跌破後，常常會變成新的壓力；壓力被突破後，也常變成新的支撐。',
    ],
    how: ['圖上兩條虛線是近 60 日的最高點（壓力）與最低點（支撐）', '股價接近壓力時追價風險較高', '帶量突破壓力，比無量突破可靠', '停損常設在支撐下方一點點'],
    trap: '支撐壓力是「區域」而不是一個精準的數字，不要因為差幾毛錢就判斷突破或跌破。',
    quiz: [
      { q: '上升趨勢的特徵是？', o: ['高點越來越高、低點也越來越高', '每天都上漲', '成交量越來越小'], a: 0, e: '趨勢看的是波段高低點，不是每天漲跌。' },
      { q: '壓力被帶量突破後，常會變成？', o: ['新的支撐', '新的壓力', '沒有意義'], a: 0, e: '支撐與壓力會互換角色。' },
    ],
  },
  {
    id: 'volume', title: '成交量', sub: '價格要有量才有說服力', panel: 'vol',
    body: [
      '成交量是一段時間內買賣的股數（台股常用「張」，1 張＝1,000 股）。量代表市場的參與熱度。',
      '俗話說「量是價的先行指標」：大資金進出一定會留下量的痕跡。',
    ],
    how: ['量增價漲：健康的上漲，有人願意追價', '價漲量縮：上漲力道可能減弱', '爆量長黑：高檔出現大量下跌，常是主力出貨警訊', '量縮整理：市場觀望，等待方向'],
    trap: '除權息、指數調整、除息前後的量會失真；比較時用 20 日均量當基準比較準。',
    quiz: [
      { q: '股價創新高但成交量越來越小，可能代表？', o: ['上漲力道減弱', '一定會繼續大漲', '主力在大量買進'], a: 0, e: '價漲量縮是量價背離，代表追價意願下降。' },
      { q: '台股 1 張等於幾股？', o: ['100 股', '1,000 股', '10,000 股'], a: 1, e: '台股 1 張＝1,000 股，不滿 1 張叫零股。' },
    ],
  },
  {
    id: 'rsi', title: 'RSI 相對強弱指標', sub: '看漲跌力道有沒有過頭', panel: 'rsi',
    body: [
      'RSI 比較最近 14 天「上漲幅度」和「下跌幅度」的比例，數值在 0～100 之間。',
      '一般以 <b>70 以上為偏熱（超買）</b>、<b>30 以下為偏冷（超賣）</b>，50 是多空分界。',
    ],
    how: ['RSI 從 30 以下回升：跌勢可能暫時止住', 'RSI 在 70 以上：短線追高風險升高', '背離：股價創新高、RSI 卻沒創新高，漲勢可能轉弱', '可以在「待驗主張」用回測工具，驗證 RSI 訊號在某檔股票上準不準'],
    trap: '強勢股的 RSI 可以長期停在 70 以上（叫「鈍化」），看到 70 就放空很容易被軋。',
    quiz: [
      { q: 'RSI 等於 25，一般解讀為？', o: ['偏熱（超買）', '偏冷（超賣）', '剛好中性'], a: 1, e: '30 以下通常視為超賣，但不代表馬上會漲。' },
      { q: '強勢股 RSI 長期在 70 以上，這種現象叫？', o: ['背離', '鈍化', '黃金交叉'], a: 1, e: '指標鈍化時，超買訊號會失靈。' },
    ],
  },
  {
    id: 'macd', title: 'MACD', sub: '追蹤趨勢動能的轉折', panel: 'macd',
    body: [
      'MACD 用「12 日」和「26 日」兩條指數均線的差（DIF），再取 9 日平均當訊號線。',
      '圖下方的<b>柱狀體</b>＝DIF 減訊號線：柱子在零軸上方且變長，代表多方動能增強；在下方且變長，代表空方動能增強。',
    ],
    how: ['柱狀體由負翻正：動能轉強（類似黃金交叉）', '柱狀體由正翻負：動能轉弱', 'DIF 在零軸上方：中期趨勢偏多', '柱子開始縮短：原本的動能正在減弱'],
    trap: 'MACD 反應比 RSI 慢，適合看波段方向，不適合抓短線買賣點。',
    quiz: [
      { q: 'MACD 柱狀體由負轉正，通常代表？', o: ['動能轉強', '動能轉弱', '成交量放大'], a: 0, e: '柱狀體翻正代表 DIF 向上穿過訊號線。' },
      { q: 'MACD 比較適合用來？', o: ['看波段趨勢方向', '抓當天最低點', '預測財報'], a: 0, e: 'MACD 由均線計算，反應較慢，適合看波段。' },
    ],
  },
  {
    id: 'bb', title: '布林通道', sub: '看股價的正常波動範圍', panel: 'bb',
    body: [
      '布林通道以 20 日均線為中軌，上下各加減 2 倍標準差，形成上軌和下軌。統計上股價大部分時間會落在通道內。',
      '通道變窄代表波動變小、市場在醞釀；通道突然張開，常是大行情的開始。',
    ],
    how: ['碰到上軌：短線偏強但偏離均值', '碰到下軌：短線偏弱或超跌', '強勢行情會「沿著上軌走」', '通道收窄後的突破方向，常是接下來的趨勢方向'],
    trap: '碰到上軌不等於一定要賣；在強勢趨勢中，沿上軌走的時間可能很長。',
    quiz: [
      { q: '布林通道的中軌通常是？', o: ['20 日均線', '5 日均線', '昨天收盤價'], a: 0, e: '中軌是 20 日移動平均。' },
      { q: '通道明顯收窄，代表？', o: ['波動變小，可能即將變盤', '一定會上漲', '成交量爆大'], a: 0, e: '收窄後常出現方向性突破，但方向要等突破才知道。' },
    ],
  },
  {
    id: 'pattern', title: '常見型態', sub: 'W 底、M 頭、頭肩頂', panel: 'pattern',
    body: [
      '型態是把一段走勢的形狀歸納出來。它反映的是市場參與者的心理：例如第二次跌到同一個低點還守得住，代表買方更有信心。',
      '型態要等<b>「頸線」被突破</b>才算完成，還沒突破前只是可能。',
    ],
    how: ['W 底：兩次低點差不多，突破中間高點（頸線）後轉強', 'M 頭：兩次高點差不多，跌破中間低點後轉弱', '頭肩頂：中間高點最高，跌破頸線是重要賣訊', '突破時有量比較可靠'],
    trap: '事後看型態都很清楚，當下常常看錯。一定要搭配停損，型態失敗就認錯。',
    quiz: [
      { q: 'W 底什麼時候才算完成？', o: ['第二個低點出現時', '突破頸線時', '第一個低點出現時'], a: 1, e: '要等突破頸線才確認，之前都只是「可能」。' },
      { q: 'M 頭跌破頸線，通常代表？', o: ['轉弱訊號', '轉強訊號', '沒有意義'], a: 0, e: 'M 頭是頭部型態，跌破頸線是賣訊。' },
    ],
  },
  {
    id: 'limits', title: '技術分析的限制與風控', sub: '最重要的一課', panel: 'none',
    body: [
      '技術指標都是用<b>過去的價格</b>算出來的，只能告訴你「現在的狀態」和「過去類似情況的機率」，不能預測未來。',
      '比較穩健的做法：<b>用基本面（研究卡）決定買什麼，用技術面決定什麼時候買、錯了在哪裡停損。</b>',
    ],
    how: ['進場前先決定停損價，並用「策略」頁的部位計算器決定買多少', '一次只看 2～3 個指標，太多反而互相矛盾', '把自己相信的訊號拿去「待驗主張」回測，確認真的有效', '每次交易都在「交易」頁留下當時的分析報告，事後覆盤檢討'],
    trap: '最常見的虧損原因不是看錯，而是看錯了不停損、或部位太大。',
    quiz: [
      { q: '比較穩健的用法是？', o: ['基本面選股、技術面找時機與停損', '只看技術指標就好', '指標越多越準'], a: 0, e: '技術面擅長管理進出場與風險，選股仍要回到基本面。' },
      { q: '進場前最應該先決定的是？', o: ['停損價與部位大小', '要賺多少才賣', '要跟誰分享'], a: 0, e: '先控制可能的虧損，再談報酬。' },
    ],
  },
];

/* ---------- 指標計算 ---------- */
const lsma = (a, n) => a.map((_, i) => (i < n - 1 ? null : a.slice(i - n + 1, i + 1).reduce((s, x) => s + x, 0) / n));
function lema(a, n) { const k = 2 / (n + 1); let e = a[0]; return a.map((x, i) => (i === 0 ? e : (e = x * k + e * (1 - k)))); }
function indicators(bars) {
  const c = bars.map(b => b[4]);
  const ma5 = lsma(c, 5), ma20 = lsma(c, 20), ma60 = lsma(c, 60);
  const sd = c.map((_, i) => (i < 19 ? null : Math.sqrt(c.slice(i - 19, i + 1).reduce((s, x) => s + (x - ma20[i]) ** 2, 0) / 20)));
  const bbU = ma20.map((m, i) => (m == null ? null : m + 2 * sd[i])), bbL = ma20.map((m, i) => (m == null ? null : m - 2 * sd[i]));
  const e12 = lema(c, 12), e26 = lema(c, 26), dif = e12.map((x, i) => x - e26[i]), dea = lema(dif, 9), hist = dif.map((x, i) => x - dea[i]);
  const rsi = rsiSeries(c);
  return { c, ma5, ma20, ma60, bbU, bbL, dif, dea, hist, rsi };
}

/* ---------- 圖表 ---------- */
function learnChart(bars, kind) {
  const N = Math.min(120, bars.length), off = bars.length - N;
  const ind = indicators(bars), B = bars.slice(off);
  const sl = a => a.slice(off);
  const W = 640, H1 = kind === 'candle' || kind === 'ma' || kind === 'sr' || kind === 'bb' ? 240 : 170, H2 = ['vol', 'rsi', 'macd'].includes(kind) ? 110 : 0, P = 6, G = 8;
  const H = H1 + (H2 ? H2 + G : 0);
  const X = i => P + (i + 0.5) * (W - 2 * P) / N, bw = Math.max(1.5, (W - 2 * P) / N * 0.6);
  const vals = B.flatMap(b => [b[2], b[3]]).concat(kind === 'bb' ? sl(ind.bbU).concat(sl(ind.bbL)).filter(v => v != null) : [], kind === 'ma' ? sl(ind.ma60).filter(v => v != null) : []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const Y = v => H1 - P - (v - lo) * (H1 - 2 * P) / (hi - lo || 1);
  const line = (a, col, w = 1.5, dash = '') => `<path d="${a.map((v, i) => (v == null ? '' : `${a[i - 1] == null ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).join('')}" fill="none" stroke="${col}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const UP = '#d64545', DN = '#1e9e5a';
  let g = '';
  // 主圖：K 線（candle/sr/bb/ma 用 K 線，其餘用收盤線）
  if (['candle', 'sr', 'bb', 'ma', 'vol'].includes(kind)) {
    g += B.map((b, i) => { const up = b[4] >= b[1], col = up ? UP : DN, y1 = Y(Math.max(b[1], b[4])), y2 = Y(Math.min(b[1], b[4]));
      return `<line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${Y(b[2]).toFixed(1)}" y2="${Y(b[3]).toFixed(1)}" stroke="${col}" stroke-width="1"/><rect x="${(X(i) - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, y2 - y1).toFixed(1)}" fill="${col}"/>`; }).join('');
  } else g += line(B.map(b => b[4]), 'var(--navy-2)', 1.8);
  const marks = [];
  if (kind === 'ma') {
    g += line(sl(ind.ma20), '#c9a24a', 1.6) + line(sl(ind.ma60), '#3b6fd8', 1.6);
    const a = sl(ind.ma20), b2 = sl(ind.ma60);
    for (let i = 1; i < N; i++) if (a[i - 1] != null && b2[i - 1] != null) {
      if (a[i - 1] <= b2[i - 1] && a[i] > b2[i]) marks.push(`<text x="${X(i)}" y="${Y(a[i]) + 16}" text-anchor="middle" fill="${UP}" font-size="14">▲</text>`);
      if (a[i - 1] >= b2[i - 1] && a[i] < b2[i]) marks.push(`<text x="${X(i)}" y="${Y(a[i]) - 6}" text-anchor="middle" fill="${DN}" font-size="14">▼</text>`);
    }
  }
  if (kind === 'bb') g += line(sl(ind.bbU), '#8a6a1c', 1.2, '4 3') + line(sl(ind.ma20), '#c9a24a', 1.4) + line(sl(ind.bbL), '#8a6a1c', 1.2, '4 3');
  if (kind === 'sr') {
    const w60 = B.slice(-60), sup = Math.min(...w60.map(b => b[3])), res = Math.max(...w60.map(b => b[2]));
    g += `<line x1="${P}" x2="${W - P}" y1="${Y(res)}" y2="${Y(res)}" stroke="${UP}" stroke-dasharray="6 4"/><text x="${W - P - 4}" y="${Y(res) - 4}" text-anchor="end" font-size="12" fill="${UP}">壓力 ${fmt(res, res < 100 ? 2 : 0)}</text>`;
    g += `<line x1="${P}" x2="${W - P}" y1="${Y(sup)}" y2="${Y(sup)}" stroke="${DN}" stroke-dasharray="6 4"/><text x="${W - P - 4}" y="${Y(sup) + 14}" text-anchor="end" font-size="12" fill="${DN}">支撐 ${fmt(sup, sup < 100 ? 2 : 0)}</text>`;
  }
  // 副圖
  let sub = '';
  if (H2) {
    const top = H1 + G, sy = (v, a, b) => top + H2 - P - (v - a) * (H2 - 2 * P) / (b - a || 1);
    if (kind === 'vol') {
      const vmax = Math.max(...B.map(b => b[5] || 0)), v20 = lsma(bars.map(b => b[5] || 0), 20).slice(off);
      sub += B.map((b, i) => `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${sy(b[5] || 0, 0, vmax).toFixed(1)}" width="${bw.toFixed(1)}" height="${(top + H2 - P - sy(b[5] || 0, 0, vmax)).toFixed(1)}" fill="${b[4] >= b[1] ? UP : DN}" opacity=".7"/>`).join('');
      sub += `<path d="${v20.map((v, i) => (v == null ? '' : `${v20[i - 1] == null ? 'M' : 'L'}${X(i).toFixed(1)},${sy(v, 0, vmax).toFixed(1)}`)).join('')}" fill="none" stroke="#c9a24a" stroke-width="1.4"/>`;
    }
    if (kind === 'rsi') {
      const r = sl(ind.rsi);
      sub += [30, 50, 70].map(v => `<line x1="${P}" x2="${W - P}" y1="${sy(v, 0, 100)}" y2="${sy(v, 0, 100)}" stroke="var(--line)" ${v !== 50 ? 'stroke-dasharray="4 3"' : ''}/><text x="${P + 2}" y="${sy(v, 0, 100) - 2}" font-size="10" fill="var(--muted)">${v}</text>`).join('');
      sub += `<path d="${r.map((v, i) => (v == null ? '' : `${r[i - 1] == null ? 'M' : 'L'}${X(i).toFixed(1)},${sy(v, 0, 100).toFixed(1)}`)).join('')}" fill="none" stroke="#7b4fd0" stroke-width="1.6"/>`;
    }
    if (kind === 'macd') {
      const h = sl(ind.hist), d = sl(ind.dif), e = sl(ind.dea), m = Math.max(...h.concat(d, e).map(Math.abs));
      sub += `<line x1="${P}" x2="${W - P}" y1="${sy(0, -m, m)}" y2="${sy(0, -m, m)}" stroke="var(--line)"/>`;
      sub += h.map((v, i) => { const y0 = sy(0, -m, m), y = sy(v, -m, m); return `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Math.min(y, y0).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(y - y0).toFixed(1)}" fill="${v >= 0 ? UP : DN}" opacity=".75"/>`; }).join('');
      sub += [[d, '#c9a24a'], [e, '#3b6fd8']].map(([a, col]) => `<path d="${a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${sy(v, -m, m).toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="1.3"/>`).join('');
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="lchart" role="img" aria-label="技術分析練習圖">${g}${marks.join('')}${sub}</svg>`;
}
function legendFor(kind) {
  const L = { candle: [['#d64545', '紅 K（收盤＞開盤）'], ['#1e9e5a', '綠 K（收盤＜開盤）']], ma: [['#c9a24a', '20 日均線（月線）'], ['#3b6fd8', '60 日均線（季線）'], ['#d64545', '▲黃金交叉'], ['#1e9e5a', '▼死亡交叉']], sr: [['#d64545', '近 60 日壓力'], ['#1e9e5a', '近 60 日支撐']], vol: [['#d64545', '上漲日成交量'], ['#1e9e5a', '下跌日成交量'], ['#c9a24a', '20 日均量']], rsi: [['#7b4fd0', 'RSI(14)'], ['#98a4b8', '30／70 參考線']], macd: [['#c9a24a', 'DIF'], ['#3b6fd8', '訊號線'], ['#d64545', '柱狀體（正）'], ['#1e9e5a', '柱狀體（負）']], bb: [['#c9a24a', '中軌（20 日均線）'], ['#8a6a1c', '上軌／下軌']] }[kind] || [];
  return `<div class="legend">${L.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;
}
function readNow(bars, kind) {
  const ind = indicators(bars), i = bars.length - 1, c = ind.c[i], n = x => (x == null ? '—' : fmt(x, x < 100 ? 2 : 1));
  switch (kind) {
    case 'candle': { const b = bars[i], body = Math.abs(b[4] - b[1]), up = b[2] - Math.max(b[1], b[4]), dn = Math.min(b[1], b[4]) - b[3];
      return `最新一根（${b[0]}）：開 ${n(b[1])}、高 ${n(b[2])}、低 ${n(b[3])}、收 ${n(b[4])}，${b[4] >= b[1] ? '紅 K' : '綠 K'}。${up > body * 1.5 ? '上影線偏長，上方有賣壓。' : dn > body * 1.5 ? '下影線偏長，下方有買盤撐住。' : body < (b[2] - b[3]) * 0.2 ? '實體很小，接近十字線，多空僵持。' : '實體明顯，當天方向清楚。'}`; }
    case 'ma': return `收盤 ${n(c)}，月線 ${n(ind.ma20[i])}、季線 ${n(ind.ma60[i])}。${c > ind.ma20[i] && ind.ma20[i] > ind.ma60[i] ? '目前是多頭排列。' : c < ind.ma20[i] && ind.ma20[i] < ind.ma60[i] ? '目前是空頭排列。' : '均線糾結或方向不一致，偏整理。'}`;
    case 'sr': { const w = bars.slice(-60), s = Math.min(...w.map(b => b[3])), r = Math.max(...w.map(b => b[2])); return `近 60 日支撐 ${n(s)}、壓力 ${n(r)}，目前 ${n(c)}，${c - s < r - c ? '比較接近支撐' : '比較接近壓力'}。`; }
    case 'vol': { const v = bars.map(b => b[5] || 0), v5 = v.slice(-5).reduce((a, b) => a + b, 0) / 5, v20 = v.slice(-20).reduce((a, b) => a + b, 0) / 20, chg = (c / ind.c[i - 5] - 1) * 100;
      return `近 5 日均量是 20 日均量的 ${fmt(v5 / v20, 2)} 倍，近 5 日股價 ${chg >= 0 ? '+' : ''}${fmt(chg, 1)}%。${v5 / v20 > 1.3 ? (chg >= 0 ? '量增價漲。' : '量增價跌，要小心。') : v5 / v20 < 0.7 ? '量縮觀望。' : '量能持平。'}`; }
    case 'rsi': { const r = ind.rsi[i]; return `RSI(14) 為 ${fmt(r, 1)}：${r >= 70 ? '偏熱，短線追高風險升高（強勢股可能鈍化）。' : r <= 30 ? '偏冷，可能超賣。' : r >= 50 ? '中性偏強。' : '中性偏弱。'}`; }
    case 'macd': { const h = ind.hist[i], p = ind.hist[i - 1]; return `DIF ${fmt(ind.dif[i], 2)}、訊號線 ${fmt(ind.dea[i], 2)}、柱狀體 ${fmt(h, 2)}：${h > 0 ? (p <= 0 ? '剛翻正，動能轉強。' : Math.abs(h) < Math.abs(p) ? '仍為正但縮短，多方動能減弱。' : '多方動能持續。') : (p >= 0 ? '剛翻負，動能轉弱。' : Math.abs(h) < Math.abs(p) ? '仍為負但縮短，空方力道減弱。' : '空方動能持續。')}`; }
    case 'bb': { const u = ind.bbU[i], l = ind.bbL[i], wNow = (u - l) / ind.ma20[i], wPrev = (ind.bbU[i - 20] - ind.bbL[i - 20]) / ind.ma20[i - 20];
      return `上軌 ${n(u)}、中軌 ${n(ind.ma20[i])}、下軌 ${n(l)}，收盤 ${n(c)}${c > u ? '，突破上軌' : c < l ? '，跌破下軌' : '，在通道內'}。通道寬度${wNow < wPrev * 0.8 ? '比一個月前收窄，可能醞釀變盤' : wNow > wPrev * 1.2 ? '比一個月前擴大，波動變大' : '和一個月前差不多'}。`; }
  }
  return '';
}
function patternSVG() {
  const P = (pts, col) => `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5"/>`;
  const box = (t, pts, neck, col, note) => `<div class="pat"><svg viewBox="0 0 200 110">${P(pts, 'var(--navy-2)')}<line x1="10" x2="190" y1="${neck}" y2="${neck}" stroke="${col}" stroke-dasharray="5 4"/><text x="190" y="${neck - 4}" text-anchor="end" font-size="11" fill="${col}">頸線</text></svg><b>${t}</b><div class="help">${note}</div></div>`;
  return `<div class="pats">${box('W 底', '10,20 45,85 80,45 115,85 150,40 190,10', 45, '#d64545', '兩次低點守住，突破頸線轉強')}${box('M 頭', '10,90 45,25 80,65 115,25 150,70 190,100', 65, '#1e9e5a', '兩次高點過不去，跌破頸線轉弱')}${box('頭肩頂', '5,95 30,50 55,70 95,15 135,70 160,50 195,100', 70, '#1e9e5a', '中間最高，跌破頸線是重要賣訊')}</div>`;
}

/* ---------- 頁面 ---------- */
const learnCache = {};
PAGES.learn = () => {
  const cur = LESSONS.find(l => l.id === S.learnLesson) || LESSONS[0];
  const code = S.learnCode || '2330', data = learnCache[code];
  const done = S.learnDone || {};
  return `
  <h2>技術分析教學</h2>
  <p class="lead">共 ${LESSONS.length} 堂課，每一堂都用真實股票的走勢圖練習。已完成 ${Object.keys(done).length} 堂。</p>
  <div class="chips">${LESSONS.map((l, i) => `<button class="chip ${l.id === cur.id ? 'on' : ''}" data-lesson="${l.id}">${done[l.id] ? '✓ ' : ''}${i + 1}. ${esc(l.title)}</button>`).join('')}</div>
  <div class="card">
    <h3 class="gold-bar">${esc(cur.title)}</h3>
    <div class="help" style="margin-bottom:8px">${esc(cur.sub)}</div>
    ${cur.body.map(p => `<p style="margin:0 0 8px;font-size:15px">${p}</p>`).join('')}
    <div class="sec-title">怎麼看</div>
    <ul style="margin:0;padding-left:20px;font-size:14px">${cur.how.map(h => `<li>${h}</li>`).join('')}</ul>
    <div class="note" style="margin-top:10px"><b>常見陷阱：</b>${cur.trap}</div>
  </div>
  ${cur.panel === 'pattern' ? `<div class="card"><h3 class="gold-bar">型態示意圖</h3>${patternSVG()}</div>` : ''}
  ${cur.panel !== 'none' && cur.panel !== 'pattern' ? `<div class="card">
    <div class="card-head"><h3 class="gold-bar">用真實股票練習</h3>
      <div class="btn-row"><input type="text" id="learnCode" value="${esc(code)}" style="width:90px" autocapitalize="characters"><button class="btn-small" id="learnGo">看圖</button></div></div>
    <div class="qbtns" style="margin:-4px 0 8px">${['2330', '2317', '0050', 'NVDA', 'SPCX'].map(x => `<button type="button" data-learn-code="${x}">${x}</button>`).join('')}</div>
    ${data?.bars ? `${learnChart(data.bars, cur.panel)}${legendFor(cur.panel)}<div class="snap" style="margin-top:8px"><b>${esc(data.name || code)} 現在的讀數</b>\n${esc(readNow(data.bars, cur.panel))}</div><div class="help" style="margin-top:6px">近 ${Math.min(120, data.bars.length)} 個交易日（${esc(data.bars[Math.max(0, data.bars.length - 120)][0])}～${esc(data.bars[data.bars.length - 1][0])}）。這只是讀圖練習，不是買賣建議。</div>`
      : data?.error ? `<div class="down">抓不到 ${esc(code)} 的資料：${esc(data.error)}</div>` : '<div class="help">載入中…</div>'}
  </div>` : ''}
  <div class="card"><h3 class="gold-bar">小測驗</h3>
    ${cur.quiz.map((q, qi) => { const ans = S.learnAns?.[cur.id + qi]; return `<div class="quiz"><div class="qq">${qi + 1}. ${esc(q.q)}</div>
      <div class="qo">${q.o.map((o, oi) => `<button type="button" class="${ans != null ? (oi === q.a ? 'right' : oi === ans ? 'wrong' : '') : ''}" data-quiz="${cur.id}|${qi}|${oi}">${esc(o)}</button>`).join('')}</div>
      ${ans != null ? `<div class="help" style="margin-top:4px">${ans === q.a ? '答對了！' : '再想想：'}${esc(q.e)}</div>` : ''}</div>`; }).join('')}
    <div class="btn-row" style="margin-top:10px">${LESSONS.indexOf(cur) < LESSONS.length - 1 ? `<button class="btn-small" data-lesson="${LESSONS[LESSONS.indexOf(cur) + 1].id}">下一堂：${esc(LESSONS[LESSONS.indexOf(cur) + 1].title)} →</button>` : '<button class="btn-small" data-go="claims">去用回測工具驗證訊號 →</button>'}</div>
  </div>`;
};
async function loadLearn(code) {
  code = String(code || '').trim().toUpperCase(); if (!code) return;
  S.learnCode = code; save();
  if (!learnCache[code]) {
    learnCache[code] = {}; render();
    try {
      const [h, q] = await Promise.all([fetch('api/stock?history=1&ohlc=1&code=' + encodeURIComponent(code), { signal: AbortSignal.timeout(45000) }).then(r => r.json()), quote(code).catch(() => ({}))]);
      if (!h.bars?.length) throw new Error(h.error || '沒有資料');
      learnCache[code] = { bars: h.bars, name: q.name };
    } catch (e) { learnCache[code] = { error: e.message }; }
  }
  if (current === 'learn') render();
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-lesson],[data-quiz],[data-learn-code],#learnGo'); if (!t) return;
  if (t.dataset.lesson) { S.learnLesson = t.dataset.lesson; save(); render(); window.scrollTo(0, 0); if (!learnCache[S.learnCode || '2330']) loadLearn(S.learnCode || '2330'); return; }
  if (t.dataset.learnCode) { loadLearn(t.dataset.learnCode); return; }
  if (t.id === 'learnGo') { loadLearn($('#learnCode').value); return; }
  if (t.dataset.quiz) {
    const [id, qi, oi] = t.dataset.quiz.split('|'); S.learnAns = S.learnAns || {}; S.learnAns[id + qi] = +oi;
    const L = LESSONS.find(x => x.id === id); if (L.quiz.every((q, i) => S.learnAns[id + i] === q.a)) { S.learnDone = S.learnDone || {}; S.learnDone[id] = true; }
    save(); render();
  }
});
const _goLearn = go;
go = function (page) { _goLearn(page); if (page === 'learn' && !learnCache[S.learnCode || '2330']) loadLearn(S.learnCode || '2330'); };
const _homeL = PAGES.home;
PAGES.home = () => _homeL().replace('<div class="grid grid-2">', `<div class="card" style="border-left:4px solid var(--gold)"><div class="card-head"><h3 class="gold-bar">新手從這裡開始</h3><button class="btn-small" data-go="learn">技術分析教學 →</button></div>
  <div class="help" style="font-size:14px">1. 先上 9 堂技術分析課（每堂 3 分鐘，附小測驗）　2. 到「研究卡」輸入代號，自動帶入資料　3. 到「策略」算部位　4. 實際買賣時在「交易」記一筆，網站會保存當下的分析報告　5. 定期到「覆盤」檢討</div></div>
  <div class="grid grid-2">`);
if (window.__startPage === 'learn' || current === 'learn') go('learn'); else if (current === 'home') render();
