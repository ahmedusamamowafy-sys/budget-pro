/* Budget Pro — Add Expense view */
(function(){
'use strict';
const BP = window.BP;
const st = { sub: '', pay: null, date: null, last: null };

function recentSubs(n){
  const seen = []; for (const e of BP.db().expenses){ if (!seen.includes(e.sub) && BP.calc.cat(e.sub)) seen.push(e.sub); if (seen.length >= n) break; } return seen;
}
function statusCard(sub){
  if (!sub) return BP.h`<div class="tipbox">Pick a category to see how much budget is left for it this month.</div>`;
  const m = (st.date || BP.today()).slice(0, 7), s = BP.actions.catStatus(sub, m); if (!s) return BP.raw('');
  const pct = s.pct == null ? 0 : s.pct, col = s.pct == null ? 'var(--muted)' : pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--amber)' : 'var(--green)';
  return BP.h`<div class="row between"><div class="row">${BP.ui.catChip(s.cat.main)}<div><div style="font-weight:700">${s.cat.sub}</div><div class="card-sub">${s.cat.main}${s.cat.category !== s.cat.main ? ' · ' + s.cat.category : ''}</div></div></div>${BP.ui.typeTag(s.cat.type)}</div>
    <div class="sp"></div><div class="bar tall"><i style="width:${Math.min(100, pct)}%;background:${col}"></i></div>
    <div class="row between" style="margin-top:8px;font-size:12.5px"><span class="muted">Spent <b class="num" style="color:var(--text)">${BP.fmt(s.spent)}</b> of <b class="num" style="color:var(--text)">${BP.fmt(s.budget)}</b></span>
    <b class="num" style="color:${col}">${s.budget ? (s.left >= 0 ? BP.fmt(s.left) + ' left' : BP.fmt(-s.left) + ' over') : 'no budget'}</b></div>
    <div class="tag ${s.cat.necessity === 'Must' ? 'must' : 'maybe'}" style="margin-top:10px">${s.cat.necessity || 'Maybe'}</div> <span class="tag">${s.cat.payType || ''}</span>`;
}

BP.views.add = {
  render(el){
    const d = BP.db(); const can = BP.auth.canEdit('add');
    st.date = st.date || BP.today(); st.pay = st.pay && d.payMethods.includes(st.pay) ? st.pay : d.payMethods[0];
    const m = BP.ui.month, pool = BP.calc.pool(m), spent = BP.calc.spentSP(m), pct = pool ? spent / pool * 100 : 0;
    const recent = recentSubs(6), recentList = d.expenses.slice(0, 6);
    const presets = d.quickAdd.filter(q => BP.calc.cat(q.sub));
    BP.mount(el, BP.h`
    ${!d.settings.welcomeSeen ? BP.h`<div class="welcome"><div style="font-size:26px">👋</div><div class="grow"><b>Welcome to Budget Pro.</b> <span class="muted">Your categories, monthly plans and ${BP.db().expenses.filter(e => e.seed).length} expenses (Jun–Oct 2026) plus net-worth accounts were loaded from <b>KSA_Budget_v8_1.xlsm</b>. Open the <a href="#dash">Dashboard</a> to see them.</span></div><button class="btn sm" data-act="dismissWelcome">Got it</button></div>` : ''}
    <div class="grid g2" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)">
      <div class="card">
        <div class="card-h"><div class="card-t big">New expense</div><span class="kbd">Ctrl K · quick add anywhere</span></div>
        ${!can ? BP.h`<div class="tipbox">You have view-only access.</div>` : BP.h`
        ${presets.length ? BP.h`<div class="chips" style="margin-bottom:16px">${presets.map(q => BP.h`<button class="chip" data-act="preset" data-sub="${q.sub}">${q.icon} ${q.label}</button>`)}</div>` : ''}
        <div class="field"><label>Amount</label><div class="row" style="background:var(--surface);border:1px solid var(--border2);border-radius:12px;padding:4px 14px"><input id="a-amt" class="num" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0" style="flex:1;min-width:0;background:none;border:none;outline:none;font-size:30px;font-weight:700;padding:4px 0;color:var(--text)"><span class="muted num" style="font-weight:600">SAR</span></div></div>
        <div class="sp-lg"></div>
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1"><label>Category</label><select class="sel" id="a-cat">${BP.actions.catOptions(st.sub)}</select>
            ${recent.length ? BP.h`<div class="chips" style="margin-top:6px"><span class="card-sub" style="align-self:center">Recent:</span>${recent.map(s => BP.h`<button class="chip" data-act="preset" data-sub="${s}">${s}</button>`)}</div>` : ''}</div>
          <div class="field" style="grid-column:1/-1"><label>Payment method</label>${BP.actions.payChips(st.pay, 'a')}</div>
          <div class="field"><label>Date</label><input class="inp" id="a-date" type="date" value="${st.date}"><div class="chips" style="margin-top:6px"><button class="chip" data-act="setDate" data-d="0">Today</button><button class="chip" data-act="setDate" data-d="-1">Yesterday</button></div></div>
          <div class="field"><label>Description</label><input class="inp" id="a-desc" list="descList" placeholder="Optional" autocomplete="off"><datalist id="descList">${[...new Set(d.expenses.map(e => e.desc).filter(Boolean))].slice(0, 40).map(x => BP.h`<option value="${x}">`)}</datalist></div>
        </div>
        <button class="btn primary block" data-act="submit" style="margin-top:18px;padding:11px;font-size:14px">${BP.icon('plus')} Add expense</button>`}
        <div id="a-flash"></div>
      </div>
      <div class="col" style="gap:16px">
        <div class="card"><div class="card-h"><div class="card-t">Category budget</div></div><div id="a-status">${statusCard(st.sub)}</div></div>
        <div class="card"><div class="card-h"><div class="card-t">${BP.fmtMonth(m)} · spendable</div></div>
          <div class="row" style="gap:18px"><div class="ring-wrap">${BP.charts.ring(pct, { size: 96, stroke: 10, color: pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--amber)' : 'var(--accent)' })}<div class="ring-c"><div class="v m-num" style="font-size:17px">${pct.toFixed(0)}%</div><div class="l">used</div></div></div>
          <div class="grow col" style="gap:8px"><div><div class="card-sub">Spent</div><b class="num m-num">${BP.fmt(spent)}</b></div><div><div class="card-sub">Remaining</div><b class="num m-num" style="color:${pool - spent >= 0 ? 'var(--green)' : 'var(--red)'}">${BP.fmt(pool - spent)}</b></div></div></div></div>
        <div class="card"><div class="card-h"><div class="card-t">Latest entries</div><button class="btn sm ghost" data-go="log">View all</button></div>
          <div class="list">${recentList.length ? recentList.map(e => BP.h`<div class="li"><div class="li-ic" style="background:${BP.charts.hexA(BP.calc.mainColor(e.main), .16)}">${BP.calc.mainIcon(e.main)}</div><div class="li-main"><div class="li-t">${e.sub}</div><div class="li-s">${e.date}${e.desc ? ' · ' + e.desc : ''}</div></div><div class="li-v m-num">${BP.fmt(e.amount)}</div></div>`) : BP.ui.empty('📭', 'No expenses yet')}</div></div>
      </div>
    </div>`);
    BP.ui.pickPay(el, 'a');
  },
  onChange(e){
    if (e.target.id === 'a-cat'){ st.sub = e.target.value; document.getElementById('a-status').innerHTML = statusCard(st.sub).s; }
    if (e.target.id === 'a-date'){ st.date = e.target.value; document.getElementById('a-status').innerHTML = statusCard(st.sub).s; }
  },
  actions: {
    dismissWelcome(){ BP.db().settings.welcomeSeen = true; BP.store.persist(true); BP.app.refresh(); },
    preset(el){ st.sub = el.dataset.sub; BP.$('#a-cat').value = st.sub; document.getElementById('a-status').innerHTML = statusCard(st.sub).s; BP.$('#a-amt').focus(); },
    setDate(el){ const d = new Date(); d.setDate(d.getDate() + Number(el.dataset.d)); st.date = BP.toISO(d); BP.$('#a-date').value = st.date; document.getElementById('a-status').innerHTML = statusCard(st.sub).s; },
    submit(){
      if (!BP.auth.canEdit('add')) return;
      const amt = parseFloat(BP.$('#a-amt').value), sub = BP.$('#a-cat').value, date = BP.$('#a-date').value;
      if (!(amt > 0)) { BP.toast('Enter an amount', 'err'); BP.$('#a-amt').focus(); return; }
      if (!sub) { BP.toast('Select a category', 'err'); return; } if (!date) { BP.toast('Pick a date', 'err'); return; }
      st.pay = BP.ui.payValue(document, 'a'); const e = BP.actions.addExpense({ amount: amt, sub, date, pay: st.pay, desc: BP.$('#a-desc').value });
      BP.ui.month = e.month; st.sub = sub;
      BP.app.refresh(); const s = BP.actions.catStatus(sub, e.month);
      const f = BP.$('#a-flash'); if (f) f.innerHTML = BP.h`<div class="status-pill good" style="margin-top:14px">✅ Added <b>${BP.fmt(amt)} SAR</b> to ${sub}${s && s.budget ? ` — ${BP.fmt(Math.abs(s.left))} SAR ${s.left >= 0 ? 'left' : 'over'} this month` : ''}</div>`.s;
      BP.toast(`Added ${BP.fmt(amt)} SAR`, 'ok');
    }
  }
};
})();
