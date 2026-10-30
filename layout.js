/* ================= 電腦版排版：版面填滿、卡片排成多欄 =================
   寬螢幕時，頁面裡連續的卡片自動排成 2～3 欄（由左到右、由上到下），
   含寬表格或圖表的卡片佔滿整列。手機版不受影響。 */
const DESK = () => innerWidth >= 1280;
// 欄位多的表格、大圖表放整列
const isWide = c => c.classList.contains('wide') || !!c.querySelector('.w-hero, .tm-clock, .ind-grid, .tr-grid, .rc-list, .chart') ||
  [...c.querySelectorAll('.gt')].some(g => +(g.style.getPropertyValue('--n') || 0) >= 5) || [...c.querySelectorAll('table')].some(t => (t.rows[0]?.cells.length || 0) >= 5);
function deskLayout() {
  const v = $('#view'); if (!v) return;
  v.classList.toggle('desk', DESK());
  if (!DESK() || current === 'home') return;
  const kids = [...v.children]; let run = [];
  // 一段連續的卡片：寬卡片佔整列；其餘依序放進比較矮的那一欄（兩欄各自往下排，不會留空）
  const flush = () => {
    if (run.length >= 2) {
      let seg = [];
      const put = () => {
        if (seg.length === 1) seg[0].classList.add('dg-wide');
        if (seg.length >= 2) {
          const g = document.createElement('div'); g.className = 'dgrid'; const cols = [document.createElement('div'), document.createElement('div')];
          cols.forEach(c => { c.className = 'dcol'; g.appendChild(c); }); seg[0].before(g);
          seg.forEach(c => { const k = cols[0].offsetHeight <= cols[1].offsetHeight ? 0 : 1; cols[k].appendChild(c); });
        }
        seg = [];
      };
      run.forEach(c => { if (isWide(c)) { put(); c.classList.add('dg-wide'); } else seg.push(c); }); put();
    }
    run = [];
  };
  kids.forEach(k => { if (k.matches('.card, details.card, section.card') && !k.matches('.alert')) run.push(k); else flush(); });
  flush();
}
const _renderDesk = render;
render = function () { const r = _renderDesk.apply(this, arguments); try { deskLayout(); } catch (e) { console.warn(e); } return r; };
render._tried = _renderDesk._tried;
let deskW = innerWidth;
addEventListener('resize', () => { if (DESK() !== (deskW >= 1280)) { deskW = innerWidth; render(); } else deskW = innerWidth; });
deskLayout();
