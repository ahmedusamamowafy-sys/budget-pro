/* Budget Pro — cloud sync through the claude.ai artifact database (db capability).
   Only available when Budget Pro is opened from its claude.ai link while signed in as the owner (or an Editor).
   Layout: household/core   — everything except expenses  (+ meta.months index, meta.device)
           household/exp-YYYY-MM — {list:[...]} expenses of that month
   Last writer wins per document; other devices receive changes live. */
(function(){
'use strict';
const BP = window.BP;
const DEV_KEY = 'bpro.device';
let device = null; try { device = localStorage.getItem(DEV_KEY); if (!device){ device = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem(DEV_KEY, device); } } catch (e) { device = 'd' + Math.random().toString(36).slice(2, 10); }

const CL = BP.cloud = {
  db: null, on: false, state: 'off', msg: '', last: null, applying: false, pushing: false, dirty: false, sent: {}, unsub: null,
  set(state, msg){ CL.state = state; CL.msg = msg || ''; if (BP.sync && BP.sync.set) BP.sync.set(state === 'ok' ? 'ok' : state === 'busy' ? 'busy' : state === 'err' ? 'err' : 'off'); const el = document.getElementById('syncDot'); if (el) el.title = 'Cloud sync: ' + (CL.msg || state); },

  /* split / join the database into documents */
  split(d){
    const core = JSON.parse(JSON.stringify(d)); delete core.expenses;
    core.sync = { url: '', auto: false, lastPush: 0, lastPull: 0 }; // Google-Sheet sync settings stay per device
    const by = {}; d.expenses.forEach(e => { (by[e.month] = by[e.month] || []).push(e); });
    core.meta = Object.assign({}, core.meta, { months: Object.keys(by).sort(), device });
    const docs = { core }; Object.entries(by).forEach(([m, list]) => { docs['exp-' + m] = { list }; });
    return docs;
  },
  async pull(){
    const core = await CL.db.doc('household/core').get(); if (!core.exists) return null;
    const c = core.data(), months = (c.meta && c.meta.months) || [];
    const parts = await Promise.all(months.map(m => CL.db.doc('household/exp-' + m).get()));
    const expenses = []; parts.forEach(p => { if (p.exists) (p.data().list || []).forEach(e => expenses.push(e)); });
    expenses.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const local = BP.db(); const full = Object.assign({}, c, { expenses, sync: local ? local.sync : c.sync });
    // remember what the cloud holds so the next push only sends real changes
    CL.sent = {}; Object.entries(CL.split(full)).forEach(([k, v]) => { CL.sent[k] = CL.sig(v); });
    return full;
  },
  sig(v){ const x = JSON.parse(JSON.stringify(v)); if (x.meta){ delete x.meta.updatedAt; delete x.meta.device; } return JSON.stringify(x); },
  async push(){
    if (!CL.on || CL.applying) return; if (CL.pushing){ CL.dirty = true; return; }
    CL.pushing = true; CL.set('busy', 'saving…');
    try {
      do {
        CL.dirty = false; const docs = CL.split(BP.db());
        const changed = Object.keys(docs).filter(k => k !== 'core' && CL.sig(docs[k]) !== CL.sent[k]);
        const removed = Object.keys(CL.sent).filter(k => k !== 'core' && !docs[k]);
        for (const k of changed){ await CL.db.doc('household/' + k).set(docs[k]); CL.sent[k] = CL.sig(docs[k]); }
        for (const k of removed){ await CL.db.doc('household/' + k).delete(); delete CL.sent[k]; }
        if (changed.length || removed.length || CL.sig(docs.core) !== CL.sent.core){ await CL.db.doc('household/core').set(docs.core); CL.sent.core = CL.sig(docs.core); }
      } while (CL.dirty);
      CL.last = new Date(); CL.set('ok', 'saved ' + CL.last.toLocaleTimeString());
    } catch (e) {
      console.warn('cloud push failed', e);
      CL.set('err', e && e.code === 'quota_exceeded' ? 'cloud storage is full' : e && e.code === 'invalid_argument' ? 'no permission to save (open as owner/editor)' : 'save failed — will retry');
      if (!e || (e.code !== 'invalid_argument' && e.code !== 'quota_exceeded')) setTimeout(() => CL.push(), 8000);
    } finally { CL.pushing = false; }
  },
  apply(full, why){
    CL.applying = true; try { BP.store.replace(full); } finally { CL.applying = false; }
    if (BP.auth.user && !BP.db().users[BP.auth.user.name]) BP.auth.logout();
    if (BP.app && BP.auth.user) BP.app.refresh(); if (why) BP.toast(why, 'ok');
  },

  /* called once at start, before the login screen */
  async boot(){
    if (!(window.claude && typeof window.claude.use === 'function')) { CL.set('off', 'local only (open from the claude.ai link to sync)'); return; }
    CL.set('busy', 'connecting…');
    let db = null; try { db = await Promise.race([window.claude.use('db'), new Promise(r => setTimeout(() => r(null), 9000))]); } catch (e) { db = null; }
    if (!db){ CL.set('off', 'not available — sign in to claude.ai to sync'); return; }
    CL.db = db;
    try {
      const remote = await CL.pull(), local = BP.db();
      const remoteIsDefault = remote && remote.meta.untouched && !local.meta.untouched;
      if (remote && !remoteIsDefault && (local.meta.fresh || (remote.meta.updatedAt || 0) >= (local.meta.updatedAt || 0))){
        CL.applying = true; try { BP.store.replace(remote); } finally { CL.applying = false; }
      } else {
        CL.on = true; delete local.meta.fresh; await CL.push(); // first device, or this device has newer data
      }
      delete BP.db().meta.fresh; CL.on = true; CL.set('ok', remote ? 'synced' : 'cloud created');
    } catch (e) {
      console.warn('cloud boot failed', e);
      CL.set('err', e && e.code === 'revoked' ? 'access withdrawn' : 'could not reach cloud — working locally'); return;
    }
    BP.store.subscribe(BP.debounce(() => { if (!CL.applying) CL.push(); }, 1200));
    // live updates from other devices
    let first = true;
    CL.unsub = CL.db.doc('household/core').onSnapshot(async snap => {
      if (first){ first = false; return; }
      if (!snap.exists || snap.metadata && snap.metadata.hasPendingWrites) return;
      const c = snap.data(); if (!c.meta || c.meta.device === device) return;
      if ((c.meta.updatedAt || 0) <= (BP.db().meta.updatedAt || 0)) return;
      try { const full = await CL.pull(); if (full) CL.apply(full, '☁️ Updated from your other device'); CL.set('ok', 'synced ' + new Date().toLocaleTimeString()); } catch (e) { CL.set('err', 'live update failed'); }
    }, err => { CL.set('err', 'live updates stopped — reload to reconnect'); });
  },
  async now(){ if (!CL.db) return BP.toast('Cloud sync is not available here', 'err'); try { CL.set('busy', 'syncing…'); const remote = await CL.pull();
      if (remote && (remote.meta.updatedAt || 0) > (BP.db().meta.updatedAt || 0)) CL.apply(remote, '☁️ Pulled the latest data'); else { CL.on = true; await CL.push(); BP.toast('☁️ Cloud is up to date', 'ok'); } CL.set('ok', 'synced ' + new Date().toLocaleTimeString()); }
    catch (e) { CL.set('err', 'sync failed'); BP.toast('Sync failed', 'err'); } }
};
})();
