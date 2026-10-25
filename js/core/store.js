/* Budget Pro — persistence layer (single JSON database in localStorage, namespaced "bpro.") */
(function(){
'use strict';
const BP = window.BP;
const KEY = 'bpro.db.v2';
let db = null, timer = null;
const subs = [];

function migrate(d){
  d.meta = d.meta || { version: 2 };
  d.settings = Object.assign({ salaryDay: 27, spendPool: 'planned', essentialCats: [], defaultSalary: 0, defaultInvestments: 0, currency: 'SAR' }, d.settings || {});
  ['categories', 'expenses', 'payMethods', 'recurring', 'goals', 'boxes', 'quickAdd'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  ['plans', 'wallet', 'perms', 'users', 'defaultBudgets'].forEach(k => { if (!d[k] || typeof d[k] !== 'object') d[k] = {}; });
  if (!d.cardMonths || typeof d.cardMonths !== 'object') d.cardMonths = {};
  d.netWorth = d.netWorth || { accounts: [], history: {} };
  d.investments = Object.assign({ holdings: [], opening: 0, profile: { nationality: 'Egyptian', residence: 'Saudi Arabia (Riyadh)', horizon: '3-5', risk: 'medium', shariah: false, goal: 'growth' }, advice: null }, d.investments || {});
  if (!Array.isArray(d.investments.holdings)) d.investments.holdings = [];
  // gold price: start from the metalcharts.org snapshot read on 19-Oct-2026 ($4,148.86/oz) until refreshed
  if (!d.investments.gold) d.investments.gold = { usdOz: 4148.86, at: '2026-10-19T12:00:00.000Z', source: 'metalcharts.org (snapshot)' };
  d.investments.keys = Object.assign({ metalcharts: '', alphavantage: '' }, d.investments.keys || {});
  // gold holdings without grams: read them from the name (e.g. "20 Gm Price on date ...")
  d.investments.holdings.forEach(h => { if (h.type === 'gold' && !h.grams){ const m = String(h.name || '').match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams|جرام|جم)\b/i); if (m){ h.grams = parseFloat(m[1]); h.karat = h.karat || 24; } } });
  d.netWorth.accounts = d.netWorth.accounts || []; d.netWorth.history = d.netWorth.history || {};
  d.sync = Object.assign({ url: '', auto: false, lastPush: 0, lastPull: 0 }, d.sync || {});
  d.expenses.forEach(e => { if (!e.month && e.date) e.month = e.date.slice(0, 7); });
  return d;
}

/* Upgrade a database created from an older Excel seed to the current one, keeping everything the user added. */
function upgradeSeed(d){
  const S = BP.seed; if (!S || (d.meta.seedVersion || 0) >= S.VERSION) return false;
  // drop demo data (it would overlap the real months now)
  d.expenses = d.expenses.filter(e => !e.demo);
  Object.keys(d.plans).forEach(k => { if (d.plans[k].demo) delete d.plans[k]; });
  Object.keys(d.wallet).forEach(k => { if (d.wallet[k].demo) delete d.wallet[k]; });
  Object.keys(d.netWorth.history).forEach(k => { if (d.netWorth.history[k].demo) delete d.netWorth.history[k]; });
  d.netWorth.accounts = d.netWorth.accounts.filter(a => !a.demo);
  ['recurring', 'goals', 'boxes'].forEach(k => { d[k] = d[k].filter(x => !x.demo); }); d.meta.demo = false;
  // categories: new list + any custom category the user still uses
  const cats = S.categories(), have = new Set(cats.map(c => c.sub));
  const user = d.expenses.filter(e => !e.seed && !/^x10\d\d$/.test(e.id));
  d.categories.forEach(c => { if (!have.has(c.sub) && user.some(e => e.sub === c.sub)){ cats.push(c); have.add(c.sub); } });
  d.categories = cats;
  // expenses: Excel history + the user's own entries
  d.expenses = [...user, ...S.expenses(cats)].sort((a, b) => b.date.localeCompare(a.date));
  // plans for the Excel months come from the workbook; later months the user saved are kept
  Object.assign(d.plans, S.plans());
  const last = S.PLANS['2026-10']; d.defaultBudgets = {}; cats.forEach(c => { d.defaultBudgets[c.sub] = Number(last.b[c.sub] || 0); });
  S.PAYS.forEach(p => { if (!d.payMethods.includes(p)) d.payMethods.push(p); });
  if (!d.netWorth.accounts.length) d.netWorth.accounts = S.netWorth();
  [...['Water Galon', 'Car Petrol'], ...cats.filter(c => c.main === 'Debt').map(c => c.sub)].forEach(x => { if (!d.settings.essentialCats.includes(x)) d.settings.essentialCats.push(x); });
  d.settings.defaultInvestments = 5700; d.settings.welcomeSeen = false;
  d.meta.seedVersion = S.VERSION; d.meta.source = 'KSA_Budget_v8_1.xlsm'; d.meta.upgradedAt = new Date().toISOString();
  return true;
}

BP.store = {
  KEY,
  load(){
    try { const raw = localStorage.getItem(KEY); if (raw) { db = migrate(JSON.parse(raw)); if (upgradeSeed(db)) { this.persist(true); BP.store.justUpgraded = true; } return db; } } catch (e) { console.warn('db load failed', e); }
    db = migrate(BP.seed.create()); db.meta.fresh = true; db.meta.untouched = true; this.persist(); return db;
  },
  get db(){ return db; },
  persist(silent){
    clearTimeout(timer);
    db.meta.updatedAt = Date.now();
    if (db.meta.untouched && BP.app && BP.app.booted && !(BP.cloud && BP.cloud.applying)) delete db.meta.untouched;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { BP.toast('Storage is full — export a backup', 'err'); }
    if (!silent) subs.forEach(f => { try { f(); } catch (e) {} });
  },
  save(){ clearTimeout(timer); db.meta.updatedAt = Date.now(); timer = setTimeout(() => this.persist(), 120); },
  subscribe(f){ subs.push(f); },
  replace(newDb){ db = migrate(newDb); this.persist(); },
  reset(){ db = migrate(BP.seed.create()); this.persist(); },
  exportJSON(){ return JSON.stringify(db, null, 1); }
};
BP.db = () => db;
})();
