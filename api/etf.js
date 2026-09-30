// Vercel Serverless Function：台股 ETF 自動資料（MoneyDJ 公開頁面）
// GET /api/etf?code=0056 → { name, issuer, size, fee, totalFee, dividend, yield, index, holdings:[{code,name,w}], sectors:[{name,w}], date }

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36', 'Accept-Language': 'zh-TW,zh;q=0.9' };

async function page(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('MoneyDJ HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  const cs = (res.headers.get('content-type') || '').match(/charset=([\w-]+)/i)?.[1]?.toLowerCase() || 'utf-8';
  let html = new TextDecoder(cs === 'big5' ? 'big5' : 'utf-8').decode(buf);
  if (cs !== 'big5' && /charset=big5/i.test(html.slice(0, 2000))) html = new TextDecoder('big5').decode(buf);
  return html;
}
const clean = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const rows = html => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1])));
const num = s => { const n = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

module.exports = async (req, res) => {
  const code = String(req.query.code || '').trim().toUpperCase().replace(/\.TW$/, '');
  if (!/^\d{4,6}[A-Z]?$/.test(code)) { res.status(400).json({ error: '目前只支援台股 ETF 代號（例如 0050、00878、009816）' }); return; }
  const id = `${code}.TW`, base = 'https://www.moneydj.com/ETF/X/Basic/';
  const errors = []; const out = { code };
  const [b4, b7, b7b] = await Promise.all(['Basic0004', 'Basic0007', 'Basic0007B'].map(p => page(`${base}${p}.xdjhtm?etfid=${id}`).catch(e => { errors.push(`${p}：${e.message}`); return ''; })));

  if (b4) {
    const kv = {};
    rows(b4).forEach(r => { for (let i = 0; i + 1 < r.length; i += 2) if (r[i] && r[i].length < 12) kv[r[i]] = r[i + 1]; });
    out.name = (b4.match(/<title>([^<-]+)/) || [])[1]?.trim();
    out.issuer = kv['發行公司']; out.since = kv['成立日期'];
    out.size = kv['ETF規模']; out.fee = kv['經理費(%)']; out.totalFee = kv['總管理費用(%)'];
    out.dividend = kv['配息頻率']; out.yield = kv['殖利率(%)']; out.index = kv['追蹤指數']; out.nav = kv['ETF淨值'];
  }
  const holdings = [];
  const seen = new Set();
  [b7b, b7].forEach(h => {
    if (!h) return;
    rows(h).forEach(r => {
      const m = (r[0] || '').match(/^(.+?)\((\w+)\.(TW|TWO|US|HK|JP|KS)\)$/i);
      if (m && r[1] != null && num(r[1]) != null && !seen.has(m[2])) { seen.add(m[2]); holdings.push({ code: m[2], name: m[1].trim(), w: num(r[1]) }); }
    });
  });
  out.holdings = holdings;
  const sectors = [];
  if (b7) {
    const sseen = new Set();
    rows(b7).forEach(r => {
      if (r.length === 4 && !r[0] && r[1] && num(r[3]) != null && !/^(台灣|美國|現金|中國|日本|香港)$/.test(r[1]) && !sseen.has(r[1])) { sseen.add(r[1]); sectors.push({ name: r[1], w: num(r[3]) }); }
    });
  }
  out.sectors = sectors.sort((a, b) => b.w - a.w);
  out.date = ((b7b || b7).match(/資料日期[：:]\s*([\d/]+)/) || [])[1] || '';
  out.errors = errors;
  const ok = holdings.length > 0;
  res.setHeader('Cache-Control', ok ? 's-maxage=43200, stale-while-revalidate=86400' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(ok ? 200 : 404).send(JSON.stringify(out));
};
