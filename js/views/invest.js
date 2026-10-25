/* Budget Pro — Investments: pot from monthly plans, holdings (assets bought from the investment budget), Investment Expert */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;
const INV = () => BP.db().investments;

/* ---- AI (claude.ai "sample" capability) — only present when the app runs as a published artifact ---- */
let aiP = null;
function ai(){ if (!aiP) aiP = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('sample').catch(() => null) : Promise.resolve(null); return aiP; }
setTimeout(ai, 0);

/* tiny, safe markdown → html (headings, bullets, numbered, bold, italics, tables kept as text) */
function md(src){
  const esc = BP.esc(src || '');
  const lines = esc.split(/\r?\n/); let out = '', list = null;
  const close = () => { if (list){ out += `</${list}>`; list = null; } };
  const inline = t => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  lines.forEach(l => {
    let m;
    if ((m = l.match(/^\s*#{1,6}\s+(.*)/))){ close(); out += `<h4>${inline(m[1])}</h4>`; }
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))){ if (list !== 'ul'){ close(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))){ if (list !== 'ol'){ close(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if (!l.trim()){ close(); }
    else { close(); out += `<p>${inline(l)}</p>`; }
  });
  close(); return out;
}

/* ---- market prices: gold (metalcharts.org) and stock quotes (Alpha Vantage / manual) ---- */
const PX = BP.prices = {
  async gold(){
    const inv = INV(), key = (inv.keys.metalcharts || '').trim();
    if (!key) throw new Error('nokey');
    const r = await fetch('https://api.metalcharts.org/v1/prices', { headers: { Authorization: 'Bearer ' + key } });
    if (r.status === 401) throw new Error('The metalcharts.org key was rejected (401).');
    if (r.status === 429) throw new Error('metalcharts.org monthly/minute limit reached — try later.');
    if (!r.ok) throw new Error('metalcharts.org returned ' + r.status);
    const j = await r.json(), x = j && j.data && (j.data.XAU ?? j.data.xau);
    const v = typeof x === 'number' ? x : x && (x.price ?? x.usd ?? x.value ?? x.last ?? x.ask ?? x.bid ?? x.spot);
    const usdOz = Number(v);
    if (!(usdOz > 300 && usdOz < 50000)) throw new Error('Unexpected price format from metalcharts.org: ' + JSON.stringify(x).slice(0, 120));
    inv.gold = { usdOz, at: new Date().toISOString(), source: 'metalcharts.org API' }; BP.store.persist(true); return inv.gold;
  },
  async quote(symbol){
    const key = (INV().keys.alphavantage || '').trim(); if (!key) throw new Error('nokey');
    const r = await fetch('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + encodeURIComponent(symbol) + '&apikey=' + encodeURIComponent(key));
    const j = await r.json(); const q = j['Global Quote'] || {}; const p = parseFloat(q['05. price']);
    if (!(p > 0)) throw new Error(j.Note || j.Information || ('No quote found for ' + symbol));
    return p;
  },
  links(sym){ const s = String(sym || '').trim(), num = /^\d{4}$/.test(s);
    return [num ? ['Google Finance', `https://www.google.com/finance/quote/${s}:TADAWUL`] : ['Google Finance', `https://www.google.com/search?q=${encodeURIComponent(s + ' stock price')}`],
      ['Yahoo Finance', `https://finance.yahoo.com/quote/${encodeURIComponent(num ? s + '.SR' : s)}`], ...(num ? [['Saudi Exchange', 'https://www.saudiexchange.sa/']] : [])]; }
};
async function refreshGold(silent){
  try { await PX.gold(); if (!silent) BP.toast('🪙 Gold price updated from metalcharts.org', 'ok'); BP.app.renderView(true); }
  catch (e) { if (e.message === 'nokey'){ if (!silent) priceSettings(); } else if (!silent) BP.toast(e.message.includes('fetch') ? 'Could not reach metalcharts.org from this page — enter the price manually' : e.message, 'err'); }
}

/* ---- data the expert works from ---- */
function profileData(){
  const c = C(), d = BP.db(), cur = BP.ymNow();
  const ms = c.dataMonths().filter(m => m <= cur).slice(-5);
  const over = ms.filter(m => c.spentSP(m) > c.spBudget(m)).length;
  const lastPlan = c.planFor(cur);
  const nw = c.nwTotals(), pf = c.portfolio(), byType = {};
  c.holdings().forEach(h => { byType[h.type] = (byType[h.type] || 0) + c.holdingValue(h); });
  return {
    month: cur, salary: lastPlan.salary, monthlyInvestBudget: lastPlan.invest, savingBoxesPlan: c.sbBudget(cur), spendablePlan: c.spBudget(cur),
    avgSpendableSpent: Math.round(BP.sum(ms, m => c.spentSP(m)) / Math.max(1, ms.length)), monthsOverSpendable: over, monthsTracked: ms.length,
    investPotAvailable: Math.round(c.investPot()), investBudgetAccumulated: Math.round(c.investBudgetTotal()), investedFromBudget: Math.round(c.investedFromBudget()),
    portfolio: { cost: Math.round(pf.cost), value: Math.round(pf.value), byType },
    liquidCash: Math.round(c.liquid()), essentialsPerMonth: Math.round(c.essentialAvg()), emergencyFundMonths: c.efMonths() == null ? null : +c.efMonths().toFixed(1),
    netWorth: Math.round(nw.net), liabilities: d.netWorth.accounts.filter(a => c.LIAB_TYPES.includes(a.type)).map(a => ({ name: a.name, balance: a.balance })),
    debtRepaymentPlanPerMonth: BP.sum(c.catsOf('Saving Box').filter(x => x.main === 'Debt'), x => c.budgetOf(cur, x.sub))
  };
}

const MODELS = {
  low:    { cash: 30, sukuk: 40, equity: 15, gold: 15, reit: 0 },
  medium: { cash: 15, sukuk: 30, equity: 40, gold: 10, reit: 5 },
  high:   { cash: 10, sukuk: 10, equity: 65, gold: 5, reit: 10 }
};
const CLASS = {
  cash:   { l: 'Cash & money-market', c: '--blue', ex: 'Saudi money-market funds from CMA-licensed managers (many are Shariah-compliant, murabaha-based) or bank time deposits. Short-term SAR yields track the SAMA policy rate (repo 4.25% after the Dec-2025 cut).' },
  sukuk:  { l: 'Sukuk / fixed income', c: '--purple', ex: 'Sukuk funds or government/corporate sukuk via a CMA-licensed broker. Note: the "Sah" savings sukuk (4.60% in Jul-2026) is open to Saudi citizens only, so it is not an option for a non-Saudi resident.' },
  equity: { l: 'Equities (index funds)', c: '--green', ex: 'Broad index ETFs — Tadawul-listed Saudi index funds and global index ETFs through a licensed broker. Shariah-screened versions exist for both.' },
  gold:   { l: 'Gold', c: '--amber', ex: 'Physical gold or a Tadawul-listed, Shariah-compliant gold ETF (backed by physical gold).' },
  reit:   { l: 'REITs', c: '--pink', ex: 'Tadawul-listed real-estate investment traded funds — rental income without buying property.' }
};

function builtInAnalysis(p, prof){
  const recs = [], risk = prof.risk || 'medium';
  let alloc = { ...MODELS[risk] };
  if (prof.horizon === '1-3'){ const shift = Math.min(alloc.equity, 20); alloc.equity -= shift; alloc.cash += Math.round(shift / 2); alloc.sukuk += shift - Math.round(shift / 2); alloc.reit = Math.min(alloc.reit, 5); }
  if (prof.goal === 'income'){ const s = Math.min(alloc.equity, 10); alloc.equity -= s; alloc.reit += s / 2; alloc.sukuk += s / 2; }
  // readiness
  const ef = p.emergencyFundMonths, efTarget = 6, efGap = ef == null ? null : Math.max(0, (efTarget - ef) * p.essentialsPerMonth);
  if (ef == null) recs.push(['warn', 'Add your bank/cash balances in Net Worth so the emergency-fund check can run.']);
  else if (ef < 3) recs.push(['bad', `Emergency fund covers only ${ef} months of essentials. Build it to at least 3–6 months (≈ ${BP.fmt(efGap)} SAR more) in cash or a money-market fund before taking equity risk.`]);
  else if (ef < 6) recs.push(['warn', `Emergency fund covers ${ef} months — healthy, but topping up to 6 months (≈ ${BP.fmt(efGap)} SAR) adds a safety margin.`]);
  else recs.push(['good', `Emergency fund covers ${ef} months of essentials — you can invest the monthly budget fully.`]);
  if (p.liabilities.length) recs.push(['warn', `You carry ${p.liabilities.length} liabilit${p.liabilities.length > 1 ? 'ies' : 'y'} (${p.liabilities.map(l => l.name + ' ' + BP.fmt(l.balance)).join(', ')}). Keep the repayment plan (${BP.fmt(p.debtRepaymentPlanPerMonth)} SAR/month in Saving Boxes) running alongside investing.`]);
  if (p.monthsOverSpendable >= Math.ceil(p.monthsTracked / 2)) recs.push(['bad', `Spendable went over plan in ${p.monthsOverSpendable} of ${p.monthsTracked} months (avg spent ${BP.fmt(p.avgSpendableSpent)} vs plan ${BP.fmt(p.spendablePlan)}). Move the investment amount out on salary day so overspending can't eat into it.`]);
  if (p.investPotAvailable > 0) recs.push(['good', `${BP.fmt(p.investPotAvailable)} SAR is sitting in your investment pot, not yet invested. Deploying it in 2–3 tranches over the next months reduces timing risk.`]);
  const rate = p.salary ? (p.monthlyInvestBudget + p.savingBoxesPlan) / p.salary * 100 : 0;
  recs.push(['info', `${(p.monthlyInvestBudget / p.salary * 100 || 0).toFixed(0)}% of salary goes to investments and ${rate.toFixed(0)}% to investments + saving boxes combined.`]);
  // projection
  const years = prof.horizon === '1-3' ? 3 : prof.horizon === '3-5' ? 5 : 10, monthly = p.monthlyInvestBudget, start = p.portfolio.value + Math.max(0, p.investPotAvailable);
  const fv = r => { const out = []; let v = start; for (let y = 0; y <= years; y++){ out.push(Math.round(v)); for (let k = 0; k < 12; k++) v = v * (1 + r / 12) + monthly; } return out; };
  return { alloc, recs, years, scen: { s3: fv(.03), s6: fv(.06), s9: fv(.09) }, monthly, start };
}

/* ======================= VIEW ======================= */
BP.views.invest = {
  render(el){
    const c = C(), d = BP.db(), inv = INV(), can = BP.auth.canEdit('invest'), pf = c.portfolio();
    if (inv.keys.metalcharts && (!inv.gold || Date.now() - new Date(inv.gold.at).getTime() > 36e5) && !PX._busy){ PX._busy = true; refreshGold(true).finally(() => { PX._busy = false; }); }
    const gp = c.goldPrice(), golds = c.holdings().filter(h => h.type === 'gold');
    const pot = c.investPot(), tot = c.investBudgetTotal(), used = c.investedFromBudget(), ms = c.investMonths();
    const hs = c.holdings().slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const byType = {}; hs.forEach(h => { byType[h.type] = (byType[h.type] || 0) + c.holdingValue(h); });
    let run = Number(inv.opening) || 0; const rows = ms.map(m => { const b = c.invest(m), u = c.investedFromBudget(m); run += b - u; return { m, b, u, run }; });
    const nwInv = d.netWorth.accounts.filter(a => a.type === 'investment' || a.type === 'gold');
    BP.mount(el, BP.h`
    <div class="hero" style="margin-bottom:14px"><div class="row between wrap" style="gap:16px">
      <div style="min-width:240px;flex:1"><h2>Investment pot · available to invest</h2>
        <div class="big m-sal" style="color:${pot >= 0 ? 'var(--accent)' : 'var(--red)'}">${BP.fmt(pot)} <small style="font-size:15px;color:var(--muted)">SAR</small></div>
        <div class="card-sub" style="margin-bottom:12px">Investment budget from ${ms.length} monthly plan${ms.length === 1 ? '' : 's'}${inv.opening ? ' + starting pot' : ''} (${BP.fmt(tot)}) − invested from budget (${BP.fmt(used)})</div>
        ${CH().flowBar([{ l: 'Invested', v: used, c: 'var(--blue)' }, { l: 'Available', v: Math.max(0, pot), c: 'var(--accent)' }])}</div>
      <div class="row wrap" style="gap:8px">${can ? BP.h`<button class="btn" data-act="opening">🏁 Starting pot</button>${nwInv.length ? BP.h`<button class="btn" data-act="importNW">⇄ Move ${nwInv.length} from Net Worth</button>` : ''}<button class="btn primary" data-act="edit">➕ Add investment</button>` : ''}<button class="btn expert-btn" data-act="expert">🤖 Investment Expert</button></div>
    </div></div>
    <div class="grid g4 keep2">
      ${BP.ui.kpi({ label: 'Monthly investment budget', value: BP.fmt(c.invest(BP.ymNow())), mask: 'sal', color: 'var(--blue)', foot: 'from this month\'s plan', spark: ms.map(m => c.invest(m)) })}
      ${BP.ui.kpi({ label: 'Total invested (cost)', value: BP.fmt(pf.cost), mask: 'sal', color: 'var(--purple)', foot: `${pf.n} holding${pf.n === 1 ? '' : 's'}` })}
      ${BP.ui.kpi({ label: 'Portfolio value', value: BP.fmt(pf.value), mask: 'sal', color: 'var(--green)', foot: 'counted in Net Worth' })}
      ${BP.ui.kpi({ label: 'Gain / loss', value: BP.signed(pf.gain), valColor: pf.gain >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--accent)', foot: pf.cost ? (pf.pct >= 0 ? '+' : '') + pf.pct.toFixed(1) + '% on cost' : 'add current values to track' })}
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><div class="card-h"><div class="card-t big">Budget vs invested</div><span class="card-sub">per month · line = pot</span></div>${rows.length ? BP.ui.canvas('ivFlow', 260) : BP.ui.empty('📈', 'Save a monthly plan to start the pot')}</div>
      <div class="card"><div class="card-h"><div class="card-t big">Allocation</div><span class="card-sub">by current value</span></div>${hs.length ? BP.ui.canvas('ivMix', 260) : BP.ui.empty('🧺', 'No holdings yet')}</div>
      <div class="card"><div class="card-h"><div class="card-t big">🪙 Gold price today</div><span class="card-sub">${gp ? 'updated ' + BP.fmtDT(gp.at) : 'not set'}</span></div>
        ${gp ? BP.h`<div class="row between wrap" style="gap:10px"><div><div class="num m-num" style="font-size:24px;font-weight:700;color:var(--amber)">${BP.fmt2(gp.sarG24)} <small class="muted" style="font-size:12px">SAR / g · 24K</small></div><div class="card-sub">$${BP.fmt2(gp.usdOz)} / oz · ${gp.source}</div></div>
          <div class="gold-k">${[[24, '24K'], [22, '22K'], [21, '21K'], [18, '18K']].map(([k, l]) => BP.h`<div><span>${l}</span><b class="num">${BP.fmt2(gp.sarG24 * k / 24)}</b></div>`)}</div></div>` : BP.ui.empty('🪙', 'Set today\'s gold price')}
        ${golds.length ? BP.h`<div class="card-sub" style="margin-top:10px">${golds.filter(h => h.grams).length} of ${golds.length} gold holdings are valued live from grams × karat × this price.</div>` : ''}
        <div class="row wrap" style="gap:8px;margin-top:12px">${can ? BP.h`<button class="btn sm primary" data-act="goldRefresh">🔄 Refresh</button><button class="btn sm" data-act="goldManual">✏️ Enter price</button><button class="btn sm" data-act="priceSettings">🔑 Price sources</button>` : ''}<a class="btn sm ghost" href="https://metalcharts.org/gold-price" target="_blank" rel="noopener">metalcharts.org ↗</a></div></div>
      <div class="card"><div class="card-h"><div class="card-t big">Gain / loss by holding</div><span class="card-sub">today's value − cost</span></div>${hs.length ? BP.ui.canvas('ivGain', 60 + hs.length * 30) : BP.ui.empty('📊', 'No holdings yet')}</div>
      <div class="card span2"><div class="card-h"><div class="card-t big">Holdings</div><span class="card-sub">assets bought with your investment budget</span></div>
        ${hs.length ? BP.h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Asset</th><th>Type</th><th>Date</th><th class="r">Cost</th><th class="r">Current value</th><th class="r">Gain</th><th>From budget</th>${can ? BP.h`<th></th>` : ''}</tr></thead><tbody>
          ${hs.map(h => { const v = c.holdingValue(h), g = v - (Number(h.amount) || 0); return BP.h`<tr><td><div class="row" style="gap:8px"><span>${c.INV_ICON[h.type] || '📦'}</span><div><b>${h.name}</b><div class="faint" style="font-size:11px">${valueDetail(h)}${h.platform ? ' · ' + h.platform : ''}</div></div></div></td><td><span class="tag">${c.INV_TYPES[h.type] || h.type}</span></td><td class="num">${h.date ? BP.fmtDate(h.date) : '—'}</td>
            <td class="r num m-sal">${BP.fmt(h.amount)}</td><td class="r num m-sal">${BP.fmt(v)}<div>${modeBadge(h)}</div></td><td class="r num ${g >= 0 ? 'up' : 'down'}">${Math.round(g) ? BP.signed(g) : '—'}${Math.round(g) && h.amount ? BP.h`<div style="font-size:10px">${(g / h.amount * 100 >= 0 ? '+' : '') + (g / h.amount * 100).toFixed(1)}%</div>` : ''}</td><td>${h.fromBudget === false ? BP.h`<span class="tag">before app</span>` : BP.h`<span class="tag sp">deducted</span>`}</td>
            ${can ? BP.h`<td class="r"><div class="row" style="gap:4px;justify-content:flex-end"><button class="icon-btn" style="width:28px;height:28px" data-act="value" data-id="${h.id}" title="${c.STOCK_TYPES.includes(h.type) ? 'Update price' : h.type === 'gold' ? 'Gold value' : 'Update value'}">${BP.icon('refresh')}</button><button class="icon-btn" style="width:28px;height:28px" data-act="edit" data-id="${h.id}" title="Edit">${BP.icon('edit')}</button><button class="icon-btn" style="width:28px;height:28px;color:var(--red)" data-act="del" data-id="${h.id}" title="Delete">${BP.icon('x')}</button></div></td>` : ''}</tr>`; })}
        </tbody></table></div>` : BP.ui.empty('📈', 'Add what you have already invested — stocks, funds, gold, sukuk, deposits…')}</div>
      <div class="card span2 pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="r">Investment budget</th><th class="r">Invested from budget</th><th class="r">Pot after month</th></tr></thead><tbody>
        ${inv.opening ? BP.h`<tr><td>Starting pot</td><td class="r num m-sal">${BP.fmt(inv.opening)}</td><td class="r">—</td><td class="r num m-sal">${BP.fmt(inv.opening)}</td></tr>` : ''}
        ${rows.map(r => BP.h`<tr><td><b>${BP.fmtMonth(r.m)}</b></td><td class="r num m-sal">${BP.fmt(r.b)}</td><td class="r num m-num">${r.u ? BP.fmt(r.u) : '–'}</td><td class="r num m-sal ${r.run >= 0 ? '' : 'down'}"><b>${BP.fmt(r.run)}</b></td></tr>`)}
        ${!rows.length ? BP.h`<tr><td colspan="4" class="center muted" style="padding:20px">No saved plans yet</td></tr>` : ''}</tbody></table></div></div>
      ${inv.advice ? BP.h`<div class="card span2"><div class="card-h"><div class="card-t big">🤖 Last expert analysis</div><span class="card-sub">${BP.fmtDT(inv.advice.at)}</span></div><div class="md">${BP.raw(md(inv.advice.text))}</div></div>` : ''}
    </div>`);
    if (rows.length) BP.charts.make('ivFlow', () => ({ type: 'bar', data: { labels: rows.map(r => BP.monthShort(r.m) + " '" + r.m.slice(2, 4)), datasets: [
      { label: 'Budget', data: rows.map(r => r.b), backgroundColor: CH().hexA(CH().css('--blue'), .55), borderRadius: 6, maxBarThickness: 40 },
      { label: 'Invested', data: rows.map(r => r.u), backgroundColor: CH().css('--purple'), borderRadius: 6, maxBarThickness: 40 },
      { type: 'line', label: 'Pot', data: rows.map(r => r.run), borderColor: CH().css('--accent'), backgroundColor: CH().css('--accent'), pointRadius: 3, borderWidth: 2.2, tension: .3 }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
    if (hs.length){ const ent = Object.entries(byType).sort((a, b) => b[1] - a[1]), pal = CH().palette();
      BP.charts.make('ivMix', () => ({ type: 'doughnut', data: { labels: ent.map(x => (c.INV_ICON[x[0]] || '') + ' ' + (c.INV_TYPES[x[0]] || x[0])), datasets: [{ data: ent.map(x => x[1]), backgroundColor: ent.map((_, i) => pal[i % 8]), borderColor: CH().css('--card'), borderWidth: 3 }] },
        options: { cutout: '66%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } }, centerText: { text: BP.fmtK(pf.value), sub: 'value', size: 20 } } } })); }
    if (hs.length){ const gs = hs.map(h => ({ n: h.name, g: c.holdingValue(h) - (Number(h.amount) || 0) })).sort((a, b) => b.g - a.g);
      BP.charts.make('ivGain', () => ({ type: 'bar', data: { labels: gs.map(x => x.n.length > 26 ? x.n.slice(0, 25) + '…' : x.n), datasets: [{ data: gs.map(x => Math.round(x.g)), backgroundColor: gs.map(x => x.g >= 0 ? CH().css('--green') : CH().css('--red')), borderRadius: 6 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${x.parsed.x >= 0 ? '+' : ''}${BP.fmt(x.parsed.x)} SAR` } } }, scales: { x: { grid: { color: CH().css('--grid') }, border: { display: false }, ticks: { callback: v => BP.fmtK(v) } }, y: { grid: { display: false }, border: { display: false } } } } })); }
  },
  actions: {
    edit(el){ holdingModal(el && el.dataset.id); },
    del(el){ BP.modal.confirm('Delete this holding? If it was paid from the investment budget, the amount goes back to the pot.', () => { const v = INV(); v.holdings = v.holdings.filter(h => h.id !== el.dataset.id); BP.store.persist(); BP.app.renderView(true); }); },
    value(el){ const h = INV().holdings.find(x => x.id === el.dataset.id); if (!h) return; valueModal(h); },
    goldRefresh(){ if (!INV().keys.metalcharts) return priceSettings(); refreshGold(false); },
    goldManual(){ goldManual(); },
    priceSettings(){ priceSettings(); },
    opening(){ const v = INV();
      BP.modal.open({ title: '🏁 Starting investment pot', body: BP.h`<div class="field"><label>Money set aside for investing before your first plan (SAR)</label><input class="inp num" id="op" type="number" value="${v.opening || 0}"></div><div class="card-sub" style="margin-top:8px">Added once to the pot. Each saved monthly plan then adds its investment budget automatically.</div>`,
        onOk(api){ v.opening = parseFloat(BP.$('#op', api.root).value) || 0; BP.store.persist(); BP.app.renderView(true); } }); },
    importNW(){ const d = BP.db(), list = d.netWorth.accounts.filter(a => a.type === 'investment' || a.type === 'gold');
      BP.modal.confirm(`Move ${list.length} account(s) from Net Worth into Investments as holdings bought before the app (${list.map(a => a.name).join(', ')})? They stay counted in your net worth — just managed here, and they won't be deducted from the pot.`, () => {
        list.forEach(a => INV().holdings.push({ id: 'h' + BP.uid(), name: a.name, type: a.type === 'gold' ? 'gold' : 'other', ...(a.type === 'gold' && /(\d+(?:\.\d+)?)\s*(?:g|gm|gram)/i.test(a.name) ? { grams: parseFloat(a.name.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram)/i)[1]), karat: 24 } : {}), date: (a.updated || BP.today()).slice(0, 10), amount: Number(a.balance) || 0, currentValue: Number(a.balance) || 0, fromBudget: false, platform: '', notes: 'Moved from Net Worth' }));
        d.netWorth.accounts = d.netWorth.accounts.filter(a => !list.includes(a)); BP.store.persist(); BP.toast('Moved to Investments', 'ok'); BP.app.renderView(true); }, { okText: 'Move', danger: false }); },
    expert(){ expertModal(); }
  }
};

