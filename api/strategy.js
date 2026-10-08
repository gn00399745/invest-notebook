// Vercel Serverless Function：台股策略組合（每月換股）＋歷史回測
// GET /api/strategy
// 候選池：上市公司市值前 150 大（不含 ETF）。資料：證交所 OpenAPI（市值、產業）、Yahoo Finance 月線（含息還原價、配息）。
// 每個月底依規則選股、等權重持有一個月，扣除換股成本，跟 0050（含息）比較。
'use strict';

const UA = { 'User-Agent': 'Mozilla/5.0 (invest-notebook; personal research tool)', Accept: 'application/json' };
const T = ms => AbortSignal.timeout(ms);
const num = s => { const n = parseFloat(String(s ?? '').replace(/[,%\s]/g, '')); return Number.isFinite(n) ? n : null; };
const r1 = n => n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10;
const r2 = n => n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100;
async function getJ(u, ms = 20000) { const res = await fetch(u, { headers: UA, signal: T(ms) }); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }
async function pool(items, n, f) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await f(items[k]); } catch (e) { out[k] = null; } } })); return out; }
const ym = t => { const d = new Date((t + 8 * 3600) * 1000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

async function monthly(sym) {
  const j = await getJ(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=12y&interval=1mo&events=div`, 10000);
  const R = j.chart.result[0], q = R.indicators.quote[0], adj = R.indicators.adjclose?.[0]?.adjclose || q.close, M = {};
  R.timestamp.forEach((t, i) => { if (q.close[i] != null && adj[i] != null) M[ym(t)] = { c: q.close[i], a: adj[i], d: 0 }; });
  Object.values(R.events?.dividends || {}).forEach(e => { const k = ym(e.date); if (M[k]) M[k].d += e.amount; });
  return M;
}

const STRATS = [
  { id: 'mom20', name: '動能領先 20', tag: 'MOM20', desc: '過去 12 個月（不含最近 1 個月）漲最多的 20 檔。強者恆強，適合多頭；轉折時回檔較大。', n: 20 },
  { id: 'lowvol20', name: '低波動穩健 20', tag: 'LV20', desc: '過去 12 個月股價波動最小的 20 檔。漲得較慢，但下跌時通常比大盤抗跌。', n: 20 },
  { id: 'div20', name: '高股息 20', tag: 'DIV20', desc: '近 12 個月現金殖利率最高的 20 檔（排除波動最大的三分之一），適合存股、領息。', n: 20 },
  { id: 'trend15', name: '趨勢強勢 15', tag: 'TR15', desc: '站上年線、而且近 3 個月漲幅最大的 15 檔。跟著趨勢走，月月檢查。', n: 15 },
  { id: 'tech15', name: '電子科技龍頭 15', tag: 'TECH15', desc: '半導體、電子、電腦、通信網路公司中，12 個月動能最強的 15 檔。', n: 15 },
  { id: 'multi20', name: '多因子均衡 20', tag: 'MF20', desc: '動能、低波動、殖利率三項排名平均最好的 20 檔，兼顧攻擊與防守。', n: 20 },
];
const TECH = /半導體|電子|電腦|光電|通信網路|資訊服務/;
const COST = 0.006; // 換股成本：手續費買賣各 0.1425% ＋ 證交稅 0.3%（以換掉的比例計）

module.exports = async (req, res) => {
  try {
    const B = 'https://openapi.twse.com.tw/v1/';
    const [day, info, rev] = await Promise.all(['exchangeReport/STOCK_DAY_ALL', 'opendata/t187ap03_L', 'opendata/t187ap05_L'].map(p => getJ(B + p).catch(() => [])));
    const U = {};
    day.forEach(x => { if (/^[1-9]\d{3}$/.test(x.Code)) U[x.Code] = { code: x.Code, name: x.Name, close: num(x.ClosingPrice) }; });
    info.forEach(x => { const u = U[x['公司代號']]; if (u) u.shares = num(x['已發行普通股數或TDR原股發行股數']); });
    rev.forEach(x => { const u = U[x['公司代號']]; if (u) u.ind = x['產業別'] || ''; });
    const uni = Object.values(U).filter(u => u.close && u.shares).map(u => ({ ...u, mcap: u.close * u.shares })).sort((a, b) => b.mcap - a.mcap).slice(0, 150);
    if (uni.length < 50) throw new Error('證交所資料取得失敗');
    const [bench, ...data] = await pool(['0050.TW', ...uni.map(u => u.code + '.TW')], 14, monthly);
    if (!bench) throw new Error('0050 資料取得失敗');
    const months = Object.keys(bench).sort();
    const S = uni.map((u, i) => ({ ...u, M: data[i] })).filter(s => s.M && Object.keys(s.M).length >= 14);
    // 每月的因子
    const at = (s, k) => s.M[k];
    const sig = (s, i) => {
      const k = months[i], p = months.slice(Math.max(0, i - 12), i + 1).map(m => at(s, m));
      if (p.length < 13 || p.some(x => !x)) return null;
      const rets = []; for (let j = 1; j < 13; j++) rets.push(p[j].a / p[j - 1].a - 1);
      const mean = rets.reduce((a, b) => a + b, 0) / 12, vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / 11) * Math.sqrt(12);
      const ma12 = p.slice(1).reduce((a, b) => a + b.c, 0) / 12, divs = p.slice(1).reduce((a, b) => a + b.d, 0);
      return { mom: p[11].a / p[0].a - 1, mom3: p[12].a / p[9].a - 1, vol, yld: divs / p[12].c, above: p[12].c > ma12, ret1: p[12].a / p[11].a - 1, tech: TECH.test(s.ind || '') };
    };
    const pick = (st, rows) => {
      const n = st.n, by = (f, asc) => [...rows].sort((a, b) => asc ? f(a) - f(b) : f(b) - f(a));
      if (st.id === 'mom20') return by(x => x.g.mom).slice(0, n);
      if (st.id === 'lowvol20') return by(x => x.g.vol, true).slice(0, n);
      if (st.id === 'div20') { const v = [...rows].sort((a, b) => a.g.vol - b.g.vol), cut = v[Math.floor(v.length * 2 / 3)]?.g.vol ?? 9; return by(x => x.g.yld).filter(x => x.g.vol <= cut).slice(0, n); }
      if (st.id === 'trend15') return by(x => x.g.mom3).filter(x => x.g.above).slice(0, n);
      if (st.id === 'tech15') return by(x => x.g.mom).filter(x => x.g.tech).slice(0, n);
      if (st.id === 'multi20') { const rk = (f, asc) => { const m = new Map(by(f, asc).map((x, i) => [x.s.code, i])); return x => m.get(x.s.code); }; const a = rk(x => x.g.mom), b = rk(x => x.g.vol, true), c = rk(x => x.g.yld); return [...rows].sort((x, y) => (a(x) + b(x) + c(x)) - (a(y) + b(y) + c(y))).slice(0, n); }
      return [];
    };
    // 回測：從有足夠股票有 13 個月資料的月份開始
    let start = months.findIndex((_, i) => S.filter(s => sig(s, i)).length >= 60); if (start < 0) throw new Error('歷史資料不足');
    const out = STRATS.map(st => ({ ...st, curve: [1], prev: [] }));
    const bcurve = [1];
    for (let i = start; i < months.length - 1; i++) {
      const rows = S.map(s => ({ s, g: sig(s, i) })).filter(x => x.g);
      const nk = months[i + 1], k = months[i];
      out.forEach(o => {
        const sel = pick(o, rows); if (!sel.length) { o.curve.push(o.curve[o.curve.length - 1]); return; }
        const rets = sel.map(x => { const a = at(x.s, k), b = at(x.s, nk); return a && b ? b.a / a.a - 1 : 0; });
        const codes = sel.map(x => x.s.code), turn = o.prev.length ? codes.filter(c => !o.prev.includes(c)).length / codes.length : 1;
        const gr = rets.reduce((a, b) => a + b, 0) / rets.length - turn * COST;
        o.curve.push(o.curve[o.curve.length - 1] * (1 + gr)); o.prev = codes;
      });
      bcurve.push(bcurve[bcurve.length - 1] * (bench[nk].a / bench[k].a));
    }
    const lab = months.slice(start); // 曲線第 j 點＝lab[j] 月底
    const stat = cv => {
      const n = cv.length - 1, back = m => n >= m ? cv[n] / cv[n - m] - 1 : null;
      let peak = cv[0], dd = 0; cv.forEach(v => { peak = Math.max(peak, v); dd = Math.min(dd, v / peak - 1); });
      return { r1: r1(back(12) * 100), r3: r1(back(36) * 100), r5: r1(back(60) * 100), total: r1((cv[n] - 1) * 100), cagr: r1(((cv[n]) ** (12 / n) - 1) * 100), mdd: r1(dd * 100) };
    };
    // 目前持股（用最新一個月的資料選）
    const li = months.length - 1, nowRows = S.map(s => ({ s, g: sig(s, li) })).filter(x => x.g);
    const prevRows = S.map(s => ({ s, g: sig(s, li - 1) })).filter(x => x.g);
    const result = out.map(o => {
      const now = pick(o, nowRows), before = pick(o, prevRows).map(x => x.s.code);
      return { id: o.id, name: o.name, tag: o.tag, desc: o.desc, n: o.n, stats: stat(o.curve), curve: o.curve.map(v => r2(v)),
        holdings: now.map(x => ({ code: x.s.code, name: x.s.name, ind: x.s.ind, mom: r1(x.g.mom * 100), mom3: r1(x.g.mom3 * 100), vol: r1(x.g.vol * 100), yld: r2(x.g.yld * 100), isNew: !before.includes(x.s.code) })),
        out: before.filter(c => !now.some(x => x.s.code === c)).map(c => ({ code: c, name: U[c]?.name || '' })) };
    });
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({ updated: new Date().toISOString(), from: lab[0], to: months[li], universe: S.length, bench: { name: '0050（含息）', stats: stat(bcurve), curve: bcurve.map(v => r2(v)) }, months: lab, strategies: result,
      note: '候選池是「今天」市值前 150 大的上市公司，回測會有倖存者偏差（下市或變小的公司不在名單內），歷史報酬會比實際偏高。' }));
  } catch (e) { res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ error: e.message }); }
};
