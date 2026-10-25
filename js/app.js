/* Budget Pro — application shell, router, global UI */
(function(){
'use strict';
const BP = window.BP;
const ui = BP.ui = { month: null, eye: 'none' };
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

/* ---------- reusable UI pieces ---------- */
ui.monthStrip = function(months, active, key){
  return BP.h`<div class="hscroll month-strip" data-strip="${key || 'm'}">${months.slice().reverse().map(m => BP.h`<button class="chip ${m === active ? 'on' : ''}" data-act="pickMonth" data-month="${m}">${BP.fmtMonth(m)}</button>`)}</div>`;
};
ui.kpi = function(o){
  return BP.h`<div class="card kpi">
    <div class="kpi-top"><i class="kpi-dot" style="background:${o.color || 'var(--accent)'}"></i>${o.label}</div>
    <div class="kpi-val ${o.mask === 'sal' ? 'm-sal' : 'm-num'}" style="${o.valColor ? 'color:' + o.valColor : ''}">${o.value}${o.unit === false ? '' : BP.h`<small>SAR</small>`}</div>
    ${o.spark ? BP.charts.spark(o.spark, { color: o.color }) : ''}
    ${o.foot ? BP.h`<div class="kpi-foot"><span>${o.foot}</span>${o.delta != null ? BP.h`<span class="delta ${o.delta > 0 ? (o.goodUp === false ? 'down' : 'up') : o.delta < 0 ? (o.goodUp === false ? 'up' : 'down') : ''}">${o.delta > 0 ? '▲' : o.delta < 0 ? '▼' : '•'} ${Math.abs(o.delta).toFixed(0)}%</span>` : ''}</div>` : ''}
  </div>`;
};
ui.empty = (icon, text) => BP.h`<div class="empty"><div class="big">${icon}</div><div>${text}</div></div>`;
ui.catChip = main => BP.h`<span class="dotc" style="background:${BP.charts.hexA(BP.calc.mainColor(main), .16)}">${BP.calc.mainIcon(main)}</span>`;
ui.typeTag = t => t === 'Saving Box' ? BP.h`<span class="tag sb">📦 Saving Box</span>` : BP.h`<span class="tag sp">💸 Spendable</span>`;
ui.canvas = (id, h) => BP.h`<div class="chart-box" style="height:${Math.min(320, Math.round((h || 260) * 0.84))}px"><canvas id="${id}"></canvas></div>`;
ui.pickPay = function(root, name){ /* wire pay chips inside root */
  root.addEventListener('click', e => { const b = e.target.closest(`[data-pay-group="${name || 'pay'}"] [data-pay]`); if (!b) return; BP.$$('[data-pay]', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); });
};
ui.payValue = (root, name) => { const on = BP.$(`[data-pay-group="${name || 'pay'}"] .on`, root); return on ? on.dataset.pay : BP.db().payMethods[0]; };

/* ---------- expense editor (shared) ---------- */
BP.editExpense = function(id){
  const e = BP.db().expenses.find(x => x.id === id); if (!e) return;
  BP.modal.open({ title: '✏️ Edit expense', body: BP.h`<div class="form-grid">
      <div class="field"><label>Amount (SAR)</label><input class="inp num" id="ee-amt" type="number" inputmode="decimal" step="0.01" value="${e.amount}"></div>
      <div class="field"><label>Date</label><input class="inp" id="ee-date" type="date" value="${e.date}"></div>
      <div class="field" style="grid-column:1/-1"><label>Category</label><select class="sel" id="ee-cat">${BP.actions.catOptions(e.sub, { placeholder: false })}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Payment method</label>${BP.actions.payChips(e.pay, 'ee')}</div>
      <div class="field" style="grid-column:1/-1"><label>Description</label><input class="inp" id="ee-desc" value="${e.desc || ''}"></div></div>`,
    onOpen: m => ui.pickPay(m.root, 'ee'),
    onOk: m => { const r = m.root; const amt = parseFloat(BP.$('#ee-amt', r).value);
      if (!(amt > 0)) { BP.toast('Enter a valid amount', 'err'); return false; }
      BP.actions.updateExpense(id, { amount: amt, date: BP.$('#ee-date', r).value || e.date, sub: BP.$('#ee-cat', r).value, pay: ui.payValue(r, 'ee'), desc: BP.$('#ee-desc', r).value });
      BP.app.refresh(); BP.toast('Expense updated', 'ok'); } });
};
BP.deleteExpenseConfirm = function(id){
  const e = BP.db().expenses.find(x => x.id === id); if (!e) return;
  BP.modal.confirm(BP.h`Delete <b>${e.sub}</b> — ${BP.fmt(e.amount)} SAR on ${e.date}?`, () => { BP.actions.deleteExpense(id); BP.app.refresh(); BP.toast('Expense removed'); }, { okText: 'Delete' });
};

/* ---------- quick add (floating +) ---------- */
function quickAdd(){
  const d = BP.db(); const sel = ''; const m = ui.month || BP.ymNow();
  const presets = d.quickAdd.filter(q => BP.calc.cat(q.sub));
  const body = BP.h`${presets.length ? BP.h`<div class="lbl" style="margin-bottom:8px">Quick picks</div><div class="chips" id="qa-presets" style="margin-bottom:14px">${presets.map(q => BP.h`<button type="button" class="chip" data-sub="${q.sub}">${q.icon} ${q.label}</button>`)}</div>` : ''}
    <div class="form-grid">
      <div class="field"><label>Amount (SAR)</label><input class="inp num" id="qa-amt" type="number" inputmode="decimal" step="0.01" placeholder="0" style="font-size:22px;font-weight:700"></div>
      <div class="field"><label>Date</label><input class="inp" type="date" id="qa-date" value="${BP.today()}"></div>
      <div class="field" style="grid-column:1/-1"><label>Category</label><select class="sel" id="qa-cat">${BP.actions.catOptions(sel)}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Payment</label>${BP.actions.payChips(d.payMethods[0], 'qa')}</div>
      <div class="field" style="grid-column:1/-1"><label>Description</label><input class="inp" id="qa-desc" placeholder="Optional"></div></div>`;
  BP.modal.open({ title: '⚡ Quick add', body, okText: 'Add expense',
    onOpen: api => { ui.pickPay(api.root, 'qa'); const r = api.root;
      BP.$('#qa-presets', r) && BP.$('#qa-presets', r).addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (!b) return; BP.$('#qa-cat', r).value = b.dataset.sub; BP.$$('#qa-presets .chip', r).forEach(x => x.classList.toggle('on', x === b)); BP.$('#qa-amt', r).focus(); });
      BP.$('#qa-amt', r).addEventListener('keydown', e => { if (e.key === 'Enter') BP.$('[data-ok]', r).click(); }); },
    onOk: api => { const r = api.root; const amt = parseFloat(BP.$('#qa-amt', r).value), sub = BP.$('#qa-cat', r).value;
      if (!(amt > 0)) { BP.toast('Enter an amount', 'err'); return false; } if (!sub) { BP.toast('Pick a category', 'err'); return false; }
      const e = BP.actions.addExpense({ amount: amt, sub, date: BP.$('#qa-date', r).value || BP.today(), pay: ui.payValue(r, 'qa'), desc: BP.$('#qa-desc', r).value });
      BP.app.refresh(); BP.toast(`Added ${BP.fmt(amt)} SAR · ${e.sub}`, 'ok'); } });
}

