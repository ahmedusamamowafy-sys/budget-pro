/* Budget Pro — optional demo data (clearly flagged, removable). Lets you preview every chart with several months of history. */
(function(){
'use strict';
const BP = window.BP;
function rng(seed){ let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// sub -> [txnCount, [descriptions], spendFactor]
const PLAN = {
  'Protein food': [5, ['Fish + Meat', 'Chicken', 'Butcher', 'Eggs & protein'], 1.0], 'Food Required Items': [2, ['Rice & oil', 'Pantry'], .9], 'Groceries': [4, ['Panda', 'Danube', 'Tamimi', 'Veggies'], 1.1],
  'Household Items': [2, ['Bokhour items', 'Kitchen stuff'], 1.0], 'Mobile Bills': [1, ['STC recharge'], 1.0], 'Car Petrol': [4, ['Petrol 95', 'Petrol'], 1.0], 'Parking Fees': [3, ['Parking'], 1.0],
  'Car Wash': [2, ['Car wash'], 1.0], 'Haircut / Salon': [1, ['Barber'], 1.0], 'Skincare': [1, ['Pharmacy skincare'], 1.0], 'Shopping': [2, ['Clothes', 'Amazon order', 'Shoes'], 1.05],
  'Restaurants': [3, ['Dinner out', 'Burger', 'Shawarma'], 1.0], 'Coffee Shops': [6, ['Signature', 'Dunkin', 'Starbucks', 'Barns'], 1.0], 'Entertainment': [2, ['Cinema', 'Ice Cream + Chips'], 1.0],
  'Weekend Trips': [1, ['Weekend trip fuel + food'], 1.0], 'Home Maintenance': [1, ['Plumber'], 1.0], 'Cleaning Supplies': [1, ['Cleaning supplies'], 1.0]
};
const PAYS = [['CB', .58], ['STC', .14], ['RAJ', .1], ['Cash', .1], ['SAB', .08]];
function pickPay(r){ let x = r(), a = 0; for (const [p, w] of PAYS){ a += w; if (x <= a) return p; } return 'CB'; }

BP.demo = {
  isLoaded: () => !!BP.db().meta.demo,
  load(){
    const d = BP.db(); if (d.meta.demo) return; const r = rng(2026);
    const cur = BP.ymNow(), months = []; for (let m = '2026-07'; m <= cur; m = BP.addMonths(m, 1)) months.push(m);
    const today = BP.today();
    const bySub = Object.fromEntries(d.categories.map(c => [c.sub, c])); const base = d.plans['2026-06'] || BP.calc.planFor('2026-06');
    const real = new Set(d.expenses.filter(e => !e.demo).map(e => e.month));
    months.forEach((m, mi) => {
      if (real.has(m) || (d.plans[m] && !d.plans[m].demo)) return; // never overlap real data
      const s0 = BP.calc.salary(BP.ymNow()) || 15000, i0 = BP.calc.invest(BP.ymNow()) || 3000; const salary = s0 + (mi >= 2 ? 500 : 0), invest = i0 + (mi >= 1 ? 250 : 0);
      d.plans[m] = { _salary: salary, _investments: invest, budgets: { ...(base.budgets || {}) }, saved: true, demo: true };
      const last = m === cur ? +today.slice(8, 10) : BP.daysIn(m); const add = (sub, day, amt, desc) => {
        const c = bySub[sub]; if (!c || day > last) return; day = Math.max(1, Math.min(day, last));
        d.expenses.push({ id: 'd' + BP.uid() + Math.floor(r() * 1e4), date: `${m}-${String(day).padStart(2, '0')}`, month: m, sub, main: c.main, category: c.category, type: c.type, amount: Math.round(amt), desc, pay: pickPay(r), addedBy: r() < .78 ? 'Ahmed' : 'Yara', createdAt: new Date().toISOString(), demo: true });
      };
      // spendable
      Object.entries(PLAN).forEach(([sub, [n, descs, f]]) => {
        const bud = (base.budgets || {})[sub] || 0; if (!bud) return;
        const factor = (.62 + r() * .7) * f * (m === cur ? Math.min(1, last / BP.daysIn(m) + .15) : 1); let total = bud * factor;
        if (sub === 'Shopping' && r() < .35) total *= 1.7; // occasional overspend
        for (let i = 0; i < n; i++){ const share = total / n * (.6 + r() * .8); add(sub, 1 + Math.floor(r() * BP.daysIn(m)), share, descs[Math.floor(r() * descs.length)]); }
      });
      // saving-box items
      add('Rent', 1, 2250, 'Monthly rent'); add('Electricity Bill', 12 + Math.floor(r() * 5), 95 + r() * 70, 'SEC bill'); add('Water Bill', 14, 60 + r() * 80, 'NWC bill');
      { const debt = d.categories.find(c => c.main === 'Debt'); if (debt) add(debt.sub, 5, 2000, 'Monthly instalment'); } add('Gym Membership', 3, 220, 'Gym'); add('Zakat / Sadqa', 9, 50, 'Sadqa'); add('Car Insurance', 8, mi === 1 ? 1650 : 0, 'Annual insurance');
      if (r() < .5) add('Doctor Visits', 6 + Math.floor(r() * 12), 60 + r() * 70, 'Clinic'); if (r() < .5) add('Pharmacy', 10 + Math.floor(r() * 10), 20 + r() * 40, 'Pharmacy');
      if (mi % 2 === 1) add('Umrah / Hajj', 20, 1000, 'Umrah saving'); if (r() < .3) add('Traffic Violations', 17, 150 + r() * 100, 'Speed camera');
      d.wallet[m] = { source: { name: 'RIY', amount: salary }, alloc: { CB: 1200 + Math.round(r() * 400), STC: 350 + Math.round(r() * 120), RAJ: 2800, SAB: 40, Cash: 150 + Math.round(r() * 80), Dollar: 2625 }, demo: true };
    });
    // net worth
    const acc = (name, type, balance) => ({ id: 'dn' + BP.uid(), name, type, balance, demo: true });
    const noRealNW = !d.netWorth.accounts.some(a => !a.demo);
    if (noRealNW) d.netWorth.accounts.push(acc('Al Rajhi Current', 'bank', 6400), acc('Cash on hand', 'cash', 320), acc('Emergency Savings', 'savings', 15200), acc('Investment Portfolio', 'investment', 28500), acc('Gold', 'gold', 6200), acc('Car', 'vehicle', 34000), acc('Personal debt', 'debt', 12000));
    if (noRealNW) [['2026-06', 78200, 15000], ['2026-07', 80100, 14000], ['2026-08', 82600, 13000], ['2026-09', 86400, 12000]].forEach(([m, a, l]) => { d.netWorth.history[m] = { assets: a, liabilities: l, net: a - l, demo: true }; });
    // recurring / goals / boxes
    const nm = BP.addMonths(cur, 1);
    d.recurring.push({ id: 'dr1', demo: true, name: 'Gym membership', sub: 'Gym Membership', pay: 'CB', amount: 220, frequency: 'monthly', nextDue: cur + '-25', active: true, autoAdd: false },
      { id: 'dr2', demo: true, name: 'Rent', sub: 'Rent', pay: 'RAJ', amount: 2250, frequency: 'monthly', nextDue: nm + '-01', active: true, autoAdd: false },
      { id: 'dr3', demo: true, name: 'Mobile line', sub: 'Mobile Bills', pay: 'STC', amount: 180, frequency: 'monthly', nextDue: cur + '-24', active: true, autoAdd: false },
      { id: 'dr4', demo: true, name: 'Car insurance', sub: 'Car Insurance', pay: 'CB', amount: 1650, frequency: 'annual', nextDue: '2027-08-08', active: true, autoAdd: false });
    d.goals.push({ id: 'dg1', demo: true, name: 'Emergency fund (6 months)', emoji: '🛡️', target: 36000, saved: 15200, deadline: BP.addMonths(cur, 14), notes: 'Six months of essentials' },
      { id: 'dg2', demo: true, name: 'Umrah trip', emoji: '🕌', target: 12000, saved: 7000, deadline: BP.addMonths(cur, 8), notes: '' }, { id: 'dg3', demo: true, name: 'New laptop', emoji: '💻', target: 6500, saved: 2100, deadline: '', notes: '' });
    d.boxes.push({ id: 'db1', demo: true, name: 'Umrah Fund', icon: '🕌', color: '#34D399', target: 12000, balance: 7000, notes: 'Monthly deposits', tx: [{ type: 'init', amount: 7000, note: 'Initial balance', date: new Date().toISOString() }] },
      { id: 'db2', demo: true, name: 'Car repairs', icon: '🚗', color: '#FBBF24', target: 4000, balance: 1350, notes: '', tx: [{ type: 'init', amount: 1350, note: 'Initial balance', date: new Date().toISOString() }] });
    d.meta.demo = true; BP.store.persist();
  },
  remove(){
    const d = BP.db();
    d.expenses = d.expenses.filter(e => !e.demo);
    Object.keys(d.plans).forEach(k => { if (d.plans[k].demo) delete d.plans[k]; });
    Object.keys(d.wallet).forEach(k => { if (d.wallet[k].demo) delete d.wallet[k]; });
    Object.keys(d.netWorth.history).forEach(k => { if (d.netWorth.history[k].demo) delete d.netWorth.history[k]; });
    d.netWorth.accounts = d.netWorth.accounts.filter(a => !a.demo);
    ['recurring', 'goals', 'boxes'].forEach(k => { d[k] = d[k].filter(x => !x.demo); });
    d.meta.demo = false; BP.store.persist();
  }
};
})();
