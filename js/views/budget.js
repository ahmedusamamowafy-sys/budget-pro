/* Budget Pro — Budget: monthly plan editor, categories, recurring, goals */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;
const st = { sec: 'plan', month: null, draft: null, open: {} };
const SECS = [['plan', '🗓️ Monthly plan'], ['recurring', '🔁 Recurring'], ['goals', '🎯 Goals']];
const NEC = ['Must', 'Maybe'], PT = ['Monthly Instalment', 'Weekly', 'Annual', 'One-time', 'Variable'];

function loadDraft(m){ const p = C().planFor(m); const b = {}; C().cats().forEach(c => { b[c.sub] = Number(p.budgets[c.sub] ?? BP.db().defaultBudgets[c.sub] ?? 0) || 0; }); st.draft = { m, salary: p.salary, invest: p.invest, budgets: b, saved: C().hasPlan(m), from: p.from }; }
function totals(){
  const d = st.draft, cats = C().cats(); const sb = BP.sum(cats.filter(c => c.type === 'Saving Box'), c => d.budgets[c.sub] || 0), sp = BP.sum(cats.filter(c => c.type === 'Spendable'), c => d.budgets[c.sub] || 0);
  return { sb, sp, un: d.salary - sb - d.invest - sp };
}
function paintTotals(){
  const t = totals(), d = st.draft, set = (id, v, col) => { const e = document.getElementById(id); if (e){ e.textContent = v; if (col) e.style.color = col; } };
  set('pl-sb', BP.fmt(t.sb)); set('pl-sp', BP.fmt(t.sp)); set('pl-sb2', BP.fmt(t.sb)); set('pl-sp2', BP.fmt(t.sp)); set('pl-inv', BP.fmt(d.invest)); set('pl-un', BP.fmt(t.un), t.un >= 0 ? 'var(--accent)' : 'var(--red)');
  const fb = document.getElementById('pl-flow'); if (fb) fb.innerHTML = CH().flowBar([{ l: 'Saving Boxes', v: t.sb, c: 'var(--purple)' }, { l: 'Investments', v: d.invest, c: 'var(--blue)' }, { l: 'Spendable', v: t.sp, c: 'var(--green)' }, { l: 'Unallocated', v: Math.max(0, t.un), c: 'var(--accent)' }]).s;
  const w = document.getElementById('pl-warn'); if (w) w.innerHTML = t.un < 0 ? `<div class="status-pill bad">⚠️ Plan exceeds salary by <b>${BP.fmt(-t.un)} SAR</b></div>` : '';
  const chart = Chart.getChart('plDonut'); if (chart){ chart.data.datasets[0].data = [t.sb, d.invest, t.sp, Math.max(0, t.un)]; chart.update('none'); }
}

