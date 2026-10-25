/* Budget Pro — Saving Boxes (plan ledger), Spendable table, named savings boxes */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;
const st = { sec: 'sheet', spsec: 'sheet' };
const SECS = [['sheet', '📋 Sheet'], ['ledger', '📦 Ledger & charts'], ['named', '🏺 My savings boxes']];

BP.views.savingboxes = {
  render(el){
    BP.mount(el, BP.h`<div class="tabs-sub"><div class="seg">${SECS.map(([k, l]) => BP.h`<button class="${st.sec === k ? 'on' : ''}" data-act="sec" data-k="${k}">${l}</button>`)}</div></div><div id="bxBody"></div>`);
    ({ sheet: e => BP.sheetView(e, 'Saving Box'), ledger, spendable, named })[st.sec](BP.$('#bxBody', el));
  },
  actions: {
    sec(el){ st.sec = el.dataset.k; BP.app.renderView(true); },
    sheetEdit(el){ BP.sheetEdit(el); },
    addBox(){ boxModal(); }, editBox(el){ boxModal(el.dataset.id); },
    delBox(el){ BP.modal.confirm('Delete this savings box and its history?', () => { const d = BP.db(); d.boxes = d.boxes.filter(b => b.id !== el.dataset.id); BP.store.persist(); BP.app.renderView(true); }); },
    dep(el){ txModal(el.dataset.id, 'deposit'); }, wd(el){ txModal(el.dataset.id, 'withdraw'); },
    hist(el){ const b = BP.db().boxes.find(x => x.id === el.dataset.id); if (!b) return;
      BP.modal.open({ title: `📜 ${b.name} — history`, actions: false, wide: true, body: BP.h`<div class="list">${(b.tx || []).slice().reverse().map(t => BP.h`<div class="li"><div class="li-ic">${t.type === 'withdraw' ? '⬇️' : t.type === 'init' ? '🏁' : '⬆️'}</div><div class="li-main"><div class="li-t">${t.type === 'withdraw' ? 'Withdrawal' : t.type === 'init' ? 'Initial balance' : 'Deposit'}</div><div class="li-s">${BP.fmtDT(t.date)}${t.note ? ' · ' + t.note : ''}</div></div><div class="li-v" style="color:${t.type === 'withdraw' ? 'var(--red)' : 'var(--green)'}">${t.type === 'withdraw' ? '−' : '+'}${BP.fmt(t.amount)}</div></div>`) || ''}${!(b.tx || []).length ? BP.ui.empty('📜', 'No transactions') : ''}</div>` }); }
  }
};

