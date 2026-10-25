/* Budget Pro — data mutations (every write to the database goes through here) */
(function(){
'use strict';
const BP = window.BP;
const D = () => BP.db();
const A = BP.actions = {};

A.who = () => (BP.auth.user && BP.auth.user.name) || 'Unknown';

A.addExpense = function(o){
  const c = BP.calc.cat(o.sub); const date = o.date || BP.today();
  const e = { id: 'x' + BP.uid(), date, month: date.slice(0, 7), sub: o.sub, main: c ? c.main : (o.main || 'Other'), category: c ? c.category : (o.category || o.main || 'Other'),
    type: c ? c.type : (o.type || 'Spendable'), amount: Number(o.amount), desc: (o.desc || '').trim(), pay: o.pay || D().payMethods[0], addedBy: o.addedBy || A.who(), createdAt: new Date().toISOString() };
  D().expenses.unshift(e); BP.store.persist(); return e;
};
A.updateExpense = function(id, o){
  const e = D().expenses.find(x => x.id === id); if (!e) return;
  const c = BP.calc.cat(o.sub || e.sub);
  Object.assign(e, { sub: o.sub || e.sub, amount: Number(o.amount), date: o.date, month: o.date.slice(0, 7), pay: o.pay, desc: (o.desc || '').trim(), main: c ? c.main : e.main, category: c ? c.category : e.category, type: c ? c.type : e.type });
  BP.store.persist(); return e;
};
A.deleteExpense = id => { D().expenses = D().expenses.filter(e => e.id !== id); BP.store.persist(); };
A.clearMonth = m => { const n = D().expenses.filter(e => e.month === m).length; D().expenses = D().expenses.filter(e => e.month !== m); BP.store.persist(); return n; };

/* ----- categories ----- */
A.addCat = function(o){
  if (D().categories.some(c => c.sub.toLowerCase() === o.sub.toLowerCase())) return false;
  D().categories.push({ main: o.main, category: o.category || o.main, sub: o.sub, type: o.type, necessity: o.necessity || 'Maybe', payType: o.payType || 'Monthly Instalment' });
  D().defaultBudgets[o.sub] = Number(o.budget) || 0; BP.store.persist(); return true;
};
A.renameCat = function(old, nn){
  const d = D(); const c = d.categories.find(x => x.sub === old); if (!c || d.categories.some(x => x.sub === nn)) return false;
  c.sub = nn; d.expenses.forEach(e => { if (e.sub === old) e.sub = nn; });
  Object.values(d.plans).forEach(p => { if (p.budgets && old in p.budgets){ p.budgets[nn] = p.budgets[old]; delete p.budgets[old]; } });
  if (old in d.defaultBudgets){ d.defaultBudgets[nn] = d.defaultBudgets[old]; delete d.defaultBudgets[old]; }
  d.settings.essentialCats = d.settings.essentialCats.map(s => s === old ? nn : s);
  d.quickAdd.forEach(q => { if (q.sub === old) q.sub = nn; }); d.recurring.forEach(r => { if (r.sub === old) r.sub = nn; });
  BP.store.persist(); return true;
};
A.updateCat = function(sub, patch){ const c = BP.calc.cat(sub); if (!c) return; Object.assign(c, patch);
  if (patch.main) D().expenses.forEach(e => { if (e.sub === sub){ e.main = c.main; } });
  if (patch.type) D().expenses.forEach(e => { if (e.sub === sub) e.type = c.type; }); BP.store.persist(); };
A.deleteCat = function(sub){ D().categories = D().categories.filter(c => c.sub !== sub); BP.store.persist(); };

/* ----- budget plans ----- */
A.savePlan = function(m, o){ D().plans[m] = { _salary: Number(o.salary) || 0, _investments: Number(o.invest) || 0, budgets: o.budgets, saved: true }; BP.store.persist(); };
A.deletePlan = function(m){ delete D().plans[m]; BP.store.persist(); };
A.copyPlan = function(from, to, o){ const src = BP.calc.planFor(from); D().plans[to] = { _salary: Number(o.salary) || 0, _investments: Number(o.invest) || 0, budgets: { ...src.budgets }, saved: true }; BP.store.persist(); };

/* ----- recurring ----- */
A.advance = function(iso, f){ const d = BP.parseDate(iso);
  if (f === 'weekly') d.setDate(d.getDate() + 7); else if (f === 'quarterly') d.setMonth(d.getMonth() + 3); else if (f === 'annual') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
  return BP.toISO(d); };
A.processRecurring = function(){
  const today = BP.today(); let n = 0;
  D().recurring.forEach(r => { if (r.active === false || !r.autoAdd || !r.nextDue) return; let g = 0;
    while (r.nextDue <= today && g < 24){ A.addExpense({ date: r.nextDue, sub: r.sub, amount: r.amount, pay: r.pay, desc: `${r.name} (recurring)` }); r.nextDue = A.advance(r.nextDue, r.frequency); n++; g++; } });
  if (n){ BP.store.persist(); BP.toast(`🔁 ${n} recurring expense${n > 1 ? 's' : ''} added`, 'ok'); }
  return n;
};

/* ----- import ----- */
A.importRows = function(rows){
  const stamp = new Date().toISOString(); let i = 0;
  rows.forEach(r => { const c = BP.calc.cat(r.sub);
    D().expenses.unshift({ id: 'x' + BP.uid() + (i++), date: r.date, month: r.date.slice(0, 7), sub: r.sub, main: c ? c.main : r.main || 'Other', category: c ? c.category : r.main || 'Other', type: c ? c.type : (r.type || 'Spendable'), amount: r.amount, desc: r.desc || '', pay: r.pay || D().payMethods[0], addedBy: A.who(), createdAt: stamp });
    if (r.pay && !D().payMethods.includes(r.pay)) D().payMethods.push(r.pay);
  });
  BP.store.persist(); return rows.length;
};

/* ----- helpers used by forms ----- */
A.catOptions = function(selected, opts){
  opts = opts || {}; const sp = BP.calc.groupByMain(BP.calc.catsOf('Spendable')), sb = BP.calc.groupByMain(BP.calc.catsOf('Saving Box'));
  const o = c => BP.h`<option value="${c.sub}" ${c.sub === selected ? BP.raw('selected') : ''}>${c.sub}</option>`;
  return BP.h`${opts.placeholder === false ? '' : BP.h`<option value="">Select category…</option>`}
    ${Object.entries(sp).map(([m, l]) => BP.h`<optgroup label="${BP.calc.mainIcon(m)} ${m}">${l.map(o)}</optgroup>`)}
    ${Object.entries(sb).map(([m, l]) => BP.h`<optgroup label="📦 Saving · ${m}">${l.map(o)}</optgroup>`)}`;
};
A.payChips = (selected, name) => BP.h`<div class="chips" data-pay-group="${name || 'pay'}">${D().payMethods.map(p => BP.h`<button type="button" class="chip ${p === selected ? 'on' : ''}" data-pay="${p}">${p}</button>`)}</div>`;
A.catStatus = function(sub, month){
  const c = BP.calc.cat(sub); if (!c) return null; const budget = BP.calc.budgetOf(month, sub);
  const spent = BP.sum(D().expenses.filter(e => e.month === month && e.sub === sub), e => e.amount);
  return { cat: c, budget, spent, left: budget - spent, pct: budget ? spent / budget * 100 : null };
};
})();