BP.views.budget = {
  render(el){
    if (st.month !== BP.ui.month || !st.draft){ st.month = BP.ui.month; loadDraft(st.month); }
    BP.mount(el, BP.h`<div class="tabs-sub"><div class="seg">${SECS.map(([k, l]) => BP.h`<button class="${st.sec === k ? 'on' : ''}" data-act="sec" data-k="${k}">${l}</button>`)}</div></div><div id="bgBody"></div>`);
    ({ plan, recurring, goals })[st.sec](BP.$('#bgBody', el));
  },
  onInput(e){
    const t = e.target, d = st.draft; if (!d) return;
    if (t.dataset.bud != null){ d.budgets[t.dataset.bud] = parseFloat(t.value) || 0; paintTotals(); const g = t.closest('[data-grp]'); if (g){ const [gt, gm] = g.dataset.grp.split('|'); const tot = BP.sum(C().cats().filter(c => c.main === gm && c.type === gt), c => d.budgets[c.sub] || 0); const s = g.querySelector('.grp-tot'); if (s) s.textContent = BP.fmt(tot); } }
    else if (t.id === 'pl-salary'){ d.salary = parseFloat(t.value) || 0; paintTotals(); } else if (t.id === 'pl-invest'){ d.invest = parseFloat(t.value) || 0; paintTotals(); }
  },
  actions: {
    sec(el){ st.sec = el.dataset.k; BP.app.renderView(true); },
    toggleGrp(el){ st.open[el.dataset.g] = !(st.open[el.dataset.g] !== false); BP.app.renderView(true); },
    savePlan(){
      if (!BP.auth.canEdit('budget')) return BP.toast('View-only access', 'err');
      BP.actions.savePlan(st.month, { salary: st.draft.salary, invest: st.draft.invest, budgets: { ...st.draft.budgets } }); loadDraft(st.month); BP.toast(`Plan saved for ${BP.fmtMonth(st.month)}`, 'ok'); BP.app.renderView(true);
    },
    resetPlan(){ loadDraft(st.month); BP.app.renderView(true); },
    copyNext(){
      const next = BP.addMonths(st.month, 1);
      BP.modal.confirm(`Copy ${BP.fmtMonth(st.month)}'s plan (salary, investments and all budgets) to ${BP.fmtMonth(next)}? An existing plan there will be replaced.`, () => {
        BP.actions.savePlan(st.month, { salary: st.draft.salary, invest: st.draft.invest, budgets: { ...st.draft.budgets } });
        BP.actions.copyPlan(st.month, next, { salary: st.draft.salary, invest: st.draft.invest }); BP.ui.month = next; BP.toast(`Copied to ${BP.fmtMonth(next)}`, 'ok'); BP.app.refresh();
      }, { okText: 'Copy', danger: false });
    },
    delPlan(){ if (!C().hasPlan(st.month)) return BP.toast('No saved plan for this month', 'err'); BP.modal.confirm(`Delete the saved plan for ${BP.fmtMonth(st.month)}? The month will fall back to the previous plan.`, () => { BP.actions.deletePlan(st.month); loadDraft(st.month); BP.toast('Plan deleted', 'ok'); BP.app.renderView(true); }); },
    addCat(){
      const mains = C().mains();
      BP.modal.open({ title: '➕ New category', body: BP.h`<div class="form-grid">
        <div class="field"><label>Main category</label><input class="inp" id="nc-main" list="ncMains" placeholder="e.g. Welfare"><datalist id="ncMains">${mains.map(x => BP.h`<option value="${x}">`)}</datalist></div>
        <div class="field"><label>Sub-category name</label><input class="inp" id="nc-sub"></div>
        <div class="field"><label>Type</label><select class="sel" id="nc-type"><option>Spendable</option><option>Saving Box</option></select></div>
        <div class="field"><label>Monthly budget (SAR)</label><input class="inp num" id="nc-bud" type="number" value="0"></div>
        <div class="field"><label>Necessity</label><select class="sel" id="nc-nec">${NEC.map(x => BP.h`<option>${x}</option>`)}</select></div>
        <div class="field"><label>Pay type</label><select class="sel" id="nc-pt">${PT.map(x => BP.h`<option>${x}</option>`)}</select></div></div>`,
        onOk(api){ const r = api.root, v = id => BP.$('#' + id, r).value.trim(); if (!v('nc-main') || !v('nc-sub')){ BP.toast('Fill main and sub category', 'err'); return false; }
          if (!BP.actions.addCat({ main: v('nc-main'), sub: v('nc-sub'), type: v('nc-type'), budget: v('nc-bud'), necessity: v('nc-nec'), payType: v('nc-pt') })){ BP.toast('That sub-category already exists', 'err'); return false; }
          loadDraft(st.month); BP.toast('Category added', 'ok'); BP.app.renderView(true); } });
    },
    editCat(el){
      const c = C().cat(el.dataset.sub); if (!c) return; const mains = C().mains();
      BP.modal.open({ title: '✏️ Edit category', body: BP.h`<div class="form-grid">
        <div class="field"><label>Sub-category name</label><input class="inp" id="ec-sub" value="${c.sub}"></div>
        <div class="field"><label>Main category</label><input class="inp" id="ec-main" list="ecMains" value="${c.main}"><datalist id="ecMains">${mains.map(x => BP.h`<option value="${x}">`)}</datalist></div>
        <div class="field"><label>Type</label><select class="sel" id="ec-type">${['Spendable', 'Saving Box'].map(x => BP.h`<option ${x === c.type ? 'selected' : ''}>${x}</option>`)}</select></div>
        <div class="field"><label>Necessity</label><select class="sel" id="ec-nec">${NEC.map(x => BP.h`<option ${x === c.necessity ? 'selected' : ''}>${x}</option>`)}</select></div>
        <div class="field"><label>Pay type</label><select class="sel" id="ec-pt">${PT.map(x => BP.h`<option ${x === c.payType ? 'selected' : ''}>${x}</option>`)}</select></div></div>`,
        onOk(api){ const r = api.root, v = id => BP.$('#' + id, r).value.trim(); const nn = v('ec-sub'); if (!nn || !v('ec-main')) return false;
          if (nn !== c.sub && !BP.actions.renameCat(c.sub, nn)){ BP.toast('Name already used', 'err'); return false; }
          BP.actions.updateCat(nn, { main: v('ec-main'), category: v('ec-main'), type: v('ec-type'), necessity: v('ec-nec'), payType: v('ec-pt') }); loadDraft(st.month); BP.toast('Category updated', 'ok'); BP.app.renderView(true); } });
    },
    delCat(el){ const s = el.dataset.sub, n = BP.db().expenses.filter(e => e.sub === s).length;
      BP.modal.confirm(`Delete “${s}”? ${n ? n + ' existing expense(s) keep their label but will no longer be linked to a budget.' : ''}`, () => { BP.actions.deleteCat(s); loadDraft(st.month); BP.toast('Category deleted', 'ok'); BP.app.renderView(true); }); },
    /* recurring */
    editRec(el){ recModal(el && el.dataset.id); },
    delRec(el){ BP.modal.confirm('Delete this recurring expense?', () => { const d = BP.db(); d.recurring = d.recurring.filter(r => r.id !== el.dataset.id); BP.store.persist(); BP.app.renderView(true); }); },
    togRec(el){ const r = BP.db().recurring.find(x => x.id === el.dataset.id); if (r){ r.active = r.active === false; BP.store.persist(); BP.app.renderView(true); } },
    runRec(){ const n = BP.actions.processRecurring(); if (!n) BP.toast('Nothing due yet', 'ok'); BP.app.renderView(true); },
    /* goals */
    editGoal(el){ goalModal(el && el.dataset.id); },
    delGoal(el){ BP.modal.confirm('Delete this goal?', () => { const d = BP.db(); d.goals = d.goals.filter(g => g.id !== el.dataset.id); BP.store.persist(); BP.app.renderView(true); }); },
    addToGoal(el){
      const g = BP.db().goals.find(x => x.id === el.dataset.id); if (!g) return;
      BP.modal.open({ title: `➕ Add to “${g.name}”`, body: BP.h`<div class="field"><label>Amount (SAR) — use a negative number to withdraw</label><input class="inp num" id="ag-amt" type="number" step="0.01"></div>`, okText: 'Add',
        onOk(api){ const v = parseFloat(BP.$('#ag-amt', api.root).value); if (!v) return false; g.saved = Math.max(0, (g.saved || 0) + v); BP.store.persist(); BP.app.renderView(true); } });
    }
  }
};

