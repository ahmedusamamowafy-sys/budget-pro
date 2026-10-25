/* Budget Pro — spreadsheet view: every month's Plan vs Spent per category, with total balance (Spendable or Saving Boxes) */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;

function sheetMonths(){
  const c = C(), set = new Set([...c.planMonths(), ...c.dataMonths()]); return [...set].sort();
}
const dash = v => v ? BP.fmt(v) : '–';

/* Render the sheet for one type into el. */
BP.sheetView = function(el, type){
  const c = C(), ms = sheetMonths(), can = BP.auth.canEdit('budget');
  const cats = c.catsOf(type), groups = c.groupByMain(cats);
  const plan = (m, sub) => c.budgetOf(m, sub), spent = (m, sub) => BP.sum(c.expOf(m).filter(e => e.sub === sub && e.type === type), e => e.amount);
  const mPlan = m => BP.sum(cats, x => plan(m, x.sub)), mSpent = m => BP.sum(c.expOf(m).filter(e => e.type === type), e => e.amount);
  const totP = BP.sum(ms, mPlan), totS = BP.sum(ms, mSpent), bal = totP - totS;
  const color = type === 'Saving Box' ? 'var(--purple)' : 'var(--green)';
  const cell = (m, x) => { const p = plan(m, x.sub), s = spent(m, x.sub);
    return BP.h`<td class="r num pl ${can ? 'edit' : ''}" ${can ? BP.raw(`data-act="sheetEdit" data-m="${m}" data-sub="${BP.esc(x.sub)}"`) : ''} title="${can ? 'Click to edit plan' : ''}">${dash(p)}</td><td class="r num sp ${s && s > p ? 'over' : ''}">${s ? '−' + BP.fmt(s) : '–'}</td>`; };
  BP.mount(el, BP.h`
  <div class="grid g3 keep2" style="margin-top:4px">
    ${BP.ui.kpi({ label: 'Planned', value: BP.fmt(totP), mask: 'sal', color, foot: `${ms.length} months · ${cats.length} categories` })}
    ${BP.ui.kpi({ label: 'Spent', value: BP.fmt(totS), color: 'var(--red)', foot: BP.pct(totS, totP) + ' of plan' })}
    ${BP.ui.kpi({ label: 'Balance', value: BP.signed(bal), valColor: bal >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--accent)', foot: bal >= 0 ? 'left in the pot' : 'overspent overall' })}
  </div>
  <div class="card" style="margin-top:14px"><div class="card-h"><div class="card-t big">Plan vs spent by month</div><span class="card-sub">${type === 'Saving Box' ? 'saving boxes' : 'spendable'}</span></div>${ms.length ? BP.ui.canvas('shBar', 210) : ''}</div>
  <div class="row between" style="margin:14px 2px 8px"><span class="card-sub">${can ? '✏️ Click any Plan cell to edit · ' : ''}Spent comes from the Log (${type} type)</span></div>
  <div class="card pad0"><div class="tbl-wrap sheet-wrap"><table class="tbl sheet">
    <thead><tr><th rowspan="2" class="sticky-col">Category</th>${ms.map(m => BP.h`<th colspan="2" class="center mh">${BP.fmtMonth(m)}</th>`)}<th rowspan="2" class="r bal-h">Total balance</th></tr>
      <tr>${ms.map(() => BP.h`<th class="r pl-h">Plan</th><th class="r sp-h">Spent</th>`)}</tr></thead>
    <tbody>
      <tr class="gt"><td class="sticky-col">Grand total</td>${ms.map(m => { const p = mPlan(m), s = mSpent(m); return BP.h`<td class="r num pl">${dash(p)}</td><td class="r num sp ${s > p ? 'over' : ''}">${s ? '−' + BP.fmt(s) : '–'}</td>`; })}<td class="r num bal ${bal >= 0 ? 'up' : 'down'}">${BP.signed(bal)}</td></tr>
      ${Object.entries(groups).map(([main, items]) => {
        const gP = BP.sum(ms, m => BP.sum(items, x => plan(m, x.sub))), gS = BP.sum(ms, m => BP.sum(items, x => spent(m, x.sub)));
        return BP.h`<tr class="grp"><td class="sticky-col">${C().mainIcon(main)} ${main}</td><td colspan="${ms.length * 2}"></td><td class="r num ${gP - gS >= 0 ? 'up' : 'down'}">${BP.signed(gP - gS)}</td></tr>
        ${items.map(x => { const P = BP.sum(ms, m => plan(m, x.sub)), S = BP.sum(ms, m => spent(m, x.sub)), b = P - S;
          return BP.h`<tr><td class="sticky-col"><div class="nm">${x.sub}</div><div class="faint" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em">${x.main}</div></td>${ms.map(m => cell(m, x))}<td class="r num bal ${b > 0 ? 'up' : b < 0 ? 'down' : ''}">${b ? BP.signed(b) : '0'}</td></tr>`; })}`; })}
    </tbody></table></div></div>`);
  if (ms.length) BP.charts.make('shBar', () => ({ type: 'bar', data: { labels: ms.map(m => BP.monthShort(m) + " '" + m.slice(2, 4)), datasets: [
    { label: 'Plan', data: ms.map(mPlan), backgroundColor: CH().hexA(CH().css(type === 'Saving Box' ? '--purple' : '--green'), .55), borderRadius: 6, maxBarThickness: 46 },
    { label: 'Spent', data: ms.map(mSpent), backgroundColor: ms.map(m => mSpent(m) > mPlan(m) ? CH().css('--red') : CH().css('--accent')), borderRadius: 6, maxBarThickness: 46 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
};

/* Inline plan editing (shared action; registered on views that show a sheet) */
BP.sheetEdit = function(td){
  if (td.querySelector('input')) return;
  const m = td.dataset.m, sub = td.dataset.sub, cur = BP.calc.budgetOf(m, sub);
  td.innerHTML = `<input class="sheet-inp" type="number" step="1" value="${cur || ''}">`; const inp = td.firstChild; inp.focus(); inp.select();
  let done = false;
  const commit = save => {
    if (done) return; done = true;
    if (save){ const v = parseFloat(inp.value) || 0; if (v !== cur){
      const p = BP.calc.planFor(m), d = BP.db();
      if (!d.plans[m]) d.plans[m] = { _salary: p.salary, _investments: p.invest, budgets: { ...p.budgets }, saved: true };
      d.plans[m].budgets[sub] = v; BP.store.persist(); BP.toast(`${sub} · ${BP.fmtMonth(m)} plan → ${BP.fmt(v)} SAR`, 'ok'); BP.app.renderView(true); return; } }
    td.textContent = cur ? BP.fmt(cur) : '–';
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(true); else if (e.key === 'Escape') commit(false); });
  inp.addEventListener('blur', () => commit(true));
};
})();