const f2 = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
if (!BP.fmt2) BP.fmt2 = f2;

function valueDetail(h){
  const c = C(), mode = c.valueMode(h), gp = c.goldPrice();
  if (h.type === 'gold' && h.grams){ const paid = h.amount / h.grams; return `${h.grams} g · ${h.karat || 24}K · paid ${f2(paid)}/g${gp ? ' · now ' + f2(gp.sarG24 * (h.karat || 24) / 24) + '/g' : ''}`; }
  if (c.STOCK_TYPES.includes(h.type) && h.shares) return `${h.symbol ? h.symbol + ' · ' : ''}${h.shares} × ${h.lastPrice ? f2(h.lastPrice) + ' ' + (h.currency || 'SAR') : 'price not set'}${h.amount && h.shares ? ' · avg cost ' + f2(h.amount / h.shares / (h.currency === 'USD' ? c.USD_SAR : 1)) : ''}`;
  if (mode === 'property') return `valued ${BP.fmt(Number(h.currentValue ?? h.amount))} · grows ${h.growth}%/yr`;
  return h.units ? h.units + ' units' : '';
}
function modeBadge(h){
  const c = C(), m = c.valueMode(h);
  if (m === 'gold') return BP.h`<span class="vbadge gold">🟡 live gold</span>`;
  if (m === 'stock') return BP.h`<span class="vbadge stock">📈 ${h.priceAt ? 'price ' + BP.fmtDate(h.priceAt.slice(0, 10)) : 'price'}</span>`;
  if (m === 'property') return BP.h`<span class="vbadge prop">🏠 +${h.growth}%/yr</span>`;
  return h.valueAt ? BP.h`<span class="vbadge">${BP.fmtDate(h.valueAt.slice(0, 10))}</span>` : BP.h`<span class="vbadge">at cost</span>`;
}

