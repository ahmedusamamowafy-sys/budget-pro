/* Budget Pro — Admin & preferences */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc;
const st = { sec: 'general', permUser: null };
const SECS = [['general', '⚙️ General'], ['users', '👥 Users & access'], ['lists', '💳 Lists'], ['tabs', '🧭 Tabs'], ['data', '🗄️ Data & sync']];

BP.views.adminpref = {
  render(el){
    BP.mount(el, BP.h`<div class="tabs-sub"><div class="seg">${SECS.map(([k, l]) => BP.h`<button class="${st.sec === k ? 'on' : ''}" data-act="sec" data-k="${k}">${l}</button>`)}</div></div><div id="adBody"></div>`);
    ({ general, users, lists, tabs, data })[st.sec](BP.$('#adBody', el));
  },
  onChange(e){
    const t = e.target, s = BP.db().settings;
    if (t.id === 'ad-salday'){ s.salaryDay = BP.clamp(parseInt(t.value) || 27, 1, 31); BP.store.persist(); BP.toast('Salary day saved', 'ok'); }
    if (t.id === 'ad-defsal'){ s.defaultSalary = parseFloat(t.value) || 0; BP.store.persist(); }
    if (t.id === 'ad-definv'){ s.defaultInvestments = parseFloat(t.value) || 0; BP.store.persist(); }
    if (t.name === 'ad-pool'){ s.spendPool = t.value; BP.store.persist(); BP.toast('Spendable pool updated', 'ok'); }
    if (t.dataset.perm){ const [u, tab, k] = t.dataset.perm.split('|'), d = BP.db(); d.perms[u] = d.perms[u] || BP.auth.defaultPerms(d.users[u].role); d.perms[u][tab] = d.perms[u][tab] || { view: true, edit: false }; d.perms[u][tab][k] = t.checked; if (k === 'edit' && t.checked) d.perms[u][tab].view = true; BP.store.persist(); BP.app.renderView(true); }
    if (t.id === 'ad-permUser'){ st.permUser = t.value; BP.app.renderView(true); }
    if (t.id === 'sy-auto'){ BP.db().sync.auto = t.checked; BP.store.persist(); }
  },
  actions: {
    sec(el){ st.sec = el.dataset.k; BP.app.renderView(true); },
    theme(){ BP.themes.openModal(); },
    essTog(el){ const s = BP.db().settings, k = el.dataset.sub, i = s.essentialCats.indexOf(k); if (i >= 0) s.essentialCats.splice(i, 1); else s.essentialCats.push(k); BP.store.persist(); BP.app.renderView(true); },
    /* users */
    editUser(el){
      const d = BP.db(), orig = el && el.dataset.u, u = orig ? d.users[orig] : null;
      BP.modal.open({ title: u ? `✏️ Edit ${orig}` : '👤 New user', body: BP.h`<div class="form-grid"><div class="field"><label>Username</label><input class="inp" id="us-name" value="${orig || ''}"></div>
        <div class="field"><label>Role</label><select class="sel" id="us-role"><option value="admin" ${u && u.role === 'admin' ? 'selected' : ''}>Admin</option><option value="viewer" ${!u || u.role === 'viewer' ? 'selected' : ''}>Member</option></select></div>
        <div class="field" style="grid-column:1/-1"><label>${u ? 'New password (leave empty to keep)' : 'Password'}</label><input class="inp" id="us-pass" type="password" autocomplete="new-password"></div></div>`,
        async onOk(api){ const q = x => BP.$('#' + x, api.root); const name = q('us-name').value.trim(), pass = q('us-pass').value, role = q('us-role').value;
          if (!name){ BP.toast('Username required', 'err'); return false; } if (!u && !pass){ BP.toast('Password required', 'err'); return false; }
          if (name !== orig && d.users[name]){ BP.toast('User exists', 'err'); return false; }
          if (orig && d.users[orig].role === 'admin' && role !== 'admin' && Object.values(d.users).filter(x => x.role === 'admin').length < 2){ BP.toast('Keep at least one admin', 'err'); return false; }
          api.close(); await BP.auth.setUser(name, pass, role, orig); BP.toast('User saved', 'ok'); BP.app.refresh(); return false; } });
    },
    delUser(el){ const n = el.dataset.u; if (BP.auth.user && n === BP.auth.user.name) return BP.toast("You can't delete yourself", 'err'); BP.modal.confirm(`Delete user ${n}?`, () => { BP.auth.delUser(n); BP.app.renderView(true); }); },
    resetPerms(el){ delete BP.db().perms[el.dataset.u]; BP.store.persist(); BP.app.renderView(true); },
    /* lists */
    addPay(){ BP.modal.open({ title: '💳 New payment method', body: BP.h`<div class="field"><label>Name</label><input class="inp" id="pm-n"></div>`, onOk(api){ const v = BP.$('#pm-n', api.root).value.trim(), d = BP.db(); if (!v || d.payMethods.includes(v)) return false; d.payMethods.push(v); BP.store.persist(); BP.app.renderView(true); } }); },
    renPay(el){ const old = el.dataset.p; BP.modal.open({ title: `Rename ${old}`, body: BP.h`<div class="field"><label>New name</label><input class="inp" id="pm-n" value="${old}"></div>`, onOk(api){ const v = BP.$('#pm-n', api.root).value.trim(), d = BP.db(); if (!v || (v !== old && d.payMethods.includes(v))) return false;
      d.payMethods = d.payMethods.map(p => p === old ? v : p); d.expenses.forEach(e => { if (e.pay === old) e.pay = v; }); Object.values(d.wallet).forEach(w => { if (old in w.alloc){ w.alloc[v] = w.alloc[old]; delete w.alloc[old]; } }); d.recurring.forEach(r => { if (r.pay === old) r.pay = v; }); BP.store.persist(); BP.app.renderView(true); } }); },
    delPay(el){ const d = BP.db(); if (d.payMethods.length < 2) return; BP.modal.confirm(`Remove “${el.dataset.p}” from the list? Existing expenses keep the label.`, () => { d.payMethods = d.payMethods.filter(p => p !== el.dataset.p); BP.store.persist(); BP.app.renderView(true); }); },
    movePay(el){ const d = BP.db(), i = d.payMethods.indexOf(el.dataset.p), j = i + Number(el.dataset.d); if (j < 0 || j >= d.payMethods.length) return; [d.payMethods[i], d.payMethods[j]] = [d.payMethods[j], d.payMethods[i]]; BP.store.persist(); BP.app.renderView(true); },
    addQA(){ BP.modal.open({ title: '⚡ New quick-add preset', body: BP.h`<div class="form-grid"><div class="field"><label>Label</label><input class="inp" id="qa-l"></div><div class="field"><label>Icon</label><input class="inp" id="qa-i" value="⭐" maxlength="4"></div><div class="field" style="grid-column:1/-1"><label>Category</label><select class="sel" id="qa-s">${BP.actions.catOptions('')}</select></div></div>`,
      onOk(api){ const q = x => BP.$('#' + x, api.root).value.trim(); if (!q('qa-l') || !q('qa-s')) return false; BP.db().quickAdd.push({ id: 'qa' + BP.uid(), label: q('qa-l'), icon: q('qa-i') || '⭐', sub: q('qa-s') }); BP.store.persist(); BP.app.renderView(true); } }); },
    delQA(el){ const d = BP.db(); d.quickAdd = d.quickAdd.filter(q => q.id !== el.dataset.id); BP.store.persist(); BP.app.renderView(true); },
    /* tabs */
    moveTab(el){ const d = BP.db(), ids = BP.TABS.filter(t => !t.admin).map(t => t.id); let o = (d.tabOrder && d.tabOrder.length ? d.tabOrder.filter(x => ids.includes(x)) : []); ids.forEach(x => { if (!o.includes(x)) o.push(x); });
      const i = o.indexOf(el.dataset.t), j = i + Number(el.dataset.d); if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; d.tabOrder = o; BP.store.persist(); BP.app.refresh(); },
    resetTabs(){ BP.db().tabOrder = null; BP.store.persist(); BP.app.refresh(); },
    /* data */
    demoLoad(){ BP.demo.load(); BP.ui.month = BP.ymNow(); BP.toast('Demo history loaded — remove it any time', 'ok'); BP.app.refresh(); },
    demoRemove(){ BP.modal.confirm('Remove all demo data? Your real data stays.', () => { BP.demo.remove(); BP.toast('Demo data removed', 'ok'); BP.app.refresh(); }); },
    reloadSheet(){ BP.modal.confirm('Replace the data on this device with the copy in your Google Sheet? Unsynced changes on this device will be lost.', async () => {
      const keep = BP.db().sync; const fresh = BP.seed.create(); fresh.meta.untouched = true; fresh.sync = keep;
      try { localStorage.removeItem('bpro.syncbase'); } catch (e) {} BP.store.replace(fresh); const ok = await BP.sync.run('reload');
      BP.toast(ok ? '⬇ Reloaded from your Google Sheet' : '⚠️ ' + BP.sync.msg, ok ? 'ok' : 'err'); BP.app.refresh(); }, { okText: 'Reload' }); },
    resetAll(){ BP.modal.confirm('Reset Budget Pro to the original Excel data? Everything you added here will be lost (download a backup first).', () => { BP.store.reset(); BP.auth.init().then(() => { BP.toast('Reset complete', 'ok'); BP.app.refresh(); }); }, { okText: 'Reset everything' }); },
    async syConnect(){ const msg = BP.$('#sy-msg'), url = BP.$('#sy-url').value, key = BP.$('#sy-key').value; msg.textContent = 'Connecting to your sheet…';
      try { const ok = await BP.sync.connect(url, key); if (ok){ delete BP.sync.cfg().newKey; BP.store.persist(true); BP.toast('☁️ Connected — your data is in your Google Sheet', 'ok'); BP.app.renderView(true); } else msg.textContent = '⚠️ ' + BP.sync.msg; }
      catch (e) { msg.textContent = '⚠️ ' + e.message + (/fetch/i.test(e.message) ? ' — check the URL and that access is set to “Anyone”.' : ''); } },
    syJoin(){ BP.connectModal(); },
    syNow(){ BP.sync.now().then(() => BP.app.renderView(true)); },
    syOff(){ BP.modal.confirm('Disconnect this device from the Google Sheet? Data stays on this device and in the sheet.', () => { BP.sync.disconnect(); BP.app.renderView(true); }, { okText: 'Disconnect' }); },
    async syLink(){ const link = BP.sync.link(), code = BP.sync.code();
      BP.modal.open({ title: '📱 Connect another device', okText: null, cancelText: 'Done', wide: true, body: BP.h`<div class="card-sub" style="margin-bottom:10px">On your phone or another computer, open this link once — it connects that device to your data automatically. Keep it private: anyone with it can read your budget.</div>
        <div class="field"><label>Connection link</label><textarea class="inp" rows="3" readonly style="font-family:var(--mono);font-size:11px">${link}</textarea></div>
        <div class="row wrap" style="gap:8px;margin-top:8px"><button class="btn primary" id="cp-link">📋 Copy link</button>${navigator.share ? BP.h`<button class="btn" id="sh-link">📤 Share to my phone</button>` : ''}</div>
        <div class="card-sub" style="margin:12px 0 4px">Or type this code in “☁️ Connect this device” on the sign-in screen:</div><div class="field"><textarea class="inp" rows="2" readonly style="font-family:var(--mono);font-size:11px">${code}</textarea></div>`,
        onOpen(api){ BP.$('#cp-link', api.root).addEventListener('click', async () => { await BP.copyText(link); BP.toast('Link copied — send it to yourself and open it on the phone', 'ok'); });
          const sh = BP.$('#sh-link', api.root); if (sh) sh.addEventListener('click', () => navigator.share({ title: 'Budget Pro', text: 'Connect Budget Pro', url: link }).catch(() => {})); } }); },
    async syScript(){ const c = BP.sync.cfg(); const key = c.key || c.newKey || (c.newKey = BP.sync.newKey()); BP.store.persist(true); await BP.copyText(BP.sync.script(key)); BP.toast('Apps Script copied — paste it in Extensions → Apps Script', 'ok'); }
  }
};

