/* Budget Pro — finance engine (pure selectors over the database) */
(function(){
'use strict';
const BP = window.BP;
const D = () => BP.db();

const MAIN_META = {
  'Housing':['🏠','#60A5FA'], 'Monthly Needs':['🍽️','#34D399'], 'Transportation':['🚗','#FBBF24'], 'Personal Care':['💇','#F472B6'],
  'Welfare':['🎉','#A78BFA'], 'Communications':['💬','#22D3EE'], 'Risks':['⚠️','#FB7185'], 'Work Related':['💼','#FB923C'],
  'Debt':['💳','#94A3B8'], 'Religious':['🕌','#2DD4BF'], 'Other':['📦','#64748B']
};
const EXTRA_COLORS = ['#38BDF8','#E879F9','#F59E0B','#84CC16','#EF4444','#14B8A6'];

const C = BP.calc = {
  MAIN_META,
  mainIcon: m => (MAIN_META[m] || ['💸'])[0],
  mainColor(m){
    if (MAIN_META[m]) return MAIN_META[m][1];
    let h = 0; for (const ch of String(m)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return EXTRA_COLORS[h % EXTRA_COLORS.length];
  },
  /* ----- categories ----- */
  cats: () => D().categories,
  cat: sub => D().categories.find(c => c.sub === sub),
  catsOf: type => D().categories.filter(c => c.type === type),
  mains(){ const out = []; D().categories.forEach(c => { if (!out.includes(c.main)) out.push(c.main); }); return out; },
  groupByMain(list){ const g = {}; list.forEach(c => (g[c.main] = g[c.main] || []).push(c)); return g; },

  /* ----- plans ----- */
  planMonths: () => Object.keys(D().plans).sort(),
  hasPlan: m => !!D().plans[m],
  planFor(m){
    const d = D(), plans = d.plans;
    if (plans[m]) return { salary: plans[m]._salary ?? d.settings.defaultSalary, invest: plans[m]._investments ?? d.settings.defaultInvestments, budgets: plans[m].budgets || {}, saved: true, from: m };
    const keys = Object.keys(plans).sort(); let src = null;
    for (const k of keys) if (k < m) src = k;
    if (!src && keys.length) src = keys[0];
    if (src) return { salary: plans[src]._salary ?? d.settings.defaultSalary, invest: plans[src]._investments ?? d.settings.defaultInvestments, budgets: plans[src].budgets || {}, saved: false, from: src };
    return { salary: d.settings.defaultSalary, invest: d.settings.defaultInvestments, budgets: d.defaultBudgets || {}, saved: false, from: null };
  },
  budgetOf(m, sub){ const p = C.planFor(m); return Number(p.budgets[sub] ?? D().defaultBudgets[sub] ?? 0) || 0; },
  salary: m => C.planFor(m).salary,
  invest: m => C.planFor(m).invest,
  typeBudget(m, type){ const p = C.planFor(m); return BP.sum(C.catsOf(type), c => Number(p.budgets[c.sub] ?? D().defaultBudgets[c.sub] ?? 0)); },
  sbBudget: m => C.typeBudget(m, 'Saving Box'),
  spBudget: m => C.typeBudget(m, 'Spendable'),
  unalloc: m => C.salary(m) - C.sbBudget(m) - C.invest(m) - C.spBudget(m),
  pool(m){ const u = C.unalloc(m); return C.spBudget(m) + (D().settings.spendPool === 'full' ? Math.max(0, u) : 0); },
  mainBudget: (m, main, type) => BP.sum(C.cats().filter(c => c.main === main && (!type || c.type === type)), c => C.budgetOf(m, c.sub)),

  /* ----- expenses ----- */
  exps: () => D().expenses,
  expOf: m => D().expenses.filter(e => e.month === m),
  spent: (m, type) => BP.sum(D().expenses.filter(e => e.month === m && (!type || e.type === type)), e => e.amount),
  spentSP: m => C.spent(m, 'Spendable'),
  spentSB: m => C.spent(m, 'Saving Box'),
  spentBy(m, type, key){ const o = {}; D().expenses.forEach(e => { if (e.month === m && (!type || e.type === type)) o[e[key]] = (o[e[key]] || 0) + e.amount; }); return o; },
  months(){
    const set = new Set(D().expenses.map(e => e.month)); Object.keys(D().plans).forEach(k => set.add(k)); Object.keys(D().wallet).forEach(k => set.add(k));
    set.add(BP.ymNow()); return Array.from(set).sort();
  },
  dataMonths: () => Array.from(new Set(D().expenses.map(e => e.month))).sort(),
  defaultMonth(){ const cur = BP.ymNow(), dm = C.dataMonths(); if (dm.includes(cur)) return cur; return dm.length ? dm[dm.length - 1] : cur; },
  remainingSP: m => C.pool(m) - C.spentSP(m),
  freeCash: m => C.salary(m) - C.sbBudget(m) - C.invest(m) - C.spentSP(m),
  savingsRate(m){ const s = C.salary(m); return s ? C.freeCash(m) / s * 100 : 0; },
  wealthRate(m){ const s = C.salary(m); return s ? (C.invest(m) + C.freeCash(m)) / s * 100 : 0; },

  /* ----- saving box ledger (planned deposits minus spend, cumulative) ----- */
  boxBalance(sub, upTo){
    let bal = 0; C.months().forEach(m => { if (upTo && m > upTo) return; if (!C.hasPlan(m) && !D().expenses.some(e => e.month === m)) return; bal += C.budgetOf(m, sub) - BP.sum(D().expenses.filter(e => e.month === m && e.sub === sub), e => e.amount); });
    return bal;
  },

  /* ----- wallet ----- */
  wallet(m){ return D().wallet[m] || null; },
  walletRows(m){
    const w = D().wallet[m] || { alloc: {}, source: null }; const spent = C.spentBy(m, null, 'pay');
    const names = Array.from(new Set([...D().payMethods, ...Object.keys(w.alloc), ...Object.keys(spent)]));
    return names.map(n => ({ name: n, alloc: Number(w.alloc[n] || 0), spent: spent[n] || 0, left: Number(w.alloc[n] || 0) - (spent[n] || 0) }))
      .filter(r => r.alloc || r.spent).sort((a, b) => b.alloc - a.alloc);
  },

  /* ----- net worth ----- */
  ASSET_TYPES: ['bank','cash','savings','investment','gold','vehicle','asset_other'],
  LIAB_TYPES: ['loan','credit_card','debt','liability_other'],
  NW_LABEL: { bank:'Bank Account', cash:'Cash', savings:'Savings', investment:'Investment', gold:'Gold', vehicle:'Vehicle', asset_other:'Other Asset', loan:'Loan', credit_card:'Credit Card', debt:'Personal Debt', liability_other:'Other Liability' },
  NW_ICON: { bank:'🏦', cash:'💵', savings:'🐖', investment:'📈', gold:'🪙', vehicle:'🚗', asset_other:'📦', loan:'🏦', credit_card:'💳', debt:'🤝', liability_other:'📄' },
  nwTotals(){
    let assets = 0, liabilities = 0;
    D().netWorth.accounts.forEach(a => { if (C.ASSET_TYPES.includes(a.type)) assets += Number(a.balance) || 0; else liabilities += Number(a.balance) || 0; });
    const inv = C.portfolio().value; assets += inv;
    return { assets, liabilities, net: assets - liabilities, investments: inv };
  },
  liquid: () => BP.sum(D().netWorth.accounts.filter(a => ['bank','cash','savings'].includes(a.type)), a => Number(a.balance) || 0),

  /* ----- investments ----- */
  INV_TYPES: { stocks:'Saudi stocks', global:'Global stocks / ETFs', fund:'Mutual fund', mmf:'Money-market fund', sukuk:'Sukuk / bonds', gold:'Gold', fx:'Foreign currency', reit:'REIT', realestate:'Real estate', crypto:'Crypto', deposit:'Deposit / savings', business:'Business / partnership', other:'Other' },
  INV_ICON: { stocks:'📈', global:'🌍', fund:'🧺', mmf:'💵', sukuk:'📜', gold:'🪙', fx:'💱', reit:'🏢', realestate:'🏠', crypto:'🪙', deposit:'🏦', business:'🤝', other:'📦' },
  holdings: () => (D().investments && D().investments.holdings) || [],
  /* ----- live valuation ----- */
  OZ_G: 31.1034768, USD_SAR: 3.75, GOLD_TYPES: ['gold'], STOCK_TYPES: ['stocks', 'global', 'fund', 'reit', 'mmf', 'sukuk'], PROPERTY_TYPES: ['realestate'],
  CURRENCIES: { USD:'US dollar', EUR:'Euro', GBP:'British pound', EGP:'Egyptian pound', AED:'UAE dirham', KWD:'Kuwaiti dinar', QAR:'Qatari riyal', BHD:'Bahraini dinar', OMR:'Omani rial', JOD:'Jordanian dinar', CHF:'Swiss franc', TRY:'Turkish lira', CNY:'Chinese yuan', JPY:'Japanese yen', INR:'Indian rupee', CAD:'Canadian dollar', AUD:'Australian dollar' },
  /* SAR value of 1 unit of a currency, from the last live rates (USD falls back to the 3.75 peg) */
  fxRate(code){ code = String(code || '').toUpperCase(); if (!code || code === 'SAR') return 1; const fx = (D().investments || {}).fx || {}; const r = Number((fx.rates || {})[code]) || 0; return r || (code === 'USD' ? C.USD_SAR : 0); },
  fxInfo(){ const fx = (D().investments || {}).fx; return fx && fx.rates ? fx : null; },
  goldPrice(){ const g = (D().investments || {}).gold || {}; const usdOz = Number(g.usdOz) || 0; return usdOz ? { usdOz, sarG24: usdOz * C.USD_SAR / C.OZ_G, at: g.at, source: g.source } : null; },
  valueMode(h){ if (h.type === 'gold' && Number(h.grams) > 0 && C.goldPrice()) return 'gold'; if (C.STOCK_TYPES.includes(h.type) && Number(h.shares) > 0 && Number(h.lastPrice) > 0) return 'stock'; if (h.type === 'fx' && Number(h.units) > 0 && C.fxRate(h.currency)) return 'fx'; if (h.type === 'realestate' && Number(h.growth)) return 'property'; return 'manual'; },
  holdingValue(h){
    const mode = C.valueMode(h);
    if (mode === 'gold') return Number(h.grams) * (Number(h.karat) || 24) / 24 * C.goldPrice().sarG24;
    if (mode === 'fx') return Number(h.units) * C.fxRate(h.currency);
    if (mode === 'stock') return Number(h.shares) * Number(h.lastPrice) * (h.currency === 'USD' ? C.USD_SAR : 1);
    const base = Number(h.currentValue != null && h.currentValue !== '' ? h.currentValue : h.amount) || 0;
    if (mode === 'property'){ const from = BP.parseDate(((h.valueAt || '').slice(0, 10)) || h.date || BP.today()); const yrs = Math.max(0, (Date.now() - from) / (365.25 * 864e5)); return base * Math.pow(1 + Number(h.growth) / 100, yrs); }
    return base;
  },
  portfolio(){ const hs = C.holdings(); const cost = BP.sum(hs, h => Number(h.amount) || 0), value = BP.sum(hs, h => C.holdingValue(h)); return { cost, value, gain: value - cost, pct: cost ? (value - cost) / cost * 100 : 0, n: hs.length }; },
  /* months whose plan feeds the investment pot: saved plans up to the current month */
  investMonths(){ const cur = BP.ymNow(); return C.planMonths().filter(m => m <= cur); },
  investBudgetTotal(){ return BP.sum(C.investMonths(), m => C.invest(m)) + (Number((D().investments || {}).opening) || 0); },
  investedFromBudget(m){ return BP.sum(C.holdings().filter(h => h.fromBudget !== false && (!m || (h.date || '').slice(0, 7) === m)), h => Number(h.amount) || 0); },
  investPot(){ return C.investBudgetTotal() - C.investedFromBudget(); },

  /* ----- emergency fund ----- */
  /* settings for the Emergency Fund tab: which money counts, averaging window, target months */
  efCfg(){ return Object.assign({ liquid: true, boxes: true, pot: false, invest: false, extra: 0, window: 3, target: 6 }, D().settings.ef || {}); },
  efWindow(n){ const cur = BP.ymNow(); let ms = C.dataMonths().filter(m => m < cur).slice(-(Number(n) || 3)); if (!ms.length) ms = C.dataMonths().slice(-1); return ms; },
  /* one row per budget item: necessary flag, plan, average actual spend, saving-box balance and the monthly amount it needs */
  efRows(){
    const cfg = C.efCfg(), cur = BP.ymNow(), ms = C.efWindow(cfg.window), ess = new Set(D().settings.essentialCats), msSet = new Set(ms), sp = {};
    D().expenses.forEach(e => { if (msSet.has(e.month)) sp[e.sub] = (sp[e.sub] || 0) + e.amount; });
    return C.cats().map(c => {
      const isSB = c.type === 'Saving Box', plan = C.budgetOf(cur, c.sub), avg = ms.length ? (sp[c.sub] || 0) / ms.length : 0;
      const bal = isSB ? C.boxBalance(c.sub, cur) : null;
      const need = isSB ? (plan || avg) : (avg || plan);          // saving box → monthly provision; spendable → what you really spend
      return { sub: c.sub, main: c.main, type: c.type, nec: ess.has(c.sub), plan, avg, bal, need, own: isSB && need > 0 ? Math.max(0, bal) / need : null };
    });
  },
  ef(){
    const cfg = C.efCfg(), rows = C.efRows(), nec = rows.filter(r => r.nec), un = rows.filter(r => !r.nec);
    const need = BP.sum(nec, r => r.need), unNeed = BP.sum(un, r => r.need);
    const src = { liquid: C.liquid(), boxes: BP.sum(rows.filter(r => r.type === 'Saving Box'), r => r.bal), pot: Math.max(0, C.investPot()), invest: C.portfolio().value, extra: Number(cfg.extra) || 0 };
    const total = ['liquid', 'boxes', 'pot', 'invest'].reduce((t, k) => t + (cfg[k] ? src[k] : 0), 0) + src.extra;
    return { cfg, rows, nec, un, need, unNeed, src, total, months: need ? total / need : null, monthsAll: need + unNeed ? total / (need + unNeed) : null, window: C.efWindow(cfg.window) };
  },
  essentialAvg(){ return C.ef().need; },
  efMonths(){ return C.ef().months; },

  /* ----- salary cycle ----- */
  nextSalaryDate(){
    const day = Number(D().settings.salaryDay) || 27, t = new Date(); t.setHours(0, 0, 0, 0);
    const mk = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
    let c = mk(t.getFullYear(), t.getMonth()); if (c < t) c = t.getMonth() === 11 ? mk(t.getFullYear() + 1, 0) : mk(t.getFullYear(), t.getMonth() + 1);
    return c;
  },
  upcomingRecurring(until){
    const today = BP.today();
    return D().recurring.filter(r => r.active !== false && r.nextDue && r.nextDue >= today && r.nextDue <= until);
  },

  /* ----- aggregated series for charts ----- */
  series(months){
    return months.map(m => ({ m, label: BP.monthShort(m) + " '" + m.slice(2, 4), salary: C.salary(m), invest: C.invest(m), sb: C.sbBudget(m), sp: C.spBudget(m), pool: C.pool(m),
      spentSP: C.spentSP(m), spentSB: C.spentSB(m), free: C.freeCash(m), rate: C.savingsRate(m), unalloc: C.unalloc(m) }));
  },
  dailySpend(m, type){
    const n = BP.daysIn(m), arr = Array(n).fill(0);
    D().expenses.forEach(e => { if (e.month === m && (!type || e.type === type)) arr[+e.date.slice(8, 10) - 1] += e.amount; });
    return arr;
  },

  /* ----- financial health ----- */
  health(){
    const cur = BP.ymNow(); const past = C.dataMonths().filter(m => m < cur).slice(-3);
    const base = past.length ? past : C.dataMonths().slice(-1);
    // 1. savings rate (30)
    let sr = { score: 50, val: '—', detail: 'Not enough data' };
    const rates = base.map(m => C.salary(m) ? C.savingsRate(m) : null).filter(x => x !== null);
    if (rates.length){ const a = BP.sum(rates) / rates.length; sr = { score: a >= 20 ? 100 : a >= 15 ? 80 : a >= 10 ? 60 : a >= 5 ? 35 : a >= 0 ? 15 : 0, val: a.toFixed(1) + '% avg free-cash rate', detail: a >= 20 ? 'Excellent (≥20%)' : a >= 15 ? 'Good (≥15%)' : a >= 10 ? 'Fair (≥10%)' : a >= 5 ? 'Low (≥5%)' : 'Very low' }; }
    // 2. budget adherence (25)
    let ba = { score: 50, val: '—', detail: 'Not enough data' };
    const used = base.map(m => C.pool(m) ? C.spentSP(m) / C.pool(m) * 100 : null).filter(x => x !== null);
    if (used.length){ const a = BP.sum(used) / used.length; ba = { score: a <= 90 ? 100 : a <= 100 ? 80 : a <= 110 ? 55 : a <= 125 ? 30 : 10, val: a.toFixed(0) + '% of spendable budget used', detail: a <= 90 ? 'Excellent (under budget)' : a <= 100 ? 'Good (within budget)' : a <= 110 ? 'Fair (slightly over)' : a <= 125 ? 'Over budget' : 'Significantly over' }; }
    // 3. emergency fund (25)
    const em = C.efMonths(); let ef = { score: 0, val: 'Add liquid accounts in Net Worth', detail: 'No data' };
    if (em !== null) ef = { score: em >= 6 ? 100 : em >= 4 ? 80 : em >= 2 ? 55 : em >= 1 ? 30 : 10, val: em.toFixed(1) + ' months of essentials covered', detail: em >= 6 ? 'Excellent (≥6 mo)' : em >= 4 ? 'Good (≥4 mo)' : em >= 2 ? 'Fair (≥2 mo)' : em >= 1 ? 'Low (≥1 mo)' : 'Critical (<1 mo)' };
    // 4. net-worth trend (20)
    const hist = D().netWorth.history, hk = Object.keys(hist).sort(); let nw = { score: 50, val: 'No net worth data', detail: 'Add accounts in Net Worth' };
    if (hk.length >= 2){ const l = hist[hk[hk.length - 1]].net, p = hist[hk[hk.length - 2]].net; if (p){ const ch = (l - p) / Math.abs(p) * 100; nw = { score: ch >= 2 ? 100 : ch >= 0 ? 70 : ch >= -2 ? 45 : 20, val: (ch >= 0 ? '↑ ' : '↓ ') + Math.abs(ch).toFixed(1) + '% month-over-month', detail: ch >= 2 ? 'Growing' : ch >= 0 ? 'Stable' : ch >= -2 ? 'Slight decline' : 'Declining' }; } else nw = { score: l >= 0 ? 70 : 20, val: BP.sar(l), detail: l >= 0 ? 'Positive net worth' : 'Negative net worth' }; }
    else if (hk.length === 1){ const v = hist[hk[0]].net; nw = { score: v >= 0 ? 65 : 25, val: 'One snapshot recorded', detail: v >= 0 ? 'Positive net worth' : 'Negative net worth' }; }
    else { const live = C.nwTotals().net; if (live) nw = { score: live >= 0 ? 55 : 20, val: BP.sar(live) + ' (live)', detail: live >= 0 ? 'Positive' : 'Negative' }; }
    const total = Math.round(sr.score * .30 + ba.score * .25 + ef.score * .25 + nw.score * .20);
    const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F';
    const title = total >= 85 ? 'Excellent financial health 🎉' : total >= 70 ? 'Good financial health' : total >= 55 ? 'Fair — room to improve' : total >= 40 ? 'Needs attention' : 'Critical — take action now';
    const recs = [];
    if (sr.score < 35) recs.push(['bad', '💡 Your free-cash rate is very low. Trim Spendable allocations or move more into Saving Boxes.']);
    else if (sr.score < 65) recs.push(['warn', '💡 Aim for a 15–20% free-cash rate. Small cuts in Welfare or Monthly Needs add up.']);
    if (ba.score < 55) recs.push(['bad', '⚠️ You are regularly over budget. Review the biggest categories in Insights and adjust the plan.']);
    else if (ba.score < 80) recs.push(['warn', '📊 You are close to your spendable limit — watch Monthly Needs and Welfare.']);
    if (ef.score < 55) recs.push(['bad', '🛡️ Emergency fund covers less than 2 months of essentials. Build this first.']);
    else if (ef.score < 80) recs.push(['warn', '🛡️ Emergency fund is growing — keep going until 6 months are covered.']);
    if (nw.score < 45) recs.push(['bad', '📉 Net worth is declining or negative. Review liabilities in the Net Worth tab.']);
    else if (nw.score < 70 && hk.length < 2) recs.push(['info', '📸 Save a monthly net-worth snapshot to see your wealth trend.']);
    if (!recs.length) recs.push(['good', '✅ Your finances look great across all areas. Keep it up!']);
    return { total, grade, title, comps: [{ name: 'Savings Rate', w: 30, ...sr }, { name: 'Budget Adherence', w: 25, ...ba }, { name: 'Emergency Fund', w: 25, ...ef }, { name: 'Net Worth Trend', w: 20, ...nw }], recs, basedOn: base.length };
  }
};
})();
