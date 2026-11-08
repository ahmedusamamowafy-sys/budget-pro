/* Budget Pro — Emergency Fund: necessary vs unnecessary items, balance per saving box / average spend per spendable item,
   and how many months the money you hold covers your necessary expenses */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc, CH = () => BP.charts;
const st = { filter: 'all', sort: 'need' };
const SRC = [
  ['liquid', '🏦 Cash & bank accounts', 'Bank / cash / savings accounts in Net Worth'],
  ['boxes', '📦 Saving-box balances', 'What is left in all saving boxes (planned deposits − spent)'],
  ['pot', '📈 Investment pot (not invested yet)', 'Investment budget still waiting to be invested'],
  ['invest', '💹 Investments (current value)', 'Gold, currencies, stocks… — can be sold in an emergency']
];
const col = m => m == null ? 'var(--muted)' : m < 3 ? 'var(--red)' : m < 6 ? 'var(--amber)' : 'var(--green)';
const moTxt = m => m == null ? '—' : m >= 100 ? '99+' : m.toFixed(1);
const days = m => Math.round((m - Math.floor(m)) * 30);

function save(){ BP.store.persist(); BP.app.renderView(true); }
function cfg(){ const s = BP.db().settings; s.ef = C().efCfg(); return s.ef; }

BP.views.emergency = {
  render(el){
    const c = C(), e = c.ef(), can = BP.auth.canEdit('emergency'), target = Number(e.cfg.target) || 6;
    const m = e.months, gap = Math.max(0, target * e.need - e.total), win = e.window;
    let rows = e.rows.filter(r => st.filter === 'all' || (st.filter === 'nec' ? r.nec : !r.nec));
    const sorter = { need: (a, b) => b.need - a.need, name: (a, b) => a.sub.localeCompare(b.sub), type: (a, b) => a.type.localeCompare(b.type) || b.need - a.need }[st.sort];
    const nec = rows.filter(r => r.nec).sort(sorter), un = rows.filter(r => !r.nec).sort(sorter);
    const fullMonths = Math.floor(m || 0), shortBoxes = e.nec.filter(r => r.type === 'Saving Box' && r.bal < 0);
    const byMain = {}; e.nec.forEach(r => { byMain[r.main] = (byMain[r.main] || 0) + r.need; });
    const top = e.nec.slice().sort((a, b) => b.need - a.need).slice(0, 3), topShare = e.need ? BP.sum(top, r => r.need) / e.need * 100 : 0;
    const cutGain = e.need && e.unNeed ? e.total / e.need - e.total / (e.need + e.unNeed) : 0;

    const row = r => BP.h`<tr class="${r.nec ? 'ef-nec' : 'ef-un'}">
      <td><div class="row" style="gap:8px"><span class="ef-ic" style="background:${CH().hexA(c.mainColor(r.main), .16)}">${c.mainIcon(r.main)}</span><div><b>${r.sub}</b><div class="faint" style="font-size:11px">${r.main}</div></div></div></td>
      <td><span class="tag ${r.type === 'Saving Box' ? 'sb' : 'sp'}">${r.type === 'Saving Box' ? 'Saving box' : 'Spendable'}</span></td>
      <td>${can ? BP.h`<button class="ef-tog ${r.nec ? 'on' : ''}" data-act="tog" data-sub="${r.sub}" title="Click to change">${r.nec ? '✅ Necessary' : '➖ Unnecessary'}</button>` : BP.h`<span class="ef-tog ${r.nec ? 'on' : ''}">${r.nec ? '✅ Necessary' : '➖ Unnecessary'}</span>`}</td>
      <td class="r num m-sal">${r.plan ? BP.fmt(r.plan) : '–'}</td>
      <td class="r num m-num">${r.type === 'Saving Box'
        ? BP.h`<b class="${r.bal < 0 ? 'down' : ''}">${BP.fmt(r.bal)}</b><div class="faint" style="font-size:10px">available in box</div>`
        : BP.h`<b>${BP.fmt(r.avg)}</b><div class="faint" style="font-size:10px">avg / month</div>`}</td>
      <td class="r num m-sal"><b>${r.need ? BP.fmt(r.need) : '–'}</b></td>
      <td class="r num">${r.type === 'Saving Box' && r.need ? BP.h`<span style="color:${col(r.own)}">${moTxt(r.own)} mo</span>` : '–'}</td></tr>`;
    const head = (label, list, cls) => BP.h`<tr class="ef-grp ${cls}"><td colspan="5"><b>${label}</b> <span class="faint">· ${list.length} item${list.length === 1 ? '' : 's'}</span></td><td class="r num m-sal"><b>${BP.fmt(BP.sum(list, r => r.need))}</b></td><td class="r faint" style="font-size:11px">/ month</td></tr>`;

    BP.mount(el, BP.h`
    <div class="hero" style="margin-bottom:14px"><div class="row between wrap" style="gap:18px;align-items:flex-start">
      <div style="min-width:260px;flex:1.4">
        <h2>🛡️ Emergency fund · how long your money lasts</h2>
        <div class="big" style="color:${col(m)}">${moTxt(m)} <small style="font-size:16px;color:var(--muted)">months</small></div>
        <div class="card-sub" style="font-size:13.5px;line-height:1.55;margin:6px 0 12px">${e.need
          ? BP.h`Your <b class="m-sal">${BP.fmt(e.total)} SAR</b> covers <b>${fullMonths} month${fullMonths === 1 ? '' : 's'}${days(m) ? ' and ' + days(m) + ' days' : ''}</b> of your <b>${e.nec.length} necessary items</b> (<span class="m-sal">${BP.fmt(e.need)}</span> SAR / month)${e.monthsAll != null ? BP.h` — or <b>${moTxt(e.monthsAll)} months</b> if you kept every item.` : '.'}`
          : 'Mark at least one item as necessary below.'}</div>
        <div class="ef-bar">${Array.from({ length: 12 }, (_, i) => BP.h`<i class="${m != null && i < Math.min(12, Math.floor(m)) ? 'on ' + (m < 3 ? 'red' : m < 6 ? 'yellow' : 'green') : ''}" title="month ${i + 1}"></i>`)}</div>
        <div class="row between faint" style="font-size:11px;margin-top:4px"><span>1 month</span><span>target ${target}</span><span>12 months</span></div>
      </div>
      <div class="ef-ring" style="--p:${Math.min(100, m == null ? 0 : m / target * 100)};--c:${col(m)}"><div><b class="num">${m == null ? '—' : Math.min(999, Math.round(m / target * 100)) + '%'}</b><span>of ${target}-month target</span></div></div>
    </div></div>

    <div class="grid g4 keep2">
      ${BP.ui.kpi({ label: 'Money available', value: BP.fmt(e.total), mask: 'sal', color: 'var(--blue)', foot: SRC.filter(s => e.cfg[s[0]]).map(s => s[1].split(' ').slice(1).join(' ')).join(' + ') + (e.src.extra ? ' + extra' : '') })}
      ${BP.ui.kpi({ label: 'Necessary / month', value: BP.fmt(e.need), mask: 'sal', color: 'var(--red)', foot: `${e.nec.length} items · avg of ${win.length} month${win.length === 1 ? '' : 's'}` })}
      ${BP.ui.kpi({ label: 'Unnecessary / month', value: BP.fmt(e.unNeed), mask: 'sal', color: 'var(--amber)', foot: `${e.un.length} items you could pause` })}
      ${BP.ui.kpi({ label: gap ? `Missing for ${target} months` : `${target}-month target`, value: gap ? BP.fmt(gap) : '✓ reached', mask: gap ? 'sal' : '', unit: gap ? undefined : false, valColor: gap ? 'var(--red)' : 'var(--green)', color: 'var(--green)', foot: gap ? `≈ ${BP.fmt(gap / 12)} SAR/month to close it in a year` : `${BP.fmt(e.total - target * e.need)} SAR above target` })}
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><div class="card-h"><div class="card-t big">📝 Summary</div><span class="card-sub">based on your data today</span></div>
        <div class="ef-sum">
          ${!e.need ? BP.h`<div class="insight warn">No necessary items selected yet — mark them in the table below.</div>` : ''}
          ${e.need ? BP.h`<div class="insight ${m < 3 ? 'bad' : m < 6 ? 'warn' : 'good'}">${m < 3 ? '🚨' : m < 6 ? '⚠️' : '✅'} You can live <b>${moTxt(m)} months</b> on necessary expenses only. ${m < 3 ? 'That is below the 3-month minimum — building this up comes before new investments.' : m < 6 ? 'Healthy minimum reached; the usual goal is 6 months.' : 'You have a full 6-month safety net.'}</div>` : ''}
          ${gap ? BP.h`<div class="insight">🎯 To reach <b>${target} months</b> you need <b class="m-sal">${BP.fmt(gap)}</b> SAR more — about <b class="m-sal">${BP.fmt(gap / 6)}</b>/month for 6 months or <b class="m-sal">${BP.fmt(gap / 12)}</b>/month for 12 months.</div>` : ''}
          ${e.unNeed && e.need ? BP.h`<div class="insight">✂️ In an emergency, pausing the <b>${e.un.length} unnecessary items</b> saves <b class="m-sal">${BP.fmt(e.unNeed)}</b> SAR/month and gives you <b>${cutGain.toFixed(1)} extra months</b> compared with keeping everything.</div>` : ''}
          ${top.length ? BP.h`<div class="insight">📌 Biggest necessary costs: ${BP.raw(top.map(r => `<b>${BP.esc(r.sub)}</b> (${BP.fmt(r.need)})`).join(', '))} — <b>${topShare.toFixed(0)}%</b> of your necessary spending.</div>` : ''}
          ${shortBoxes.length ? BP.h`<div class="insight bad">📦 ${shortBoxes.length} necessary saving box${shortBoxes.length === 1 ? ' is' : 'es are'} in deficit: ${BP.raw(shortBoxes.map(r => `<b>${BP.esc(r.sub)}</b> ${BP.fmt(r.bal)}`).join(', '))}. Refill ${shortBoxes.length === 1 ? 'it' : 'them'} first — the deficit is reducing your fund.</div>` : ''}
          ${e.cfg.invest ? BP.h`<div class="insight warn">💹 Investments are included at today's value — prices move, so treat that part as a last resort.</div>` : ''}
        </div></div>
      <div class="card"><div class="card-h"><div class="card-t big">💰 Money counted</div><span class="card-sub">tick what you can really use in an emergency</span></div>
        <div class="list">${SRC.map(([k, l, d]) => BP.h`<label class="li ef-src ${e.cfg[k] ? 'on' : ''}"><input type="checkbox" data-src="${k}" ${e.cfg[k] ? 'checked' : ''} ${can ? '' : 'disabled'}><div class="li-main"><div class="li-t">${l}</div><div class="li-s">${d}</div></div><b class="num m-sal ${e.src[k] < 0 ? 'down' : ''}">${BP.fmt(e.src[k])}</b></label>`)}
          <div class="li"><div class="li-main"><div class="li-t">➕ Other money (SAR)</div><div class="li-s">cash at home, money owed to you…</div></div><input class="inp num" id="ef-extra" type="number" style="width:120px" value="${e.src.extra || ''}" placeholder="0" ${can ? '' : 'disabled'}></div></div>
        <div class="row between" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)"><b>Total</b><b class="num m-sal" style="font-size:18px;color:var(--blue)">${BP.fmt(e.total)} SAR</b></div>
        <div class="form-grid" style="margin-top:12px">
          <div class="field"><label>Average spendable over</label><select class="sel" id="ef-win" ${can ? '' : 'disabled'}>${[3, 6, 12].map(n => BP.h`<option value="${n}" ${Number(e.cfg.window) === n ? 'selected' : ''}>last ${n} months</option>`)}</select></div>
          <div class="field"><label>Target</label><select class="sel" id="ef-target" ${can ? '' : 'disabled'}>${[3, 6, 9, 12].map(n => BP.h`<option value="${n}" ${target === n ? 'selected' : ''}>${n} months</option>`)}</select></div></div>
        <div class="card-sub" style="margin-top:8px">Averages use ${win.length ? win.map(x => BP.monthShort(x)).join(', ') : 'no months yet'} (the running month is left out).</div></div>
      <div class="card"><div class="card-h"><div class="card-t big">Runway</div><span class="card-sub">money left month by month</span></div>${e.need ? BP.ui.canvas('efRun', 250) : BP.ui.empty('📉', 'Mark necessary items')}</div>
      <div class="card"><div class="card-h"><div class="card-t big">Necessary spending by group</div><span class="card-sub">per month</span></div>${e.need ? BP.ui.canvas('efMix', 250) : BP.ui.empty('🧾', 'Mark necessary items')}</div>
    </div>

    <div class="card pad0" style="margin-top:14px">
      <div class="card-h" style="padding:16px 18px 0"><div><div class="card-t big">Budget items</div><div class="card-sub">Saving box → balance available in the box · Spendable → your average monthly spending. Click the status to switch necessary ⇄ unnecessary.</div></div>
        <div class="row wrap" style="gap:8px"><div class="seg">${[['all', 'All'], ['nec', 'Necessary'], ['un', 'Unnecessary']].map(([k, l]) => BP.h`<button class="${st.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`)}</div>
          <div class="seg">${[['need', 'By amount'], ['type', 'By type'], ['name', 'A–Z']].map(([k, l]) => BP.h`<button class="${st.sort === k ? 'on' : ''}" data-act="sort" data-s="${k}">${l}</button>`)}</div>
          ${can ? BP.h`<button class="btn sm" data-act="useMust" title="Use the Must / Maybe marks from your categories">⚡ Use "Must" marks</button>` : ''}</div></div>
      <div class="tbl-wrap" style="margin-top:12px"><table class="tbl ef-tbl"><thead><tr><th>Item</th><th>Type</th><th>Status</th><th class="r">Plan / month</th><th class="r">Balance · Avg spent</th><th class="r">Counted / month</th><th class="r">Box covers</th></tr></thead><tbody>
        ${nec.length ? head('✅ Necessary', nec, 'nec') : ''}${nec.map(row)}
        ${un.length ? head('➖ Unnecessary', un, 'un') : ''}${un.map(row)}
        <tr class="ef-tot"><td colspan="5"><b>Necessary total</b></td><td class="r num m-sal"><b>${BP.fmt(e.need)}</b></td><td class="r num" style="color:${col(m)}"><b>${moTxt(m)} mo</b></td></tr>
      </tbody></table></div>
      <div class="card-sub" style="padding:10px 18px 16px">"Counted / month" = the saving box's monthly plan (rent, bills… set aside every month) or, for spendable items, what you really spent on average (the plan if there is no history yet).</div></div>`);

    if (e.need){
      const n = Math.max(target, Math.ceil(m || 0)) + 1, L = Array.from({ length: Math.min(n, 25) }, (_, i) => i ? 'M' + i : 'Now');
      const all = e.need + e.unNeed;
      BP.charts.make('efRun', () => ({ type: 'line', data: { labels: L, datasets: [
        { label: 'Necessary only', data: L.map((_, i) => Math.max(0, e.total - i * e.need)), borderColor: CH().css('--green'), backgroundColor: CH().hexA(CH().css('--green'), .14), fill: true, tension: .25, pointRadius: 2.5, borderWidth: 2.4 },
        { label: 'Keeping everything', data: L.map((_, i) => Math.max(0, e.total - i * all)), borderColor: CH().css('--amber'), borderDash: [5, 4], tension: .25, pointRadius: 0, borderWidth: 2 }] },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: CH().tipMoney }, scales: CH().scales() } }));
      const ent = Object.entries(byMain).sort((a, b) => b[1] - a[1]);
      BP.charts.make('efMix', () => ({ type: 'doughnut', data: { labels: ent.map(x => c.mainIcon(x[0]) + ' ' + x[0]), datasets: [{ data: ent.map(x => Math.round(x[1])), backgroundColor: ent.map(x => c.mainColor(x[0])), borderColor: CH().css('--card'), borderWidth: 3 }] },
        options: { cutout: '64%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } }, tooltip: CH().tipMoney, centerText: { text: BP.fmtK(e.need), sub: 'per month', size: 20 } } } }));
    }
  },
  onChange(ev){
    const t = ev.target, k = t.dataset && t.dataset.src, f = cfg();
    if (k){ f[k] = t.checked; return save(); }
    if (t.id === 'ef-win'){ f.window = Number(t.value) || 3; return save(); }
    if (t.id === 'ef-target'){ f.target = Number(t.value) || 6; return save(); }
    if (t.id === 'ef-extra'){ f.extra = parseFloat(t.value) || 0; return save(); }
  },
  actions: {
    tog(el){ const s = BP.db().settings, k = el.dataset.sub, i = s.essentialCats.indexOf(k); if (i >= 0) s.essentialCats.splice(i, 1); else s.essentialCats.push(k); save(); },
    filter(el){ st.filter = el.dataset.f; BP.app.renderView(true); },
    sort(el){ st.sort = el.dataset.s; BP.app.renderView(true); },
    useMust(){ const list = C().cats().filter(x => x.necessity === 'Must').map(x => x.sub);
      BP.modal.confirm(`Mark the ${list.length} items you labelled "Must" as necessary and all others as unnecessary?`, () => { BP.db().settings.essentialCats = list; save(); BP.toast('Necessary items updated', 'ok'); }, { okText: 'Apply', danger: false }); }
  }
};
})();
