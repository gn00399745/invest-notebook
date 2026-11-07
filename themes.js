/* ================= 趨勢主題雷達 =================
   先看「哪個科技趨勢正在升溫」，再看「供應鏈裡誰真的吃到紅利」：
   ・主題熱度＝股價動能＋站上季線比例＋營收成長＋新聞熱度（api/themes.js）
   ・個股判讀：營收和股價誰先跑（正在吃紅利／營收起飛股價未反映／股價先跑待驗證） */
'use strict';

let themesBusy = false;
async function loadThemes(force) {
  if (themesBusy || !location.protocol.startsWith('http')) return;
  if (!force && S.themes && Date.now() - (S.themesAt || 0) < 6 * 3600e3) return;
  themesBusy = true; if (current === 'themes') render();
  try {
    const j = await (await fetch('api/themes' + (force ? '?t=' + Date.now() : ''), { signal: AbortSignal.timeout(90000) })).json();
    if (j.error || !j.themes) throw new Error(j.error || '格式錯誤');
    S.themes = j; S.themesAt = Date.now(); save();
  } catch (e) { if (current === 'themes') toast('主題資料讀取失敗：' + e.message); }
  themesBusy = false; if (current === 'themes') { const y = scrollY; render(); scrollTo(0, y); }
}
const thPc = v => v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v, 1)}%`;
const thCls = v => v == null ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '';
const TH_TAG = { hot: '🔥', gem: '💎', spec: '🚀', cold: '❄️', neu: '·' };
function thSpark(a) {
  if (!a || a.length < 3) return '';
  const lo = Math.min(...a), hi = Math.max(...a), w = 90, h = 26, d = a.map((v, i) => `${i ? 'L' : 'M'}${(i / (a.length - 1) * w).toFixed(1)},${(h - (v - lo) / (hi - lo || 1) * h).toFixed(1)}`).join('');
  return `<svg class="th-spk ${a[a.length - 1] >= a[0] ? 'up' : 'down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${d}"/></svg>`;
}
function thHasCard(code) { return S.cards.find(c => !c.example && String(c.code).toUpperCase() === String(code).toUpperCase()); }
function thRow(x, t) {
  const has = thHasCard(x.code);
  return `<div class="th-s ${x.cls}">
    <div class="th-sn"><b>${esc(x.code)}</b><span>${esc(x.name || '')}</span></div>
    <i class="th-tag ${x.cls}">${TH_TAG[x.cls] || ''} ${esc(x.tag)}</i>
    <div class="th-sm"><span>3 個月 <b class="${thCls(x.r3m)}">${thPc(x.r3m)}</b></span><span>營收年增 <b class="${thCls(x.rev)}">${thPc(x.rev)}</b>${x.revYM ? `<small>${x.revYM.slice(-2)} 月</small>` : x.mkt === '美股' && x.rev != null ? '<small>近一季</small>' : ''}</span></div>
    ${thSpark(x.spark)}
    <button class="btn-small ${has ? 'ghost' : ''}" data-thcard="${esc(x.code)}" data-th="${esc(t.id)}">${has ? '打開研究卡' : '＋ 研究卡'}</button></div>`;
}
function thCard(t, open) {
  const nw = t.news, sc = t.score ?? 0;
  return `<div class="card th-card ${open ? 'open' : ''}" data-thopen="${t.id}">
    <div class="th-h"><span class="th-ic">${t.ic}</span><div><h3>${esc(t.name)}</h3><i class="th-st ${t.stage[0]}">${t.stage[1]}</i></div>
      <div class="th-sc"><b>${sc}</b><small>熱度</small></div></div>
    <div class="th-bar"><i style="width:${sc}%"></i></div>
    <div class="th-m"><span>股價 3 個月<b class="${thCls(t.m3)}">${thPc(t.m3)}</b></span><span>近 1 個月<b class="${thCls(t.m1)}">${thPc(t.m1)}</b></span><span>營收年增<b class="${thCls(t.rev)}">${thPc(t.rev)}</b></span><span>站上季線<b>${t.breadth ?? '—'}%</b></span><span>新聞 7 天<b>${nw ? nw.n7 : '—'}</b></span></div>
    <div class="help">${esc(t.stage[2])}</div>
    ${open ? `<div class="th-body">
      <div class="th-why">💬 ${esc(t.why)}</div>
      <div class="th-chain">${t.chain.map(c => `<div class="th-cg"><div class="th-role">${esc(c.role)}</div>${c.list.map(x => thRow(x, t)).join('')}</div>`).join('')}</div>
      ${nw?.top?.length ? `<div class="th-news"><b>📰 最新新聞</b>${nw.top.map(n => `<a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}<small>${esc(n.src || '')} ・ ${esc(n.d)}</small></a>`).join('')}</div>` : ''}
    </div>` : '<div class="th-more">看供應鏈與個股 ›</div>'}
  </div>`;
}
PAGES.themes = () => {
  setTimeout(() => loadThemes(false), 30);
  const D = S.themes, T = D?.themes || [];
  const all = T.flatMap(t => t.chain.flatMap(c => c.list.map(x => ({ ...x, th: t })))), seen = new Set();
  const pick = all.filter(x => (x.cls === 'gem' || x.cls === 'hot') && !seen.has(x.code) && seen.add(x.code)).sort((a, b) => (b.cls === 'gem') - (a.cls === 'gem') || (b.rev ?? 0) - (a.rev ?? 0)).slice(0, 10);
  const open = S.thOpen || T[0]?.id;
  return `${typeof subNav === 'function' ? subNav('themes') : ''}<h2>趨勢主題雷達</h2>
    <p class="help">先看哪個科技趨勢正在升溫，再看供應鏈裡誰的營收真的跟著成長。熱度＝股價動能、站上季線比例、營收年增、新聞篇數，在所有主題中排名。
      ${D ? `<br>更新於 ${new Date(D.updated).toLocaleString('zh-TW', { hour12: false })}` : ''} <button class="btn-small ghost" id="thRefresh">${themesBusy ? '更新中…（約 20～40 秒）' : '↻ 更新'}</button></p>
    ${!D ? `<div class="card"><div class="empty">${themesBusy ? '正在分析各主題的股價、營收與新聞…（約 20～40 秒）' : '還沒有資料，按「更新」開始分析。'}</div></div>` : `
    <div class="card th-pick"><h3 class="gold-bar">💎 值得優先研究</h3>
      <div class="help">「營收起飛、股價未反映」排前面：基本面已經吃到紅利，但市場還沒完全買單。「正在吃紅利」是營收和股價一起漲，追高要分批。</div>
      ${pick.length ? `<div class="th-pl">${pick.map(x => `<div class="th-pi" data-thopen="${x.th.id}"><span>${x.th.ic} ${esc(x.th.name)}</span><b>${esc(x.code)} ${esc(x.name || '')}</b><i class="th-tag ${x.cls}">${TH_TAG[x.cls]} ${esc(x.tag)}</i><small>營收 <b class="${thCls(x.rev)}">${thPc(x.rev)}</b>・3 個月 <b class="${thCls(x.r3m)}">${thPc(x.r3m)}</b></small></div>`).join('')}</div>` : '<div class="empty">目前沒有營收大幅成長的主題股。</div>'}
    </div>
    <div class="th-grid">${T.map(t => thCard(t, t.id === open)).join('')}</div>
    <div class="help">${esc(D.note || '')}${D.errors?.length ? `<br>⚠ 部分資料取得失敗：${esc(D.errors.join('；'))}` : ''}</div>`}`;
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-thcard]');
  if (b) {
    e.stopPropagation();
    const code = b.dataset.thcard, ex = thHasCard(code);
    if (ex) { openCardId = ex.id; return go('cards'); }
    const t = S.themes?.themes?.find(y => y.id === b.dataset.th), x = t?.chain.flatMap(c => c.list).find(y => y.code === code), role = t?.chain.find(c => c.list.some(y => y.code === code))?.role;
    const c = blankCard(); c.code = code; c.name = x?.name || ''; c.market = /^\d/.test(code) ? '台股' : '美股'; c.fromTheme = t?.id;
    c.thesis = `【趨勢主題 ${new Date().toLocaleDateString('zh-TW')}】${t?.name}｜${role}。${t?.why} 判讀：${x?.tag}（營收年增 ${thPc(x?.rev)}、股價 3 個月 ${thPc(x?.r3m)}）。待確認：這家公司的營收有多少比例來自這個主題？競爭對手是誰？`;
    S.cards.push(c); openCardId = c.id; save(); go('cards'); setTimeout(() => autoFillCard(c), 50);
    return;
  }
  const o = e.target.closest('[data-thopen]');
  if (o && current === 'themes' && !e.target.closest('a, .th-body, button')) { const id = o.dataset.thopen; S.thOpen = S.thOpen === id && o.classList.contains('th-card') ? '' : id; save(); render(); if (!o.classList.contains('th-card')) setTimeout(() => document.querySelector(`.th-card[data-thopen="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); return; }
  if (e.target.closest('#thRefresh')) loadThemes(true);
});