/* ---------- app ---------- */
const app = BP.app = {
  tab: 'dash',
  tabsFor(){
    const order = BP.db().tabOrder; let list = BP.TABS.slice();
    if (order && order.length) list.sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    list.sort((a, b) => (a.admin ? 1 : 0) - (b.admin ? 1 : 0));
    return list.filter(t => BP.auth.canView(t.id));
  },
  go(tab){ if (!BP.auth.canView(tab)) return; app.tab = tab; try { localStorage.setItem('bpro.tab', tab); } catch (e) {} history.replaceState(null, '', '#' + tab); app.renderChrome(); app.renderView(); window.scrollTo({ top: 0 }); },
  refresh(){ app.renderChrome(); app.renderView(true); },
  renderChrome(){
    const tabs = app.tabsFor(), cur = BP.TABS.find(t => t.id === app.tab) || tabs[0];
    const d = BP.db(), u = BP.auth.user;
    BP.$('#nav').innerHTML = BP.str(tabs.map(t => BP.h`<button class="nav-item ${t.id === app.tab ? 'active' : ''}" data-go="${t.id}">${BP.icon(t.icon, 'ic')}<span>${t.label}</span></button>`));
    const main4 = tabs.filter(t => !t.admin).slice(0, 4), rest = tabs.filter(t => !main4.includes(t));
    BP.$('#bottomnav').innerHTML = BP.str(main4.map(t => BP.h`<button class="${t.id === app.tab ? 'active' : ''}" data-go="${t.id}">${BP.icon(t.icon)}<span>${t.label.split(' ')[0]}</span></button>`))
      + BP.h`<button data-more class="${rest.some(t => t.id === app.tab) ? 'active' : ''}">${BP.icon('more')}<span>More</span></button>`.s;
    BP.$('#pageTitle').textContent = cur ? cur.label : '';
    BP.$('#userChip').innerHTML = BP.h`<div class="avatar">${u.name[0].toUpperCase()}</div><div class="grow"><div style="font-weight:600;line-height:1.2">${u.name}${u.role === 'admin' ? ' 👑' : ''}</div><div class="card-sub">${u.role === 'admin' ? 'Admin' : 'Viewer'}</div></div>`.s;
    BP.$('#eyeBtn').innerHTML = BP.icon(ui.eye === 'none' ? 'eye' : 'eyeoff').s;
    BP.$('#modeBtn').innerHTML = BP.icon(BP.themes.state.mode === 'night' ? 'sun' : 'moon').s;
    if (BP.sync) BP.sync.set(BP.sync.status);
    document.body.classList.toggle('eye-totals', ui.eye === 'totals'); document.body.classList.toggle('eye-all', ui.eye === 'all');
    BP.$('#fab').classList.toggle('hidden', app.tab === 'add' || !BP.auth.canEdit('add'));
  },
  renderView(keepScroll){
    const el = BP.$('#content'); const v = BP.views[app.tab]; const sy = window.scrollY;
    if (!v) { el.innerHTML = '<div class="empty">Coming soon</div>'; return; }
    BP.charts.gc();
    if (BP.motion) BP.motion.setQuiet(!!keepScroll);
    el.innerHTML = '<div class="view" id="viewRoot"></div>';
    try { v.render(BP.$('#viewRoot')); } catch (e) { console.error(e); BP.$('#viewRoot').innerHTML = `<div class="card"><b>Something went wrong rendering this page.</b><pre class="num faint" style="white-space:pre-wrap;margin-top:8px">${BP.esc(e.stack || e.message)}</pre></div>`; }
    if (keepScroll) window.scrollTo({ top: sy, behavior: 'instant' });
    if (BP.motion) BP.motion.after(el, keepScroll);
  },
  boot(){
    BP.$('#login').classList.add('off'); BP.$('#app').classList.add('on');
    if (!ui.month) ui.month = BP.calc.defaultMonth();
    let t = (location.hash || '').slice(1) || localStorage.getItem('bpro.tab') || 'dash';
    if (!BP.auth.canView(t) || !BP.views[t]) t = 'dash'; app.tab = t;
    BP.actions.processRecurring(); app.booted = true;
    if (BP.cards && BP.cards.needsSetup() && BP.auth.canEdit('cards')) setTimeout(() => BP.toast(`💳 Start of ${BP.fmtMonth(BP.ymNow())}? Set up your card balances in the Card Balances tab`, 'ok'), 1400);
    if (BP.store.justUpgraded){ BP.store.justUpgraded = false; setTimeout(() => BP.toast('📥 Loaded your v8.1 workbook data (Jun–Oct 2026)', 'ok'), 600); }
    app.renderChrome(); app.renderView();
  },
  showLogin(){ BP.$('#app').classList.remove('on'); BP.$('#login').classList.remove('off'); BP.$('#loginPass').value = ''; BP.$('#loginErr').textContent = ''; setTimeout(() => BP.$('#loginUser').focus(), 50); },
  openMore(){
    const tabs = app.tabsFor();
    BP.modal.open({ title: 'Menu', actions: false, focus: false, body: BP.h`<div class="col" style="gap:6px">${tabs.map(t => BP.h`<button class="nav-item ${t.id === app.tab ? 'active' : ''}" data-go="${t.id}" style="background:var(--surface)">${BP.icon(t.icon, 'ic')}<span>${t.label}</span></button>`)}</div>` })
      .el.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g){ BP.modal.stack.slice().forEach(m => m.close()); app.go(g.dataset.go); } });
  },
  eyeMenu(btn){
    const old = BP.$('#eyeMenu'); if (old) { old.remove(); return; }
    const m = document.createElement('div'); m.className = 'menu-pop'; m.id = 'eyeMenu';
    const opts = [['none', 'eye', 'Show all'], ['totals', 'eyeoff', 'Hide salary & totals'], ['all', 'lock', 'Hide all numbers']];
    m.innerHTML = BP.str(opts.map(([k, ic, l]) => BP.h`<button data-eye="${k}" class="${ui.eye === k ? 'on' : ''}">${BP.icon(ic)}<span>${l}</span></button>`));
    btn.parentElement.appendChild(m);
    const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
    m.addEventListener('click', e => { const b = e.target.closest('[data-eye]'); if (!b) return; ui.eye = b.dataset.eye; m.remove(); app.renderChrome(); });
  },
  userMenu(btn){
    const old = BP.$('#userMenu'); if (old) { old.remove(); return; }
    const m = document.createElement('div'); m.className = 'menu-pop'; m.id = 'userMenu';
    m.innerHTML = BP.h`<button data-um="theme">${BP.icon('palette')}<span>Appearance</span></button>
      ${installEvt ? BP.h`<button data-um="install">${BP.icon('download')}<span>Install app</span></button>` : ''}
      <button data-um="sync">${BP.icon('refresh')}<span>Sync now</span></button>
      <button data-um="backup">${BP.icon('download')}<span>Download backup</span></button>
      <button data-um="logout">${BP.icon('logout')}<span>Switch user</span></button>`.s;
    btn.parentElement.appendChild(m);
    const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
    m.addEventListener('click', async e => { const b = e.target.closest('[data-um]'); if (!b) return; m.remove();
      if (b.dataset.um === 'theme') BP.themes.openModal();
      if (b.dataset.um === 'logout'){ BP.auth.logout(); app.showLogin(); }
      if (b.dataset.um === 'sync'){ if (BP.sync.configured()) BP.sync.now(); else BP.connectModal(); }
      if (b.dataset.um === 'backup'){ BP.download(`budget-pro-backup-${BP.today()}.json`, BP.store.exportJSON(), 'application/json'); BP.toast('Backup downloaded', 'ok'); }
      if (b.dataset.um === 'install' && installEvt){ installEvt.prompt(); installEvt = null; } });
  }
};