/* type-aware “current value” update */
function valueModal(h){
  const c = C();
  if (h.type === 'gold'){
    if (!h.grams) return holdingModal(h.id);
    const gp = c.goldPrice(); BP.modal.open({ title: `🪙 ${h.name}`, okText: null, cancelText: 'Close', body: BP.h`<div class="list">
      <div class="li"><div class="li-main"><div class="li-t">Weight · karat</div></div><b class="num">${h.grams} g · ${h.karat || 24}K</b></div>
      <div class="li"><div class="li-main"><div class="li-t">You paid</div><div class="li-s">${f2(h.amount / h.grams)} SAR/g</div></div><b class="num">${BP.fmt(h.amount)}</b></div>
      <div class="li"><div class="li-main"><div class="li-t">Value today</div><div class="li-s">${gp ? f2(gp.sarG24 * (h.karat || 24) / 24) + ' SAR/g · ' + gp.source + ' · ' + BP.fmtDT(gp.at) : 'set the gold price'}</div></div><b class="num">${BP.fmt(c.holdingValue(h))}</b></div></div>
      <div class="card-sub" style="margin-top:10px">The value follows the gold price card automatically — refresh or enter today's price there.</div>` });
    return;
  }
  if (c.STOCK_TYPES.includes(h.type)){
    const links = PX.links(h.symbol);
    BP.modal.open({ title: `📈 Update price · ${h.name}`, body: BP.h`
      <div class="form-grid"><div class="field"><label>Ticker / symbol</label><input class="inp" id="q-sym" value="${h.symbol || ''}" placeholder="e.g. 2222 (Aramco), AAPL"></div>
      <div class="field"><label>Shares / units</label><input class="inp num" id="q-sh" type="number" step="any" value="${h.shares || ''}"></div>
      <div class="field"><label>Price per share</label><input class="inp num" id="q-px" type="number" step="any" value="${h.lastPrice || ''}"></div>
      <div class="field"><label>Currency</label><select class="sel" id="q-cur"><option ${h.currency !== 'USD' ? 'selected' : ''}>SAR</option><option ${h.currency === 'USD' ? 'selected' : ''}>USD</option></select></div></div>
      <div class="row wrap" style="gap:6px;margin-top:10px"><span class="card-sub">Check today's price:</span>${links.map(([l, u]) => BP.h`<a class="btn sm ghost" href="${u}" target="_blank" rel="noopener">${l} ↗</a>`)}<button class="btn sm" id="q-fetch">⚡ Fetch automatically</button></div>
      <div class="card-sub" id="q-msg" style="margin-top:8px"></div>`, okText: 'Save price',
      onOpen(api){ BP.$('#q-fetch', api.root).addEventListener('click', async () => { const m = BP.$('#q-msg', api.root), sym = BP.$('#q-sym', api.root).value.trim(); if (!sym){ m.textContent = 'Enter the ticker first.'; return; }
        m.textContent = 'Fetching…'; try { const p = await PX.quote(sym); BP.$('#q-px', api.root).value = p; m.textContent = `✅ ${sym}: ${p} (Alpha Vantage)`; } catch (e) { m.textContent = e.message === 'nokey' ? 'Add a free Alpha Vantage key in 🔑 Price sources to fetch automatically, or type the price.' : (String(e.message).includes('fetch') ? 'Could not reach the quote service from this page — type the price instead.' : e.message); } }); },
      onOk(api){ const q = x => BP.$('#' + x, api.root); const px = parseFloat(q('q-px').value), sh = parseFloat(q('q-sh').value); if (!(px > 0) || !(sh > 0)){ BP.toast('Enter shares and price', 'err'); return false; }
        Object.assign(h, { symbol: q('q-sym').value.trim(), shares: sh, lastPrice: px, currency: q('q-cur').value, priceAt: new Date().toISOString() }); BP.store.persist(); BP.app.renderView(true); } });
    return;
  }
  BP.modal.open({ title: `🔄 Current value · ${h.name}`, body: BP.h`<div class="form-grid"><div class="field"><label>Current market value (SAR)</label><input class="inp num" id="hv" type="number" step="0.01" value="${Math.round(c.holdingValue(h))}"></div>
    ${h.type === 'realestate' ? BP.h`<div class="field"><label>Expected growth % per year (optional)</label><input class="inp num" id="hg" type="number" step="0.1" value="${h.growth || ''}" placeholder="e.g. 4"></div>` : ''}</div>
    <div class="card-sub" style="margin-top:8px">Cost was ${BP.fmt(h.amount)} SAR.${h.type === 'realestate' ? ' Use a recent valuation or comparable listings; with a growth % the value then rises automatically each day.' : ''}</div>`, okText: 'Update',
    onOk(api){ const v = parseFloat(BP.$('#hv', api.root).value); if (!(v >= 0)) return false; h.currentValue = v; h.valueAt = new Date().toISOString(); const g = BP.$('#hg', api.root); if (g) h.growth = parseFloat(g.value) || 0; BP.store.persist(); BP.app.renderView(true); } });
}