function general(el){
  const s = BP.db().settings, ess = new Set(s.essentialCats), cats = C().catsOf('Spendable');
  BP.mount(el, BP.h`<div class="grid g2">
    <div class="card"><div class="card-h"><div class="card-t big">Salary & plan defaults</div></div><div class="form-grid">
      <div class="field"><label>Salary day of month</label><input class="inp num" id="ad-salday" type="number" min="1" max="31" value="${s.salaryDay}"></div>
      <div class="field"><label>Default salary</label><input class="inp num" id="ad-defsal" type="number" value="${s.defaultSalary}"></div>
      <div class="field"><label>Default investments</label><input class="inp num" id="ad-definv" type="number" value="${s.defaultInvestments}"></div></div>
      <div class="sp-lg"></div><div class="card-t" style="margin-bottom:8px">Spendable pool</div>
      <label class="radio-card ${s.spendPool === 'planned' ? 'on' : ''}"><input type="radio" name="ad-pool" value="planned" ${s.spendPool === 'planned' ? 'checked' : ''}><div><b>Planned only</b><div class="card-sub">Sum of Spendable category budgets — matches your Excel sheet.</div></div></label>
      <label class="radio-card ${s.spendPool === 'full' ? 'on' : ''}"><input type="radio" name="ad-pool" value="full" ${s.spendPool === 'full' ? 'checked' : ''}><div><b>Planned + unallocated</b><div class="card-sub">Salary − saving boxes − investments — how the old tracker counted it.</div></div></label></div>
    <div class="card"><div class="card-h"><div class="card-t big">Appearance</div></div><div class="row"><div class="swatch on" style="width:64px;height:44px;background:linear-gradient(135deg,var(--bg),var(--card) 55%,var(--accent))"></div><div class="grow"><b>${(BP.themes.list[BP.themes.state.id] || {}).name || 'Theme'}</b><div class="card-sub">${BP.themes.state.mode === 'night' ? '🌙 Night' : '☀️ Day'} mode${BP.themes.state.photo ? ' · photo background' : ''}</div></div><button class="btn primary" data-act="theme">🎨 Change</button></div>
      <div class="sp-lg"></div><div class="card-t" style="margin-bottom:6px">Essential categories</div><div class="card-sub" style="margin-bottom:10px">Used for the emergency-fund calculation (months of essentials covered).</div>
      <div class="chips">${cats.map(c => BP.h`<button class="chip ${ess.has(c.sub) ? 'on' : ''}" data-act="essTog" data-sub="${c.sub}">${c.sub}</button>`)}</div></div>
  </div>`);
}
function users(el){
  const d = BP.db(), names = Object.keys(d.users); st.permUser = st.permUser && d.users[st.permUser] ? st.permUser : (names.find(n => d.users[n].role !== 'admin') || names[0]);
  const pu = st.permUser, isAdm = d.users[pu].role === 'admin', p = BP.auth.perms(pu), pal = BP.charts.palette();
  BP.mount(el, BP.h`<div class="grid g2">
    <div class="card"><div class="card-h"><div class="card-t big">Users</div><button class="btn sm primary" data-act="editUser">➕ Add user</button></div>
      <div class="list">${names.map((n, i) => BP.h`<div class="li"><div class="avatar" style="background:${pal[i % 8]}">${n[0]}</div><div class="li-main"><div class="li-t">${n}${BP.auth.user && BP.auth.user.name === n ? BP.h` <span class="tag">you</span>` : ''}</div><div class="li-s">${d.users[n].role === 'admin' ? '👑 Admin' : '👤 Member'} · ${d.expenses.filter(e => e.addedBy === n).length} entries</div></div>
        <div class="li-act" style="opacity:1"><button class="icon-btn" style="width:32px;height:32px" data-act="editUser" data-u="${n}">${BP.icon('edit')}</button><button class="icon-btn" style="width:32px;height:32px;color:var(--red)" data-act="delUser" data-u="${n}">${BP.icon('x')}</button></div></div>`)}</div></div>
    <div class="card"><div class="card-h"><div class="card-t big">Tab permissions</div><select class="sel" id="ad-permUser" style="max-width:160px">${names.map(n => BP.h`<option ${n === pu ? 'selected' : ''}>${n}</option>`)}</select></div>
      ${isAdm ? BP.h`<div class="tipbox">Admins can see and edit everything.</div>` : BP.h`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tab</th><th class="center">View</th><th class="center">Edit</th></tr></thead><tbody>${BP.TABS.filter(t => t.perm).map(t => BP.h`<tr><td>${t.label}</td><td class="center"><input type="checkbox" data-perm="${pu}|${t.id}|view" ${(p[t.id] || {}).view !== false ? 'checked' : ''}></td><td class="center"><input type="checkbox" data-perm="${pu}|${t.id}|edit" ${(p[t.id] || {}).edit ? 'checked' : ''}></td></tr>`)}</tbody></table></div>
      <button class="btn sm" data-act="resetPerms" data-u="${pu}" style="margin-top:10px">↺ Reset to defaults</button>`}</div>
  </div>`);
}
function lists(el){
  const d = BP.db();
  BP.mount(el, BP.h`<div class="grid g2">
    <div class="card"><div class="card-h"><div class="card-t big">💳 Payment methods</div><button class="btn sm primary" data-act="addPay">➕ Add</button></div>
      <div class="list">${d.payMethods.map((p, i) => BP.h`<div class="li"><div class="li-ic">💳</div><div class="li-main"><div class="li-t">${p}</div><div class="li-s">${d.expenses.filter(e => e.pay === p).length} expenses</div></div><div class="li-act" style="opacity:1"><button class="icon-btn" style="width:30px;height:30px" data-act="movePay" data-p="${p}" data-d="-1" ${i ? '' : 'disabled'}>↑</button><button class="icon-btn" style="width:30px;height:30px" data-act="movePay" data-p="${p}" data-d="1" ${i < d.payMethods.length - 1 ? '' : 'disabled'}>↓</button><button class="icon-btn" style="width:30px;height:30px" data-act="renPay" data-p="${p}">${BP.icon('edit')}</button><button class="icon-btn" style="width:30px;height:30px;color:var(--red)" data-act="delPay" data-p="${p}">${BP.icon('x')}</button></div></div>`)}</div></div>
    <div class="card"><div class="card-h"><div class="card-t big">⚡ Quick-add presets</div><button class="btn sm primary" data-act="addQA">➕ Add</button></div>
      <div class="list">${d.quickAdd.length ? d.quickAdd.map(q => BP.h`<div class="li"><div class="li-ic">${q.icon}</div><div class="li-main"><div class="li-t">${q.label}</div><div class="li-s">${q.sub}${BP.calc.cat(q.sub) ? '' : ' · ⚠️ category missing'}</div></div><div class="li-act" style="opacity:1"><button class="icon-btn" style="width:30px;height:30px;color:var(--red)" data-act="delQA" data-id="${q.id}">${BP.icon('x')}</button></div></div>`) : BP.ui.empty('⚡', 'No presets')}</div></div>
  </div>`);
}
function tabs(el){
  const ids = BP.TABS.filter(t => !t.admin), list = BP.app.tabsFor().filter(t => !t.admin);
  BP.mount(el, BP.h`<div class="card" style="max-width:560px"><div class="card-h"><div class="card-t big">🧭 Tab order</div><button class="btn sm" data-act="resetTabs">↺ Reset</button></div><div class="card-sub" style="margin-bottom:10px">Reorder the navigation. The first four also appear in the mobile bottom bar.</div>
    <div class="list">${list.map((t, i) => BP.h`<div class="li"><div class="li-ic">${BP.icon(t.icon)}</div><div class="li-main"><div class="li-t">${t.label}</div>${i < 4 ? BP.h`<div class="li-s">📱 bottom bar</div>` : ''}</div><div class="li-act" style="opacity:1"><button class="icon-btn" style="width:32px;height:32px" data-act="moveTab" data-t="${t.id}" data-d="-1" ${i ? '' : 'disabled'}>↑</button><button class="icon-btn" style="width:32px;height:32px" data-act="moveTab" data-t="${t.id}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'}>↓</button></div></div>`)}</div></div>`);
  void ids;
}
function data(el){
  const d = BP.db(), s = d.sync, demo = BP.demo.isLoaded(), kb = (BP.store.exportJSON().length / 1024).toFixed(0);
  BP.mount(el, BP.h`<div class="grid g2">
    <div class="card"><div class="card-h"><div class="card-t big">🧪 Demo history</div><span class="tag ${demo ? 'sp' : ''}">${demo ? 'loaded' : 'off'}</span></div>
      <div class="card-sub" style="margin-bottom:12px">Adds realistic example months (Jul → today), net-worth accounts, goals, recurring bills and a savings box so every chart has something to show. Everything is tagged “demo” and can be removed in one click — your real data is never touched.</div>
      ${demo ? BP.h`<button class="btn danger" data-act="demoRemove">🧹 Remove demo data</button>` : BP.h`<button class="btn primary" data-act="demoLoad">✨ Load demo data</button>`}</div>
    <div class="card"><div class="card-h"><div class="card-t big">🗄️ Storage</div></div><div class="list">
      <div class="li"><div class="li-main"><div class="li-t">Expenses</div></div><b class="num">${d.expenses.length}</b></div><div class="li"><div class="li-main"><div class="li-t">Categories</div></div><b class="num">${d.categories.length}</b></div>
      <div class="li"><div class="li-main"><div class="li-t">Saved plans</div></div><b class="num">${Object.keys(d.plans).length}</b></div><div class="li"><div class="li-main"><div class="li-t">Database size</div></div><b class="num">${kb} KB</b></div></div>
      <div class="row wrap" style="margin-top:12px"><button class="btn" data-go="import">💾 Backup / export</button>${BP.sync.configured() ? BP.h`<button class="btn" data-act="reloadSheet">⬇ Reload everything from Google Sheet</button>` : BP.seed.PUBLIC ? '' : BP.h`<button class="btn danger" data-act="resetAll">⚠️ Reset to Excel data</button>`}</div></div>
    ${sheetCard()}
    ${BP.cloud && BP.cloud.on ? BP.h`<div class="card span2"><div class="card-h"><div class="card-t big">☁️ claude.ai cloud copy</div><span class="tag sp">on</span></div><div class="card-sub">This page is also saving to your claude.ai account (only when opened from the claude.ai link). Status: <b>${BP.cloud.msg || BP.cloud.state}</b></div></div>` : ''}
  </div>`);
}
function sheetCard(){
  const S = BP.sync, c = S.cfg(), on = S.configured();
  if (on) return BP.h`<div class="card span2 sync-card"><div class="card-h"><div class="card-t big">☁️ Google Sheet sync</div><span class="tag ${S.status === 'ok' ? 'sp' : S.status === 'err' ? 'must' : ''}">${S.status === 'ok' ? 'connected' : S.status}</span></div>
      <div class="sync-state"><div><div class="card-sub">Status</div><b>${S.msg}</b></div><div><div class="card-sub">Last sync</div><b>${c.lastSync ? BP.fmtDT(new Date(c.lastSync).toISOString()) : '—'}</b></div><div><div class="card-sub">Auto sync</div><label class="row" style="gap:6px"><input type="checkbox" id="sy-auto" ${c.auto ? 'checked' : ''}> every 30 s + after each change</label></div></div>
      <div class="row wrap" style="gap:8px;margin-top:12px"><button class="btn primary" data-act="syNow">🔄 Sync now</button><button class="btn" data-act="syLink">📱 Connect another device</button><button class="btn" data-act="syScript">📋 Copy Apps Script again</button><button class="btn danger" data-act="syOff">Disconnect this device</button></div>
      <div class="card-sub" style="margin-top:10px">Every device keeps its own copy and works offline. Changes from all connected devices are merged — nothing is overwritten. Your sheet also keeps the previous version (tab “BudgetProDB_previous”) and a SyncLog.</div></div>`;
  if (!c.newKey) c.newKey = S.newKey();
  return BP.h`<div class="card span2 sync-card"><div class="card-h"><div class="card-t big">☁️ Sync your phone and computer (Google Sheet)</div><span class="tag">not connected</span></div>
    <div class="card-sub" style="margin-bottom:12px">Your data stays in <b>your own Google Sheet</b>, protected by a secret key. One-time set-up, about 5 minutes:</div>
    <ol class="sync-steps">
      <li><b>Create a new Google Sheet</b> at <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a> and name it “Budget Pro Data”.</li>
      <li>Menu <b>Extensions → Apps Script</b>. Delete what's there and paste the script: <button class="btn sm primary" data-act="syScript">📋 Copy script (includes your secret key)</button></li>
      <li>Click <b>Deploy → New deployment</b> → type <b>Web app</b> → Execute as <b>Me</b> → Who has access <b>Anyone</b> → <b>Deploy</b> → allow access (Advanced → Go to project).</li>
      <li>Copy the <b>Web app URL</b> and paste it here:</li>
    </ol>
    <div class="form-grid"><div class="field" style="grid-column:1/-1"><label>Web-app URL</label><input class="inp" id="sy-url" placeholder="https://script.google.com/macros/s/…/exec"></div>
      <div class="field" style="grid-column:1/-1"><label>Secret key (already inside the script)</label><input class="inp num" id="sy-key" value="${c.newKey}" readonly></div></div>
    <div class="row wrap" style="gap:8px;margin-top:12px"><button class="btn primary" data-act="syConnect">🔗 Connect & upload my data</button><button class="btn" data-act="syJoin">I already have a sheet — connect with a link/code</button></div>
    <div class="card-sub" id="sy-msg" style="margin-top:10px"></div></div>`;
}
})();