/* ---------- Monthly plan ---------- */
function plan(el){
  const c = C(), d = st.draft, m = st.month, can = BP.auth.canEdit('budget'); const t = totals(); const groups = c.groupByMain(c.cats());
  const dis = can ? '' : 'disabled';
  BP.mount(el, BP.h`${BP.ui.monthStrip(c.months(), m)}
  <div class="grid g2" style="margin-top:8px;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
    <div class="col" style="gap:16px">
      <div class="card"><div class="card-h"><div class="card-t big">${BP.fmtMonth(m, true)} plan</div><span class="tag ${d.saved ? 'sp' : ''}">${d.saved ? 'saved' : d.from ? 'carried from ' + BP.fmtMonth(d.from) : 'defaults'}</span></div>
        <div class="form-grid"><div class="field"><label>Gross salary (SAR)</label><input class="inp num" id="pl-salary" type="number" value="${d.salary}" ${dis}></div><div class="field"><label>Investments (SAR)</label><input class="inp num" id="pl-invest" type="number" value="${d.invest}" ${dis}></div></div>
        <div class="card-sub" style="margin-top:8px">📈 Investment pot available now: <b class="num m-sal" style="color:var(--accent)">${BP.fmt(c.investPot())} SAR</b>${d.saved ? '' : ' · saving this plan adds ' + BP.fmt(d.invest) + ' SAR to it'} · <a data-go="invest" style="cursor:pointer;color:var(--accent)">open Investments →</a></div>
        <div class="sp-lg"></div><div id="pl-flow">${CH().flowBar([{ l: 'Saving Boxes', v: t.sb, c: 'var(--purple)' }, { l: 'Investments', v: d.invest, c: 'var(--blue)' }, { l: 'Spendable', v: t.sp, c: 'var(--green)' }, { l: 'Unallocated', v: Math.max(0, t.un), c: 'var(--accent)' }])}</div>
        <div id="pl-warn" style="margin-top:12px"></div>
        <div class="row wrap" style="margin-top:16px;gap:8px"><button class="btn primary" data-act="savePlan" ${dis}>💾 Save plan</button><button class="btn" data-act="resetPlan">↺ Reset</button><button class="btn" data-act="copyNext" ${dis}>⏭️ Copy to next month</button><button class="btn danger" data-act="delPlan" ${dis}>🗑️ Delete plan</button></div></div>
      ${[['Saving Box', '📦 Saving Boxes', 'var(--purple)', 'sb'], ['Spendable', '💸 Spendable', 'var(--green)', 'sp']].map(([type, label, col, key]) => {
        const tcats = c.cats().filter(x => x.type === type), tg = c.groupByMain(tcats), ttot = BP.sum(tcats, x => d.budgets[x.sub] || 0), topen = st.open['T:' + type] !== false;
        const tspent = BP.sum(c.expOf(m).filter(e => e.type === type), e => e.amount);
        return BP.h`<div class="type-sec" style="--tc:${col}">
          <div class="type-head" data-act="toggleGrp" data-g="T:${type}"><div class="row"><span class="type-dot"></span><b>${label}</b><span class="tag">${tcats.length} categories</span></div>
            <div class="row" style="gap:14px"><span class="card-sub">spent <b class="num m-num" style="color:var(--text)">${BP.fmt(tspent)}</b></span><b class="num m-sal type-tot">Plan <span id="pl-${key}2">${BP.fmt(ttot)}</span> SAR</b><span class="muted">${topen ? '▼' : '▶'}</span></div></div>
          ${topen ? BP.h`<div class="col" style="gap:10px">${Object.entries(tg).map(([main, items]) => { const gk = type + '|' + main, open = st.open[gk] !== false, tot = BP.sum(items, x => d.budgets[x.sub] || 0);
            return BP.h`<div class="card" data-grp="${gk}"><div class="row between" data-act="toggleGrp" data-g="${gk}" style="cursor:pointer"><div class="row">${BP.ui.catChip(main)}<b>${main}</b><span class="tag">${items.length}</span></div><div class="row"><b class="num m-sal"><span class="grp-tot">${BP.fmt(tot)}</span> SAR</b><span class="muted">${open ? '▼' : '▶'}</span></div></div>
              ${open ? BP.h`<div style="margin-top:8px">${items.map(x => BP.h`<div class="plan-row">
                <div class="grow" style="min-width:0"><div class="row" style="gap:6px"><b style="font-size:13px">${x.sub}</b><span class="tag ${x.necessity === 'Must' ? 'must' : 'maybe'}">${x.necessity}</span></div><div class="faint" style="font-size:11px">${x.payType || ''} · spent ${BP.fmt(BP.sum(c.expOf(m).filter(e => e.sub === x.sub), e => e.amount))}</div></div>
                <input class="inp num" style="width:100px;text-align:right" type="number" data-bud="${x.sub}" value="${d.budgets[x.sub] || 0}" ${dis}>
                ${can ? BP.h`<button class="icon-btn" style="width:30px;height:30px" data-act="editCat" data-sub="${x.sub}" title="Edit">${BP.icon('edit')}</button><button class="icon-btn" style="width:30px;height:30px;color:var(--red)" data-act="delCat" data-sub="${x.sub}" title="Delete">${BP.icon('x')}</button>` : ''}</div>`)}</div>` : ''}</div>`; })}</div>` : ''}
        </div>`; })}
      ${can ? BP.h`<button class="btn block" data-act="addCat">➕ Add category</button>` : ''}
    </div>
    <div class="col" style="gap:16px;position:sticky;top:76px;align-self:start">
      <div class="card"><div class="card-h"><div class="card-t big">Allocation</div></div>${BP.ui.canvas('plDonut', 240)}
        <div class="list" style="margin-top:8px"><div class="li"><div class="li-main"><div class="li-t">📦 Saving boxes</div></div><div class="li-v m-sal"><span id="pl-sb">${BP.fmt(t.sb)}</span></div></div>
        <div class="li"><div class="li-main"><div class="li-t">📈 Investments</div></div><div class="li-v m-sal"><span id="pl-inv">${BP.fmt(d.invest)}</span></div></div>
        <div class="li"><div class="li-main"><div class="li-t">💸 Spendable</div></div><div class="li-v m-sal"><span id="pl-sp">${BP.fmt(t.sp)}</span></div></div>
        <div class="li"><div class="li-main"><div class="li-t">🟢 Unallocated</div></div><div class="li-v m-sal"><span id="pl-un" style="color:${t.un >= 0 ? 'var(--accent)' : 'var(--red)'}">${BP.fmt(t.un)}</span></div></div></div></div>
      <div class="card"><div class="card-h"><div class="card-t big">Plan by group</div></div>${BP.ui.canvas('plBars', 60 + Object.keys(groups).length * 26)}</div>
    </div></div>`);
  paintTotals();
  const labels = ['Saving Boxes', 'Investments', 'Spendable', 'Unallocated'], cols = ['--purple', '--blue', '--green', '--accent'];
  BP.charts.make('plDonut', () => ({ type: 'doughnut', data: { labels, datasets: [{ data: [t.sb, d.invest, t.sp, Math.max(0, t.un)], backgroundColor: cols.map(x => CH().css(x)), borderColor: CH().css('--card'), borderWidth: 3 }] },
    options: { cutout: '68%', animation: { duration: 300 }, plugins: { legend: { position: 'bottom' }, centerText: { text: BP.fmtK(d.salary), sub: 'salary', size: 22 } } } }));
  const gk = Object.keys(groups).map(k => ({ k, v: BP.sum(groups[k], x => d.budgets[x.sub] || 0) })).filter(x => x.v).sort((a, b) => b.v - a.v);
  BP.charts.make('plBars', () => ({ type: 'bar', data: { labels: gk.map(x => x.k), datasets: [{ data: gk.map(x => x.v), backgroundColor: gk.map(x => C().mainColor(x.k)), borderRadius: 6 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => ` ${BP.fmt(x.parsed.x)} SAR` } } }, scales: { x: { ...CH().scales().y, ticks: { callback: v => BP.fmtK(v) } }, y: { grid: { display: false }, border: { display: false } } } } }));
}

