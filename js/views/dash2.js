/* Budget Pro — Dashboard sub-tabs: Health, Annual, Forecast, Insights */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, T = BP.dashTabs, ds = BP.dashState;
const CH = () => BP.charts;
const gradFill = (col, a = .35) => ctx => ctx.chart.chartArea ? CH().vert(ctx.chart.ctx, ctx.chart.chartArea, CH().hexA(CH().css(col), a), CH().hexA(CH().css(col), 0)) : 'transparent';

/* ============================ HEALTH ============================ */
T.health = function(el){
  const h = C().health(), col = h.total >= 70 ? 'var(--green)' : h.total >= 55 ? 'var(--amber)' : 'var(--red)';
  BP.mount(el, BP.h`<div class="grid g2">
    <div class="card"><div class="col" style="align-items:center;text-align:center;gap:10px">
      <div class="ring-wrap">${CH().ring(h.total, { size: 164, stroke: 14, color: col })}<div class="ring-c"><div class="v" style="font-size:38px">${h.total}</div><div class="l">out of 100 · grade ${h.grade}</div></div></div>
      <div style="font-size:15px;font-weight:700">${h.title}</div><div class="card-sub">Based on the last ${h.basedOn} month${h.basedOn === 1 ? '' : 's'} of data</div></div></div>
    <div class="card"><div class="card-h"><div class="card-t big">Score profile</div></div>${BP.ui.canvas('hRadar', 280)}</div>
    <div class="card span2"><div class="card-h"><div class="card-t big">Components</div><span class="card-sub">weights 30 / 25 / 25 / 20</span></div>
      ${h.comps.map(c => { const cc = c.score >= 70 ? 'var(--green)' : c.score >= 45 ? 'var(--amber)' : 'var(--red)'; return BP.h`<div style="margin-bottom:16px"><div class="row between"><b>${c.name} <span class="faint" style="font-weight:500">· weight ${c.w}%</span></b><b class="num" style="color:${cc}">${c.score}/100</b></div><div class="bar tall" style="margin:7px 0"><i style="width:${c.score}%;background:${cc}"></i></div><div class="card-sub">${c.val} — ${c.detail}</div></div>`; })}</div>
    <div class="card span2"><div class="card-h"><div class="card-t big">Recommendations</div></div>${h.recs.map(r => BP.h`<div class="status-pill ${r[0] === 'info' ? 'good' : r[0]}" style="margin-bottom:8px">${r[1]}</div>`)}</div>
  </div>`);
  BP.charts.make('hRadar', () => ({ type: 'radar', data: { labels: h.comps.map(c => c.name), datasets: [{ label: 'Score', data: h.comps.map(c => c.score), borderColor: CH().css('--accent'), backgroundColor: CH().hexA(CH().css('--accent'), .25), pointBackgroundColor: CH().css('--accent'), borderWidth: 2.4 }] },
    options: { plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, backdropColor: 'transparent' }, grid: { color: CH().css('--grid') }, angleLines: { color: CH().css('--grid') }, pointLabels: { color: CH().css('--text'), font: { size: 12, weight: 600 } } } } } }));
};

