/* 選股雷達，兩種風格（規則與 2013～2026 回測相同，api/radar.js）：
   價值：估公允價值，股價打七折以下才買；抱 3～5 年，漲到公允價值、轉虧或滿 5 年才賣
   成長趨勢：營收大成長＋股價強勢，每季換股，掉出前 20 名就賣 */
'use strict';

const VR_N = 20;   // 回測用 20 檔等權重
const VR_TIERS = [['低價', '百元內', x => x.close < 100], ['全部', '全部價位', () => true]];
const vrP = p => p == null ? '—' : fmt(p, p < 100 ? 2 : 1);
let radarBusy = false;
const vrTrend = () => S.radarStyle === 'trend';
async function loadRadar(force) {
  if (radarBusy || !location.protocol.startsWith('http')) return;
  const T = vrTrend(), have = T ? S.radarT : S.radar?.margin && S.radar, at = T ? S.radarTAt : S.radarAt;   // 舊版（動能）資料沒有 margin，直接重抓
  if (!force && have && Date.now() - (at || 0) < 6 * 3600e3) return;
  radarBusy = true; if (current === 'radar') render();
  try {
    const q = [T && 'style=trend', force && 't=' + Date.now()].filter(Boolean).join('&');
    const j = await (await fetch('api/radar' + (q ? '?' + q : ''), { signal: AbortSignal.timeout(90000) })).json();
    if (!j.list) throw new Error('格式錯誤');
    if (T) { S.radarT = j; S.radarTAt = Date.now(); } else { S.radar = j; S.radarAt = Date.now(); }
    save(); if (force) toast(`找到 ${j.list.length} 檔`);
  } catch (e) { toast('選股雷達更新失敗：' + e.message); }
  radarBusy = false; if (current === 'radar') { const y = scrollY; render(); scrollTo(0, y); }
}
// 這次持有從哪天開始（交易紀錄裡股數從 0 變成正數的那天）
function vrSince(code) {
  let sh = 0, since = null;
  [...S.trades].filter(t => String(t.code || '').toUpperCase() === code).sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
    const n = num(t.shares) || 0;
    if (t.side === '賣出') { sh = Math.max(0, sh - n); if (!sh) since = null; } else { if (!sh && n > 0) since = t.date; sh += n; }
  });
  return since;
}
// 續抱檢查（與回測相同）：到公允價值、近四季轉虧、或抱滿 5 年就賣
function vrHoldCheck(H, since) {
  const [, , pe, fair, ratio] = H, yrs = since ? (Date.now() - new Date(since)) / 365.25 / 864e5 : null;
  if (!(pe > 0)) return ['該賣', 'red', '近四季轉虧，買進理由消失'];
  if (ratio != null && ratio >= 1) return ['可以賣', 'gold', `已漲到公允價值 ${vrP(fair)}（現價為公允價值的 ${fmt(ratio * 100, 0)}%），獲利了結、換一檔還便宜的`];
  if (yrs != null && yrs >= 5) return ['該賣', 'red', `已抱 ${fmt(yrs, 1)} 年還沒到公允價值，市場不認同，換一檔`];
  return ['續抱', 'green', `公允價值 ${vrP(fair)}・現價為公允價值的 ${ratio != null ? fmt(ratio * 100, 0) + '%' : '—'}${yrs != null ? `・已抱 ${fmt(yrs, 1)} 年` : ''}`];
}
const vrWarn = x => [(x.cumYoY > 100 || x.revYoY > 150) && '營收暴增，低本益比可能是一次性入帳', x.dy >= 10 && '殖利率異常高，確認是否一次性配息', /營造|建材/.test(x.ind) && '營建股獲利認列不平均'].filter(Boolean);
// 價格位置：0 ～ 公允價值 × 1.2，標出買進上限與公允價值
function vrBar(x) {
  const top = x.fair * 1.2, X = v => Math.max(0, Math.min(100, v / top * 100));
  return `<div class="vr-bar"><div class="vr-tr"><i class="vr-zb" style="width:${X(x.buyBelow)}%"></i><i class="vr-tk" style="left:${X(x.buyBelow)}%"></i><i class="vr-tk f" style="left:${X(x.fair)}%"></i><i class="vr-dot" style="left:${X(x.close)}%"></i></div>
    <div class="vr-ax"><span style="left:${X(x.close)}%">現價 ${vrP(x.close)}</span><span style="left:${X(x.buyBelow)}%">買進上限 ${vrP(x.buyBelow)}</span><span style="left:${X(x.fair)}%">公允 ${vrP(x.fair)}</span></div></div>`;
}

