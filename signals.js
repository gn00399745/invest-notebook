/* 九大市場指標：依「看什麼／簡單記法」自動判讀，對台股是順風（綠）、中性（黃）還是逆風（紅） */
'use strict';

const SIG_DEF = [
  // [代號, 名稱, 看什麼, 簡單記法]
  ['^VIX', 'VIX 恐慌指數', '綜合恐慌指標，40 以上是罕見機會', '唯一的「總表」，其他都是分項'],
  ['^DJI', '道瓊', '信心', '傳產／藍籌股的臉色'],
  ['^GSPC', 'S&P 500', '資金流向', '大盤整體溫度'],
  ['^IXIC', '那斯達克', '科技景氣', '科技股情緒'],
  ['^SOX', '費城半導體', '台股連動', '跟台股最像的美股指標'],
  ['DX-Y.NYB', '美元指數', '強→資金回美國、新興市場壓力大；弱→資金外流、台股有機會', '美元強＝台股弱；美元弱＝台股強（但要犧牲出口商）'],
  ['GC=F', '黃金', '快漲＝恐慌；緩漲＝通膨', '看漲的「速度」，不是看漲不漲'],
  ['CL=F', '原油', '暴漲＝通膨壓力大；暴跌＝通膨降溫', '油價跟通膨同向'],
  ['TW', '台股內部', '加權跟櫃買一起看，分歧＝警訊', '兩個指數要同步，不同步要小心'],
];
const sigMkt = sym => { for (const e of Object.values(S.world?.economies || {})) { const m = (e.markets || []).find(x => x.sym === sym); if (m) return m; } return null; };
const sigAvg = (a, n) => a && a.length >= n ? a.slice(-n).reduce((s, v) => s + v, 0) / n : null;
const sigPc = v => v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v, 1)}%`;

// 股價指數：站上季線且近一月上漲＝綠；跌破季線＝紅
function sigTrend(m, good, bad) {
  const ma60 = sigAvg(m.spark, 60) ?? sigAvg(m.spark, m.spark?.length || 0), above = ma60 ? m.price >= ma60 : null;
  const pos = ma60 ? `${above ? '站上' : '跌破'}季線（${sigPc((m.price / ma60 - 1) * 100)}）` : '';
  if (above && m.chg1m >= 0) return ['g', `${good}：${pos}、近一月 ${sigPc(m.chg1m)}`];
  if (above === false && m.chg1m < 0) return ['r', `${bad}：${pos}、近一月 ${sigPc(m.chg1m)}`];
  return ['y', `方向不明：${pos}、近一月 ${sigPc(m.chg1m)}`];
}
function sigRead(sym) {
  if (sym === 'TW') {
    const a = sigMkt('^TWII'), b = sigMkt('TPEX'); if (!a || !b) return null;
    const d = (a.chg1m ?? 0) - (b.chg1m ?? 0), same = Math.sign(a.chg1m || 0) === Math.sign(b.chg1m || 0);
    const v = `加權 ${sigPc(a.chg1m)}・櫃買 ${sigPc(b.chg1m)}`;
    if (!same || Math.abs(d) >= 5) return ['r', `分歧＝警訊：近一月${d > 0 ? '只有大型權值股在撐，中小型股轉弱' : '中小型股強、權值股弱'}（差 ${fmt(Math.abs(d), 1)} 點）`, v];
    if (a.chg1m >= 0) return ['g', '同步走強：大型股與中小型股一起漲', v];
    return ['y', '同步走弱：整體回檔，但沒有分歧', v];
  }
  const m = sigMkt(sym); if (!m) return null;
  const v = `${fmt(m.price, m.price < 100 ? 2 : 0)}（週 ${sigPc(m.chg1w)}・月 ${sigPc(m.chg1m)}）`;
  if (sym === '^VIX') {
    const x = m.price;
    if (x >= 40) return ['o', '極度恐慌＝罕見機會：照計畫分批承接，不要一次買滿', v];
    if (x >= 30) return ['r', '恐慌：波動大，新資金放慢、守好停損', v];
    if (x >= 20) return ['y', '緊張：市場開始擔心，留意其他分項是否轉弱', v];
    if (m.chg1m >= 20) return ['y', '還算平靜但快速升溫：一個月內明顯上升，留意是否突破 20', v];
    return ['g', '平靜：恐慌低，照計畫操作（太低時也要防樂觀過頭）', v];
  }
  if (sym === 'DX-Y.NYB') {
    if (m.chg1m >= 1.5) return ['r', '美元走強：資金回美國，台股與新興市場有壓力', v];
    if (m.chg1m <= -1.5) return ['g', '美元走弱：資金外流到亞洲，台股有機會（出口商有匯損）', v];
    return ['y', '美元持平：對資金流向影響不大', v];
  }
  if (sym === 'GC=F') {
    if (m.chg1m >= 8 || m.chg1w >= 4) return ['r', '快漲＝恐慌：避險資金湧入，股市要小心', v];
    if (m.chg1m >= 2) return ['y', '緩漲＝通膨：物價壓力或長期避險需求', v];
    if (m.chg1m <= -5) return ['g', '回落：避險需求退燒', v];
    return ['g', '平穩：沒有明顯恐慌或通膨訊號', v];
  }
  if (sym === 'CL=F') {
    if (m.chg1m >= 15) return ['r', '暴漲＝通膨壓力大：利率可能維持高檔', v];
    if (m.chg1m <= -15) return ['y', '暴跌＝通膨降溫：但也可能是需求轉弱，要對照景氣', v];
    if (Math.abs(m.chg1m) >= 8) return ['y', `${m.chg1m > 0 ? '上漲' : '下跌'}偏快：留意通膨${m.chg1m > 0 ? '升溫' : '降溫'}`, v];
    return ['g', '平穩：通膨壓力沒有明顯變化', v];
  }
  const t = { '^DJI': ['信心穩', '信心轉弱'], '^GSPC': ['資金流入', '資金撤出'], '^IXIC': ['科技股情緒好', '科技股情緒差'], '^SOX': ['台股電子有撐', '台股電子有壓力'] }[sym];
  const r = sigTrend(m, t[0], t[1]); return [r[0], r[1], v];
}
function mktSignals() {
  const rows = SIG_DEF.map(([sym, n, what, memo]) => { const r = sigRead(sym); return r && { sym, n, what, memo, c: r[0], t: r[1], v: r[2] }; }).filter(Boolean);
  const g = rows.filter(r => r.c === 'g').length, red = rows.filter(r => r.c === 'r').length, vix40 = rows.some(r => r.c === 'o');
  const sc = g - red, lv = vix40 ? ['o', '極度恐慌：罕見機會'] : sc >= 3 ? ['g', '順風'] : sc <= -2 ? ['r', '逆風'] : ['y', '中性'];
  return { rows, g, red, y: rows.length - g - red, lv, vix40 };
}
const SIG_IC = { g: '🟢', y: '🟡', r: '🔴', o: '🟣' };
function sigCardHTML() {
  const M = mktSignals(); if (!M.rows.length) return '';
  const tip = { g: '外部環境對台股有利，照計畫操作。', y: '訊號互相抵銷，照計畫、不加碼也不急著賣。', r: '多數指標對台股不利：新資金放慢、只買半批、先檢查停損。', o: 'VIX 40 以上歷史上很少見，常是長線好買點：照計畫分批，不要一次買滿。' }[M.lv[0]];
  return `<div class="card sig"><div class="card-head"><h3 class="gold-bar">📡 九大市場指標</h3><span class="sig-lv ${M.lv[0]}">${SIG_IC[M.lv[0]]} 台股外部環境：${M.lv[1]}</span></div>
    <div class="sig-sum">🟢 ${M.g}　🟡 ${M.y}　🔴 ${M.red}｜${tip}</div>
    <div class="sig-list">${M.rows.map(r => `<div class="sig-r ${r.c}"><span class="sig-ic">${SIG_IC[r.c]}</span><div class="sig-b"><div class="sig-t"><b>${esc(r.n)}</b><em>${esc(r.what)}</em><span>${esc(r.v || '')}</span></div><div class="sig-x">${esc(r.t)}</div><div class="sig-m">💡 ${esc(r.memo)}</div></div></div>`).join('')}</div>
    <div class="help">台股內部另外要自己看：領頭羊（台積電等權值股）有沒有轉弱、類股輪動是否混亂、上漲家數是否越來越少（廣度收窄）——這些是轉折的早期徵兆。</div></div>`;
}
