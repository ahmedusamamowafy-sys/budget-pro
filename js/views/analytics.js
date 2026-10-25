/* Budget Pro — Charts / Analytics tab */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;
const st = { type: 'Spendable', main: '', from: null, to: null, view: 'main' };

BP.views.charts = {
  render(el){
    const c = C(), m = BP.ui.month, all = c.dataMonths(); const cur = BP.ymNow();
    const ms = all.length ? all : [m]; st.to = st.to && ms.includes(st.to) ? st.to : ms[ms.length - 1]; st.from = st.from && ms.includes(st.from) ? st.from : ms[Math.max(0, ms.length - 6)];
    if (st.from > st.to) st.from = st.to;
    const range = ms.filter(x => x >= st.from && x <= st.to);
    const T = st.type === 'All' ? null : st.type;
    const mains = c.mains();
    const budFor = (mm, k) => c.mainBudget(mm, k, T);
    const spFor = (mm, k) => BP.sum(c.expOf(mm).filter(e => e.main === k && (!T || e.type === T)), e => e.amount);
    const rows = mains.filter(k => !st.main || k === st.main).map(k => ({ k, bud: BP.sum(range, mm => budFor(mm, k)), sp: BP.sum(range, mm => spFor(mm, k)) })).filter(r => r.bud || r.sp);
    const totB = BP.sum(rows, r => r.bud), totS = BP.sum(rows, r => r.sp);
    const subAgg = {}; range.forEach(mm => c.expOf(mm).filter(e => (!T || e.type === T) && (!st.main || e.main === st.main)).forEach(e => { (subAgg[e.sub] = subAgg[e.sub] || { t: 0, n: 0, main: e.main }); subAgg[e.sub].t += e.amount; subAgg[e.sub].n++; }));
    const subs = Object.entries(subAgg).sort((a, b) => b[1].t - a[1].t).slice(0, 12);
    const opt = (v, sel, l) => BP.h`<option value="${v}" ${v === sel ? 'selected' : ''}>${l || v}</option>`;
    BP.mount(el, BP.h`
    <div class="card" style="margin-bottom:16px"><div class="row wrap" style="gap:14px">
      <div class="field" style="min-width:130px"><label>Type</label><select class="sel" id="an-type">${['Spendable', 'Saving Box', 'All'].map(v => opt(v, st.type))}</select></div>
      <div class="field" style="min-width:150px"><label>Category</label><select class="sel" id="an-main"><option value="">All categories</option>${mains.map(v => opt(v, st.main))}</select></div>
      <div class="field" style="min-width:130px"><label>From</label><select class="sel" id="an-from">${ms.map(v => opt(v, st.from, BP.fmtMonth(v)))}</select></div>
      <div class="field" style="min-width:130px"><label>To</label><select class="sel" id="an-to">${ms.map(v => opt(v, st.to, BP.fmtMonth(v)))}</select></div>
    </div></div>
    <div class="grid g4 keep2">
      ${BP.ui.kpi({ label: 'Budgeted', value: BP.fmt(totB), mask: 'sal', color: 'var(--blue)', foot: `${range.length} month${range.length === 1 ? '' : 's'}` })}
      ${BP.ui.kpi({ label: 'Spent', value: BP.fmt(totS), color: 'var(--red)', foot: BP.pct(totS, totB) + ' of budget' })}
      ${BP.ui.kpi({ label: 'Difference', value: BP.signed(totB - totS), valColor: totB - totS >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--green)', foot: totB - totS >= 0 ? 'under budget' : 'over budget' })}
      ${BP.ui.kpi({ label: 'Avg / month', value: BP.fmt(range.length ? totS / range.length : 0), color: 'var(--accent)', foot: 'actual spend' })}
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><div class="card-t big">Budget vs spent</div></div>${rows.length ? BP.ui.canvas('anBvS', 300) : BP.ui.empty('📊', 'No data for this selection')}</div>
      <div class="card"><div class="card-h"><div class="card-t big">Share of spending</div></div>${totS ? BP.ui.canvas('anShare', 300) : BP.ui.empty('🍩', 'No spending in range')}</div>
      <div class="card span2"><div class="card-h"><div class="card-t big">Trend by month</div><span class="card-sub">stacked by category</span></div>${range.length ? BP.ui.canvas('anTrend', 300) : ''}</div>
      <div class="card span2"><div class="card-h"><div class="card-t big">Top sub-categories</div></div>${subs.length ? BP.ui.canvas('anSubs', 60 + subs.length * 30) : BP.ui.empty('🏷️', 'No data')}</div>
      <div class="card span2 pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th class="r">Budget</th><th class="r">Spent</th><th class="r">Diff</th><th style="width:28%">Used</th></tr></thead><tbody>
        ${rows.map(r => { const p = r.bud ? r.sp / r.bud * 100 : (r.sp ? 100 : 0), col = r.bud && r.sp > r.bud ? 'var(--red)' : p > 80 ? 'var(--amber)' : 'var(--green)'; return BP.h`<tr><td>${C().mainIcon(r.k)} <b>${r.k}</b></td><td class="r num m-sal">${BP.fmt(r.bud)}</td><td class="r num m-num">${BP.fmt(r.sp)}</td><td class="r num ${r.bud - r.sp >= 0 ? 'up' : 'down'}">${BP.signed(r.bud - r.sp)}</td><td><div class="bar"><i style="width:${Math.min(100, p)}%;background:${col}"></i></div></td></tr>`; })}
        ${rows.length ? BP.h`<tr style="font-weight:700"><td>Total</td><td class="r num m-sal">${BP.fmt(totB)}</td><td class="r num m-num">${BP.fmt(totS)}</td><td class="r num ${totB - totS >= 0 ? 'up' : 'down'}">${BP.signed(totB - totS)}</td><td></td></tr>` : BP.h`<tr><td colspan="5" class="center muted" style="padding:24px">No data</td></tr>`}
      </tbody></table></div></div>
    </div>`);
    if (rows.length) BP.charts.make('anBvS', () => ({ type: 'bar', data: { labels: rows.map(r => r.k), datasets: [{ label: 'Budget', data: rows.map(r => r.bud), backgroundColor: CH().hexA(CH().css('--blue'), .55), borderRadius: 6 }, { label: 'Spent', data: rows.map(r => r.sp), backgroundColor: rows.map(r => r.bud && r.sp > r.bud ? CH().css('--red') : CH().css('--accent')), borderRadius: 6 }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales({ rot: 30 }) } }));
    if (totS){ const sr = rows.filter(r => r.sp).sort((a, b) => b.sp - a.sp);
      BP.charts.make('anShare', () => ({ type: 'doughnut', data: { labels: sr.map(r => r.k), datasets: [{ data: sr.map(r => r.sp), backgroundColor: sr.map(r => C().mainColor(r.k)), borderColor: CH().css('--card'), borderWidth: 3, hoverOffset: 8 }] },
        options: { cutout: '66%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } }, centerText: { text: BP.fmtK(totS), sub: 'SAR', size: 22 }, tooltip: { callbacks: { label: x => ` ${x.label}: ${BP.fmt(x.parsed)} (${(x.parsed / totS * 100).toFixed(0)}%)` } } } } })); }
    if (range.length){ const mk = [...new Set(range.flatMap(mm => c.expOf(mm).filter(e => !T || e.type === T).map(e => e.main)))].filter(k => !st.main || k === st.main);
      BP.charts.make('anTrend', () => ({ type: 'bar', data: { labels: range.map(mm => BP.monthShort(mm) + " '" + mm.slice(2, 4)), datasets: [...mk.map(k => ({ label: k, data: range.map(mm => spFor(mm, k)), backgroundColor: C().mainColor(k), stack: 's', borderRadius: 3 })), { type: 'line', label: 'Budget', data: range.map(mm => BP.sum(mk, k => budFor(mm, k))), borderColor: CH().css('--text'), borderDash: [5, 4], pointRadius: 3, borderWidth: 1.8, fill: false, order: 0 }] },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: CH().tipMoney }, scales: { ...CH().scales(), x: { ...CH().scales().x, stacked: true }, y: { ...CH().scales().y, stacked: true } } } })); }
    if (subs.length) BP.charts.make('anSubs', () => ({ type: 'bar', data: { labels: subs.map(x => x[0]), datasets: [{ data: subs.map(x => x[1].t), backgroundColor: subs.map(x => C().mainColor(x[1].main)), borderRadius: 7 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${BP.fmt(x.parsed.x)} SAR · ${subs[x.dataIndex][1].n} purchases` } } }, scales: { x: { ...CH().scales().y, ticks: { callback: v => BP.fmtK(v) } }, y: { grid: { display: false }, border: { display: false } } } } }));
  },
  onChange(e){
    const id = e.target.id; if (!id.startsWith('an-')) return;
    st[id.slice(3)] = e.target.value; BP.app.renderView(true);
  },
  actions: {}
};
})();