/* ---------- Recurring ---------- */
function recurring(el){
  const d = BP.db(), list = d.recurring.slice().sort((a, b) => (a.nextDue || '').localeCompare(b.nextDue || '')), can = BP.auth.canEdit('budget'); const mo = BP.sum(list.filter(r => r.active !== false), r => r.amount * ({ weekly: 4.33, quarterly: 1 / 3, annual: 1 / 12 }[r.frequency] || 1));
  BP.mount(el, BP.h`<div class="grid g3 keep2" style="margin-bottom:16px">
      ${BP.ui.kpi({ label: 'Active commitments', value: list.filter(r => r.active !== false).length, unit: false, color: 'var(--blue)' })}
      ${BP.ui.kpi({ label: 'Monthly equivalent', value: BP.fmt(mo), color: 'var(--red)', foot: 'normalised to months' })}
      ${BP.ui.kpi({ label: 'Next 30 days', value: BP.fmt(BP.sum(C().upcomingRecurring(BP.toISO(new Date(Date.now() + 30 * 864e5))), r => r.amount)), color: 'var(--amber)' })}</div>
    <div class="card"><div class="card-h"><div class="card-t big">🔁 Recurring expenses</div><div class="row">${can ? BP.h`<button class="btn sm" data-act="runRec">▶ Add due now</button><button class="btn sm primary" data-act="editRec">➕ New</button>` : ''}</div></div>
    <div class="list">${list.length ? list.map(r => BP.h`<div class="li" style="${r.active === false ? 'opacity:.5' : ''}"><div class="li-ic">${C().mainIcon((C().cat(r.sub) || {}).main)}</div><div class="li-main"><div class="li-t">${r.name} <span class="tag">${r.frequency}</span>${r.autoAdd ? BP.h` <span class="tag sp">auto</span>` : ''}</div><div class="li-s">${r.sub} · ${r.pay} · next ${r.nextDue ? BP.fmtDate(r.nextDue) : '—'}</div></div><div class="li-v m-num">${BP.fmt(r.amount)}</div>
      ${can ? BP.h`<div class="li-act"><button class="icon-btn" style="width:32px;height:32px" data-act="togRec" data-id="${r.id}" title="Pause/resume">${r.active === false ? '▶' : '⏸'}</button><button class="icon-btn" style="width:32px;height:32px" data-act="editRec" data-id="${r.id}">${BP.icon('edit')}</button><button class="icon-btn" style="width:32px;height:32px;color:var(--red)" data-act="delRec" data-id="${r.id}">${BP.icon('x')}</button></div>` : ''}</div>`) : BP.ui.empty('🔁', 'No recurring expenses yet — add rent, subscriptions, installments…')}</div></div>`);
}
function recModal(id){
  const d = BP.db(), r = id ? d.recurring.find(x => x.id === id) : null, v = r || { name: '', sub: '', amount: '', pay: d.payMethods[0], frequency: 'monthly', nextDue: BP.today(), autoAdd: false };
  BP.modal.open({ title: r ? '✏️ Edit recurring' : '🔁 New recurring expense', body: BP.h`<div class="form-grid">
    <div class="field"><label>Name</label><input class="inp" id="rc-name" value="${v.name}"></div><div class="field"><label>Amount (SAR)</label><input class="inp num" id="rc-amt" type="number" value="${v.amount}"></div>
    <div class="field"><label>Category</label><select class="sel" id="rc-sub">${BP.actions.catOptions(v.sub)}</select></div><div class="field"><label>Payment</label><select class="sel" id="rc-pay">${d.payMethods.map(p => BP.h`<option ${p === v.pay ? 'selected' : ''}>${p}</option>`)}</select></div>
    <div class="field"><label>Frequency</label><select class="sel" id="rc-fr">${['weekly', 'monthly', 'quarterly', 'annual'].map(p => BP.h`<option ${p === v.frequency ? 'selected' : ''}>${p}</option>`)}</select></div><div class="field"><label>Next due</label><input class="inp" id="rc-due" type="date" value="${v.nextDue}"></div>
    <label class="row" style="grid-column:1/-1;gap:8px"><input type="checkbox" id="rc-auto" ${v.autoAdd ? 'checked' : ''}> Add automatically when due</label></div>`,
    onOk(api){ const q = x => BP.$('#' + x, api.root); const o = { name: q('rc-name').value.trim(), amount: parseFloat(q('rc-amt').value), sub: q('rc-sub').value, pay: q('rc-pay').value, frequency: q('rc-fr').value, nextDue: q('rc-due').value, autoAdd: q('rc-auto').checked, active: true };
      if (!o.name || !(o.amount > 0) || !o.sub){ BP.toast('Name, amount and category are required', 'err'); return false; }
      if (r) Object.assign(r, o); else d.recurring.push({ id: 'r' + BP.uid(), ...o }); BP.store.persist(); BP.app.renderView(true); } });
}