/* ============================ ANNUAL ============================ */
T.annual = function(el){
  const c = C(), cy = +BP.ymNow().slice(0, 4); const yr = ds.year = ds.year || (+BP.ui.month.slice(0, 4) || cy);
  const ms = Array.from({ length: 12 }, (_, i) => `${yr}-${String(i + 1).padStart(2, '0')}`); const live = ms.filter(m => c.expOf(m).length || c.hasPlan(m));
  const ser = c.series(ms), act = ser.filter(x => live.includes(x.m));
  const tSal = BP.sum(act, x => x.salary), tSp = BP.sum(act, x => x.spentSP), tSB = BP.sum(act, x => x.sb), tInv = BP.sum(act, x => x.invest), tFree = BP.sum(act, x => x.free);
  const mains = [...new Set(c.exps().filter(e => e.month.startsWith(yr + '')).map(e => e.main))];
  const best = act.length ? act.reduce((a, b) => b.free > a.free ? b : a) : null, worst = act.length ? act.reduce((a, b) => b.spentSP > a.spentSP ? b : a) : null;
  BP.mount(el, BP.h`
  <div class="row center" style="justify-content:center;gap:14px;margin-bottom:14px"><button class="icon-btn" data-act="shiftYear" data-d="-1">‹</button><b style="font-size:18px" class="num">${yr}</b><button class="icon-btn" data-act="shiftYear" data-d="1">›</button></div>
  <div class="grid g4 keep2">
    ${BP.ui.kpi({ label: 'Total salary', value: BP.fmt(tSal), mask: 'sal', color: 'var(--blue)', foot: `${act.length} active months` })}
    ${BP.ui.kpi({ label: 'Total spent', value: BP.fmt(tSp), color: 'var(--red)', foot: `≈ ${BP.fmt(act.length ? tSp / act.length : 0)} / month` })}
    ${BP.ui.kpi({ label: 'Saving boxes + invest', value: BP.fmt(tSB + tInv), mask: 'sal', color: 'var(--purple)', foot: BP.pct(tSB + tInv, tSal) + ' of salary' })}
    ${BP.ui.kpi({ label: 'Free cash', value: BP.fmt(tFree), valColor: tFree >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--green)', foot: best ? `best: ${BP.fmtMonth(best.m)}` : '—' })}
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card span2"><div class="card-h"><div class="card-t big">Salary vs spending vs free cash</div></div>${act.length ? BP.ui.canvas('aMain', 290) : BP.ui.empty('📆', 'No data for ' + yr)}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Category mix by month</div></div>${mains.length ? BP.ui.canvas('aStack', 280) : BP.ui.empty('📊', 'No data')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Savings rate</div></div>${act.length ? BP.ui.canvas('aRate', 280) : BP.ui.empty('📉', 'No data')}</div>
    <div class="card span2 pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="r">Salary</th><th class="r">Boxes</th><th class="r">Invest</th><th class="r">Spent</th><th class="r">Free</th><th class="r">Rate</th></tr></thead><tbody>
      ${ser.map(x => live.includes(x.m) ? BP.h`<tr class="clickrow" data-act="openMonth" data-m="${x.m}"><td><b>${BP.fmtMonth(x.m)}</b></td><td class="r num m-sal">${BP.fmt(x.salary)}</td><td class="r num m-sal">${BP.fmt(x.sb)}</td><td class="r num m-sal">${BP.fmt(x.invest)}</td><td class="r num m-num">${BP.fmt(x.spentSP)}</td><td class="r num m-num ${x.free >= 0 ? 'up' : 'down'}">${BP.fmt(x.free)}</td><td class="r num">${x.rate.toFixed(0)}%</td></tr>` : BP.h`<tr style="opacity:.35"><td>${BP.fmtMonth(x.m)}</td><td class="r" colspan="6">—</td></tr>`)}
      </tbody></table></div></div>
  </div>`);
  if (act.length){
    BP.charts.make('aMain', () => ({ type: 'bar', data: { labels: ser.map(x => BP.monthShort(x.m)), datasets: [
      { type: 'line', label: 'Salary', data: ser.map(x => live.includes(x.m) ? x.salary : null), borderColor: CH().css('--blue'), pointRadius: 3, borderWidth: 2.4, tension: .3, order: 0 },
      { label: 'Spent', data: ser.map(x => live.includes(x.m) ? x.spentSP : null), backgroundColor: CH().css('--red'), borderRadius: 6, order: 1 },
      { label: 'Free cash', data: ser.map(x => live.includes(x.m) ? x.free : null), backgroundColor: CH().css('--accent'), borderRadius: 6, order: 1 }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
    BP.charts.make('aRate', () => ({ type: 'line', data: { labels: ser.map(x => BP.monthShort(x.m)), datasets: [{ label: 'Savings rate %', data: ser.map(x => live.includes(x.m) ? +x.rate.toFixed(1) : null), borderColor: CH().css('--green'), backgroundColor: gradFill('--green'), fill: true, tension: .35, pointRadius: 4, borderWidth: 2.4, spanGaps: true }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${x.parsed.y}%` } } }, scales: CH().scales({ y: { beginAtZero: false, ticks: { callback: v => v + '%' } } }) } }));
  }
  if (mains.length){
    const pal = CH().palette();
    BP.charts.make('aStack', () => ({ type: 'bar', data: { labels: ms.map(m => BP.monthShort(m)), datasets: mains.map(k => ({ label: k, data: ms.map(m => BP.sum(c.expOf(m).filter(e => e.main === k && e.type === 'Spendable'), e => e.amount)), backgroundColor: C().mainColor(k), stack: 's', borderRadius: 3 })) },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: CH().tipMoney }, scales: { ...CH().scales(), x: { ...CH().scales().x, stacked: true }, y: { ...CH().scales().y, stacked: true } } } }));
  }
};
BP.views.dash.actions.openMonth = el => { BP.ui.month = el.dataset.m; ds.tab = 'overview'; BP.app.renderView(); };

/* ============================ FORECAST ============================ */
const fc = { sel: [], mode: 'monthly', src: 'spent', sub: '' };
BP.fcState = fc;
function fcSeries(key, months){
  const c = C();
  const f = {
    'Salary': m => c.salary(m), 'Total spent': m => c.spentSP(m) + c.spentSB(m), 'Spendable spent': m => c.spentSP(m), 'Saving-box draws': m => c.spentSB(m), 'Free cash': m => c.freeCash(m), 'Investments': m => c.invest(m)
  };
  if (f[key]) return months.map(f[key]);
  if (key.startsWith('main:')){ const k = key.slice(5); return months.map(m => fc.src === 'budget' ? c.mainBudget(m, k, null) : BP.sum(c.expOf(m).filter(e => e.main === k), e => e.amount)); }
  if (key.startsWith('sub:')){ const k = key.slice(4); return months.map(m => fc.src === 'budget' ? c.budgetOf(m, k) : BP.sum(c.expOf(m).filter(e => e.sub === k), e => e.amount)); }
  return months.map(() => 0);
}
T.forecast = function(el){
  const c = C(), cur = BP.ymNow(), H = ds.horizon || 6;
  const hist = c.dataMonths().filter(m => m <= cur).slice(-6); const nHist = hist.length;
  const avg = k => nHist ? BP.sum(hist, m => k(m)) / nHist : 0;
  const aSp = avg(m => c.spentSP(m)), aSB = avg(m => c.sb ? c.sbBudget(m) : 0), aInv = avg(m => c.invest(m)), aSal = nHist ? c.salary(hist[nHist - 1]) : c.salary(cur);
  const aFree = aSal - aSB - aInv - aSp;
  const future = Array.from({ length: H }, (_, i) => BP.addMonths(cur, i + 1)); const base = c.liquid();
  let cum = base; const proj = future.map(m => (cum += aFree)); let low = base, cumLow = base; const lowP = future.map(() => (cumLow += aFree - aFree * .15)), hiP = (() => { let x = base; return future.map(() => (x += aFree + Math.abs(aFree) * .15)); })();
  const labels = [...hist.map(m => BP.monthShort(m) + " '" + m.slice(2, 4)), ...future.map(m => BP.monthShort(m) + " '" + m.slice(2, 4))];
  // builder
  const mains = c.mains(), totals = ['Salary', 'Total spent', 'Spendable spent', 'Saving-box draws', 'Free cash', 'Investments'];
  const subs = fc.sub ? c.cats().filter(x => x.main === fc.sub).map(x => x.sub) : [];
  const bm = [...c.dataMonths().filter(m => m <= cur).slice(-12)];
  BP.mount(el, BP.h`
  <div class="grid g4 keep2">
    ${BP.ui.kpi({ label: 'Avg monthly spend', value: BP.fmt(aSp), color: 'var(--red)', foot: `last ${nHist} month${nHist === 1 ? '' : 's'}` })}
    ${BP.ui.kpi({ label: 'Projected free / month', value: BP.fmt(aFree), valColor: aFree >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--accent)', foot: 'salary − plan − avg spend' })}
    ${BP.ui.kpi({ label: `Liquid in ${H} months`, value: BP.fmt(proj[proj.length - 1] || base), color: 'var(--green)', foot: `today ${BP.fmt(base)}` })}
    ${BP.ui.kpi({ label: `Saved over ${H} months`, value: BP.fmt(aFree * H), valColor: aFree >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--blue)', foot: 'if habits stay the same' })}
  </div>
  <div class="card" style="margin-top:16px"><div class="card-h"><div class="card-t big">Liquid-balance projection</div><div class="seg">${[3, 6, 12, 24].map(h => BP.h`<button class="${H === h ? 'on' : ''}" data-act="horizon" data-h="${h}">${h}m</button>`)}</div></div>${BP.ui.canvas('fProj', 300)}
    <div class="card-sub" style="margin-top:8px">Base = liquid accounts in Net Worth. Band ±15% around your average free cash. A projection, not a promise.</div></div>
  <div class="card" style="margin-top:16px"><div class="card-h"><div class="card-t big">📊 Chart builder</div><div class="row"><div class="seg"><button class="${fc.mode === 'monthly' ? 'on' : ''}" data-act="fcMode" data-v="monthly">Monthly</button><button class="${fc.mode === 'cumulative' ? 'on' : ''}" data-act="fcMode" data-v="cumulative">Cumulative</button></div><div class="seg"><button class="${fc.src === 'spent' ? 'on' : ''}" data-act="fcSrc" data-v="spent">Actual</button><button class="${fc.src === 'budget' ? 'on' : ''}" data-act="fcSrc" data-v="budget">Budget</button></div><button class="btn sm" data-act="fcClear">Clear</button></div></div>
    <div class="card-sub" style="margin-bottom:8px">Click or drag chips onto the chart to add / remove series.</div>
    <div class="chips" style="margin-bottom:8px">${totals.map(k => BP.h`<button class="chip ${fc.sel.includes(k) ? 'on' : ''}" draggable="true" data-fc="${k}" data-act="fcTog" data-k="${k}">${k}</button>`)}</div>
    <div class="chips" style="margin-bottom:8px">${mains.map(k => BP.h`<button class="chip ${fc.sel.includes('main:' + k) ? 'on' : ''}" draggable="true" data-fc="main:${k}" data-act="fcTog" data-k="main:${k}">${C().mainIcon(k)} ${k}</button>`)}</div>
    <div class="row" style="margin-bottom:10px"><span class="card-sub">Drill into</span><select class="sel" id="fcSub" style="max-width:220px"><option value="">— category —</option>${mains.map(k => BP.h`<option ${fc.sub === k ? 'selected' : ''}>${k}</option>`)}</select>
      ${subs.map(s => BP.h`<button class="chip ${fc.sel.includes('sub:' + s) ? 'on' : ''}" draggable="true" data-fc="sub:${s}" data-act="fcTog" data-k="sub:${s}">${s}</button>`)}</div>
    <div class="dropzone" id="fcDrop">${fc.sel.length ? BP.ui.canvas('fBuild', 300) : BP.h`<div class="center muted" style="padding:44px 10px">⬇ Drop a chip here or click one above to start plotting</div>`}</div>
  </div>`);
  const pal = CH().palette();
  BP.charts.make('fProj', () => ({ type: 'line', data: { labels, datasets: [
    { label: 'Liquid balance', data: [...hist.map(() => null), ...proj], borderColor: CH().css('--accent'), backgroundColor: gradFill('--accent', .3), fill: true, tension: .3, pointRadius: 3, borderWidth: 2.6 },
    { label: 'Pessimistic', data: [...hist.map(() => null), ...lowP], borderColor: CH().css('--red'), borderDash: [4, 4], pointRadius: 0, borderWidth: 1.4, fill: false },
    { label: 'Optimistic', data: [...hist.map(() => null), ...hiP], borderColor: CH().css('--green'), borderDash: [4, 4], pointRadius: 0, borderWidth: 1.4, fill: false },
    { label: 'Actual free cash', type: 'bar', data: [...hist.map(m => c.freeCash(m)), ...future.map(() => null)], backgroundColor: CH().hexA(CH().css('--blue'), .6), borderRadius: 5 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
  if (fc.sel.length){
    BP.charts.make('fBuild', () => ({ type: 'line', data: { labels: bm.map(m => BP.monthShort(m) + " '" + m.slice(2, 4)), datasets: fc.sel.map((k, i) => { let d = fcSeries(k, bm); if (fc.mode === 'cumulative'){ let s = 0; d = d.map(v => (s += v)); } return { label: k.replace(/^(main|sub):/, ''), data: d, borderColor: pal[i % pal.length], backgroundColor: CH().hexA(pal[i % pal.length], .12), tension: .3, pointRadius: 3, borderWidth: 2.4, fill: fc.sel.length === 1 }; }) },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
  }
  // drag & drop
  el.querySelectorAll('[draggable]').forEach(b => b.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', b.dataset.fc)));
  const dz = BP.$('#fcDrop', el);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); }); dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); const k = e.dataTransfer.getData('text/plain'); if (k && !fc.sel.includes(k)) fc.sel.push(k); BP.app.renderView(true); });
};
Object.assign(BP.views.dash.actions, {
  fcMode(el){ fc.mode = el.dataset.v; BP.app.renderView(true); }, fcSrc(el){ fc.src = el.dataset.v; BP.app.renderView(true); }, fcClear(){ fc.sel = []; BP.app.renderView(true); },
  fcTog(el){ const k = el.dataset.k, i = fc.sel.indexOf(k); if (i >= 0) fc.sel.splice(i, 1); else fc.sel.push(k); BP.app.renderView(true); }
});
BP.views.dash.onChange = e => { if (e.target.id === 'fcSub'){ fc.sub = e.target.value; BP.app.renderView(true); } };

/* ============================ INSIGHTS ============================ */
T.insights = function(el){
  const c = C(), m = BP.ui.month, prev = BP.addMonths(m, -1), exps = c.expOf(m).filter(e => e.type === 'Spendable');
  const spent = BP.sum(exps, e => e.amount), pSpent = c.spentSP(prev);
  const ins = [];
  if (pSpent && spent){ const d = (spent - pSpent) / pSpent * 100; ins.push([d > 10 ? 'warn' : d < -10 ? 'good' : 'info', `${d > 0 ? '📈' : '📉'} Spending is <b>${Math.abs(d).toFixed(0)}% ${d > 0 ? 'higher' : 'lower'}</b> than ${BP.fmtMonth(prev)} (${BP.fmt(spent)} vs ${BP.fmt(pSpent)} SAR).`]); }
  const byMain = Object.entries(c.spentBy(m, 'Spendable', 'main')).sort((a, b) => b[1] - a[1]);
  if (byMain[0]) ins.push(['info', `🏆 Biggest category: <b>${byMain[0][0]}</b> — ${BP.fmt(byMain[0][1])} SAR (${(byMain[0][1] / spent * 100).toFixed(0)}% of spending).`]);
  const over = c.cats().filter(x => x.type === 'Spendable').map(x => ({ x, b: c.budgetOf(m, x.sub), s: BP.sum(exps.filter(e => e.sub === x.sub), e => e.amount) })).filter(r => r.b > 0 && r.s > r.b).sort((a, b) => (b.s - b.b) - (a.s - a.b));
  over.slice(0, 4).forEach(r => ins.push(['bad', `🚨 <b>${r.x.sub}</b> is over budget by ${BP.fmt(r.s - r.b)} SAR (${BP.fmt(r.s)} of ${BP.fmt(r.b)}).`]));
  const daily = c.dailySpend(m, 'Spendable'), mxd = Math.max(...daily, 0); if (mxd > 0) ins.push(['info', `📅 Heaviest day: <b>${m}-${String(daily.indexOf(mxd) + 1).padStart(2, '0')}</b> with ${BP.fmt(mxd)} SAR.`]);
  const wkend = BP.sum(exps.filter(e => [5, 6].includes(BP.parseDate(e.date).getDay())), e => e.amount); if (spent) ins.push([wkend / spent > .4 ? 'warn' : 'info', `🛍️ Weekend (Fri–Sat) spending is <b>${(wkend / spent * 100).toFixed(0)}%</b> of the month.`]);
  const maybe = BP.sum(exps.filter(e => (c.cat(e.sub) || {}).necessity === 'Maybe'), e => e.amount); if (spent && maybe) ins.push(['info', `⚖️ <b>${(maybe / spent * 100).toFixed(0)}%</b> (${BP.fmt(maybe)} SAR) went to “Maybe” items — the easiest place to save.`]);
  const free = c.freeCash(m); ins.push([free >= 0 ? 'good' : 'bad', free >= 0 ? `✅ You're on course to keep <b>${BP.fmt(free)} SAR</b> this month.` : `⚠️ Spending exceeds the free pool by <b>${BP.fmt(-free)} SAR</b>.`]);

  // leaks: small frequent
  const grp = {}; c.exps().filter(e => e.type === 'Spendable' && e.month <= m).forEach(e => { const k = e.sub; (grp[k] = grp[k] || { n: 0, t: 0, months: new Set() }); grp[k].n++; grp[k].t += e.amount; grp[k].months.add(e.month); });
  const leaks = Object.entries(grp).filter(([, g]) => g.n >= 4 && g.t / g.n < 80).map(([k, g]) => ({ k, n: g.n, t: g.t, avg: g.t / g.n, perMonth: g.t / Math.max(1, g.months.size) })).sort((a, b) => b.t - a.t).slice(0, 6);
  const topSubs = Object.entries(grp).sort((a, b) => b[1].t - a[1].t).slice(0, 8);
  BP.mount(el, BP.h`${BP.ui.monthStrip(c.months(), m)}
  <div class="grid g2" style="margin-top:8px">
    <div class="card"><div class="card-h"><div class="card-t big">💡 Auto insights</div><span class="card-sub">${BP.fmtMonth(m)}</span></div>${spent || free ? ins.map(i => BP.h`<div class="insight ${i[0]}">${BP.raw(i[1])}</div>`) : BP.ui.empty('💡', 'Add expenses to unlock insights')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">💧 Spending leaks</div><span class="card-sub">small & frequent</span></div>
      ${leaks.length ? leaks.map(l => BP.h`<div class="leak"><div class="grow"><b>${l.k}</b><div class="card-sub">${l.n} purchases · avg ${BP.fmt(l.avg)} SAR</div></div><div class="right"><b class="num m-num" style="color:var(--amber)">${BP.fmt(l.t)}</b><div class="card-sub">≈ ${BP.fmt(l.perMonth)} / mo</div></div></div>`) : BP.ui.empty('✨', 'No obvious leaks — nothing small and frequent')}
      <div class="card-sub" style="margin-top:10px">Leaks = categories with 4+ small purchases (&lt; 80 SAR each). They hide in plain sight.</div></div>
    <div class="card span2"><div class="card-h"><div class="card-t big">Top sub-categories</div><span class="card-sub">all-time up to ${BP.fmtMonth(m)}</span></div>${topSubs.length ? BP.ui.canvas('iTop', 60 + topSubs.length * 30) : BP.ui.empty('🏷️', 'No data')}</div>
  </div>`);
  if (topSubs.length) BP.charts.make('iTop', () => ({ type: 'bar', data: { labels: topSubs.map(x => x[0]), datasets: [{ data: topSubs.map(x => x[1].t), backgroundColor: topSubs.map((x, i) => CH().palette()[i % 8]), borderRadius: 7 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, valueLabels: { show: true, horizontal: true }, tooltip: { callbacks: { label: x => ` ${BP.fmt(x.parsed.x)} SAR · ${topSubs[x.dataIndex][1].n} purchases` } } }, scales: { x: { ...CH().scales().y, ticks: { callback: v => BP.fmtK(v) } }, y: { grid: { display: false }, border: { display: false } } } } }));
};
})();
