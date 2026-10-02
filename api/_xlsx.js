// 極簡 xlsx 讀取（不需外部套件）：解 zip → 讀 sharedStrings 與工作表
'use strict';
const zlib = require('zlib');

function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('不是有效的 xlsx');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const files = {};
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString('utf8');
    files[name] = () => { const lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28); const d = buf.slice(off + 30 + lnl + lel, off + 30 + lnl + lel + csize); return (method === 0 ? d : zlib.inflateRawSync(d)).toString('utf8'); };
    p += 46 + nl + el + cl;
  }
  return files;
}
const colIdx = s => s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
const unx = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
// 回傳 { 工作表名: 二維陣列（rows[r][c]，字串或數字）}；names 可只讀指定工作表
function readXlsx(buf, names) {
  const f = unzip(buf);
  const strs = f['xl/sharedStrings.xml'] ? [...f['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unx([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''))) : [];
  const wb = f['xl/workbook.xml'](), rels = f['xl/_rels/workbook.xml.rels']();
  const out = {};
  for (const m of wb.matchAll(/<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"/g)) {
    const name = unx(m[1]); if (names && !names.some(n => (n instanceof RegExp ? n.test(name) : n === name))) continue;
    const tgt = (rels.match(new RegExp(`Id="${m[2]}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${m[2]}"`)) || [])[1]; if (!tgt) continue;
    const path = tgt.startsWith('/') ? tgt.slice(1) : 'xl/' + tgt; if (!f[path]) continue;
    const rows = [];
    for (const r of f[path]().matchAll(/<row [^>]*?r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const inner = c[3] || ''; const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; const is = (inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
        let val = null;
        if (/t="s"/.test(c[2]) && v != null) val = strs[+v]; else if (/t="inlineStr"/.test(c[2])) val = unx(is || ''); else if (/t="str"/.test(c[2])) val = unx(v || ''); else if (v != null) val = isFinite(+v) ? +v : unx(v);
        if (val != null && val !== '') row[colIdx(c[1])] = typeof val === 'string' ? val.trim() : val;
      }
      rows[+r[1] - 1] = row;
    }
    out[name] = rows;
  }
  return out;
}
module.exports = { readXlsx, colIdx };