/* ---------- Goals ---------- */
function goals(el){
  const d = BP.db(), can = BP.auth.canEdit('budget');
  BP.mount(el, BP.h`<div class="card"><div class="card-h"><div class="card-t big">🎯 Financial goals</div>${can ? BP.h`<button class="btn sm primary" data-act="editGoal">➕ New goal</button>` : ''}</div>
    ${d.goals.length ? BP.h`<div class="grid g2">${d.goals.map(g => { const p = g.target ? BP.clamp((g.saved || 0) / g.target * 100, 0, 100) : 0, left = Math.max(0, g.target - (g.saved || 0));
      let eta = ''; if (g.deadline){ const mo = Math.max(1, BP.monthsBetween(BP.ymNow(), g.deadline.slice(0, 7))); eta = left ? `Needs ${BP.fmt(left / mo)} SAR / month to hit ${BP.fmtDate(g.deadline)}` : 'Goal reached 🎉'; }
      return BP.h`<div class="card" style="background:var(--surface)"><div class="row between"><div class="row"><div class="ring-wrap">${CH().ring(p, { size: 72, stroke: 8, color: p >= 100 ? 'var(--green)' : 'var(--accent)' })}<div class="ring-c"><div class="v" style="font-size:15px">${p.toFixed(0)}%</div></div></div><div><b>${g.emoji || g.icon || '🎯'} ${g.name}</b><div class="card-sub num m-num">${BP.fmt(g.saved || 0)} / ${BP.fmt(g.target)} SAR</div></div></div>
        ${can ? BP.h`<div class="row"><button class="icon-btn" style="width:32px;height:32px" data-act="editGoal" data-id="${g.id}">${BP.icon('edit')}</button><button class="icon-btn" style="width:32px;height:32px;color:var(--red)" data-act="delGoal" data-id="${g.id}">${BP.icon('x')}</button></div>` : ''}</div>
        <div class="card-sub" style="margin:10px 0">${eta || (left ? BP.fmt(left) + ' SAR to go' : 'Goal reached 🎉')}</div>${can ? BP.h`<button class="btn sm block" data-act="addToGoal" data-id="${g.id}">➕ Add money</button>` : ''}</div>`; })}</div>` : BP.ui.empty('🎯', 'No goals yet — set a target like “Emergency fund” or “New car”')}</div>`);
}
function goalModal(id){
  const d = BP.db(), g = id ? d.goals.find(x => x.id === id) : null, v = g || { name: '', icon: '🎯', target: '', saved: 0, deadline: '' };
  BP.modal.open({ title: g ? '✏️ Edit goal' : '🎯 New goal', body: BP.h`<div class="form-grid"><div class="field"><label>Name</label><input class="inp" id="gl-name" value="${v.name}"></div><div class="field"><label>Icon</label><input class="inp" id="gl-ic" value="${v.emoji || v.icon || '🎯'}" maxlength="4"></div>
    <div class="field"><label>Target (SAR)</label><input class="inp num" id="gl-target" type="number" value="${v.target}"></div><div class="field"><label>Saved so far</label><input class="inp num" id="gl-saved" type="number" value="${v.saved || 0}"></div>
    <div class="field"><label>Deadline (optional)</label><input class="inp" id="gl-dl" type="date" value="${v.deadline || ''}"></div></div>`,
    onOk(api){ const q = x => BP.$('#' + x, api.root); const o = { name: q('gl-name').value.trim(), emoji: q('gl-ic').value || '🎯', target: parseFloat(q('gl-target').value), saved: parseFloat(q('gl-saved').value) || 0, deadline: q('gl-dl').value };
      if (!o.name || !(o.target > 0)){ BP.toast('Name and target required', 'err'); return false; }
      if (g) Object.assign(g, o); else d.goals.push({ id: 'g' + BP.uid(), ...o }); BP.store.persist(); BP.app.renderView(true); } });
}
})();
