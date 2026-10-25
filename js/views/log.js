/* Budget Pro — Expense log */
(function(){
'use strict';
const BP = window.BP;
const st = { q: '', sort: 'date', dir: 'desc', f: { type: null, pay: null, main: null, sub: null }, collapsed: { Spendable: false, 'Saving Box': false } };

function filtered(){
  const m = BP.ui.month; let list = BP.calc.expOf(m);
  const base = list;
  ['type', 'pay', 'main', 'sub'].forEach(k => { if (st.f[k]) list = list.filter(e => e[k] === st.f[k]); });
  if (st.q){ const q = st.q.toLowerCase(); list = list.filter(e => [e.sub, e.desc, e.main, e.pay, e.date, String(e.amount), e.addedBy].some(v => String(v || '').toLowerCase().includes(q))); }
  list = list.slice().sort((a, b) => st.sort === 'amount' ? (st.dir === 'asc' ? a.amount - b.amount : b.amount - a.amount) : (st.dir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return { list, base };
}
const chipRow = (label, key, vals, fmt) => vals.length > 1 ? BP.h`<div class="row wrap" style="gap:6px;margin-bottom:6px"><span class="card-sub" style="min-width:42px">${label}</span>${vals.map(v => BP.h`<button class="chip ${st.f[key] === v ? 'on' : ''}" data-act="filter" data-k="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`)}</div>` : '';

BP.views.log = {
  render(el){
    const m = BP.ui.month, months = BP.calc.months(), canEdit = BP.auth.canEdit('log');
    const { list, base } = filtered();
    const totSP = BP.sum(base.filter(e => e.type === 'Spendable'), e => e.amount), totSB = BP.sum(base.filter(e => e.type === 'Saving Box'), e => e.amount);
    let subBase = base; ['type', 'pay', 'main'].forEach(k => { if (st.f[k]) subBase = subBase.filter(e => e[k] === st.f[k]); });
    const uniq = (arr, k) => [...new Set(arr.map(e => e[k]).filter(Boolean))];
    const hasF = Object.values(st.f).some(Boolean);
    const groups = ['Spendable', 'Saving Box'].map(t => ({ t, items: list.filter(e => e.type === t) })).filter(g => g.items.length);
    BP.mount(el, BP.h`
    ${BP.ui.monthStrip(months, m)}
    <div class="grid g3 keep2" style="margin:6px 0 16px">
      ${BP.ui.kpi({ label: 'Showing', value: BP.fmt(BP.sum(list, e => e.amount)), foot: `${list.length} of ${base.length} entries`, color: 'var(--accent)' })}
      ${BP.ui.kpi({ label: 'Spendable', value: BP.fmt(totSP), color: 'var(--green)', foot: 'logged this month' })}
      ${BP.ui.kpi({ label: 'Saving Box', value: BP.fmt(totSB), color: 'var(--purple)', foot: 'drawn from boxes' })}
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card-h"><div class="card-t">Daily spending · ${BP.fmtMonth(m)}</div></div>${BP.ui.canvas('logDaily', 150)}</div>
    <div class="card">
      <div class="row wrap" style="margin-bottom:12px">
        <div class="row grow search-box" style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:0 12px;min-width:200px;gap:6px">${BP.icon('search')}<input id="l-q" value="${st.q}" placeholder="Search description, category, card, amount…" style="flex:1;background:none;border:none;outline:none;padding:9px 4px;color:var(--text);font-size:13px"></div>
        <div class="seg"><button data-act="sort" data-k="date" class="${st.sort === 'date' ? 'on' : ''}">Date ${st.sort === 'date' ? (st.dir === 'asc' ? '↑' : '↓') : ''}</button><button data-act="sort" data-k="amount" class="${st.sort === 'amount' ? 'on' : ''}">Amount ${st.sort === 'amount' ? (st.dir === 'asc' ? '↑' : '↓') : ''}</button></div>
        ${hasF ? BP.h`<button class="btn sm danger" data-act="clearF">✕ Clear filters</button>` : ''}
      </div>
      ${chipRow('Type', 'type', uniq(base, 'type'))}${chipRow('Pay', 'pay', uniq(base, 'pay'))}${chipRow('Cat', 'main', uniq(base, 'main'), v => BP.calc.mainIcon(v) + ' ' + v)}${chipRow('Sub', 'sub', uniq(subBase, 'sub'))}
      <div class="sp"></div>
      ${!groups.length ? BP.ui.empty('📭', `No expenses for ${BP.fmtMonth(m)}${hasF || st.q ? ' with these filters' : ''}`) : groups.map(g => BP.h`
        <div class="row between" data-act="toggle" data-t="${g.t}" style="cursor:pointer;padding:10px 4px;border-bottom:1px solid var(--border)">
          <div class="row"><b>${g.t === 'Spendable' ? '💸 Spendable' : '📦 Saving Boxes'}</b><span class="tag">${g.items.length}</span></div>
          <div class="row"><b class="num m-sal">${BP.fmt(BP.sum(g.items, e => e.amount))} SAR</b><span class="muted">${st.collapsed[g.t] ? '▶' : '▼'}</span></div></div>
        <div class="list ${st.collapsed[g.t] ? 'hidden' : ''}">${g.items.map(e => BP.h`<div class="li">
          <div class="li-ic" style="background:${BP.charts.hexA(BP.calc.mainColor(e.main), .16)}">${BP.calc.mainIcon(e.main)}</div>
          <div class="li-main"><div class="li-t">${e.sub}</div><div class="li-s">${BP.fmtDate(e.date)}${e.desc ? ' · ' + e.desc : ''}</div>${e.seed ? BP.h`<div class="li-s faint" style="font-size:10.5px">📥 Excel v8.1</div>` : e.createdAt || e.addedBy ? BP.h`<div class="li-s faint" style="font-size:10.5px">${e.createdAt ? BP.fmtDT(e.createdAt) : ''}${e.createdAt && e.addedBy ? ' · ' : ''}${e.addedBy || ''}${e.demo ? ' · demo' : ''}</div>` : ''}</div>
          <div class="right"><div class="li-v m-num">${BP.fmt(e.amount)}</div><span class="tag">${e.pay}</span></div>
          ${canEdit ? BP.h`<div class="li-act"><button class="icon-btn" style="width:32px;height:32px" data-act="edit" data-id="${e.id}" title="Edit">${BP.icon('edit')}</button><button class="icon-btn" style="width:32px;height:32px;color:var(--red)" data-act="del" data-id="${e.id}" title="Delete">${BP.icon('x')}</button></div>` : ''}
        </div>`)}</div>`)}
    </div>`);
    const daily = BP.calc.dailySpend(m, null);
    BP.charts.make('logDaily', () => ({ type: 'bar', data: { labels: daily.map((_, i) => i + 1), datasets: [{ label: 'Spent', data: daily, backgroundColor: BP.charts.css('--accent'), borderRadius: 5, maxBarThickness: 18 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => `${BP.MN[+m.slice(5) - 1]} ${i[0].label}`, label: c => ` ${BP.fmt(c.parsed.y)} SAR` } } }, scales: BP.charts.scales() } }));
  },
  onInput(e){ if (e.target.id === 'l-q'){ const pos = e.target.selectionStart; st.q = e.target.value; BP.app.renderView(true); const i = BP.$('#l-q'); i.focus(); i.setSelectionRange(pos, pos); } },
  actions: {
    sort(el){ const k = el.dataset.k; if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = 'desc'; } BP.app.renderView(true); },
    filter(el){ const { k, v } = el.dataset; st.f[k] = st.f[k] === v ? null : v; if (k !== 'sub') st.f.sub = null; BP.app.renderView(true); },
    clearF(){ st.f = { type: null, pay: null, main: null, sub: null }; st.q = ''; BP.app.renderView(true); },
    toggle(el){ st.collapsed[el.dataset.t] = !st.collapsed[el.dataset.t]; BP.app.renderView(true); },
    edit(el, ev){ ev.stopPropagation(); BP.editExpense(el.dataset.id); },
    del(el, ev){ ev.stopPropagation(); BP.deleteExpenseConfirm(el.dataset.id); }
  }
};
})();