function goldManual(){
  const gp = C().goldPrice() || {};
  BP.modal.open({ title: '🪙 Today\'s gold price', body: BP.h`<div class="form-grid">
      <div class="field"><label>USD per troy ounce (as on metalcharts.org)</label><input class="inp num" id="g-oz" type="number" step="0.01" value="${gp.usdOz ? gp.usdOz.toFixed(2) : ''}"></div>
      <div class="field"><label>…or SAR per gram (24K)</label><input class="inp num" id="g-g" type="number" step="0.01" value="${gp.sarG24 ? gp.sarG24.toFixed(2) : ''}"></div></div>
      <div class="card-sub" style="margin-top:8px">1 oz = 31.1035 g · 1 USD = 3.75 SAR (fixed peg). <a href="https://metalcharts.org/gold-price" target="_blank" rel="noopener" style="color:var(--accent)">Open metalcharts.org ↗</a></div>`,
    onOpen(api){ const oz = BP.$('#g-oz', api.root), g = BP.$('#g-g', api.root), K = C().USD_SAR / C().OZ_G;
      oz.addEventListener('input', () => { const v = parseFloat(oz.value); g.value = v ? (v * K).toFixed(2) : ''; });
      g.addEventListener('input', () => { const v = parseFloat(g.value); oz.value = v ? (v / K).toFixed(2) : ''; }); },
    onOk(api){ const v = parseFloat(BP.$('#g-oz', api.root).value); if (!(v > 300)){ BP.toast('Enter a valid price', 'err'); return false; }
      INV().gold = { usdOz: v, at: new Date().toISOString(), source: 'entered manually' }; BP.store.persist(); BP.toast('Gold price saved', 'ok'); BP.app.renderView(true); } });
}

