/* Budget Pro — empty starter for the PUBLIC (hosted) build. Contains no personal data.
   Real data arrives from the owner's Google Sheet (Connect this device) or from a backup (Import / Export → Restore). */
(function(){
'use strict';
const BP = window.BP;
const SEED_VERSION = 3;
const PAYS = ['Cash'];
BP.seed = {
  VERSION: SEED_VERSION, CATS: [], PLANS: { '2026-10': { s: 0, i: 0, b: {} } }, EXPS: [], WALLET: {}, NETWORTH: [], PAYS, PUBLIC: true,
  categories(){ return []; },
  plans(){ return {}; },
  expenses(){ return []; },
  netWorth(){ return []; },
  create(){
    const now = new Date().toISOString();
    return {
      meta:{ version:2, seedVersion:SEED_VERSION, createdAt:now, updatedAt:Date.now(), source:'empty', demo:false },
      settings:{ salaryDay:27, spendPool:'planned', essentialCats:[], defaultSalary:0, defaultInvestments:0, currency:'SAR', welcomeSeen:true },
      categories:[], plans:{}, defaultBudgets:{}, expenses:[],
      payMethods:PAYS.slice(), wallet:{},
      users:{ Ahmed:{ role:'admin', hash:null, pass0:'99' } },
      perms:{}, recurring:[], goals:[], boxes:[],
      netWorth:{ accounts:[], history:{} },
      quickAdd:[], tabOrder:null,
      sync:{ url:'', key:'', auto:true, lastSync:0, remoteAt:0 }
    };
  }
};
})();
