/* Budget Pro — Dashboard (framework + Overview, Grand Total, Family) */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc;
const T = BP.dashTabs = {};
const ds = BP.dashState = { tab: 'overview' };
const SUBS = [['overview', '📅 Overview'], ['grand', '🌍 Grand Total'], ['health', '💚 Health'], ['annual', '📆 Annual'], ['forecast', '📈 Forecast'], ['insights', '🔍 Insights'], ['family', '👨‍👩‍👧 Family']];

BP.views.dash = {
  render(el){
    BP.mount(el, BP.h`<div class="tabs-sub"><div class="seg">${SUBS.map(([k, l]) => BP.h`<button class="${ds.tab === k ? 'on' : ''}" data-act="sub" data-k="${k}">${l}</button>`)}</div></div><div id="dashBody"></div>`);
    T[ds.tab](BP.$('#dashBody', el));
  },
  actions: {
    sub(el){ ds.tab = el.dataset.k; BP.app.renderView(); },
    shiftYear(el){ ds.year = (ds.year || +BP.ymNow().slice(0, 4)) + Number(el.dataset.d); BP.app.renderView(true); },
    horizon(el){ ds.horizon = Number(el.dataset.h); BP.app.renderView(true); },
    editKpi(el){ BP.go && 0; BP.app.go('budget'); }
  }
};
BP.views.dash.onResize = () => {};

/* ---------- helpers ---------- */
const last = (arr, n) => arr.slice(Math.max(0, arr.length - n));
function histMonths(m, n){ const ms = C().dataMonths().filter(x => x <= m); const out = last(ms, n); return out.length ? out : [m]; }