/* ---------- global events ---------- */
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]'); if (go && !e.target.closest('.overlay')) { app.go(go.dataset.go); return; }
  if (e.target.closest('[data-more]')) { app.openMore(); return; }
  if (e.target.closest('#eyeBtn')) { app.eyeMenu(BP.$('#eyeBtn')); return; }
  if (e.target.closest('#userBtn')) { app.userMenu(BP.$('#userBtn')); return; }
  if (e.target.closest('#syncBtn')) { if (BP.sync.configured()) BP.sync.now(); else BP.connectModal(); return; }
  if (e.target.closest('#loginConnect')) { BP.connectModal(); return; }
  if (e.target.closest('#modeBtn')) { BP.themes.toggleMode(); return; }
  if (e.target.closest('#themeBtn')) { BP.themes.openModal(); return; }
  if (e.target.closest('#fab')) { quickAdd(); return; }
  const pm = e.target.closest('[data-act="pickMonth"]'); if (pm){ ui.month = pm.dataset.month; app.refresh(); return; }
  const el = e.target.closest('[data-act]'); const v = BP.views[app.tab];
  if (el && v && v.actions && v.actions[el.dataset.act]) v.actions[el.dataset.act](el, e);
});
document.addEventListener('input', e => { const v = BP.views[app.tab]; if (v && v.onInput && e.target.closest('#content')) v.onInput(e); });
document.addEventListener('change', e => { const v = BP.views[app.tab]; if (v && v.onChange && e.target.closest('#content')) v.onChange(e); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); if (BP.auth.user && BP.auth.canEdit('add')) quickAdd(); } });
window.addEventListener('resize', BP.debounce(() => { if (BP.auth.user && BP.views[app.tab] && BP.views[app.tab].onResize) BP.views[app.tab].onResize(); }, 250));
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (BP.auth.user && t && t !== app.tab && BP.views[t] && BP.auth.canView(t)) app.go(t); });