// 大師選股法成績單（scratchpad 回測：2013/4～2026/10，20 檔等權重，含息、扣手續費與證交稅）
const VR_SCORE = [
  ['0050（含配息）', '買市值最大的 50 家，不選股', 20.6, -34, 13.7, 27.7, 1],
  ['巴菲特：好公司、合理價', '連續 3 年 ROE ≥ 15%、本益比 ≤ 20、有配息', 6.5, -34, -0.1, 13.3],
  ['葛拉漢：便宜防禦股', '本益比 ≤ 15、淨值比 ≤ 1.5、兩者相乘 ≤ 22.5', 6.8, -38, 2.1, 11.9],
  ['葛林布雷：神奇公式', 'ROE 高＋本益比低的排名相加', -0.3, -51, -1.3, 0.8],
  ['彼得林區：合理價成長', '營收成長 15～50%、本益比 ÷ 成長率 ≤ 1', 12.9, -39, 7.3, 16.2],
  ['價值：公允價值七折', '本頁「價值」風格，每年換股', 15.9, -30, 13.9, 21.3, 2],
  ['成長趨勢（股癌式）', '本頁「成長趨勢」風格，每季換股', 25.4, -52, 7.1, 46.6, 2],
  ['0050 七成 ＋ 價值 三成', '核心＋衛星', 19.5, -30, 13.9, 25.1, 3],
  ['0050 一半 ＋ 成長趨勢 一半', '核心＋衛星', 24.2, -40, 10.9, 37.9, 3],
];
const vrPct = v => `<span class="${v > 0 ? 'good' : v < 0 ? 'bad' : ''}">${v > 0 ? '+' : ''}${fmt(v, 1)}%</span>`;
const vrTabs = c => `<div class="chips hub-tabs"><button class="chip ${c === 'value' ? 'on' : ''}" data-radarstyle="value">💎 價值</button><button class="chip ${c === 'trend' ? 'on' : ''}" data-radarstyle="trend">🚀 成長趨勢</button><button class="chip ${c === 'picks' ? 'on' : ''}" data-go="picks">📦 策略組合</button></div>`;
function vrHead() {
  const T = vrTrend();
  return `<h2>選股</h2>${vrTabs(T ? 'trend' : 'value')}
  <details class="card rd-bt vr-score"><summary><b>🏆 大師選股法成績單</b>：13 年半下來，沒有一派穩定贏 0050</summary>
    <div class="help" style="margin-top:6px">把各派公開的選股原則寫成規則，用 2013/4～2026/10 每季當時公開的本益比、淨值比、殖利率、營收與股價回測。每派選 20 檔等權重，含配息、扣手續費與證交稅。</div>
    <div class="vr-st"><table class="rd-bt-t"><thead><tr><th>選股法</th><th class="num">年化</th><th class="num">最大回落</th><th class="num">2013～19</th><th class="num">2020～26</th></tr></thead><tbody>
    ${VR_SCORE.map(r => `<tr class="${r[6] === 2 ? 'me' : ''}"><td><b>${r[0]}</b><br><small>${r[1]}</small></td><td class="num">${vrPct(r[2])}</td><td class="num bad">${r[3]}%</td><td class="num">${vrPct(r[4])}</td><td class="num">${vrPct(r[5])}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="help"><b>看懂這張表：</b><br>
    ・<b>0050 很難打敗。</b>這段期間台積電一路大漲，0050 年化 20.6%，選股法只有「成長趨勢」贏它，而且全靠 2020 年後的 AI 行情；2013～2019 年它年化只有 7%，還輸 0050。<br>
    ・<b>巴菲特、葛拉漢、神奇公式在台股中小型股上效果很差。</b>巴菲特真正的優勢是買整家好公司、長期持有、用保險浮存金加槓桿，散戶照抄財務條件抄不到。（波克夏 1965～2025 年化約 19.7%，標普 500 約 10.5%；但近 20 年已跟大盤差不多。）<br>
    ・<b>股癌</b>（謝孟恭）沒有公開可驗證的完整績效。他的方法是先看產業長期趨勢（例如 AI、先進封裝），再找受惠的上下游，抱強勢股、跌破趨勢就減碼。這裡用「營收大成長＋股價強勢」來近似，不是他本人的選股。<br>
    ・<b>分析師目標價</b>：台灣的研究發現，外資報告的目標價一年內只有約一半達到，看多的報告普遍過度樂觀。<br>
    ・<b>最實際的用法是核心＋衛星：</b>0050 當核心，選股只用一小部分。「0050 七成＋價值三成」報酬差不多、回落更小；「0050 一半＋成長趨勢一半」報酬較高，但 2013～2019 年輸 0050，回落也大。<br>
    過去表現不代表未來，也不構成投資建議。</div></details>`;
}
const vrTWarn = x => [x.pe >= 60 && `本益比 ${fmt(x.pe, 0)} 倍很高，跌起來很快`, x.mom >= 300 && '一年漲好幾倍，追高風險大', x.revYoY >= 150 && '營收暴增，確認是不是一次性訂單', /金融|保險|證券|銀行/.test(x.ind) && '金融股營收受股市影響，不是產業趨勢'].filter(Boolean);
function vrTrendPage() {
  const V = S.radarT, tier = VR_TIERS.find(t => t[0] === (S.radarTier || '低價')) || VR_TIERS[0];
  const list = (V?.list || []).filter(tier[2]), shown = S.radarAll ? list : list.slice(0, VR_N);
  let cap = 0; try { cap = typeof wealth === 'function' ? wealth().invest || 0 : 0; } catch (e) { /* 沒有資產資料 */ }
  const per = cap / VR_N * 0.3, mine = code => S.cards.find(c => String(c.code) === code);
  const top = new Set((V?.list || []).slice(0, VR_N).map(x => x.code)), rank = code => (V?.list || []).find(x => x.code === code)?.rank;
  const held = V && typeof holdings === 'function' ? holdings().filter(h => h.shares > 0 && /^[1-9]\d{3}$/.test(h.code)) : [];
  const holdBox = held.length ? `<div class="card"><h3 class="gold-bar">我的持股：如果是照成長趨勢買的</h3>
    ${held.map(h => { const k = rank(h.code), s = top.has(h.code) ? ['續抱', 'green', `目前排第 ${k} 名`] : k ? ['換股時賣', 'gold', `掉到第 ${k} 名，下次換股時換掉`] : ['換股時賣', 'gold', '已不符合（營收成長放慢或跌破半年線），下次換股時換掉']; return `<div class="vr-h"><b>${esc(h.code)} ${esc(h.name || '')}</b><span class="pill ${s[1]}">${s[0]}</span><em>${esc(s[2])}</em></div>`; }).join('')}
    <div class="help">換股日：1、4、7、10 月營收公布後（約 12 號）。照價值風格買的股票請切回「價值」檢查。</div></div>` : '';
  const rows = shown.map((x, i) => {
    const w = vrTWarn(x), sh = per && x.close ? Math.floor(per / x.close) : 0, c = mine(x.code);
    return `<div class="vr">
      <div class="vr-hd"><span class="rd-rank">${i + 1}</span><div class="rd-id"><b>${esc(x.code)} ${esc(x.name)}</b><em>${esc(x.mkt)}・${esc(x.ind || '—')}・一張約 ${fmt(x.close * 1000)} 元</em></div>
        <div class="rd-px"><b>${vrP(x.close)}</b><em class="good">一年 +${fmt(x.mom, 0)}%</em></div></div>
      <div class="vr-m">
        <div><em>一年漲幅</em><b class="good">+${fmt(x.mom, 0)}%</b><small>不含最近一個月</small></div>
        <div><em>高於半年線</em><b>${pct(x.ma, 0)}</b><small>趨勢向上</small></div>
        <div><em>營收年增</em><b class="good">${pct(x.cumYoY, 0)}</b><small>當月 ${pct(x.revYoY, 0)}</small></div>
        <div><em>本益比</em><b>${fmt(x.pe, 1)}</b><small>${x.dy ? `殖利率 ${fmt(x.dy, 1)}%` : '無配息'}</small></div>
      </div>
      ${w.length ? `<div class="vr-w">${w.map(t => `<span class="pill gold">⚠ ${esc(t)}</span>`).join('')}</div>` : ''}
      ${sh ? `<div class="rp-sz">若拿資產三成做衛星、分 ${VR_N} 檔：<b>${sh >= 1000 ? `${fmt(Math.floor(sh / 1000))} 張${sh % 1000 ? ` ＋ ${fmt(sh % 1000)} 股零股` : ''}` : `${fmt(sh)} 股（零股）`}</b>・約 ${fmt(sh * x.close)} 元</div>` : ''}
      <div class="btn-row">${c ? `<button class="btn-small ghost" data-card="${c.id}" data-go-card="1">看研究卡 ›</button>` : `<button class="btn-small" data-radarcard="${esc(x.code)}" data-n="${esc(x.name)}">建研究卡確認</button>`}
        <a class="btn-small ghost" href="https://tw.stock.yahoo.com/quote/${esc(x.code)}.${x.mkt === '上櫃' ? 'TWO' : 'TW'}/technical-analysis" target="_blank" rel="noopener">技術線圖</a></div></div>`;
  }).join('');
  const ym = V?.revYM ? `${+V.revYM.slice(0, 3) + 1911} 年 ${+V.revYM.slice(3)} 月` : '';
  return `<p class="lead">找<b>營收大成長、股價也強</b>的公司，跟著產業趨勢走；<b>每季換一次股</b>，掉出前 ${VR_N} 名就換掉。報酬高，但跌起來也很兇。</p>
  <div class="card rd-rule"><div class="card-head"><h3 class="gold-bar">⚠️ 成長趨勢的紀律：比價值派更需要照做</h3></div>
    <ol>
      <li><b>只當衛星，不當核心。</b>建議最多用可投資資產的三成，其餘放 0050。回測最大回落 −52%，2018 年 −25%、2022 年 −32%。</li>
      <li><b>一次買前 ${VR_N} 檔，等權重。</b>只買 10 檔時最大回落到 −62%。</li>
      <li><b>每季換股一次，一定要換。</b>1、4、7、10 月營收公布後（約 12 號），掉出前 ${VR_N} 名就賣、換新進榜的。回測改成一年換一次，年化從 25% 掉到 1%：趨勢會反轉，不換就會抱到下跌。</li>
      <li><b>季中不追、不殺。</b>不要每天看盤加碼或停損，照換股日操作。</li>
      <li><b>要有心理準備會長期落後。</b>2013～2019 年它年化只有 7%，輸 0050；漂亮的成績主要來自 2020 年後的 AI 行情。現在名單上不少股票一年已漲好幾倍，行情轉向時跌幅會很大。</li>
    </ol></div>
  ${holdBox}
  <div class="chips">${VR_TIERS.map(([k, l]) => `<button class="chip ${k === tier[0] ? 'on' : ''}" data-radartier="${k}">${k === '低價' ? '💰 ' : ''}${l}</button>`).join('')}<span class="spacer"></span><button class="btn-small ghost" id="radarRefresh">${radarBusy ? '篩選中…' : '↻ 重新篩選'}</button></div>
  <div class="help" style="margin:-4px 0 10px">${V ? `符合條件 ${list.length} 檔，依「過去一年漲幅」排序${list.length > VR_N ? `，前 ${VR_N} 名是這季該持有的` : ''}` : ''}</div>
  ${V ? (rows ? rows + (list.length > VR_N ? `<button class="btn-ghost rd-more" data-radarall="1">${S.radarAll ? `只看前 ${VR_N} 名` : `顯示全部 ${list.length} 檔`}</button>` : '') : '<div class="card empty">目前沒有符合條件的股票。</div>')
    : `<div class="card empty">${radarBusy ? '正在篩選上市櫃全部股票（要抓每檔一年股價，約 15 秒）…' : '按「重新篩選」開始。'}</div>`}
  ${V ? `<div class="help" style="margin-top:10px"><b>入選條件：</b>累計營收年增與當月營收年增都 ≥ 20%、近四季賺錢、成交值 1,000 萬以上、股價站上半年線；依過去 12 個月（不含最近 1 個月）的含息漲幅排序。<br>
    營收資料：${ym}｜營收成長的候選 ${V.cand} 檔｜更新 ${new Date(V.updated).toLocaleString('zh-TW', { hour12: false })}${V.errors?.length ? `<br><span class="bad">${V.errors.map(esc).join('；')}</span>` : ''}<br>來源：證交所、櫃買中心 OpenAPI、Yahoo 股價。</div>` : ''}`;
}

PAGES.radar = () => {
  setTimeout(() => loadRadar(false), 30);
  if (vrTrend()) return vrHead() + vrTrendPage();
  const V = S.radar?.margin ? S.radar : null, tier = VR_TIERS.find(t => t[0] === (S.radarTier || '低價')) || VR_TIERS[0];
  const list = (V?.list || []).filter(tier[2]), shown = S.radarAll ? list : list.slice(0, VR_N);
  let cap = 0; try { cap = typeof wealth === 'function' ? wealth().invest || 0 : 0; } catch (e) { /* 沒有資產資料 */ }
  const per = cap / VR_N, mine = code => S.cards.find(c => String(c.code) === code), lock = code => (S.radarPlans || {})[code];
  const held = typeof holdings === 'function' ? holdings().filter(h => h.shares > 0 && V?.hold?.[h.code]) : [];
  const holdBox = held.length ? `<div class="card"><h3 class="gold-bar">我的持股：用公允價值檢查</h3>
    ${held.map(h => { const H = V.hold[h.code], s = vrHoldCheck(H, vrSince(h.code)); return `<div class="vr-h"><b>${esc(h.code)} ${esc(H[0])}</b><span class="pill ${s[1]}">${s[0]}</span><em>${esc(s[2])}</em></div>`; }).join('')}
    <div class="help">每季（1、4、7、10 月營收公布後）檢查一次就好。抱的年數依你「交易紀錄」裡的買進日期計算。</div></div>` : '';
  const rows = shown.map((x, i) => {
    const w = vrWarn(x), sh = per && x.close ? Math.floor(per / x.close) : 0, c = mine(x.code), L = lock(x.code);
    return `<div class="vr">
      <div class="vr-hd"><span class="rd-rank">${i + 1}</span><div class="rd-id"><b>${esc(x.code)} ${esc(x.name)}</b><em>${esc(x.mkt)}・${esc(x.ind || '—')}・一張約 ${fmt(x.close * 1000)} 元</em></div>
        <div class="rd-px"><b>${vrP(x.close)}</b><em class="good">便宜 ${fmt((1 - x.ratio) * 100, 0)}%</em></div></div>
      ${vrBar(x)}
      <div class="vr-m">
        <div><em>公允價值</em><b>${vrP(x.fair)}</b><small>漲到這裡就賣</small></div>
        <div><em>潛在漲幅</em><b class="good">+${fmt((x.fair / x.close - 1) * 100, 0)}%</b><small>不含股利</small></div>
        <div><em>殖利率</em><b class="good">${fmt(x.dy, 1)}%</b><small>邊等邊領</small></div>
        <div><em>累計營收年增</em><b>${pct(x.cumYoY, 0)}</b><small>沒在衰退</small></div>
      </div>
      <div class="vr-fx">三種估法：本益比法 <b>${vrP(x.fairPE)}</b>（${fmt(x.pe, 1)} 倍 → 同業 ${fmt(Math.max(8, Math.min(20, x.indPE)), 1)} 倍）・淨值法 <b>${vrP(x.fairPB)}</b>（${fmt(x.pb, 2)} → ${fmt(Math.max(0.8, Math.min(2.5, x.indPB)), 2)} 倍）${x.fairDiv ? `・股利法 <b>${vrP(x.fairDiv)}</b>（股利 ÷ 5%）` : ''}；取中間值</div>
      ${w.length ? `<div class="vr-w">${w.map(t => `<span class="pill gold">⚠ ${esc(t)}</span>`).join('')}</div>` : ''}
      ${sh ? `<div class="rp-sz">每檔約可投資資產的 1/${VR_N}：<b>${sh >= 1000 ? `${fmt(Math.floor(sh / 1000))} 張${sh % 1000 ? ` ＋ ${fmt(sh % 1000)} 股零股` : ''}` : `${fmt(sh)} 股（零股）`}</b>・約 ${fmt(sh * x.close)} 元</div>` : ''}
      <div class="btn-row">${c ? `<button class="btn-small ghost" data-card="${c.id}" data-go-card="1">看研究卡 ›</button>` : `<button class="btn-small" data-radarcard="${esc(x.code)}" data-n="${esc(x.name)}">建研究卡確認</button>`}
        <button class="btn-small ghost" data-rpmon="${esc(x.code)}">${L ? '🔒 已設提醒・解除' : '🔔 設到價提醒'}</button>
        <a class="btn-small ghost" href="https://tw.stock.yahoo.com/quote/${esc(x.code)}.${x.mkt === '上櫃' ? 'TWO' : 'TW'}/dividend" target="_blank" rel="noopener">配息紀錄</a></div></div>`;
  }).join('');
  const ym = V?.revYM ? `${+V.revYM.slice(0, 3) + 1911} 年 ${+V.revYM.slice(3)} 月` : '';
  return `${vrHead()}
  <p class="lead">先估每檔股票的<b>公允價值</b>，股價<b>打七折以下</b>才買；買了抱 3～5 年，漲到公允價值、公司轉虧或抱滿 5 年才賣。</p>
  <div class="card rd-rule"><div class="card-head"><h3 class="gold-bar">⚠️ 長抱的紀律：買之前先讀，買了就照做</h3></div>
    <ol>
      <li><b>只買名單上的股票。</b>名單上都是股價 ≤ 公允價值 × 0.7（安全邊際 30%）、近四季賺錢、有配息、營收沒在衰退的公司。</li>
      <li><b>一次分散買 ${VR_N} 檔，每檔約可投資資產的 1/${VR_N}。</b>回測裡 10 檔和 20 檔報酬差不多，但 20 檔的最差情況好很多。</li>
      <li><b>每季檢查一次就好</b>（1、4、7、10 月營收公布後），不要每天看盤。</li>
      <li><b>只有三種情況賣：</b>漲到公允價值（獲利了結）、近四季轉虧（理由消失）、抱滿 5 年還沒到公允價值（市場不認同）。賣掉後換名單上新的一檔。</li>
      <li><b>不設停損。</b>價值股常要等 1～3 年才被重新評價，中間跌 20～30% 是正常的；只要公司還賺錢就抱著，不要因為跌了就賣。</li>
      <li><b>有 ⚠ 標記的先建研究卡確認</b>，看看便宜是不是一次性獲利造成的。</li>
    </ol>
    <details class="rd-bt"><summary>📊 歷史回測：買 20 檔抱 5 年，中位數 +95%（500 萬 → 975 萬），從沒虧過</summary>
      <div class="help" style="margin-top:6px">2013/4～2026/10，每季照當時公開的資料選股，含配息與手續費稅。</div>
      <table class="rd-bt-t"><thead><tr><th>買 20 檔後抱著（任一季開始）</th><th class="num">中位數</th><th class="num">平均</th><th class="num">最差～最好</th></tr></thead><tbody>
        <tr class="me"><td>抱 3 年（39 個起點）</td><td class="num">+41%<br><small>500 萬 → 705 萬</small></td><td class="num">+58%</td><td class="num">0%～+179%</td></tr>
        <tr class="me"><td>抱 5 年（32 個起點）</td><td class="num">+95%<br><small>500 萬 → 975 萬</small></td><td class="num">+108%</td><td class="num">+15%～+222%</td></tr>
        <tr><td>同期間 0050 抱 5 年</td><td class="num">+100%</td><td class="num">+114%</td><td class="num">—</td></tr>
      </tbody></table>
      <table class="rd-bt-t"><thead><tr><th>13 年半連續操作（到公允價就換股）</th><th class="num">年化</th><th class="num">500 萬變成</th><th class="num">最大回落</th></tr></thead><tbody>
        <tr class="me"><td>選股雷達 20 檔</td><td class="num">14.8%</td><td class="num">3,250 萬</td><td class="num">−29%</td></tr>
        <tr><td>選股雷達 20 檔（只買百元內）</td><td class="num">13.7%</td><td class="num">2,860 萬</td><td class="num">−29%</td></tr>
        <tr><td>0050（含配息）</td><td class="num">20.6%</td><td class="num">6,300 萬</td><td class="num">−34%</td></tr>
      </tbody></table>
      <div class="help">歷史上任何一季開始買、抱滿 3 年或 5 年都沒有虧錢；空頭年跌得比大盤少（2022 年 −6%，0050 −22%），但 2024～2026 年 AI 行情集中在台積電等大型股，價值股大幅落後，所以長期總報酬輸 0050。每季依當時公開的本益比、淨值比、殖利率與營收選股，隔天收盤價買進。過去表現不代表未來，也不構成投資建議。</div>
    </details></div>
  ${holdBox}
  <div class="chips">${VR_TIERS.map(([k, l]) => `<button class="chip ${k === tier[0] ? 'on' : ''}" data-radartier="${k}">${k === '低價' ? '💰 ' : ''}${l}</button>`).join('')}<span class="spacer"></span><button class="btn-small ghost" id="radarRefresh">${radarBusy ? '篩選中…' : '↻ 重新篩選'}</button></div>
  <div class="help" style="margin:-4px 0 10px">${V ? `符合條件 ${list.length} 檔，依「比公允價值便宜多少」排序${list.length > VR_N ? `，先看前 ${VR_N} 名` : ''}` : ''}</div>
  ${V ? (rows ? rows + (list.length > VR_N ? `<button class="btn-ghost rd-more" data-radarall="1">${S.radarAll ? `只看前 ${VR_N} 名` : `顯示全部 ${list.length} 檔`}</button>` : '') : '<div class="card empty">目前沒有符合條件的股票。</div>')
    : `<div class="card empty">${radarBusy ? '正在篩選上市櫃全部股票…' : '按「重新篩選」開始。'}</div>`}
  ${V ? `<div class="help" style="margin-top:10px"><b>公允價值怎麼算：</b>本益比法（每股盈餘 × 同業本益比中位數，限 8～20 倍）、淨值法（每股淨值 × 同業淨值比中位數，限 0.8～2.5 倍）、股利法（每股股利 ÷ 5%），三者取中間值。<br>
    <b>入選條件：</b>股價 ≤ 公允價值 × 0.7、本益比 6 倍以上、殖利率 3% 以上、累計營收年增 ≥ 0、成交值 1,000 萬以上。<br>
    營收資料：${ym}｜全市場 ${V.universe} 檔｜更新 ${new Date(V.updated).toLocaleString('zh-TW', { hour12: false })}${V.errors?.length ? `<br><span class="bad">${V.errors.map(esc).join('；')}</span>` : ''}<br>來源：證交所、櫃買中心 OpenAPI。</div>` : ''}`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-radarstyle],[data-radartier],[data-radarall],#radarRefresh,[data-radarcard],[data-rpmon]'); if (!t) return;
  if (t.dataset.radarstyle) { S.radarStyle = t.dataset.radarstyle; S.radarAll = false; save(); if (current !== 'radar') go('radar'); else render(); return loadRadar(false); }
  if (t.dataset.radartier) { S.radarTier = t.dataset.radartier; save(); return render(); }
  if (t.dataset.radarall) { S.radarAll = !S.radarAll; save(); return render(); }
  if (t.id === 'radarRefresh') return loadRadar(true);
  if (t.dataset.rpmon) return radarLock(t.dataset.rpmon);
  if (t.dataset.radarcard) {
    const c = blankCard(); c.code = t.dataset.radarcard; c.name = t.dataset.n || ''; c.market = '台股'; c.fromRadar = true;
    const x = S.radar?.list?.find(y => y.code === c.code), z = vrTrend() && S.radarT?.list?.find(y => y.code === c.code);
    if (z) c.thesis = `【選股雷達・成長趨勢 ${new Date().toLocaleDateString('zh-TW')}】排名第 ${z.rank}，一年漲 ${z.mom}%、高於半年線 ${z.ma}%，累計營收年增 ${z.cumYoY}%（當月 ${z.revYoY}%），本益比 ${z.pe}。計畫：當衛星部位，每季換股日檢查，掉出前 ${VR_N} 名就賣。待確認：營收成長是產業趨勢還是一次性訂單？`;
    else if (x) c.thesis = `【選股雷達 ${new Date().toLocaleDateString('zh-TW')}】公允價值 ${x.fair}（本益比法 ${x.fairPE}、淨值法 ${x.fairPB}${x.fairDiv ? `、股利法 ${x.fairDiv}` : ''}），現價 ${x.close} 便宜 ${fmt((1 - x.ratio) * 100, 0)}%。本益比 ${x.pe}（同業 ${x.indPE}）、殖利率 ${x.dy}%、累計營收年增 ${x.cumYoY}%。計畫：抱 3～5 年，到公允價值、轉虧或滿 5 年賣。待確認：便宜是不是一次性獲利造成的。`;
    S.cards.push(c); openCardId = c.id; save(); go('cards'); setTimeout(() => autoFillCard(c), 50);
  }
});
// 到價提醒：跌到買進上限以下可以買、漲到公允價值該賣；再按一次解除
function radarLock(code) {
  S.radarPlans = S.radarPlans || {};
  const tag = `雷達計畫 ${code}`, y = scrollY;
  S.monitors = S.monitors.filter(m => m.src !== tag);
  if (S.radarPlans[code]) { delete S.radarPlans[code]; save(); toast('已移除提醒'); render(); return scrollTo(0, y); }
  const x = S.radar?.list?.find(z => z.code === code); if (!x) return;
  S.radarPlans[code] = { date: today(), buy: x.buyBelow, fair: x.fair };
  const base = { target: `${code} ${x.name}`.trim(), code, notify: '網站內提醒', status: '啟用', src: tag };
  S.monitors.push(
    { id: uid(), ...base, metric: '收盤價', op: '低於', value: String(x.buyBelow), cond: `跌到買進上限 ${vrP(x.buyBelow)} 以下`, action: `可以買進（每檔約可投資資產 1/${VR_N}），買了抱 3～5 年` },
    { id: uid(), ...base, metric: '收盤價', op: '高於', value: String(x.fair), cond: `漲到公允價值 ${vrP(x.fair)}`, action: '有持股就賣出獲利了結，換名單上還便宜的一檔' });
  save(); toast('已建立「可以買」與「到公允價值」兩個提醒'); render(); scrollTo(0, y);
}
if (current === 'radar') render();
