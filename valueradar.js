/* 選股雷達：估公允價值，股價打七折以下才買；買了抱 3～5 年，漲到公允價值、轉虧或滿 5 年才賣
   規則與 2013～2026 回測相同（api/radar.js） */
'use strict';

const VR_N = 20;   // 回測用 20 檔等權重
const VR_TIERS = [['低價', '百元內', x => x.close < 100], ['全部', '全部價位', () => true]];
const vrP = p => p == null ? '—' : fmt(p, p < 100 ? 2 : 1);
let radarBusy = false;
async function loadRadar(force) {
  if (radarBusy || !location.protocol.startsWith('http')) return;
  if (!force && S.radar?.margin && Date.now() - (S.radarAt || 0) < 6 * 3600e3) return;   // 舊版（動能）資料沒有 margin，直接重抓
  radarBusy = true; if (current === 'radar') render();
  try {
    const j = await (await fetch('api/radar' + (force ? '?t=' + Date.now() : ''), { signal: AbortSignal.timeout(60000) })).json();
    if (!j.list) throw new Error('格式錯誤');
    S.radar = j; S.radarAt = Date.now(); save(); if (force) toast(`找到 ${j.list.length} 檔`);
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

PAGES.radar = () => {
  setTimeout(() => loadRadar(false), 30);
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
  return `<h2>選股雷達</h2>
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
  const t = e.target.closest('[data-radartier],[data-radarall],#radarRefresh,[data-radarcard],[data-rpmon]'); if (!t) return;
  if (t.dataset.radartier) { S.radarTier = t.dataset.radartier; save(); return render(); }
  if (t.dataset.radarall) { S.radarAll = !S.radarAll; save(); return render(); }
  if (t.id === 'radarRefresh') return loadRadar(true);
  if (t.dataset.rpmon) return radarLock(t.dataset.rpmon);
  if (t.dataset.radarcard) {
    const c = blankCard(); c.code = t.dataset.radarcard; c.name = t.dataset.n || ''; c.market = '台股'; c.fromRadar = true;
    const x = S.radar?.list?.find(y => y.code === c.code);
    if (x) c.thesis = `【選股雷達 ${new Date().toLocaleDateString('zh-TW')}】公允價值 ${x.fair}（本益比法 ${x.fairPE}、淨值法 ${x.fairPB}${x.fairDiv ? `、股利法 ${x.fairDiv}` : ''}），現價 ${x.close} 便宜 ${fmt((1 - x.ratio) * 100, 0)}%。本益比 ${x.pe}（同業 ${x.indPE}）、殖利率 ${x.dy}%、累計營收年增 ${x.cumYoY}%。計畫：抱 3～5 年，到公允價值、轉虧或滿 5 年賣。待確認：便宜是不是一次性獲利造成的。`;
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