/* ---------- connect this device to the Google Sheet ---------- */
BP.connectModal = function(){
  BP.modal.open({ title: '☁️ Connect this device', body: BP.h`<div class="card-sub" style="margin-bottom:12px">Paste the <b>connection link or code</b> from a device that is already connected (Admin → Data & sync → “Connect another device”), or enter the web-app URL and secret key.</div>
    <div class="field"><label>Connection link or code</label><input class="inp" id="cn-code" placeholder="https://…#connect=…  or the code"></div>
    <div class="card-sub center" style="margin:10px 0">— or —</div>
    <div class="field"><label>Apps Script web-app URL</label><input class="inp" id="cn-url" placeholder="https://script.google.com/macros/s/…/exec"></div>
    <div class="field" style="margin-top:8px"><label>Secret key</label><input class="inp" id="cn-key" autocomplete="off"></div>
    <div class="card-sub" id="cn-msg" style="margin-top:10px"></div>`, okText: 'Connect',
    onOk(api){ const q = x => BP.$('#' + x, api.root), msg = q('cn-msg'); let url = q('cn-url').value, key = q('cn-key').value;
      const code = q('cn-code').value.trim(); if (code){ const o = BP.sync.parseCode(code); if (!o){ msg.textContent = '⚠️ That code is not valid.'; return false; } url = o.url; key = o.key; }
      msg.textContent = 'Connecting…';
      BP.sync.connect(url, key).then(ok => { api.close(); BP.toast(ok ? '☁️ Connected — your data is synced' : '⚠️ ' + BP.sync.msg, ok ? 'ok' : 'err');
        if (BP.auth.user) BP.app.refresh(); else { BP.$('#loginUsers').innerHTML = BP.str(Object.keys(BP.db().users).map(n => BP.h`<button type="button" class="chip" data-u="${n}">${n}</button>`)); const ls = BP.$('#loginSync'); if (ls) ls.textContent = '☁️ Synced — sign in with your usual password'; } })
        .catch(e => { msg.textContent = '⚠️ ' + e.message; });
      return false; } });
};

