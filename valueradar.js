/* 價值雷達：找長期被低估、營收沒在衰退的股票；每月營收公布後檢查一次，長抱等重新評價 */
'use strict';

const VR_N = 15;   // 回測用 15 檔等權重
const VR_TIERS = [['低價', '百元內', x => x.close < 100], ['全部', '全部價位', () => true]];
let valueBusy = false;
async function loadValue(force) {
  if (valueBusy || !location.protocol.startsWith('http')) return;
  if (!force && S.value && Date.now() - (S.valueAt || 0) < 6 * 3600e3) return;
  valueBusy = true; if (current === 'value') render();
  try {
    const j = await (await fetch('api/value' + (force ? '?t=' + Date.now() : ''), { signal: AbortSignal.timeout(60000) })).json();
    if (!j.list) throw new Error('格式錯誤');
    S.value = j; S.valueAt = Date.now(); save(); if (force) toast(`找到 ${j.list.length} 檔`);
  } catch (e) { toast('價值雷達更新失敗：' + e.message); }
  valueBusy = false; if (current === 'value') { const y = scrollY; render(); scrollTo(0, y); }
}
// 續抱檢查（與回測相同）：本益比 > 0、不高於同業中位數、累計營收年增 ≥ −10%
function vrHoldCheck(h) {
  const [, , pe, rel, , cum] = h;
  if (!(pe > 0)) return ['該賣', 'red', '近四季轉虧'];
  if (rel != null && rel > 1) return ['該賣', 'red', `本益比已高於同業（${fmt(rel * 100, 0)}%），不再便宜`];
  if (cum != null && cum < -10) return ['該賣', 'red', `累計營收年增 ${pct(cum, 0)}，基本面在衰退`];
  return ['續抱', 'green', `本益比為同業的 ${rel != null ? fmt(rel * 100, 0) + '%' : '—'}・累計營收 ${cum != null ? pct(cum, 0) : '—'}`];
}
const vrWarn = x => [x.pe < 6 && '本益比極低，可能是一次性獲利', (x.cumYoY > 100 || x.revYoY > 150) && '營收暴增，可能是一次性入帳', x.dy >= 10 && '殖利率異常高，確認是否一次性配息', /營造|建材/.test(x.ind) && '營建股獲利認列不平均'].filter(Boolean);