/* ============================ OVERVIEW ============================ */
T.overview = function(el){
  const m = BP.ui.month, c = C(), d = BP.db(), cur = m === BP.ymNow();
  const SAL = c.salary(m), SB = c.sbBudget(m), INV = c.invest(m), SPB = c.spBudget(m), UN = c.unalloc(m), POOL = c.pool(m);
  const spent = c.spentSP(m), spentSB = c.spentSB(m), rem = POOL - spent, free = c.freeCash(m);
  const hm = histMonths(m, 6), ser = c.series(hm); const prevM = hm.length > 1 ? hm[hm.length - 2] : null;
  const dlt = (a, b) => b ? (a - b) / Math.abs(b) * 100 : null;
  const prev = prevM ? c.series([prevM])[0] : null;
  const usedPct = POOL ? spent / POOL * 100 : 0;
  const byMain = c.spentBy(m, 'Spendable', 'main'); const mainsAll = [...new Set([...Object.keys(byMain), ...c.mains().filter(x => c.mainBudget(m, x, 'Spendable') > 0)])];
  const catRows = mainsAll.map(k => ({ k, spent: byMain[k] || 0, bud: c.mainBudget(m, k, 'Spendable') })).sort((a, b) => b.spent - a.spent || b.bud - a.bud);
  const exps = c.expOf(m), top5 = exps.filter(e => e.type === 'Spendable').sort((a, b) => b.amount - a.amount).slice(0, 5);
  const necSpent = { Must: 0, Maybe: 0 }; exps.filter(e => e.type === 'Spendable').forEach(e => { const k = (c.cat(e.sub) || {}).necessity || 'Maybe'; necSpent[k] = (necSpent[k] || 0) + e.amount; });
  const payMix = c.spentBy(m, null, 'pay');
  const efm = c.efMonths(), liquid = c.liquid(), essAvg = c.essentialAvg();

  // salary countdown
  let sf = '';
  if (cur){
    const today = new Date(); today.setHours(0, 0, 0, 0); const ns = c.nextSalaryDate(); const days = Math.round((ns - today) / 864e5);
    const upcoming = BP.sum(c.upcomingRecurring(BP.toISO(ns)), r => r.amount), proj = rem - upcoming, safe = proj > 0 ? proj / Math.max(days, 1) : 0, avgD = spent / Math.max(today.getDate(), 1);
    const cls = proj < 0 ? 'bad' : (avgD === 0 || safe >= avgD * 1.15) ? 'good' : 'warn';
    const msg = proj < 0 ? `⚠️ <b>Overspending</b> — at this pace you'll be ${BP.fmt(-proj)} SAR over before salary day.` : cls === 'good' ? `✅ <b>On track</b> — comfortable room until payday.` : `🟡 <b>Watch it</b> — spend carefully to stay within budget.`;
    sf = BP.h`<div class="card span2"><div class="card-h"><div class="card-t big">⏳ Salary countdown & cash-flow forecast</div><span class="tag">${days <= 0 ? 'Payday today 🎉' : days + ' day' + (days === 1 ? '' : 's') + ' to go'}</span></div>
      <div class="grid g4 keep2" style="margin-bottom:14px"><div class="mini-stat"><div class="l">Remaining spendable</div><div class="v m-num">${BP.fmt(rem)}</div></div><div class="mini-stat"><div class="l">Upcoming bills</div><div class="v m-num" style="color:var(--red)">${BP.fmt(upcoming)}</div></div>
        <div class="mini-stat"><div class="l">Projected balance</div><div class="v m-num" style="color:${proj >= 0 ? 'var(--accent)' : 'var(--red)'}">${BP.fmt(proj)}</div></div><div class="mini-stat"><div class="l">Safe daily spend</div><div class="v m-num" style="color:var(--green)">${BP.fmt(safe)}</div></div></div>
      <div class="status-pill ${cls}">${BP.raw(msg)}</div></div>`;
  }

  BP.mount(el, BP.h`
  ${BP.ui.monthStrip(c.months(), m)}
  ${cur && BP.cards && !BP.cards.get(m) && BP.auth.canView('cards') ? BP.h`<div class="welcome" style="margin:4px 0 14px"><div style="font-size:24px">💳</div><div class="grow"><b>New month — set up your card balances.</b> <span class="muted">Enter what's left on each card, and Budget Pro tells you how much of the ${BP.fmt(c.spBudget(m))} SAR spendable budget you still need to transfer.</span></div><button class="btn sm primary" data-go="cards">Set up now</button></div>` : ''}
  <div class="hero" style="margin:6px 0 16px">
    <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:center">
      <div><h2>${BP.fmtMonth(m, true)} · free cash after plan</h2>
        <div class="big m-num" style="color:${free >= 0 ? 'var(--accent)' : 'var(--red)'}">${BP.fmt(free)} <small style="font-size:16px;color:var(--muted)">SAR</small></div>
        <div class="card-sub" style="margin-bottom:16px">Salary − saving boxes − investments − spendable spent · ${BP.pct(free, SAL, 1)} of salary</div>
        ${BP.charts.flowBar([{ l: 'Saving Boxes', v: SB, c: 'var(--purple)' }, { l: 'Investments', v: INV, c: 'var(--blue)' }, { l: 'Spendable', v: SPB, c: 'var(--green)' }, { l: 'Unallocated', v: Math.max(0, UN), c: 'var(--accent)' }])}</div>
      <div class="row" style="justify-content:center;gap:22px;flex-wrap:wrap"><div class="ring-wrap">${BP.charts.ring(usedPct, { size: 124, stroke: 12, color: usedPct > 100 ? 'var(--red)' : usedPct > 80 ? 'var(--amber)' : 'var(--accent)' })}<div class="ring-c"><div class="v m-num">${usedPct.toFixed(0)}%</div><div class="l">spendable used</div></div></div>
        <div class="col" style="gap:10px"><div><div class="card-sub">Spent</div><b class="num m-num" style="font-size:16px">${BP.fmt(spent)}</b></div><div><div class="card-sub">Remaining</div><b class="num m-num" style="font-size:16px;color:${rem >= 0 ? 'var(--green)' : 'var(--red)'}">${BP.fmt(rem)}</b></div></div></div>
    </div>
  </div>
  <div class="grid g4 keep2">
    ${BP.ui.kpi({ label: 'Gross salary', value: BP.fmt(SAL), mask: 'sal', color: 'var(--blue)', spark: ser.map(x => x.salary), foot: c.hasPlan(m) ? 'plan saved' : 'carried from ' + (c.planFor(m).from ? BP.fmtMonth(c.planFor(m).from) : 'defaults') })}
    ${BP.ui.kpi({ label: 'Saving boxes', value: BP.fmt(SB), mask: 'sal', color: 'var(--purple)', spark: ser.map(x => x.sb), foot: `${c.catsOf('Saving Box').length} boxes · ${BP.fmt(spentSB)} drawn` })}
    ${BP.ui.kpi({ label: 'Investments', value: BP.fmt(INV), mask: 'sal', color: 'var(--cyan)', spark: ser.map(x => x.invest), foot: BP.pct(INV, SAL) + ' of salary' })}
    ${BP.ui.kpi({ label: 'Spendable budget', value: BP.fmt(POOL), mask: 'sal', color: 'var(--green)', spark: ser.map(x => x.pool), foot: d.settings.spendPool === 'full' ? 'planned + unallocated' : 'sum of category plans' })}
    ${BP.ui.kpi({ label: 'Spent (spendable)', value: BP.fmt(spent), color: 'var(--red)', spark: ser.map(x => x.spentSP), foot: `${exps.filter(e => e.type === 'Spendable').length} transactions`, delta: prev ? dlt(spent, prev.spentSP) : null, goodUp: false })}
    ${BP.ui.kpi({ label: 'Remaining spendable', value: BP.fmt(rem), valColor: rem >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--green)', foot: BP.pct(rem, POOL) + ' of budget left' })}
    ${BP.ui.kpi({ label: 'Unallocated', value: BP.fmt(UN), valColor: UN >= 0 ? 'var(--accent)' : 'var(--red)', color: 'var(--accent)', spark: ser.map(x => x.unalloc), foot: UN >= 0 ? 'not assigned to any plan' : 'plan exceeds salary' })}
    ${BP.ui.kpi({ label: 'Projected savings', value: BP.fmt(free), valColor: free >= 0 ? 'var(--accent)' : 'var(--red)', color: 'var(--accent)', spark: ser.map(x => x.free), foot: BP.pct(free, SAL, 0) + ' savings rate', delta: prev ? dlt(free, prev.free) : null })}
  </div>
  <div class="grid g2" style="margin-top:16px">
    ${sf}
    <div class="card"><div class="card-h"><div class="card-t big">Spend by category</div><span class="card-sub">spendable only</span></div>${byMain && Object.keys(byMain).length ? BP.ui.canvas('dCat', 250) : BP.ui.empty('🍩', 'No spendable expenses yet')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Budget vs actual</div><span class="card-sub">per main category</span></div>
      <div class="list">${catRows.length ? catRows.map(r => { const p = r.bud ? r.spent / r.bud * 100 : (r.spent ? 100 : 0), over = r.bud && r.spent > r.bud, col = over ? 'var(--red)' : p > 80 ? 'var(--amber)' : BP.calc.mainColor(r.k);
        return BP.h`<div class="cat-row">${BP.ui.catChip(r.k)}<div><div class="row between"><span class="nm">${r.k}</span><span class="sm num m-num">${BP.fmt(r.spent)}${r.bud ? ' / ' + BP.fmt(r.bud) : ''}</span></div><div class="bar thin" style="margin-top:5px"><i style="width:${Math.min(100, p)}%;background:${col}"></i></div></div><span class="num sm" style="color:${over ? 'var(--red)' : 'var(--muted)'};min-width:40px;text-align:right">${r.bud ? p.toFixed(0) + '%' : '—'}</span></div>`; }) : BP.ui.empty('📊', 'Nothing to compare yet')}</div></div>
    <div class="card span2"><div class="card-h"><div class="card-t big">Spending pace</div><span class="card-sub">cumulative vs. ideal pace and budget</span></div>${exps.length ? BP.ui.canvas('dBurn', 260) : BP.ui.empty('📈', 'No data for this month')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Daily heatmap</div><span class="card-sub">all outflows</span></div><div id="heatWrap"></div></div>
    <div class="card"><div class="card-h"><div class="card-t big">Weekday pattern</div><span class="card-sub">total by day of week</span></div>${exps.length ? BP.ui.canvas('dWeek', 230) : BP.ui.empty('🗓️', 'No data')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Must vs Maybe</div><span class="card-sub">necessity of spending</span></div>${necSpent.Must + necSpent.Maybe ? BP.ui.canvas('dNec', 220) : BP.ui.empty('⚖️', 'No data')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Payment methods</div><span class="card-sub">where money left</span></div>${Object.keys(payMix).length ? BP.ui.canvas('dPay', 220) : BP.ui.empty('💳', 'No data')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">🛡️ Emergency fund</div><span class="num" style="font-weight:700;font-size:15px;color:${efm == null ? 'var(--muted)' : efm < 3 ? 'var(--red)' : efm < 6 ? 'var(--amber)' : 'var(--green)'}">${efm == null ? '—' : efm.toFixed(1) + ' mo'}</span></div>
      <div class="ef-bar">${Array.from({ length: 12 }, (_, i) => BP.h`<i class="${efm != null && i < Math.min(12, Math.round(efm)) ? 'on ' + (efm < 3 ? 'red' : efm < 6 ? 'yellow' : 'green') : ''}"></i>`)}</div>
      <div class="card-sub" style="margin-top:10px">${efm == null ? 'Add liquid accounts in Net Worth and some expense history to calculate.' : `Liquid assets ${BP.fmt(liquid)} SAR · essentials ≈ ${BP.fmt(essAvg)} SAR / month`}</div></div>
    <div class="card"><div class="card-h"><div class="card-t big">Top expenses</div></div><div class="list">${top5.length ? top5.map(e => BP.h`<div class="li"><div class="li-ic" style="background:${BP.charts.hexA(BP.calc.mainColor(e.main), .16)}">${BP.calc.mainIcon(e.main)}</div><div class="li-main"><div class="li-t">${e.sub}</div><div class="li-s">${e.date}${e.desc ? ' · ' + e.desc : ''}</div></div><div class="li-v m-num">${BP.fmt(e.amount)}</div></div>`) : BP.ui.empty('🏷️', 'No expenses')}</div></div>
    ${cur ? upcomingCard() : ''}
  </div>`);

  // heatmap
  const daily = c.dailySpend(m, null), mx = Math.max(...daily, 1), first = BP.parseDate(m + '-01').getDay(), todayIso = BP.today();
  const hw = BP.$('#heatWrap', el);
  hw.innerHTML = '<div class="heat">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<div class="hd">${x}</div>`).join('') + Array.from({ length: first }, () => '<div></div>').join('')
    + daily.map((v, i) => { const iso = `${m}-${String(i + 1).padStart(2, '0')}`; const a = v ? .16 + .74 * Math.sqrt(v / mx) : 0;
      return `<div class="d ${iso === todayIso ? 'today' : ''}" title="${iso}: ${BP.fmt(v)} SAR" style="${v ? 'background:' + BP.charts.hexA(BP.charts.css('--accent'), a.toFixed(2)) + ';color:var(--text)' : ''}">${i + 1}${v ? `<b class="m-num">${BP.fmtK(v)}</b>` : ''}</div>`; }).join('') + '</div>';

  // charts
  if (Object.keys(byMain).length){
    const ent = Object.entries(byMain).sort((a, b) => b[1] - a[1]);
    BP.charts.make('dCat', () => ({ type: 'doughnut', data: { labels: ent.map(x => x[0]), datasets: [{ data: ent.map(x => x[1]), backgroundColor: ent.map(x => BP.calc.mainColor(x[0])), borderColor: BP.charts.css('--card'), borderWidth: 3, hoverOffset: 8 }] },
      options: { cutout: '70%', plugins: { legend: { position: 'right', labels: { color: BP.charts.css('--muted') } }, centerText: { text: BP.fmt(spent), sub: 'spent', size: 22 }, tooltip: { callbacks: { label: x => ` ${x.label}: ${BP.fmt(x.parsed)} SAR (${(x.parsed / spent * 100).toFixed(0)}%)` } } } } }));
  }
  if (exps.length){
    const n = BP.daysIn(m), dailySP = c.dailySpend(m, 'Spendable'); const upto = cur ? new Date().getDate() : n; let cum = 0; const act = dailySP.map((v, i) => i < upto ? (cum += v) : null);
    const avg = upto ? cum / upto : 0; const proj = dailySP.map((_, i) => i + 1 >= upto && cur ? cum + avg * (i + 1 - upto) : null);
    BP.charts.make('dBurn', () => ({ type: 'line', data: { labels: dailySP.map((_, i) => i + 1), datasets: [
      { label: 'Actual', data: act, borderColor: BP.charts.css('--accent'), backgroundColor: ctx => ctx.chart.chartArea ? BP.charts.vert(ctx.chart.ctx, ctx.chart.chartArea, BP.charts.hexA(BP.charts.css('--accent'), .35), BP.charts.hexA(BP.charts.css('--accent'), 0)) : 'transparent', fill: true, tension: .3, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2.5 },
      ...(cur ? [{ label: 'Projected', data: proj, borderColor: BP.charts.css('--accent'), borderDash: [5, 5], pointRadius: 0, borderWidth: 1.8, fill: false, tension: .2 }] : []),
      { label: 'Ideal pace', data: dailySP.map((_, i) => POOL * (i + 1) / n), borderColor: BP.charts.css('--blue'), borderDash: [2, 4], pointRadius: 0, borderWidth: 1.6, fill: false },
      { label: 'Budget', data: dailySP.map(() => POOL), borderColor: BP.charts.css('--red'), pointRadius: 0, borderWidth: 1.2, fill: false }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: i => `Day ${i[0].label}`, label: x => ` ${x.dataset.label}: ${BP.fmt(x.parsed.y)} SAR` } } }, scales: BP.charts.scales({ x: { ticks: { maxTicksLimit: 10 } } }) } }));
    const wk = Array(7).fill(0), wkn = Array(7).fill(0); exps.forEach(e => { const w = BP.parseDate(e.date).getDay(); wk[w] += e.amount; wkn[w]++; });
    BP.charts.make('dWeek', () => ({ type: 'bar', data: { labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], datasets: [{ label: 'Spent', data: wk, backgroundColor: wk.map(v => BP.charts.hexA(BP.charts.css('--accent'), v === Math.max(...wk) ? 1 : .45)), borderRadius: 8 }] },
      options: { plugins: { legend: { display: false }, valueLabels: { show: true }, tooltip: { callbacks: { afterLabel: x => `${wkn[x.dataIndex]} transactions` } } }, scales: BP.charts.scales() } }));
  }
  if (necSpent.Must + necSpent.Maybe){
    BP.charts.make('dNec', () => ({ type: 'doughnut', data: { labels: ['Must', 'Maybe'], datasets: [{ data: [necSpent.Must, necSpent.Maybe], backgroundColor: [BP.charts.css('--red'), BP.charts.css('--amber')], borderColor: BP.charts.css('--card'), borderWidth: 3 }] },
      options: { cutout: '68%', plugins: { legend: { position: 'bottom' }, centerText: { text: BP.pct(necSpent.Must, necSpent.Must + necSpent.Maybe), sub: 'essential', size: 22 } } } }));
  }
  if (Object.keys(payMix).length){
    const ent = Object.entries(payMix).sort((a, b) => b[1] - a[1]); const pal = BP.charts.palette();
    BP.charts.make('dPay', () => ({ type: 'doughnut', data: { labels: ent.map(x => x[0]), datasets: [{ data: ent.map(x => x[1]), backgroundColor: ent.map((_, i) => pal[i % pal.length]), borderColor: BP.charts.css('--card'), borderWidth: 3 }] },
      options: { cutout: '66%', plugins: { legend: { position: 'right' }, centerText: { text: String(ent.length), sub: 'methods', size: 24 } } } }));
  }

  function upcomingCard(){
    const items = d.recurring.filter(r => r.active !== false && r.nextDue).sort((a, b) => a.nextDue.localeCompare(b.nextDue)).slice(0, 5);
    if (!items.length) return '';
    return BP.h`<div class="card"><div class="card-h"><div class="card-t big">🔁 Upcoming commitments</div></div><div class="list">${items.map(r => BP.h`<div class="li"><div class="li-ic">${BP.calc.mainIcon((BP.calc.cat(r.sub) || {}).main)}</div><div class="li-main"><div class="li-t">${r.name}</div><div class="li-s">Due ${BP.fmtDate(r.nextDue)}</div></div><div class="li-v m-num">${BP.fmt(r.amount)}</div></div>`)}</div></div>`;
  }
};

/* ============================ GRAND TOTAL ============================ */
T.grand = function(el){
  const c = C(), ms = c.dataMonths(), ser = c.series(ms);
  const tSal = BP.sum(ser, x => x.salary), tSB = BP.sum(ser, x => x.sb), tInv = BP.sum(ser, x => x.invest), tSp = BP.sum(ser, x => x.spentSP), tSBs = BP.sum(ser, x => x.spentSB), tFree = BP.sum(ser, x => x.free);
  let cum = 0; const cumFree = ser.map(x => (cum += x.free));
  BP.mount(el, BP.h`
  <div class="grid g4 keep2">
    ${BP.ui.kpi({ label: 'Months tracked', value: ms.length, unit: false, color: 'var(--blue)' })}
    ${BP.ui.kpi({ label: 'Total salary', value: BP.fmt(tSal), mask: 'sal', color: 'var(--blue)' })}
    ${BP.ui.kpi({ label: 'Total saving boxes', value: BP.fmt(tSB), mask: 'sal', color: 'var(--purple)' })}
    ${BP.ui.kpi({ label: 'Total investments', value: BP.fmt(tInv), mask: 'sal', color: 'var(--cyan)' })}
    ${BP.ui.kpi({ label: 'Total spent (spendable)', value: BP.fmt(tSp), color: 'var(--red)' })}
    ${BP.ui.kpi({ label: 'Saving-box draws', value: BP.fmt(tSBs), color: 'var(--amber)' })}
    ${BP.ui.kpi({ label: 'Cumulative free cash', value: BP.fmt(tFree), valColor: tFree >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--green)' })}
    ${BP.ui.kpi({ label: 'Avg savings rate', value: ser.length ? BP.sum(ser, x => x.rate) / ser.length : 0, unit: false, color: 'var(--accent)' }).s.replace(/(<div class="kpi-val[^>]*>)([\d.-]+)/, (_, a, b) => a + Number(b).toFixed(1) + '%')}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><div class="card-h"><div class="card-t big">Month by month</div><span class="card-sub">spent vs free cash</span></div>${ser.length ? BP.ui.canvas('gBar', 280) : BP.ui.empty('📊', 'No data yet')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Cumulative free cash</div><span class="card-sub">running total</span></div>${ser.length ? BP.ui.canvas('gCum', 280) : BP.ui.empty('📈', 'No data yet')}</div>
    <div class="card span2 pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="r">Salary</th><th class="r">Spent (spendable)</th><th class="r">Saving-box draws</th><th class="r">Free cash</th><th class="r">Rate</th></tr></thead>
      <tbody>${ser.slice().reverse().map(x => BP.h`<tr><td><b>${BP.fmtMonth(x.m)}</b></td><td class="r num m-sal">${BP.fmt(x.salary)}</td><td class="r num m-num">${BP.fmt(x.spentSP)}</td><td class="r num m-num">${BP.fmt(x.spentSB)}</td><td class="r num m-num ${x.free >= 0 ? 'up' : 'down'}">${BP.fmt(x.free)}</td><td class="r num">${x.rate.toFixed(0)}%</td></tr>`) || ''}
      ${!ser.length ? BP.h`<tr><td colspan="6" class="center muted" style="padding:24px">No data yet</td></tr>` : ''}</tbody></table></div></div>
  </div>`);
  if (ser.length){
    BP.charts.make('gBar', () => ({ type: 'bar', data: { labels: ser.map(x => x.label), datasets: [
      { label: 'Spendable spent', data: ser.map(x => x.spentSP), backgroundColor: BP.charts.css('--red'), borderRadius: 6, stack: 'a' }, { label: 'Saving-box draws', data: ser.map(x => x.spentSB), backgroundColor: BP.charts.css('--purple'), borderRadius: 6, stack: 'a' },
      { label: 'Free cash', data: ser.map(x => Math.max(0, x.free)), backgroundColor: BP.charts.css('--accent'), borderRadius: 6, stack: 'b' }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: BP.charts.tipMoney }, scales: { ...BP.charts.scales(), x: { ...BP.charts.scales().x, stacked: true }, y: { ...BP.charts.scales().y, stacked: true } } } }));
    BP.charts.make('gCum', () => ({ type: 'line', data: { labels: ser.map(x => x.label), datasets: [{ label: 'Cumulative free cash', data: cumFree, borderColor: BP.charts.css('--green'), backgroundColor: ctx => ctx.chart.chartArea ? BP.charts.vert(ctx.chart.ctx, ctx.chart.chartArea, BP.charts.hexA(BP.charts.css('--green'), .4), BP.charts.hexA(BP.charts.css('--green'), 0)) : 'transparent', fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: BP.charts.css('--green'), borderWidth: 2.6 }] },
      options: { plugins: { legend: { display: false }, tooltip: BP.charts.tipMoney }, scales: BP.charts.scales() } }));
  }
};

/* ============================ FAMILY ============================ */
T.family = function(el){
  const all = BP.db().expenses; if (!all.length){ BP.mount(el, BP.ui.empty('👨‍👩‍👧', 'No transactions yet')); return; }
  const by = {}; all.forEach(e => { const w = e.addedBy || 'Unknown'; (by[w] = by[w] || { total: 0, n: 0, cats: {} }); by[w].total += e.amount; by[w].n++; by[w].cats[e.main] = (by[w].cats[e.main] || 0) + e.amount; });
  const people = Object.entries(by).sort((a, b) => b[1].total - a[1].total), grand = BP.sum(all, e => e.amount), pal = BP.charts.palette();
  const m = BP.ui.month, mexp = BP.calc.expOf(m), mt = BP.sum(mexp, e => e.amount);
  BP.mount(el, BP.h`<div class="grid g2">
    <div class="card"><div class="card-h"><div class="card-t big">Who spends what</div><span class="card-sub">all time</span></div>${BP.ui.canvas('fDonut', 240)}</div>
    <div class="card"><div class="card-h"><div class="card-t big">By month</div><span class="card-sub">stacked by person</span></div>${BP.ui.canvas('fStack', 240)}</div>
    ${people.map(([name, p], i) => { const top = Object.entries(p.cats).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = top[0] ? top[0][1] : 1;
      return BP.h`<div class="card"><div class="row between"><div class="row"><div class="avatar" style="background:${pal[i % pal.length]}">${name[0]}</div><div><b>${name}</b><div class="card-sub">${(p.total / grand * 100).toFixed(0)}% of all spending · ${p.n} txns</div></div></div><b class="num m-num" style="font-size:17px">${BP.fmt(p.total)}</b></div>
        <div class="bar" style="margin:12px 0"><i style="width:${p.total / grand * 100}%;background:${pal[i % pal.length]}"></i></div>
        ${top.map(([k, v]) => BP.h`<div class="cat-row" style="grid-template-columns:24px 1fr auto;padding:5px 0"><span>${BP.calc.mainIcon(k)}</span><div><div class="row between sm"><span style="font-size:12.5px">${k}</span></div><div class="bar thin" style="margin-top:3px"><i style="width:${v / mx * 100}%;background:${pal[i % pal.length]}"></i></div></div><span class="num sm m-num">${BP.fmt(v)}</span></div>`)}</div>`; })}
    ${mt ? BP.h`<div class="card span-all"><div class="card-h"><div class="card-t big">${BP.fmtMonth(m, true)} split</div></div>${people.map(([name], i) => { const a = BP.sum(mexp.filter(e => (e.addedBy || 'Unknown') === name), e => e.amount); return BP.h`<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--border)"><span style="color:${pal[i % pal.length]};font-weight:700">${name}</span><span class="num m-num">${BP.fmt(a)} SAR <span class="faint">(${(a / mt * 100).toFixed(0)}%)</span></span></div>`; })}</div>` : ''}
  </div>`);
  BP.charts.make('fDonut', () => ({ type: 'doughnut', data: { labels: people.map(p => p[0]), datasets: [{ data: people.map(p => p[1].total), backgroundColor: people.map((_, i) => pal[i % pal.length]), borderColor: BP.charts.css('--card'), borderWidth: 3 }] }, options: { cutout: '68%', plugins: { legend: { position: 'right' }, centerText: { text: BP.fmtK(grand), sub: 'SAR total', size: 22 } } } }));
  const ms = BP.calc.dataMonths();
  BP.charts.make('fStack', () => ({ type: 'bar', data: { labels: ms.map(x => BP.monthShort(x)), datasets: people.map(([name], i) => ({ label: name, data: ms.map(mm => BP.sum(all.filter(e => e.month === mm && (e.addedBy || 'Unknown') === name), e => e.amount)), backgroundColor: pal[i % pal.length], borderRadius: 5, stack: 's' })) },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: BP.charts.tipMoney }, scales: { ...BP.charts.scales(), x: { ...BP.charts.scales().x, stacked: true }, y: { ...BP.charts.scales().y, stacked: true } } } }));
};
})();