/* ---------- start ---------- */
async function start(){
  BP.store.load(); BP.themes.load();
  if (BP.cloud) await BP.cloud.boot();
  if (BP.sync) await BP.sync.boot();
  { const ls = BP.$('#loginSync'); if (ls) ls.textContent = BP.sync && BP.sync.configured() ? (BP.sync.status === 'ok' ? '☁️ Synced with your Google Sheet' : '☁️ ' + BP.sync.msg) : 'This device is not connected yet — your data stays on this device.'; }
  await BP.auth.init();
  const form = BP.$('#loginForm');
  form.addEventListener('submit', async e => {
    e.preventDefault(); const ok = await BP.auth.login(BP.$('#loginUser').value, BP.$('#loginPass').value, BP.$('#loginRemember').checked);
    if (ok) app.boot(); else { BP.$('#loginErr').textContent = '❌ Incorrect username or password'; BP.$('#loginPass').value = ''; }
  });
  BP.$('#loginUsers').innerHTML = BP.str(Object.keys(BP.db().users).map(n => BP.h`<button type="button" class="chip" data-u="${n}">${n}</button>`));
  BP.$('#loginUsers').addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (b){ BP.$('#loginUser').value = b.dataset.u; BP.$('#loginPass').focus(); } });
  if (BP.auth.user) app.boot(); else app.showLogin();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('DOMContentLoaded', start);
})();