function priceSettings(){
  const k = INV().keys;
  BP.modal.open({ title: '🔑 Price sources', wide: true, body: BP.h`
    <div class="field"><label>metalcharts.org API key — live gold price</label><input class="inp" id="k-mc" value="${k.metalcharts || ''}" placeholder="mc_live_…" autocomplete="off"></div>
    <div class="card-sub" style="margin:6px 0 14px">Free plan: 1 key, about 200 price checks a month. Get it at <a href="https://metalcharts.org/free-metals-api" target="_blank" rel="noopener" style="color:var(--accent)">metalcharts.org/free-metals-api ↗</a>. Budget Pro checks at most once an hour when you open Investments.</div>
    <div class="field"><label>Alpha Vantage API key — stock quotes (optional)</label><input class="inp" id="k-av" value="${k.alphavantage || ''}" placeholder="your free key" autocomplete="off"></div>
    <div class="card-sub" style="margin:6px 0 4px">Free key at <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noopener" style="color:var(--accent)">alphavantage.co ↗</a> (25 requests/day). Best for US and global tickers; Saudi coverage is limited — for Tadawul stocks the price box links to Google Finance / Yahoo so you can type it in.</div>
    <div class="tipbox" style="margin-top:12px">Keys are stored only in this browser's Budget Pro data (and in backups you export). If a source can't be reached from this page, you can always enter prices by hand.</div>`,
    onOk(api){ k.metalcharts = BP.$('#k-mc', api.root).value.trim(); k.alphavantage = BP.$('#k-av', api.root).value.trim(); BP.store.persist(); BP.toast('Price sources saved', 'ok'); if (k.metalcharts) refreshGold(false); else BP.app.renderView(true); } });
}

