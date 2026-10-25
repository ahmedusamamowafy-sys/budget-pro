/* Budget Pro — Card Balances: monthly opening balances per card, top-up transfers, live balance per card, reconcile checks */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;
const st = { edit: false, open: null };

/* ---------- model ---------- */
const CB = BP.cards = {
  all(){ const d = BP.db(); if (!d.cardMonths || typeof d.cardMonths !== 'object') d.cardMonths = {}; return d.cardMonths; },
  get(m){ return CB.all()[m] || null; },
  /* expenses that reduce card balances this month */
  exps(m){ const s = CB.get(m) || {}; return C().expOf(m).filter(e => s.includeSB || e.type === 'Spendable'); },
  spentBy(m){ const o = {}; CB.exps(m).forEach(e => { o[e.pay] = (o[e.pay] || 0) + e.amount; }); return o; },
  rows(m){
    const s = CB.get(m); if (!s) return [];
    const sp = CB.spentBy(m), names = [...new Set([...BP.db().payMethods, ...Object.keys(s.opening || {}), ...Object.keys(s.transfers || {}), ...Object.keys(sp)])];
    return names.map(n => { const op = Number((s.opening || {})[n]) || 0, tr = Number((s.transfers || {})[n]) || 0, start = op + tr, spent = sp[n] || 0;
      const checks = (s.checks || []).filter(x => x.card === n); return { name: n, opening: op, transfer: tr, start, spent, balance: start - spent, last: checks[checks.length - 1] || null }; })
      .filter(r => r.start || r.spent).sort((a, b) => b.start - a.start || b.spent - a.spent);
  },
  /* closing balances of the previous set-up month, used to pre-fill a new month */
  prevClosing(m){ const ks = Object.keys(CB.all()).filter(k => k < m).sort(); if (!ks.length) return null; const pm = ks[ks.length - 1]; const o = {}; CB.rows(pm).forEach(r => { o[r.name] = Math.max(0, Math.round(r.balance * 100) / 100); }); return { month: pm, bal: o }; },
  needsSetup(){ const cur = BP.ymNow(); return !CB.get(cur); }
};

/* ---------- view ---------- */
BP.views.cards = {
  render(el){
    const m = BP.ui.month, s = CB.get(m), can = BP.auth.canEdit('cards');
    if (!s || st.edit) return setup(el, m, s, can);
    live(el, m, s, can);
  },
  onInput(e){ if (e.target.closest('#cardSetup')) paintSetup(); },
  actions: {
    save(){ saveSetup(); },
    cancel(){ st.edit = false; BP.app.renderView(true); },
    editSetup(){ st.edit = true; BP.app.renderView(true); },
    fill(el){ // put the remaining transfer on one card
      const n = el.dataset.card, inp = BP.$(`[data-tr="${CSS.escape(n)}"]`); if (!inp) return; const t = totalsSetup(); inp.value = Math.max(0, (parseFloat(inp.value) || 0) + t.toAllocate - t.transfers).toFixed(0); paintSetup(); },
    prefill(){ const pc = CB.prevClosing(BP.ui.month); if (!pc) return; BP.$$('[data-op]').forEach(i => { const v = pc.bal[i.dataset.op]; i.value = v ? v : ''; }); paintSetup(); BP.toast(`Filled from ${BP.fmtMonth(pc.month)} closing balances — adjust to your real balances`, 'ok'); },
    toggle(el){ st.open = st.open === el.dataset.card ? null : el.dataset.card; BP.app.renderView(true); },
    check(el){ checkModal(el.dataset.card); },
    checkAll(){ checkModal(null); },
    includeSB(){ const s = CB.get(BP.ui.month); s.includeSB = !s.includeSB; BP.store.persist(); BP.app.renderView(true); },
    reset(){ BP.modal.confirm(`Remove the card set-up for ${BP.fmtMonth(BP.ui.month)}? Expenses are not affected.`, () => { delete CB.all()[BP.ui.month]; BP.store.persist(); st.edit = false; BP.app.renderView(true); }); },
    addExpense(el){ BP.app.go('add'); setTimeout(() => { const b = document.querySelector(`[data-pay-group="a"] [data-pay="${CSS.escape(el.dataset.card)}"]`); if (b) b.click(); }, 120); }
  }
};

