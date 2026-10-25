/* Budget Pro — Net Worth: assets, liabilities, monthly snapshots */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;

BP.views.networth = {
  render(el){
    const c = C(), d = BP.db(), nw = d.netWorth, t = c.nwTotals(), can = BP.auth.canEdit('networth');
    const assets = nw.accounts.filter(a => c.ASSET_TYPES.includes(a.type)).sort((a, b) => b.balance - a.balance), liabs = nw.accounts.filter(a => c.LIAB_TYPES.includes(a.type)).sort((a, b) => b.balance - a.balance);
    const hk = Object.keys(nw.history).sort(), hist = hk.map(k => ({ k, ...nw.history[k] }));
    const prev = hist.length ? hist[hist.length - 1] : null, ch = prev && prev.net ? (t.net - prev.net) / Math.abs(prev.net) * 100 : null;
    const ratio = t.assets ? t.liabilities / t.assets * 100 : 0;
    const acctRow = a => BP.h`<div class="li"><div class="li-ic">${c.NW_ICON[a.type] || '📦'}</div><div class="li-main"><div class="li-t">${a.name}</div><div class="li-s">${c.NW_LABEL[a.type] || a.type}${a.updated ? ' · updated ' + BP.fmtDate(a.updated.slice(0, 10)) : ''}</div></div><div class="li-v m-sal">${BP.fmt(a.balance)}</div>
      ${can ? BP.h`<div class="li-act"><button class="icon-btn" style="width:32px;height:32px" data-act="edit" data-id="${a.id}">${BP.icon('edit')}</button><button class="icon-btn" style="width:32px;height:32px;color:var(--red)" data-act="del" data-id="${a.id}">${BP.icon('x')}</button></div>` : ''}</div>`;
    BP.mount(el, BP.h`
    <div class="hero" style="margin-bottom:16px"><div class="row between wrap"><div><h2>Net worth</h2><div class="big m-sal" style="color:${t.net >= 0 ? 'var(--accent)' : 'var(--red)'}">${BP.fmt(t.net)} <small style="font-size:16px;color:var(--muted)">SAR</small></div>
      <div class="card-sub">${ch == null ? 'Save a snapshot to start tracking the trend' : `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}% vs last snapshot (${BP.fmtMonth(prev.k)})`}</div></div>
      ${can ? BP.h`<div class="row wrap"><button class="btn" data-act="fromWallet">👛 Create from wallet</button><button class="btn" data-act="snap">📸 Save ${BP.fmtMonth(BP.ymNow())} snapshot</button><button class="btn primary" data-act="edit">➕ Add account</button></div>` : ''}</div></div>
    <div class="grid g4 keep2">
      ${BP.ui.kpi({ label: 'Total assets', value: BP.fmt(t.assets), mask: 'sal', color: 'var(--green)', foot: `${assets.length} accounts${t.investments ? ' + investments' : ''}`, spark: hist.map(h => h.assets) })}
      ${BP.ui.kpi({ label: 'Total liabilities', value: BP.fmt(t.liabilities), mask: 'sal', color: 'var(--red)', foot: `${liabs.length} accounts`, spark: hist.map(h => h.liabilities) })}
      ${BP.ui.kpi({ label: 'Liquid (cash + bank + savings)', value: BP.fmt(c.liquid()), mask: 'sal', color: 'var(--blue)', foot: c.efMonths() != null ? c.efMonths().toFixed(1) + ' months of essentials' : '—' })}
      ${BP.ui.kpi({ label: 'Debt-to-asset ratio', value: ratio.toFixed(0) + '%', unit: false, color: 'var(--amber)', foot: ratio < 30 ? 'healthy' : ratio < 60 ? 'moderate' : 'high' })}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><div class="card-t big">Net worth history</div></div>${hist.length ? BP.ui.canvas('nwLine', 270) : BP.ui.empty('📸', 'No snapshots yet')}</div>
      <div class="card"><div class="card-h"><div class="card-t big">Asset mix</div></div>${assets.length || t.investments ? BP.ui.canvas('nwMix', 270) : BP.ui.empty('🍩', 'No assets yet')}</div>
      <div class="card"><div class="card-h"><div class="card-t big">🟢 Assets</div><b class="num m-sal" style="color:var(--green)">${BP.fmt(t.assets)}</b></div><div class="list">${assets.length || c.holdings().length ? assets.map(acctRow) : BP.ui.empty('🏦', 'Add bank accounts, cash, savings, gold…')}
        ${c.holdings().length ? BP.h`<div class="li" data-go="invest" style="cursor:pointer;background:var(--accent-soft);border-radius:10px;padding:9px 8px"><div class="li-ic">📈</div><div class="li-main"><div class="li-t">Investments portfolio</div><div class="li-s">${c.holdings().length} holdings · managed in the Investments tab →</div></div><div class="li-v m-sal">${BP.fmt(t.investments)}</div></div>` : ''}</div></div>
      <div class="card"><div class="card-h"><div class="card-t big">🔴 Liabilities</div><b class="num m-sal" style="color:var(--red)">${BP.fmt(t.liabilities)}</b></div><div class="list">${liabs.length ? liabs.map(acctRow) : BP.ui.empty('✅', 'No liabilities recorded')}</div></div>
      ${hist.length ? BP.h`<div class="card span2"><div class="card-h"><div class="card-t big">Assets vs liabilities</div></div>${BP.ui.canvas('nwBar', 240)}</div>
      <div class="card span2 pad0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Snapshot</th><th class="r">Assets</th><th class="r">Liabilities</th><th class="r">Net</th><th class="r">Change</th>${can ? BP.h`<th></th>` : ''}</tr></thead><tbody>
        ${hist.slice().reverse().map((h, i, arr) => { const p = arr[i + 1], dd = p ? h.net - p.net : null; return BP.h`<tr><td><b>${BP.fmtMonth(h.k)}</b>${h.demo ? BP.h` <span class="tag">demo</span>` : ''}</td><td class="r num m-sal">${BP.fmt(h.assets)}</td><td class="r num m-sal">${BP.fmt(h.liabilities)}</td><td class="r num m-sal"><b>${BP.fmt(h.net)}</b></td><td class="r num ${dd == null ? '' : dd >= 0 ? 'up' : 'down'}">${dd == null ? '—' : BP.signed(dd)}</td>${can ? BP.h`<td class="r"><button class="icon-btn" style="width:28px;height:28px;color:var(--red)" data-act="delSnap" data-k="${h.k}">${BP.icon('x')}</button></td>` : ''}</tr>`; })}</tbody></table></div></div>` : ''}
    </div>`);
    if (hist.length){
      BP.charts.make('nwLine', () => ({ type: 'line', data: { labels: hist.map(h => BP.monthShort(h.k) + " '" + h.k.slice(2, 4)), datasets: [{ label: 'Net worth', data: hist.map(h => h.net), borderColor: CH().css('--accent'), backgroundColor: ctx => ctx.chart.chartArea ? CH().vert(ctx.chart.ctx, ctx.chart.chartArea, CH().hexA(CH().css('--accent'), .4), CH().hexA(CH().css('--accent'), 0)) : 'transparent', fill: true, tension: .35, pointRadius: 4, borderWidth: 2.6 }] },
        options: { plugins: { legend: { display: false }, tooltip: CH().tipMoney }, scales: CH().scales({ y: { beginAtZero: false } }) } }));
      BP.charts.make('nwBar', () => ({ type: 'bar', data: { labels: hist.map(h => BP.monthShort(h.k) + " '" + h.k.slice(2, 4)), datasets: [{ label: 'Assets', data: hist.map(h => h.assets), backgroundColor: CH().css('--green'), borderRadius: 6 }, { label: 'Liabilities', data: hist.map(h => -h.liabilities), backgroundColor: CH().css('--red'), borderRadius: 6 }, { type: 'line', label: 'Net', data: hist.map(h => h.net), borderColor: CH().css('--accent'), pointRadius: 3, borderWidth: 2.2 }] },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: x => ` ${x.dataset.label}: ${BP.fmt(Math.abs(x.parsed.y))} SAR` } } }, scales: CH().scales({ x: { stacked: true }, y: { beginAtZero: true } }) } }));
    }
    if (assets.length || t.investments){ const by = {}; assets.forEach(a => { by[a.type] = (by[a.type] || 0) + Number(a.balance); }); if (t.investments) by.investment = (by.investment || 0) + t.investments; const ent = Object.entries(by).sort((a, b) => b[1] - a[1]), pal = CH().palette();
      BP.charts.make('nwMix', () => ({ type: 'doughnut', data: { labels: ent.map(x => (c.NW_ICON[x[0]] || '') + ' ' + c.NW_LABEL[x[0]]), datasets: [{ data: ent.map(x => x[1]), backgroundColor: ent.map((_, i) => pal[i % 8]), borderColor: CH().css('--card'), borderWidth: 3 }] }, options: { cutout: '66%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } }, centerText: { text: BP.fmtK(t.assets), sub: 'assets', size: 22 } } } })); }
  },
  actions: {
    edit(el){
      const c = C(), d = BP.db(), id = el && el.dataset.id, a = id ? d.netWorth.accounts.find(x => x.id === id) : null, v = a || { name: '', type: 'bank', balance: '' };
      const opts = [...c.ASSET_TYPES.map(t => [t, 'Asset']), ...c.LIAB_TYPES.map(t => [t, 'Liability'])];
      BP.modal.open({ title: a ? '✏️ Edit account' : '➕ New account', body: BP.h`<div class="form-grid"><div class="field"><label>Name</label><input class="inp" id="nw-name" value="${v.name}" placeholder="e.g. Al Rajhi current"></div>
        <div class="field"><label>Type</label><select class="sel" id="nw-type">${opts.map(([t, g]) => BP.h`<option value="${t}" ${t === v.type ? 'selected' : ''}>${c.NW_ICON[t]} ${c.NW_LABEL[t]} (${g})</option>`)}</select></div>
        <div class="field"><label>Balance (SAR)</label><input class="inp num" id="nw-bal" type="number" step="0.01" value="${v.balance}"></div></div><div class="card-sub" style="margin-top:8px">For liabilities enter the amount you owe as a positive number.</div>`,
        onOk(api){ const q = x => BP.$('#' + x, api.root); const o = { name: q('nw-name').value.trim(), type: q('nw-type').value, balance: parseFloat(q('nw-bal').value) || 0, updated: new Date().toISOString() };
          if (!o.name){ BP.toast('Name required', 'err'); return false; }
          if (a) Object.assign(a, o); else d.netWorth.accounts.push({ id: 'a' + BP.uid(), ...o }); BP.store.persist(); BP.app.renderView(true); } });
    },
    del(el){ BP.modal.confirm('Delete this account?', () => { const nw = BP.db().netWorth; nw.accounts = nw.accounts.filter(a => a.id !== el.dataset.id); BP.store.persist(); BP.app.renderView(true); }); },
    snap(){ const k = BP.ymNow(), t = C().nwTotals(); BP.db().netWorth.history[k] = { assets: t.assets, liabilities: t.liabilities, net: t.net, at: new Date().toISOString() }; BP.store.persist(); BP.toast(`Snapshot saved for ${BP.fmtMonth(k)}`, 'ok'); BP.app.renderView(true); },
    delSnap(el){ BP.modal.confirm(`Delete the ${BP.fmtMonth(el.dataset.k)} snapshot?`, () => { delete BP.db().netWorth.history[el.dataset.k]; BP.store.persist(); BP.app.renderView(true); }); },
    fromWallet(){
      const m = BP.ui.month, rows = C().walletRows(m).filter(r => r.left > 0); if (!rows.length) return BP.toast(`No positive wallet balances in ${BP.fmtMonth(m)}`, 'err');
      BP.modal.confirm(`Create or update ${rows.length} asset account(s) from the ${BP.fmtMonth(m)} wallet balances (${rows.map(r => r.name + ' ' + BP.fmt(r.left)).join(', ')})?`, () => {
        const acc = BP.db().netWorth.accounts; rows.forEach(r => { const nm = `Wallet · ${r.name}`, ex = acc.find(a => a.name === nm); const type = r.name.toLowerCase() === 'cash' ? 'cash' : 'bank';
          if (ex) Object.assign(ex, { balance: r.left, updated: new Date().toISOString() }); else acc.push({ id: 'a' + BP.uid(), name: nm, type, balance: r.left, updated: new Date().toISOString() }); });
        BP.store.persist(); BP.toast('Accounts updated from wallet', 'ok'); BP.app.renderView(true); }, { okText: 'Create', danger: false });
    }
  }
};
})();