PAGES.value = () => {
  setTimeout(() => loadValue(false), 30);
  const V = S.value, tier = VR_TIERS.find(t => t[0] === (S.valueTier || '低價')) || VR_TIERS[0];
  const list = (V?.list || []).filter(tier[2]), shown = S.valueAll ? list : list.slice(0, VR_N);
  let cap = 0; try { cap = typeof wealth === 'function' ? wealth().invest || 0 : 0; } catch (e) { /* 沒有資產資料 */ }
  const per = cap / VR_N, mine = code => S.cards.find(c => String(c.code) === code);
  const held = typeof holdings === 'function' ? holdings().filter(h => h.shares > 0 && V?.hold?.[h.code]) : [];
  const holdBox = held.length ? `<div class="card"><h3 class="gold-bar">我的持股：用價值標準檢查</h3>
    ${held.map(h => { const H = V.hold[h.code], s = vrHoldCheck(H); return `<div class="vr-h"><b>${esc(h.code)} ${esc(H[0])}</b><span class="pill ${s[1]}">${s[0]}</span><em>${esc(s[2])}</em></div>`; }).join('')}
    <div class="help">只有用價值雷達買進的股票才適用這個標準；用選股雷達（動能）買的，照選股雷達的出場規則。</div></div>` : '';
  const rows = shown.map((x, i) => {
    const w = vrWarn(x), sh = per && x.close ? Math.floor(per / x.close) : 0, c = mine(x.code);
    return `<div class="vr">
      <div class="vr-hd"><span class="rd-rank">${i + 1}</span><div class="rd-id"><b>${esc(x.code)} ${esc(x.name)}</b><em>${esc(x.mkt)}・${esc(x.ind || '—')}</em></div>
        <div class="rd-px"><b>${fmt(x.close, x.close < 100 ? 2 : 1)}</b><em>一張約 ${fmt(x.close * 1000)} 元</em></div></div>
      <div class="vr-m">
        <div><em>本益比</em><b>${fmt(x.pe, 1)}</b><small>同業 ${fmt(x.indPE, 1)}・便宜 ${fmt((1 - x.rel) * 100, 0)}%</small></div>
        <div><em>股價淨值比</em><b>${fmt(x.pb, 2)}</b><small>2 以下</small></div>
        <div><em>殖利率</em><b class="good">${fmt(x.dy, 1)}%</b><small>4% 以上</small></div>
        <div><em>累計營收年增</em><b>${pct(x.cumYoY, 0)}</b><small>沒在衰退</small></div>
      </div>
      ${w.length ? `<div class="vr-w">${w.map(t => `<span class="pill gold">⚠ ${esc(t)}</span>`).join('')}</div>` : ''}
      ${sh ? `<div class="rp-sz">每檔約可投資資產的 1/${VR_N}：<b>${sh >= 1000 ? `${fmt(Math.floor(sh / 1000))} 張${sh % 1000 ? ` ＋ ${fmt(sh % 1000)} 股零股` : ''}` : `${fmt(sh)} 股（零股）`}</b>・約 ${fmt(sh * x.close)} 元</div>` : ''}
      <div class="btn-row">${c ? `<button class="btn-small ghost" data-card="${c.id}" data-go-card="1">看研究卡 ›</button>` : `<button class="btn-small" data-vrcard="${esc(x.code)}" data-n="${esc(x.name)}">建研究卡確認</button>`}
        <a class="btn-small ghost" href="https://tw.stock.yahoo.com/quote/${esc(x.code)}.${x.mkt === '上櫃' ? 'TWO' : 'TW'}/dividend" target="_blank" rel="noopener">配息紀錄</a></div></div>`;
  }).join('');
  const ym = V?.revYM ? `${+V.revYM.slice(0, 3) + 1911} 年 ${+V.revYM.slice(3)} 月` : '';
  return `<h2>價值雷達</h2>
  <p class="lead">反過來找<b>長期被低估、營收沒在衰退</b>的股票：本益比比同業便宜、股價淨值比低、殖利率高。跟選股雷達（追動能）是兩套邏輯，可以互補。</p>
  <div class="card rd-rule"><div class="card-head"><h3 class="gold-bar">⚠️ 價值投資的紀律</h3></div>
    <ol>
      <li><b>一次分散買 ${VR_N} 檔，每檔約可投資資產的 1/${VR_N}。</b>不必等回檔，名單上的股票本來就便宜。</li>
      <li><b>每月 11 日營收公布後檢查一次。</b>還便宜就續抱，不要每天看盤。</li>
      <li><b>該賣的三種情況：</b>本益比回到同業中位數以上（不再便宜）、累計營收年增掉到 −10% 以下、或近四季轉虧。賣掉後補上名單裡新的一檔。</li>
      <li><b>不設短線停損。</b>價值股常要等 1～2 年才被重新評價，中間跌 20～30% 是正常的。</li>
      <li><b>不要只挑最便宜的。</b>只看本益比最低或殖利率最高，回測反而虧錢（價值陷阱）；營收沒在衰退這一條很重要。</li>
      <li><b>有 ⚠ 標記的先建研究卡確認</b>，看看低本益比、高殖利率是不是一次性獲利或處分資產。</li>
    </ol>
    <details class="rd-bt"><summary>📊 這套規則的歷史回測（2022/1～2026/10）</summary>
      <table class="rd-bt-t"><thead><tr><th>做法（500 萬起、含配息與手續費稅）</th><th class="num">年化報酬</th><th class="num">最大回落</th></tr></thead><tbody>
        <tr class="me"><td>價值雷達（8～20 檔）</td><td class="num">14～19%</td><td class="num">−29～−35%</td></tr>
        <tr><td>價值雷達（百元內，15 檔）</td><td class="num">14.6%</td><td class="num">−27%</td></tr>
        <tr><td>只挑本益比最低 15 檔（不看營收）</td><td class="num">−6.4%</td><td class="num">−41%</td></tr>
        <tr><td>只挑殖利率最高 15 檔（不看營收）</td><td class="num">−4.8%</td><td class="num">−38%</td></tr>
        <tr><td>0056（含配息）</td><td class="num">22.3%</td><td class="num">−27%</td></tr>
        <tr><td>0050（含配息）</td><td class="num">28.2%</td><td class="num">−34%</td></tr>
      </tbody></table>
      <div class="help">每月營收公布後依當時公開的本益比、淨值比、殖利率選股，隔天開盤換股。價值股與動能股賺錢的年份常錯開（例如 2025 年動能較好、2026 年價值較好）。過去表現不代表未來，也不構成投資建議。</div>
    </details></div>
  ${holdBox}
  <div class="chips">${VR_TIERS.map(([k, l]) => `<button class="chip ${k === tier[0] ? 'on' : ''}" data-vrtier="${k}">${k === '低價' ? '💰 ' : ''}${l}</button>`).join('')}<span class="spacer"></span><button class="btn-small ghost" id="valueRefresh">${valueBusy ? '篩選中…' : '↻ 重新篩選'}</button></div>
  <div class="help" style="margin:-4px 0 10px">${V ? `符合條件 ${list.length} 檔，依「對同業本益比、淨值比、殖利率」綜合排序${list.length > VR_N ? `，先看前 ${VR_N} 名` : ''}` : ''}</div>
  ${V ? (rows ? rows + (list.length > VR_N ? `<button class="btn-ghost rd-more" data-vrall="1">${S.valueAll ? `只看前 ${VR_N} 名` : `顯示全部 ${list.length} 檔`}</button>` : '') : '<div class="card empty">目前沒有符合條件的股票。</div>')
    : `<div class="card empty">${valueBusy ? '正在篩選上市櫃全部股票…' : '按「重新篩選」開始。'}</div>`}
  ${V ? `<div class="help" style="margin-top:10px">條件：本益比 15 倍以下且比同業中位數便宜 20% 以上、股價淨值比 2 以下、殖利率 4% 以上、累計營收年增 ≥ 0、成交值 1,000 萬以上。營收資料：${ym}｜全市場 ${V.universe} 檔｜更新 ${new Date(V.updated).toLocaleString('zh-TW', { hour12: false })}${V.errors?.length ? `<br><span class="bad">${V.errors.map(esc).join('；')}</span>` : ''}<br>來源：證交所、櫃買中心 OpenAPI。</div>` : ''}`;
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-vrtier],[data-vrall],#valueRefresh,[data-vrcard]'); if (!t) return;
  if (t.dataset.vrtier) { S.valueTier = t.dataset.vrtier; save(); return render(); }
  if (t.dataset.vrall) { S.valueAll = !S.valueAll; save(); return render(); }
  if (t.id === 'valueRefresh') return loadValue(true);
  if (t.dataset.vrcard) {
    const c = blankCard(); c.code = t.dataset.vrcard; c.name = t.dataset.n || ''; c.market = '台股';
    const x = S.value?.list?.find(y => y.code === c.code);
    if (x) c.thesis = `【價值雷達 ${new Date().toLocaleDateString('zh-TW')}】本益比 ${x.pe}（同業 ${fmt(x.indPE, 1)}）、淨值比 ${x.pb}、殖利率 ${x.dy}%、累計營收年增 ${x.cumYoY}%。待確認：低本益比是不是一次性獲利。`;
    S.cards.push(c); openCardId = c.id; save(); go('cards'); setTimeout(() => autoFillCard(c), 50);
  }
});
if (current === 'value') render();