function holdingModal(id){
  const c = C(), v0 = id ? INV().holdings.find(h => h.id === id) : null, v = v0 || { name: '', type: 'fund', date: BP.today(), amount: '', currentValue: '', units: '', platform: '', fromBudget: true, notes: '', karat: 24 };
  BP.modal.open({ title: v0 ? '✏️ Edit investment' : '➕ Add investment', wide: true, body: BP.h`<div class="form-grid">
    <div class="field"><label>Name</label><input class="inp" id="h-name" value="${v.name}" placeholder="e.g. 20 g gold sabeka, Aramco shares, Apartment in Cairo"></div>
    <div class="field"><label>Type</label><select class="sel" id="h-type">${Object.entries(c.INV_TYPES).map(([k, l]) => BP.h`<option value="${k}" ${k === v.type ? 'selected' : ''}>${c.INV_ICON[k]} ${l}</option>`)}</select></div>
    <div class="field"><label>Date bought</label><input class="inp" id="h-date" type="date" value="${v.date || ''}"></div>
    <div class="field"><label>Amount paid (SAR)</label><input class="inp num" id="h-amt" type="number" step="0.01" value="${v.amount}"></div>
    <div class="vf vf-gold" style="grid-column:1/-1"><div class="form-grid">
      <div class="field"><label>Weight (grams)</label><input class="inp num" id="h-grams" type="number" step="any" value="${v.grams || ''}" placeholder="e.g. 20"></div>
      <div class="field"><label>Karat</label><select class="sel" id="h-karat">${[24, 22, 21, 18].map(k => BP.h`<option value="${k}" ${Number(v.karat || 24) === k ? 'selected' : ''}>${k}K${k === 24 ? ' (sabeka / bullion)' : ''}</option>`)}</select></div></div>
      <div class="card-sub">Value = grams × karat/24 × today's 24K price (gold price card).</div></div>
    <div class="vf vf-stock" style="grid-column:1/-1"><div class="form-grid">
      <div class="field"><label>Ticker / symbol</label><input class="inp" id="h-sym" value="${v.symbol || ''}" placeholder="e.g. 2222 (Aramco), 1120, AAPL"></div>
      <div class="field"><label>Shares / units</label><input class="inp num" id="h-shares" type="number" step="any" value="${v.shares || ''}"></div>
      <div class="field"><label>Current price per share</label><input class="inp num" id="h-px" type="number" step="any" value="${v.lastPrice || ''}" placeholder="update any time"></div>
      <div class="field"><label>Price currency</label><select class="sel" id="h-cur"><option ${v.currency !== 'USD' ? 'selected' : ''}>SAR</option><option ${v.currency === 'USD' ? 'selected' : ''}>USD</option></select></div></div>
      <div class="card-sub">Value = shares × price. Use the 🔄 button on the holding to update the price (links to the quote page, or fetch with an Alpha Vantage key).</div></div>
    <div class="vf vf-prop" style="grid-column:1/-1"><div class="form-grid">
      <div class="field"><label>Current valuation (SAR)</label><input class="inp num" id="h-pval" type="number" step="0.01" value="${v.type === 'realestate' ? (v.currentValue ?? '') : ''}" placeholder="same as price paid"></div>
      <div class="field"><label>Expected growth % per year</label><input class="inp num" id="h-growth" type="number" step="0.1" value="${v.growth || ''}" placeholder="e.g. 4 (optional)"></div></div>
      <div class="card-sub">No live price feed exists for property — set a valuation (recent appraisal or similar listings) and an optional yearly growth estimate.</div></div>
    <div class="field vf vf-other"><label>Current value (SAR, optional)</label><input class="inp num" id="h-val" type="number" step="0.01" value="${!['realestate'].includes(v.type) ? (v.currentValue ?? '') : ''}" placeholder="same as cost"></div>
    <div class="field"><label>Platform / broker</label><input class="inp" id="h-plat" value="${v.platform || ''}" placeholder="e.g. Al Rajhi Capital, jeweller"></div>
    <div class="field" style="grid-column:1/-1"><label>Notes</label><input class="inp" id="h-notes" value="${v.notes || ''}"></div>
    <label class="row" style="grid-column:1/-1;gap:8px"><input type="checkbox" id="h-budget" ${v.fromBudget !== false ? 'checked' : ''}> Paid from my investment budget (deduct from the pot)</label></div>`,
    onOpen(api){ const t = BP.$('#h-type', api.root), sync = () => { const ty = t.value, grp = ty === 'gold' ? 'gold' : c.STOCK_TYPES.includes(ty) ? 'stock' : ty === 'realestate' ? 'prop' : 'other';
        BP.$$('.vf', api.root).forEach(x => { x.style.display = x.classList.contains('vf-' + grp) ? '' : 'none'; }); };
      t.addEventListener('change', sync); sync();
      const nm = BP.$('#h-name', api.root), gr = BP.$('#h-grams', api.root); nm.addEventListener('input', () => { const m = nm.value.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram)/i); if (m && !gr.value) gr.value = m[1]; }); },
    onOk(api){ const q = x => BP.$('#' + x, api.root), num = x => q(x).value === '' ? null : parseFloat(q(x).value), ty = q('h-type').value;
      const o = { name: q('h-name').value.trim(), type: ty, date: q('h-date').value, amount: parseFloat(q('h-amt').value), platform: q('h-plat').value.trim(), notes: q('h-notes').value.trim(), fromBudget: q('h-budget').checked };
      if (!o.name || !(o.amount > 0)){ BP.toast('Name and amount are required', 'err'); return false; }
      if (ty === 'gold') Object.assign(o, { grams: num('h-grams'), karat: parseInt(q('h-karat').value) || 24, currentValue: null });
      else if (c.STOCK_TYPES.includes(ty)){ const px = num('h-px'); Object.assign(o, { symbol: q('h-sym').value.trim(), shares: num('h-shares'), lastPrice: px, currency: q('h-cur').value, currentValue: null }); if (px && (!v0 || px !== v0.lastPrice)) o.priceAt = new Date().toISOString(); }
      else if (ty === 'realestate'){ const pv = num('h-pval'); Object.assign(o, { currentValue: pv, growth: num('h-growth') || 0 }); if (pv == null) o.valueAt = null; else if (!v0 || pv !== v0.currentValue) o.valueAt = new Date().toISOString(); }
      else Object.assign(o, { currentValue: num('h-val') });
      if (v0) Object.assign(v0, o); else INV().holdings.push({ id: 'h' + BP.uid(), ...o }); BP.store.persist(); BP.toast('Investment saved', 'ok'); BP.app.renderView(true); } });
}