/* ---------- setup (start of month) ---------- */
function setup(el, m, s, can){
  const d = BP.db(), c = C(), plan = c.spBudget(m), pc = !s ? CB.prevClosing(m) : null;
  const op = s ? s.opening || {} : (pc ? pc.bal : {}), tr = s ? s.transfers || {} : {}, budget = s ? s.budget : plan;
  const names = [...new Set([...d.payMethods, ...Object.keys(op), ...Object.keys(tr)])];
  BP.mount(el, BP.h`${BP.ui.monthStrip(c.months(), m)}
  <div class="card" id="cardSetup" style="margin-top:8px">
    <div class="card-h"><div><div class="card-t big">💳 ${BP.fmtMonth(m, true)} · card set-up</div><div class="card-sub">${s ? 'Edit this month\'s opening balances and transfers' : 'Do this at the start of the month, before you transfer the spendable budget'}</div></div>${s ? BP.h`<button class="btn sm" data-act="cancel">Cancel</button>` : ''}</div>
    ${!can ? BP.h`<div class="tipbox">View-only access.</div>` : ''}
    <div class="setup-steps">
      <div class="step"><div class="step-h"><span class="step-n">1</span><b>What's actually left on each card and in cash right now?</b></div>
        ${pc ? BP.h`<div class="card-sub" style="margin:2px 0 8px">Pre-filled with the app's closing balances from ${BP.fmtMonth(pc.month)} — check your banking apps and correct them. <a style="cursor:pointer;color:var(--accent)" data-act="prefill">Refill</a></div>` : BP.h`<div class="card-sub" style="margin:2px 0 8px">Open each banking app and type the remaining balance. Leave empty if zero.</div>`}
        <div class="card-grid">${names.map(n => BP.h`<label class="cin"><span>${n}</span><input class="inp num" type="number" step="0.01" data-op="${n}" value="${op[n] || ''}" placeholder="0" ${can ? '' : 'disabled'}></label>`)}</div>
        <div class="step-sum">Already on your cards: <b class="num" id="cs-op">0</b> SAR</div></div>
      <div class="step"><div class="step-h"><span class="step-n">2</span><b>Spendable budget for ${BP.fmtMonth(m)}</b></div>
        <div class="row wrap" style="gap:12px;align-items:flex-end"><label class="cin" style="max-width:200px"><span>Spendable budget (from plan: ${BP.fmt(plan)})</span><input class="inp num" type="number" id="cs-budget" value="${budget}" ${can ? '' : 'disabled'}></label>
          <div class="formula"><span class="num" id="cs-f-b">0</span><span>−</span><span class="num" id="cs-f-o">0</span><span>=</span><b class="num" id="cs-f-t">0</b><span class="card-sub">to transfer</span></div></div></div>
      <div class="step"><div class="step-h"><span class="step-n">3</span><b>Where will you transfer it?</b></div>
        <div class="card-sub" style="margin:2px 0 8px">Split the top-up across the cards you'll spend from this month. Click ⤵ to put the rest on that card.</div>
        <div class="card-grid">${names.map(n => BP.h`<label class="cin"><span>${n} <a class="fill" data-act="fill" data-card="${n}" title="Put the remaining amount here">⤵</a></span><input class="inp num" type="number" step="0.01" data-tr="${n}" value="${tr[n] || ''}" placeholder="0" ${can ? '' : 'disabled'}></label>`)}</div>
        <div class="step-sum" id="cs-alloc"></div></div>
    </div>
    <div class="card-start" id="cs-start"></div>
    ${can ? BP.h`<div class="row wrap" style="gap:8px;margin-top:14px"><button class="btn primary" data-act="save">💾 Save ${BP.fmtMonth(m)} card balances</button>${s ? BP.h`<button class="btn danger" data-act="reset">Remove set-up</button>` : ''}</div>` : ''}
  </div>`);
  paintSetup();
}
function totalsSetup(){
  const sum = sel => BP.sum(BP.$$(sel), i => parseFloat(i.value) || 0);
  const opening = sum('[data-op]'), transfers = sum('[data-tr]'), budget = parseFloat((BP.$('#cs-budget') || {}).value) || 0;
  return { opening, transfers, budget, toAllocate: Math.max(0, budget - opening) };
}
function paintSetup(){
  if (!BP.$('#cs-op')) return; const t = totalsSetup(), set = (id, v) => { const e = BP.$('#' + id); if (e) e.textContent = v; };
  set('cs-op', BP.fmt2(t.opening)); set('cs-f-b', BP.fmt(t.budget)); set('cs-f-o', BP.fmt2(t.opening)); set('cs-f-t', BP.fmt2(t.toAllocate));
  const left = t.toAllocate - t.transfers, a = BP.$('#cs-alloc');
  a.innerHTML = Math.abs(left) < 0.01 ? `✅ Transfers match: <b class="num">${BP.fmt2(t.transfers)}</b> SAR` : left > 0 ? `Transferred <b class="num">${BP.fmt2(t.transfers)}</b> of <b class="num">${BP.fmt2(t.toAllocate)}</b> · <span style="color:var(--amber)">${BP.fmt2(left)} left to place</span>` : `<span style="color:var(--red)">Transfers exceed the top-up by ${BP.fmt2(-left)} SAR</span>`;
  const starts = {}; BP.$$('[data-op]').forEach(i => { starts[i.dataset.op] = (parseFloat(i.value) || 0); }); BP.$$('[data-tr]').forEach(i => { starts[i.dataset.tr] = (starts[i.dataset.tr] || 0) + (parseFloat(i.value) || 0); });
  const ent = Object.entries(starts).filter(x => x[1]);
  BP.$('#cs-start').innerHTML = ent.length ? `<div class="card-sub" style="margin:14px 0 6px">Starting balance per card this month · total <b class="num">${BP.fmt2(t.opening + t.transfers)}</b> SAR</div><div class="chips">${ent.map(([n, v]) => `<span class="chip on">💳 ${BP.esc(n)} · <b class="num">${BP.fmt2(v)}</b></span>`).join('')}</div>` : '';
}
function saveSetup(){
  const m = BP.ui.month, opening = {}, transfers = {};
  BP.$$('[data-op]').forEach(i => { const v = parseFloat(i.value); if (v) opening[i.dataset.op] = v; });
  BP.$$('[data-tr]').forEach(i => { const v = parseFloat(i.value); if (v) transfers[i.dataset.tr] = v; });
  const prev = CB.get(m) || {}; const t = totalsSetup();
  CB.all()[m] = { opening, transfers, budget: t.budget, includeSB: !!prev.includeSB, checks: prev.checks || [], savedAt: new Date().toISOString() };
  BP.store.persist(); st.edit = false; BP.toast(`💳 ${BP.fmtMonth(m)} card balances saved`, 'ok'); BP.app.refresh();
}

/* ---------- live month ---------- */
function live(el, m, s, can){
  const c = C(), rows = CB.rows(m), tot = k => BP.sum(rows, r => r[k]);
  const opening = tot('opening'), transfer = tot('transfer'), start = tot('start'), spent = tot('spent'), bal = start - spent;
  const n = BP.daysIn(m), cur = m === BP.ymNow(), upto = cur ? new Date().getDate() : n;
  const daily = Array(n).fill(0); CB.exps(m).forEach(e => { daily[+e.date.slice(8, 10) - 1] += e.amount; });
  let run = start; const line = daily.map((v, i) => i < upto ? (run -= v) : null);
  const neg = rows.filter(r => r.balance < -0.005);
  BP.mount(el, BP.h`${BP.ui.monthStrip(c.months(), m)}
  <div class="grid g4 keep2" style="margin-top:8px">
    ${BP.ui.kpi({ label: 'Carried over on cards', value: BP.fmt(opening), mask: 'sal', color: 'var(--blue)', foot: 'at the start of the month' })}
    ${BP.ui.kpi({ label: 'Transferred in', value: BP.fmt(transfer), mask: 'sal', color: 'var(--purple)', foot: `budget ${BP.fmt(s.budget)} − carried ${BP.fmt(opening)}` })}
    ${BP.ui.kpi({ label: 'Spent from cards', value: BP.fmt(spent), color: 'var(--red)', foot: `${CB.exps(m).length} expenses · ${s.includeSB ? 'spendable + saving box' : 'spendable only'}` })}
    ${BP.ui.kpi({ label: 'Left on all cards', value: BP.fmt(bal), valColor: bal >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--green)', foot: start ? BP.pct(bal, start) + ' of starting balance' : '' })}
  </div>
  ${neg.length ? BP.h`<div class="status-pill bad" style="margin-top:12px">⚠️ ${neg.map(r => `${r.name} is ${BP.fmt2(-r.balance)} SAR below zero`).join(' · ')} — transfer money to ${neg.length > 1 ? 'these cards' : 'this card'} or check for an expense logged with the wrong card.</div>` : ''}
  <div class="row between wrap" style="margin:16px 2px 10px;gap:8px"><div class="card-t big">💳 Balance per card</div>
    <div class="row wrap" style="gap:8px"><label class="row" style="gap:6px;font-size:12px" title="Also deduct Saving Box expenses paid by card"><input type="checkbox" data-act="includeSB" ${s.includeSB ? 'checked' : ''} ${can ? '' : 'disabled'}> include Saving Box expenses</label>${can ? BP.h`<button class="btn sm" data-act="checkAll">✔ Check balances</button><button class="btn sm" data-act="editSetup">✏️ Edit set-up</button>` : ''}</div></div>
  <div class="grid g3" style="align-items:start">${rows.map(r => { const p = r.start ? Math.min(100, r.spent / r.start * 100) : (r.spent ? 100 : 0), col = r.balance < -0.005 ? 'var(--red)' : p > 85 ? 'var(--amber)' : 'var(--green)';
    const diff = r.last ? r.last.actual - r.last.app : null;
    return BP.h`<div class="card cardbal ${st.open === r.name ? 'open' : ''}">
      <div class="row between"><b>💳 ${r.name}</b>${r.last ? BP.h`<span class="tag ${Math.abs(diff) < 1 ? 'sp' : 'must'}" title="Last check ${BP.fmtDT(r.last.at)}">${Math.abs(diff) < 1 ? '✔ matched' : (diff > 0 ? '+' : '−') + BP.fmt2(Math.abs(diff)) + ' vs bank'}</span>` : BP.h`<span class="tag">not checked</span>`}</div>
      <div class="num m-num cb-bal" style="color:${col}">${BP.fmt2(r.balance)} <small>SAR left</small></div>
      <div class="bar"><i style="width:${p}%;background:${col}"></i></div>
      <div class="cb-grid"><div><span>Carried</span><b class="num">${BP.fmt(r.opening)}</b></div><div><span>Transferred</span><b class="num">${BP.fmt(r.transfer)}</b></div><div><span>Spent</span><b class="num" style="color:var(--red)">${BP.fmt(r.spent)}</b></div></div>
      <div class="row" style="gap:6px;margin-top:10px">${can ? BP.h`<button class="btn sm grow" data-act="check" data-card="${r.name}">✔ Check</button><button class="btn sm grow" data-act="addExpense" data-card="${r.name}">➕ Expense</button>` : ''}<button class="btn sm ghost" data-act="toggle" data-card="${r.name}">${st.open === r.name ? '▲' : '▼'} ${CB.exps(m).filter(e => e.pay === r.name).length}</button></div>
      ${st.open === r.name ? BP.h`<div class="list cb-ledger" style="margin-top:8px">${cardLedger(m, r)}</div>` : ''}
    </div>`; })}${!rows.length ? BP.ui.empty('💳', 'No balances yet') : ''}</div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><div class="card-h"><div class="card-t big">Start vs spent vs left</div></div>${rows.length ? BP.ui.canvas('cbBar', 250) : ''}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Money left on cards · day by day</div></div>${BP.ui.canvas('cbLine', 250)}</div>
  </div>
  ${(s.checks || []).length ? BP.h`<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-t big">✔ Balance checks</div><span class="card-sub">your bank balance vs the app</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Card</th><th class="r">Bank says</th><th class="r">App says</th><th class="r">Difference</th></tr></thead><tbody>
    ${s.checks.slice().reverse().map(x => { const df = x.actual - x.app; return BP.h`<tr><td>${BP.fmtDT(x.at)}</td><td><b>${x.card}</b></td><td class="r num">${BP.fmt2(x.actual)}</td><td class="r num">${BP.fmt2(x.app)}</td><td class="r num ${Math.abs(df) < 1 ? '' : df > 0 ? 'up' : 'down'}">${Math.abs(df) < 1 ? '✔ 0' : (df > 0 ? '+' : '−') + BP.fmt2(Math.abs(df))}</td></tr>`; })}</tbody></table></div>
    <div class="card-sub" style="margin-top:8px">A negative difference usually means an expense paid from that card isn't logged yet; a positive one means money came in (refund, transfer) or an expense was logged on the wrong card.</div></div>` : ''}`);
  if (rows.length) BP.charts.make('cbBar', () => ({ type: 'bar', data: { labels: rows.map(r => r.name), datasets: [
    { label: 'Start', data: rows.map(r => r.start), backgroundColor: CH().hexA(CH().css('--blue'), .55), borderRadius: 6, maxBarThickness: 34 },
    { label: 'Spent', data: rows.map(r => r.spent), backgroundColor: CH().css('--red'), borderRadius: 6, maxBarThickness: 34 },
    { label: 'Left', data: rows.map(r => r.balance), backgroundColor: rows.map(r => r.balance < 0 ? CH().css('--red') : CH().css('--green')), borderRadius: 6, maxBarThickness: 34 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
  BP.charts.make('cbLine', () => ({ type: 'line', data: { labels: daily.map((_, i) => i + 1), datasets: [
    { label: 'Left on cards', data: line, borderColor: CH().css('--accent'), backgroundColor: ctx => ctx.chart.chartArea ? CH().vert(ctx.chart.ctx, ctx.chart.chartArea, CH().hexA(CH().css('--accent'), .3), CH().hexA(CH().css('--accent'), 0)) : 'transparent', fill: true, tension: .25, pointRadius: 0, borderWidth: 2.4 },
    { label: 'Ideal pace', data: daily.map((_, i) => start * (1 - (i + 1) / n)), borderColor: CH().css('--blue'), borderDash: [3, 4], pointRadius: 0, borderWidth: 1.5, fill: false }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: i => `Day ${i[0].label}`, label: x => ` ${x.dataset.label}: ${BP.fmt(x.parsed.y)} SAR` } } }, scales: CH().scales({ x: { ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: true } }) } }));
}
function cardLedger(m, r){
  let bal = r.start; const list = CB.exps(m).filter(e => e.pay === r.name).slice().sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  const rows = list.map(e => { bal -= e.amount; return { e, bal }; }).reverse();
  return BP.raw(BP.str([...rows.slice(0, 40).map(x => BP.h`<div class="li"><div class="li-main"><div class="li-t">${x.e.sub}</div><div class="li-s">${BP.fmtDate(x.e.date)}${x.e.desc ? ' · ' + x.e.desc : ''}</div></div><div class="right"><div class="li-v num" style="color:var(--red)">−${BP.fmt2(x.e.amount)}</div><div class="faint num" style="font-size:10.5px">left ${BP.fmt2(x.bal)}</div></div></div>`),
    BP.h`<div class="li"><div class="li-main"><div class="li-t">Start of month</div><div class="li-s">carried ${BP.fmt2(r.opening)} + transferred ${BP.fmt2(r.transfer)}</div></div><div class="li-v num">${BP.fmt2(r.start)}</div></div>`]));
}
function checkModal(card){
  const m = BP.ui.month, rows = CB.rows(m).filter(r => !card || r.name === card);
  BP.modal.open({ title: card ? `✔ Check ${card}` : '✔ Check card balances', wide: !card, body: BP.h`<div class="card-sub" style="margin-bottom:10px">Type the balance your banking app shows now. Budget Pro compares it with what it expects.</div>
    <div class="card-grid">${rows.map(r => BP.h`<label class="cin"><span>${r.name} · app ${BP.fmt2(r.balance)}</span><input class="inp num" type="number" step="0.01" data-chk="${r.name}" data-app="${r.balance}" placeholder="bank balance"></label>`)}</div>
    <div id="chk-res" class="card-sub" style="margin-top:10px"></div>`, okText: 'Save check',
    onOpen(api){ api.root.addEventListener('input', () => { const out = BP.$$('[data-chk]', api.root).filter(i => i.value !== '').map(i => { const df = parseFloat(i.value) - parseFloat(i.dataset.app); return `${BP.esc(i.dataset.chk)}: ${Math.abs(df) < 1 ? '✔ matches' : (df > 0 ? '+' : '−') + BP.fmt2(Math.abs(df)) + ' vs app'}`; }); BP.$('#chk-res', api.root).innerHTML = out.join(' · '); }); },
    onOk(api){ const s = CB.get(m); s.checks = s.checks || []; let n = 0;
      BP.$$('[data-chk]', api.root).forEach(i => { if (i.value === '') return; s.checks.push({ at: new Date().toISOString(), card: i.dataset.chk, actual: parseFloat(i.value), app: Math.round(parseFloat(i.dataset.app) * 100) / 100 }); n++; });
      if (!n){ BP.toast('Enter at least one balance', 'err'); return false; } BP.store.persist(); BP.toast(`✔ ${n} check${n > 1 ? 's' : ''} saved`, 'ok'); BP.app.renderView(true); } });
}
})();