/* ---------- ledger ---------- */
function ledger(el){
  const c = C(), m = BP.ui.month, cats = c.catsOf('Saving Box'), cur = BP.ymNow();
  const rows = cats.map(x => { const b = c.budgetOf(m, x.sub), s = BP.sum(c.expOf(m).filter(e => e.sub === x.sub), e => e.amount); return { x, b, s, net: b - s, bal: c.boxBalance(x.sub, m) }; });
  const tb = BP.sum(rows, r => r.b), ts = BP.sum(rows, r => r.s), tbal = BP.sum(rows, r => r.bal);
  const hist = c.dataMonths().filter(mm => mm <= m).slice(-8);
  BP.mount(el, BP.h`${BP.ui.monthStrip(c.months(), m)}
  <div class="grid g4 keep2" style="margin-top:8px">
    ${BP.ui.kpi({ label: 'Planned deposits', value: BP.fmt(tb), mask: 'sal', color: 'var(--purple)', foot: `${cats.length} boxes` })}
    ${BP.ui.kpi({ label: 'Drawn this month', value: BP.fmt(ts), color: 'var(--red)', foot: BP.pct(ts, tb) + ' of deposits' })}
    ${BP.ui.kpi({ label: 'Net movement', value: BP.signed(tb - ts), valColor: tb - ts >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--green)' })}
    ${BP.ui.kpi({ label: 'Total running balance', value: BP.fmt(tbal), mask: 'sal', color: 'var(--accent)', foot: 'all boxes, cumulative' })}</div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><div class="card-h"><div class="card-t big">Deposit vs drawn</div></div>${rows.some(r => r.b || r.s) ? BP.ui.canvas('bxBar', 280) : BP.ui.empty('📦', 'No saving-box plan')}</div>
    <div class="card"><div class="card-h"><div class="card-t big">Where the balance sits</div></div>${rows.some(r => r.bal > 0) ? BP.ui.canvas('bxDon', 280) : BP.ui.empty('🍩', 'No balance yet')}</div>
    <div class="card span2"><div class="card-h"><div class="card-t big">Total balance over time</div></div>${hist.length ? BP.ui.canvas('bxLine', 240) : ''}</div>
    <div class="card span2 pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Saving box</th><th class="r">Planned</th><th class="r">Drawn</th><th class="r">Month net</th><th class="r">Running balance</th></tr></thead><tbody>
      ${rows.map(r => BP.h`<tr><td>${BP.ui.catChip(r.x.main)} <b>${r.x.sub}</b> <span class="faint">· ${r.x.main}</span></td><td class="r num m-sal">${BP.fmt(r.b)}</td><td class="r num m-num">${BP.fmt(r.s)}</td><td class="r num ${r.net >= 0 ? 'up' : 'down'}">${BP.signed(r.net)}</td><td class="r num m-sal ${r.bal >= 0 ? '' : 'down'}"><b>${BP.fmt(r.bal)}</b></td></tr>`)}
      ${rows.length ? BP.h`<tr style="font-weight:700"><td>Total</td><td class="r num m-sal">${BP.fmt(tb)}</td><td class="r num m-num">${BP.fmt(ts)}</td><td class="r num ${tb - ts >= 0 ? 'up' : 'down'}">${BP.signed(tb - ts)}</td><td class="r num m-sal">${BP.fmt(tbal)}</td></tr>` : BP.h`<tr><td colspan="5" class="center muted" style="padding:24px">No Saving Box categories</td></tr>`}</tbody></table></div></div></div>`);
  const act = rows.filter(r => r.b || r.s);
  if (act.length) BP.charts.make('bxBar', () => ({ type: 'bar', data: { labels: act.map(r => r.x.sub), datasets: [{ label: 'Planned', data: act.map(r => r.b), backgroundColor: CH().hexA(CH().css('--purple'), .7), borderRadius: 6 }, { label: 'Drawn', data: act.map(r => r.s), backgroundColor: CH().css('--red'), borderRadius: 6 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales({ rot: 35 }) } }));
  const pos = rows.filter(r => r.bal > 0).sort((a, b) => b.bal - a.bal), pal = CH().palette();
  if (pos.length) BP.charts.make('bxDon', () => ({ type: 'doughnut', data: { labels: pos.map(r => r.x.sub), datasets: [{ data: pos.map(r => r.bal), backgroundColor: pos.map((_, i) => pal[i % 8]), borderColor: CH().css('--card'), borderWidth: 3 }] }, options: { cutout: '66%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } }, centerText: { text: BP.fmtK(tbal), sub: 'SAR', size: 22 } } } }));
  if (hist.length) BP.charts.make('bxLine', () => ({ type: 'line', data: { labels: hist.map(mm => BP.monthShort(mm) + " '" + mm.slice(2, 4)), datasets: [{ label: 'Total balance', data: hist.map(mm => BP.sum(cats, x => c.boxBalance(x.sub, mm))), borderColor: CH().css('--purple'), backgroundColor: ctx => ctx.chart.chartArea ? CH().vert(ctx.chart.ctx, ctx.chart.chartArea, CH().hexA(CH().css('--purple'), .4), CH().hexA(CH().css('--purple'), 0)) : 'transparent', fill: true, tension: .35, pointRadius: 4, borderWidth: 2.6 }] }, options: { plugins: { legend: { display: false }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
}

/* ---------- spendable ---------- */
function spendable(el){
  const c = C(), m = BP.ui.month, groups = c.groupByMain(c.catsOf('Spendable'));
  const rows = Object.entries(groups).map(([main, items]) => ({ main, items: items.map(x => { const b = c.budgetOf(m, x.sub), s = BP.sum(c.expOf(m).filter(e => e.sub === x.sub), e => e.amount); return { x, b, s, left: b - s, p: b ? s / b * 100 : (s ? 100 : 0) }; }) }));
  const tb = BP.sum(rows, g => BP.sum(g.items, i => i.b)), ts = BP.sum(rows, g => BP.sum(g.items, i => i.s));
  const flat = rows.flatMap(g => g.items).filter(i => i.b || i.s);
  BP.mount(el, BP.h`${BP.ui.monthStrip(c.months(), m)}
  <div class="grid g3 keep2" style="margin-top:8px">${BP.ui.kpi({ label: 'Spendable budget', value: BP.fmt(tb), mask: 'sal', color: 'var(--green)' })}${BP.ui.kpi({ label: 'Spent', value: BP.fmt(ts), color: 'var(--red)', foot: BP.pct(ts, tb) + ' used' })}${BP.ui.kpi({ label: 'Left', value: BP.fmt(tb - ts), valColor: tb - ts >= 0 ? 'var(--green)' : 'var(--red)', color: 'var(--accent)' })}</div>
  <div class="card" style="margin-top:16px"><div class="card-h"><div class="card-t big">Budget usage by sub-category</div></div>${flat.length ? BP.ui.canvas('spBar', 60 + flat.length * 24) : BP.ui.empty('💸', 'No spendable plan')}</div>
  ${rows.filter(g => g.items.some(i => i.b || i.s)).map(g => BP.h`<div class="card" style="margin-top:16px;padding-bottom:6px"><div class="row between"><div class="row">${BP.ui.catChip(g.main)}<b>${g.main}</b></div><b class="num m-num">${BP.fmt(BP.sum(g.items, i => i.s))} / ${BP.fmt(BP.sum(g.items, i => i.b))}</b></div>
    <div style="margin-top:10px">${g.items.filter(i => i.b || i.s).map(i => BP.h`<div class="cat-row"><span class="faint" style="font-size:11px;width:20px">${i.x.necessity === 'Must' ? '●' : '○'}</span><div><div class="row between"><span class="nm">${i.x.sub}</span><span class="sm num m-num">${BP.fmt(i.s)} / ${BP.fmt(i.b)}</span></div><div class="bar thin" style="margin-top:5px"><i style="width:${Math.min(100, i.p)}%;background:${i.s > i.b && i.b ? 'var(--red)' : i.p > 80 ? 'var(--amber)' : 'var(--green)'}"></i></div></div><span class="num sm" style="min-width:70px;text-align:right;color:${i.left >= 0 ? 'var(--green)' : 'var(--red)'}">${i.b ? (i.left >= 0 ? BP.fmt(i.left) + ' left' : BP.fmt(-i.left) + ' over') : '—'}</span></div>`)}</div></div>`)}`);
  if (flat.length) BP.charts.make('spBar', () => ({ type: 'bar', data: { labels: flat.map(i => i.x.sub), datasets: [{ label: 'Budget', data: flat.map(i => i.b), backgroundColor: CH().hexA(CH().css('--blue'), .45), borderRadius: 5 }, { label: 'Spent', data: flat.map(i => i.s), backgroundColor: flat.map(i => i.b && i.s > i.b ? CH().css('--red') : CH().css('--accent')), borderRadius: 5 }] },
    options: { indexAxis: 'y', interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: x => ` ${x.dataset.label}: ${BP.fmt(x.parsed.x)} SAR` } } }, scales: { x: { ...CH().scales().y, ticks: { callback: v => BP.fmtK(v) } }, y: { grid: { display: false }, border: { display: false } } } } }));
}

/* ---------- named savings boxes ---------- */
function named(el){
  const d = BP.db(), can = BP.auth.canEdit('savingboxes'), tot = BP.sum(d.boxes, b => b.balance || 0), tgt = BP.sum(d.boxes, b => b.target || 0);
  BP.mount(el, BP.h`<div class="grid g3 keep2" style="margin-bottom:16px">${BP.ui.kpi({ label: 'Boxes', value: d.boxes.length, unit: false, color: 'var(--blue)' })}${BP.ui.kpi({ label: 'Total saved', value: BP.fmt(tot), mask: 'sal', color: 'var(--green)' })}${BP.ui.kpi({ label: 'Total target', value: BP.fmt(tgt), mask: 'sal', color: 'var(--purple)', foot: BP.pct(tot, tgt) + ' funded' })}</div>
  <div class="card"><div class="card-h"><div class="card-t big">🏺 Savings boxes</div>${can ? BP.h`<button class="btn sm primary" data-act="addBox">➕ New box</button>` : ''}</div>
  ${d.boxes.length ? BP.h`<div class="grid g3">${d.boxes.map(b => { const p = b.target ? BP.clamp(b.balance / b.target * 100, 0, 100) : 0, col = b.color || '#34D399';
    return BP.h`<div class="card box-card" style="background:var(--surface);border-top:3px solid ${col}"><div class="row between"><div class="row"><div class="li-ic" style="background:${CH().hexA(col, .18)}">${b.icon || '🏺'}</div><div><b>${b.name}</b><div class="card-sub">${b.notes || ''}</div></div></div>${can ? BP.h`<div class="row"><button class="icon-btn" style="width:30px;height:30px" data-act="editBox" data-id="${b.id}">${BP.icon('edit')}</button><button class="icon-btn" style="width:30px;height:30px;color:var(--red)" data-act="delBox" data-id="${b.id}">${BP.icon('x')}</button></div>` : ''}</div>
      <div class="num m-num" style="font-size:21px;font-weight:700;margin:12px 0 4px">${BP.fmt(b.balance || 0)} <small class="muted" style="font-size:13px">${b.target ? '/ ' + BP.fmt(b.target) : 'SAR'}</small></div>
      ${b.target ? BP.h`<div class="bar tall"><i style="width:${p}%;background:${col}"></i></div><div class="card-sub" style="margin-top:6px">${p.toFixed(0)}% funded · ${BP.fmt(Math.max(0, b.target - b.balance))} to go</div>` : ''}
      <div class="row" style="margin-top:12px;gap:6px">${can ? BP.h`<button class="btn sm grow" data-act="dep" data-id="${b.id}">⬆ Deposit</button><button class="btn sm grow" data-act="wd" data-id="${b.id}">⬇ Withdraw</button>` : ''}<button class="btn sm ghost" data-act="hist" data-id="${b.id}">📜</button></div></div>`; })}</div>` : BP.ui.empty('🏺', 'Create a box for a goal — Umrah, wedding, car, travel…')}</div>
  ${d.boxes.length ? BP.h`<div class="card" style="margin-top:16px"><div class="card-h"><div class="card-t big">Funding progress</div></div>${BP.ui.canvas('nbBar', 40 + d.boxes.length * 34)}</div>` : ''}`);
  if (d.boxes.length) BP.charts.make('nbBar', () => ({ type: 'bar', data: { labels: d.boxes.map(b => b.name), datasets: [{ label: 'Saved', data: d.boxes.map(b => b.balance || 0), backgroundColor: d.boxes.map(b => b.color || CH().css('--green')), borderRadius: 6 }, { label: 'Remaining', data: d.boxes.map(b => Math.max(0, (b.target || 0) - (b.balance || 0))), backgroundColor: CH().css('--surface2') || 'rgba(128,128,128,.25)', borderRadius: 6 }] },
    options: { indexAxis: 'y', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: x => ` ${x.dataset.label}: ${BP.fmt(x.parsed.x)} SAR` } } }, scales: { x: { ...CH().scales().y, stacked: true, ticks: { callback: v => BP.fmtK(v) } }, y: { stacked: true, grid: { display: false }, border: { display: false } } } } }));
}
function boxModal(id){
  const d = BP.db(), b = id ? d.boxes.find(x => x.id === id) : null, v = b || { name: '', icon: '🏺', color: '#34D399', target: '', balance: 0, notes: '' };
  BP.modal.open({ title: b ? '✏️ Edit box' : '🏺 New savings box', body: BP.h`<div class="form-grid"><div class="field"><label>Name</label><input class="inp" id="bx-name" value="${v.name}"></div><div class="field"><label>Icon</label><input class="inp" id="bx-ic" value="${v.icon}" maxlength="4"></div>
    <div class="field"><label>Target (SAR)</label><input class="inp num" id="bx-target" type="number" value="${v.target}"></div>${b ? '' : BP.h`<div class="field"><label>Starting balance</label><input class="inp num" id="bx-bal" type="number" value="0"></div>`}
    <div class="field"><label>Colour</label><input class="inp" id="bx-col" type="color" value="${v.color}" style="height:44px;padding:4px"></div><div class="field"><label>Notes</label><input class="inp" id="bx-notes" value="${v.notes || ''}"></div></div>`,
    onOk(api){ const q = x => BP.$('#' + x, api.root); const name = q('bx-name').value.trim(); if (!name){ BP.toast('Name required', 'err'); return false; }
      const o = { name, icon: q('bx-ic').value || '🏺', target: parseFloat(q('bx-target').value) || 0, color: q('bx-col').value, notes: q('bx-notes').value };
      if (b) Object.assign(b, o); else { const bal = parseFloat(q('bx-bal').value) || 0; d.boxes.push({ id: 'b' + BP.uid(), ...o, balance: bal, tx: bal ? [{ type: 'init', amount: bal, note: 'Initial balance', date: new Date().toISOString() }] : [] }); }
      BP.store.persist(); BP.app.renderView(true); } });
}
function txModal(id, type){
  const b = BP.db().boxes.find(x => x.id === id); if (!b) return;
  BP.modal.open({ title: `${type === 'deposit' ? '⬆ Deposit to' : '⬇ Withdraw from'} ${b.name}`, body: BP.h`<div class="field"><label>Amount (SAR)</label><input class="inp num" id="tx-amt" type="number" step="0.01"></div><div class="field"><label>Note</label><input class="inp" id="tx-note"></div>`, okText: type === 'deposit' ? 'Deposit' : 'Withdraw',
    onOk(api){ const a = parseFloat(BP.$('#tx-amt', api.root).value); if (!(a > 0)){ BP.toast('Enter an amount', 'err'); return false; }
      if (type === 'withdraw' && a > (b.balance || 0)){ BP.toast('Not enough balance', 'err'); return false; }
      b.balance = (b.balance || 0) + (type === 'deposit' ? a : -a); (b.tx = b.tx || []).push({ type, amount: a, note: BP.$('#tx-note', api.root).value, date: new Date().toISOString() }); BP.store.persist(); BP.toast('Saved', 'ok'); BP.app.renderView(true); } });
}
BP.views.spendable = {
  render(el){
    BP.mount(el, BP.h`<div class="tabs-sub"><div class="seg">${[['sheet', '📋 Sheet'], ['usage', '📊 Usage this month']].map(([k, l]) => BP.h`<button class="${st.spsec === k ? 'on' : ''}" data-act="sec" data-k="${k}">${l}</button>`)}</div></div><div id="spBody"></div>`);
    if (st.spsec === 'sheet') BP.sheetView(BP.$('#spBody', el), 'Spendable'); else spendable(BP.$('#spBody', el));
  },
  actions: { sec(el){ st.spsec = el.dataset.k; BP.app.renderView(true); }, sheetEdit(el){ BP.sheetEdit(el); } }
};
})();