/* ======================= INVESTMENT EXPERT ======================= */
function expertModal(){
  const inv = INV(), prof = inv.profile = Object.assign({ nationality: 'Egyptian', residence: 'Saudi Arabia (Riyadh)', horizon: '3-5', risk: 'medium', shariah: false, goal: 'growth', lang: 'en' }, inv.profile || {});
  const opt = (k, v, l) => BP.h`<option value="${v}" ${prof[k] === v ? 'selected' : ''}>${l}</option>`;
  const api = BP.modal.open({ title: '🤖 Investment Expert', wide: true, okText: null, cancelText: 'Close', body: BP.h`
    <div class="tipbox" style="margin-bottom:12px">Analyses <b>your own numbers</b> in Budget Pro — salary, monthly investment budget, pot, holdings, emergency fund, debts and spending habits — and suggests an approach. Educational guidance, not licensed financial advice.</div>
    <div class="form-grid">
      <div class="field"><label>Nationality</label><input class="inp" id="ex-nat" value="${prof.nationality}"></div>
      <div class="field"><label>Residence</label><input class="inp" id="ex-res" value="${prof.residence}"></div>
      <div class="field"><label>Time horizon</label><select class="sel" id="ex-hor">${opt('horizon', '1-3', '1–3 years')}${opt('horizon', '3-5', '3–5 years')}${opt('horizon', '5+', '5+ years')}</select></div>
      <div class="field"><label>Risk comfort</label><select class="sel" id="ex-risk">${opt('risk', 'low', 'Low — protect capital')}${opt('risk', 'medium', 'Medium — balanced')}${opt('risk', 'high', 'High — maximise growth')}</select></div>
      <div class="field"><label>Main goal</label><select class="sel" id="ex-goal">${opt('goal', 'growth', 'Grow wealth')}${opt('goal', 'home', 'Buy a home / big purchase')}${opt('goal', 'income', 'Passive income')}${opt('goal', 'retirement', 'Retirement')}</select></div>
      <div class="field"><label>AI answer language</label><select class="sel" id="ex-lang">${opt('lang', 'en', 'English')}${opt('lang', 'ar', 'العربية')}</select></div>
      <label class="row" style="grid-column:1/-1;gap:8px"><input type="checkbox" id="ex-sh" ${prof.shariah ? 'checked' : ''}> Shariah-compliant options only</label>
      <div class="field" style="grid-column:1/-1"><label>Anything specific to ask? (optional)</label><input class="inp" id="ex-q" placeholder="e.g. Should I put the pot into gold or an index fund first?"></div>
    </div>
    <div class="row wrap" style="margin-top:14px;gap:8px"><button class="btn primary" id="ex-run">📊 Analyse my data</button><button class="btn" id="ex-ai" style="display:none">✨ Deep AI analysis</button><span class="card-sub" id="ex-ai-note"></span></div>
    <div id="ex-out" style="margin-top:16px"></div>` });
  const r = api.root, q = x => BP.$('#' + x, r);
  const read = () => { Object.assign(prof, { nationality: q('ex-nat').value.trim(), residence: q('ex-res').value.trim(), horizon: q('ex-hor').value, risk: q('ex-risk').value, goal: q('ex-goal').value, lang: q('ex-lang').value, shariah: q('ex-sh').checked }); BP.store.persist(true); return prof; };
  ai().then(s => { if (!r.isConnected) return; if (s){ q('ex-ai').style.display = ''; } else q('ex-ai-note').textContent = 'Deep AI analysis is available when you open Budget Pro from its claude.ai link.'; });
  q('ex-run').addEventListener('click', () => renderBuiltIn(q('ex-out'), profileData(), read()));
  q('ex-ai').addEventListener('click', () => runAI(q('ex-out'), profileData(), read(), q('ex-q').value.trim(), q('ex-ai')));
  renderBuiltIn(q('ex-out'), profileData(), prof);
}

