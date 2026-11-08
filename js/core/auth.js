/* Budget Pro — users, roles and per-tab permissions */
(function(){
'use strict';
const BP = window.BP;
const SKEY = 'bpro.session';

BP.TABS = [
  { id: 'dash',        label: 'Dashboard',    icon: 'grid',   perm: true },
  { id: 'add',         label: 'Add Expense',  icon: 'plus',   perm: true },
  { id: 'log',         label: 'Log',          icon: 'list',   perm: true },
  { id: 'charts',      label: 'Analytics',    icon: 'chart',  perm: true },
  { id: 'budget',      label: 'Budget',       icon: 'pie',    perm: true },
  { id: 'savingboxes', label: 'Saving Boxes', icon: 'box',    perm: true },
  { id: 'spendable',   label: 'Spendable',    icon: 'coins',  perm: true },
  { id: 'cards',       label: 'Card Balances', icon: 'card',  perm: true },
  { id: 'emergency',   label: 'Emergency Fund', icon: 'shield', perm: true },
  { id: 'wallet',      label: 'Wallet',       icon: 'wallet', perm: true },
  { id: 'networth',    label: 'Net Worth',    icon: 'gem',    perm: true },
  { id: 'invest',      label: 'Investments',  icon: 'trend',  perm: true },
  { id: 'import',      label: 'Import / Export', icon: 'swap', perm: true },
  { id: 'adminpref',   label: 'Admin',        icon: 'gear',   perm: false, admin: true }
];

BP.auth = {
  user: null,
  async init(){
    const d = BP.db(); let changed = false;
    for (const [n, u] of Object.entries(d.users)){ if (!u.hash && u.pass0 != null){ u.hash = await BP.hash(u.pass0); delete u.pass0; changed = true; } }
    if (changed) BP.store.persist(true);
    try { const s = JSON.parse(sessionStorage.getItem(SKEY) || localStorage.getItem(SKEY) || 'null'); if (s && d.users[s.name]) this.user = { name: s.name, role: d.users[s.name].role }; } catch (e) {}
    return this.user;
  },
  async login(name, pass, remember){
    const u = BP.db().users[name.trim()];
    if (!u) return false;
    if ((await BP.hash(pass)) !== u.hash) return false;
    this.user = { name: name.trim(), role: u.role };
    const s = JSON.stringify({ name: this.user.name });
    sessionStorage.setItem(SKEY, s); if (remember) localStorage.setItem(SKEY, s); else localStorage.removeItem(SKEY);
    return true;
  },
  logout(){ this.user = null; sessionStorage.removeItem(SKEY); localStorage.removeItem(SKEY); },
  isAdmin(){ return this.user && this.user.role === 'admin'; },
  defaultPerms(role){
    const p = {}; BP.TABS.filter(t => t.perm).forEach(t => { p[t.id] = { view: true, edit: role === 'admin' || t.id === 'add' }; }); return p;
  },
  perms(name){ const d = BP.db(); return d.perms[name] || this.defaultPerms((d.users[name] || {}).role); },
  canView(tab){ if (!this.user) return false; const t = BP.TABS.find(x => x.id === tab); if (t && t.admin) return this.isAdmin(); return this.isAdmin() || (this.perms(this.user.name)[tab] || {}).view !== false; },
  canEdit(tab){ if (!this.user) return false; return this.isAdmin() || (this.perms(this.user.name)[tab] || {}).edit === true; },
  async setUser(name, pass, role, orig){
    const d = BP.db();
    if (orig && orig !== name){ d.users[name] = d.users[orig]; delete d.users[orig]; if (d.perms[orig]){ d.perms[name] = d.perms[orig]; delete d.perms[orig]; } d.expenses.forEach(e => { if (e.addedBy === orig) e.addedBy = name; }); }
    const cur = d.users[name] || {}; d.users[name] = { role, hash: pass ? await BP.hash(pass) : cur.hash };
    if (this.user && orig === this.user.name) this.user = { name, role };
    BP.store.persist();
  },
  delUser(name){ const d = BP.db(); delete d.users[name]; delete d.perms[name]; BP.store.persist(); }
};
})();
