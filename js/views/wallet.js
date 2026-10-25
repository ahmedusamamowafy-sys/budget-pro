/* Budget Pro — Wallet: allocation per payment method vs spent */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;

BP.views.wallet = {
  render(el){
    const c = C(), m = BP.ui.month, d = BP.db(), w = c.wallet(m), rows = c.walletRows(m), can = BP.auth.canEdit('wallet');
    const src = w && w.source ? Number(w.source.amount) || 0 : 0, alloc = BP.sum(rows, r => r.alloc), spent = BP.sum(rows, r => r.spent), left = alloc - spent;
    BP.mount(el, BP.h`${BP.ui.monthStrip(c.months(), m)}
    <div class="grid g4 keep2" style="margin-top:8px">
      ${BP.ui.kpi({ label: w && w.source ? 'Source · ' + w.source.name : 'Source', value: BP.fmt(src), mask: 'sal', color: 'var(--blue)', foot: src ? BP.fmt(src - alloc) + ' not allocated' : 'set your funding source' })}
      ${BP.ui.kpi({ label: 'Allocated', value: BP.fmt(alloc), mask: 'sal', color: 'var(--purple)', foot: `${rows.filter(r => r.alloc).length} methods` })}
      ${BP.ui.kpi({ label: 'Spent', value: BP.fmt(spent), color: 'var(--red)', foot: BP.pct(spent, alloc) + ' of allocated' })}
      ${BP.ui.kpi({ label: 'Left in wallets', value: BP.fmt(left), valColor: left >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--green)' })}</div>
    <div class="row between" style="margin:16px 0 8px"><div><div class="card-t big">${BP.fmtMonth(m, true)} wallet</div><div class="card-sub">Opening snapshot — what you had on each card and in cash before budgeting with the app</div></div>${can ? BP.h`<div class="row"><button class="btn sm" data-act="copyPrev">⏮ Copy last month</button><button class="btn sm primary" data-act="edit">✏️ Edit allocation</button></div>` : ''}</div>
    ${rows.length ? BP.h`<div class="grid g2">
      <div class="card"><div class="card-h"><div class="card-t big">Allocated vs spent</div></div>${BP.ui.canvas('wlBar', 290)}</div>
      <div class="card"><div class="card-h"><div class="card-t big">Where money left</div></div>${spent ? BP.ui.canvas('wlDon', 290) : BP.ui.empty('🍩', 'No spending yet')}</div>
      <div class="card span2"><div class="card-h"><div class="card-t big">Balance per method</div></div><div class="grid g3">${rows.map(r => { const p = r.alloc ? r.spent / r.alloc * 100 : (r.spent ? 100 : 0), col = r.left < 0 ? 'var(--red)' : p > 80 ? 'var(--amber)' : 'var(--green)';
        return BP.h`<div class="card" style="background:var(--surface)"><div class="row between"><b>💳 ${r.name}</b><span class="tag" style="color:${col}">${p.toFixed(0)}%</span></div><div class="num m-num" style="font-size:20px;font-weight:700;margin:8px 0;color:${col}">${BP.fmt(r.left)} <small class="muted" style="font-size:12px">left</small></div><div class="bar"><i style="width:${Math.min(100, p)}%;background:${col}"></i></div><div class="row between card-sub" style="margin-top:8px"><span>Allocated <b class="num m-num">${BP.fmt(r.alloc)}</b></span><span>Spent <b class="num m-num">${BP.fmt(r.spent)}</b></span></div></div>`; })}</div></div>
    </div>` : BP.ui.empty('👛', `No wallet set for ${BP.fmtMonth(m)} yet — press “Edit allocation” to split your salary across cards and cash.`)}`);
    if (rows.length){
      BP.charts.make('wlBar', () => ({ type: 'bar', data: { labels: rows.map(r => r.name), datasets: [{ label: 'Allocated', data: rows.map(r => r.alloc), backgroundColor: CH().hexA(CH().css('--purple'), .65), borderRadius: 6 }, { label: 'Spent', data: rows.map(r => r.spent), backgroundColor: rows.map(r => r.left < 0 ? CH().css('--red') : CH().css('--accent')), borderRadius: 6 }] },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales({ rot: 30 }) } }));
      const sp = rows.filter(r => r.spent), pal = CH().palette();
      if (sp.length) BP.charts.make('wlDon', () => ({ type: 'doughnut', data: { labels: sp.map(r => r.name), datasets: [{ data: sp.map(r => r.spent), backgroundColor: sp.map((_, i) => pal[i % 8]), borderColor: CH().css('--card'), borderWidth: 3 }] }, options: { cutout: '66%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } }, centerText: { text: BP.fmtK(spent), sub: 'SAR', size: 22 } } } }));
    }
  },
  actions: {
    copyPrev(){ const m = BP.ui.month, ks = Object.keys(BP.db().wallet).filter(k => k < m).sort(); if (!ks.length) return BP.toast('No earlier wallet to copy', 'err'); const w = BP.db().wallet[ks[ks.length - 1]]; BP.db().wallet[m] = BP.clone(w); BP.store.persist(); BP.toast(`Copied from ${BP.fmtMonth(ks[ks.length - 1])}`, 'ok'); BP.app.renderView(true); },
    edit(){
      const m = BP.ui.month, d = BP.db(), w = d.wallet[m] || { source: { name: 'Salary', amount: BP.calc.salary(m) }, alloc: {} };
      BP.modal.open({ title: `👛 ${BP.fmtMonth(m, true)} wallet`, wide: true, body: BP.h`<div class="form-grid"><div class="field"><label>Funding source</label><input class="inp" id="wl-sn" value="${w.source ? w.source.name : ''}" placeholder="e.g. RIY"></div><div class="field"><label>Source amount (SAR)</label><input class="inp num" id="wl-sa" type="number" value="${w.source ? w.source.amount : ''}"></div></div>
        <div class="sp"></div><div class="card-sub" style="margin-bottom:8px">Allocate to each payment method</div><div class="form-grid">${d.payMethods.map(p => BP.h`<div class="field"><label>${p}</label><input class="inp num" data-wl="${p}" type="number" value="${w.alloc[p] || ''}" placeholder="0"></div>`)}</div>
        <div class="card-sub" id="wl-sum" style="margin-top:8px"></div>`,
        onOpen(api){ const upd = () => { const t = BP.sum(BP.$$('[data-wl]', api.root), i => parseFloat(i.value) || 0), s = parseFloat(BP.$('#wl-sa', api.root).value) || 0; BP.$('#wl-sum', api.root).innerHTML = `Allocated <b>${BP.fmt(t)}</b> of ${BP.fmt(s)} · ${s - t >= 0 ? BP.fmt(s - t) + ' unallocated' : '<span style="color:var(--red)">' + BP.fmt(t - s) + ' over source</span>'}`; }; api.root.addEventListener('input', upd); upd(); },
        onOk(api){ const alloc = {}; BP.$$('[data-wl]', api.root).forEach(i => { const v = parseFloat(i.value); if (v) alloc[i.dataset.wl] = v; });
          d.wallet[m] = { source: { name: BP.$('#wl-sn', api.root).value.trim() || 'Source', amount: parseFloat(BP.$('#wl-sa', api.root).value) || 0 }, alloc }; BP.store.persist(); BP.toast('Wallet saved', 'ok'); BP.app.renderView(true); } });
    }
  }
};
})();