function renderBuiltIn(out, p, prof){
  const a = builtInAnalysis(p, prof), keys = Object.keys(a.alloc).filter(k => a.alloc[k] > 0);
  out.innerHTML = BP.h`
    <div class="card-t" style="margin-bottom:8px">1 · Readiness check</div>
    ${a.recs.map(x => BP.h`<div class="insight ${x[0] === 'info' ? '' : x[0]}">${x[1]}</div>`)}
    <div class="card-t" style="margin:16px 0 8px">2 · Suggested split of your ${BP.fmt(a.monthly)} SAR monthly budget</div>
    <div class="stack" style="height:16px">${keys.map(k => BP.h`<i style="width:${a.alloc[k]}%;background:var(${CLASS[k].c})" title="${CLASS[k].l} ${a.alloc[k]}%"></i>`)}</div>
    <div class="list" style="margin-top:8px">${keys.map(k => BP.h`<div class="li" style="align-items:flex-start"><div class="li-ic" style="background:${CH().hexA(CH().css(CLASS[k].c), .18)};font-weight:700;font-size:12px">${a.alloc[k]}%</div><div class="li-main"><div class="li-t">${CLASS[k].l} · <span class="num">${BP.fmt(a.monthly * a.alloc[k] / 100)} SAR/month</span></div><div class="li-s" style="white-space:normal">${CLASS[k].ex}${prof.shariah ? ' Pick the Shariah-compliant share classes / funds.' : ''}</div></div></div>`)}</div>
    <div class="card-t" style="margin:16px 0 8px">3 · What it could grow to in ${a.years} years</div>
    <div class="chart-box" style="height:200px"><canvas id="exProj"></canvas></div>
    <div class="card-sub" style="margin-top:6px">Starts from your portfolio + pot (${BP.fmt(a.start)} SAR) and adds ${BP.fmt(a.monthly)} SAR every month. 3% / 6% / 9% yearly are illustrative scenarios, not forecasts.</div>
    <div class="tipbox" style="margin-top:14px">⚖️ Educational analysis of your budget data — not licensed investment advice. Before buying, check that the product is offered by a CMA-licensed firm and suits your residency status.</div>`.s;
  const yrs = Array.from({ length: a.years + 1 }, (_, i) => 'Y' + i);
  BP.charts.make('exProj', () => ({ type: 'line', data: { labels: yrs, datasets: [
    { label: '9%', data: a.scen.s9, borderColor: CH().css('--green'), borderWidth: 2, pointRadius: 0, tension: .3 },
    { label: '6%', data: a.scen.s6, borderColor: CH().css('--accent'), borderWidth: 2.4, pointRadius: 0, tension: .3, fill: false },
    { label: '3%', data: a.scen.s3, borderColor: CH().css('--blue'), borderWidth: 2, pointRadius: 0, tension: .3 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
}

async function runAI(out, p, prof, question, btn){
  const sample = await ai(); if (!sample){ BP.toast('AI is not available here', 'err'); return; }
  const lang = prof.lang === 'ar' ? 'Answer in clear Arabic (Modern Standard, easy to read).' : 'Answer in English.';
  const prompt = `You are an experienced, careful investment educator helping one person plan how to invest his monthly investment budget. ${lang}
Person: ${prof.nationality} national living in ${prof.residence}. Time horizon: ${prof.horizon} years. Risk comfort: ${prof.risk}. Main goal: ${prof.goal}. ${prof.shariah ? 'He wants Shariah-compliant options only.' : ''}
His real budget data (SAR) from his budgeting app, as JSON:
${JSON.stringify(p)}
Known market facts to rely on (do not invent other numbers): SAMA repo rate 4.25% after the Dec-2025 cut; the government "Sah" savings sukuk paid 4.60% for 1 year in Jul-2026 but is open to Saudi citizens only. Tadawul lists index ETFs, a Shariah-compliant gold ETF and REITs; money-market and sukuk funds are offered by CMA-licensed asset managers.
${question ? 'His specific question: ' + question : ''}
Write a practical analysis with these markdown sections: "## Where you stand" (3-5 bullets using his numbers: emergency fund, debts, spending discipline, idle pot), "## Recommended approach" (a percentage split of his monthly investment budget across asset classes with SAR amounts and a one-line reason each, suited to his residency, horizon, risk${prof.shariah ? ', Shariah filter' : ''}), "## Next 3 months" (numbered concrete steps), "## Watch-outs" (2-4 bullets incl. currency/EGP exposure if relevant). Refer to product types and kinds of licensed providers, never to specific stock tickers. Keep it under 450 words. End with one line noting this is educational, not licensed financial advice.`;
  btn.disabled = true; const box = document.createElement('div'); box.className = 'card md ai-box'; box.innerHTML = '<div class="card-sub">✨ Thinking…</div>'; out.prepend(box);
  try {
    const res = await sample(prompt, { modelTier: 'complex', cache: false, onText: ({ text }) => { box.innerHTML = md(text); } });
    box.innerHTML = md(res.text); INV().advice = { text: res.text, at: new Date().toISOString() }; BP.store.persist(true);
  } catch (e) {
    box.innerHTML = BP.h`<div class="status-pill bad">${e && e.code === 'not_granted' ? 'AI access was not allowed for this page.' : e && e.code === 'rate_limited' ? 'Too many requests — try again in a minute.' : 'The AI analysis could not be completed.'}</div>`.s;
    if (e && e.text) box.innerHTML += md(e.text);
  } finally { btn.disabled = false; }
}
})();
