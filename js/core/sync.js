/* Budget Pro — cross-device sync through YOUR OWN Google Sheet (Apps Script web app).
   • Every device keeps a full local copy (works offline).
   • Sync = pull → 3-way merge (local, sheet, last-synced base) → push. Edits made on two devices are both kept;
     deletions are respected; when the same item was changed on both, the most recent device wins.
   • Pushes are guarded: the sheet rejects a push that was based on an older version, and the app re-merges.
   • The sheet is protected by a secret key that only your devices know. */
(function(){
'use strict';
const BP = window.BP;
const BASE_KEY = 'bpro.syncbase', DEV_KEY = 'bpro.device';
const SKIP = new Set(['sync', 'meta']);
let device; try { device = localStorage.getItem(DEV_KEY) || ('d' + Math.random().toString(36).slice(2, 10)); localStorage.setItem(DEV_KEY, device); } catch (e) { device = 'd' + Math.random().toString(36).slice(2, 10); }

const SCRIPT = key => `// Budget Pro sync — paste into Extensions → Apps Script of a NEW Google Sheet, then Deploy → New deployment → Web app
//   Execute as: Me   ·   Who has access: Anyone      (the secret key below protects your data)
const SECRET = '${key}';
const TAB = 'BudgetProDB', PREV = 'BudgetProDB_previous', LOG = 'SyncLog';

function out_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_(name){ const ss = SpreadsheetApp.getActive(); return ss.getSheetByName(name) || ss.insertSheet(name); }
function read_(name){
  const s = sheet_(name), n = Number(s.getRange('A1').getValue() || 0); if (!n) return { updatedAt: 0, text: '' };
  const vals = s.getRange(2, 1, n, 1).getValues(); let t = ''; for (let i = 0; i < n; i++) t += String(vals[i][0]).slice(2);
  return { updatedAt: Number(s.getRange('B1').getValue() || 0), text: t };
}
function write_(name, text, updatedAt){
  const s = sheet_(name); s.clear(); const parts = text.match(/[\\s\\S]{1,45000}/g) || [];
  s.getRange('A1').setValue(parts.length); s.getRange('B1').setValue(updatedAt); s.getRange('C1').setValue(new Date());
  if (parts.length) s.getRange(2, 1, parts.length, 1).setValues(parts.map(p => ['c:' + p]));
}
function doGet(e){
  const p = (e && e.parameter) || {};
  if (p.key !== SECRET) return out_({ ok: false, error: 'bad key' });
  const r = read_(TAB);
  return out_({ ok: true, updatedAt: r.updatedAt, db: r.text ? JSON.parse(r.text) : null });
}
function doPost(e){
  let b; try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad json' }); }
  if (b.key !== SECRET) return out_({ ok: false, error: 'bad key' });
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const cur = read_(TAB);
    if (b.action === 'push'){
      if (cur.updatedAt && Number(b.base || 0) !== cur.updatedAt && !b.force) return out_({ ok: false, conflict: true, updatedAt: cur.updatedAt });
      if (cur.text) write_(PREV, cur.text, cur.updatedAt);          // keep the previous version as a safety copy
      const text = JSON.stringify(b.db); write_(TAB, text, b.updatedAt);
      sheet_(LOG).appendRow([new Date(), b.device || '', b.updatedAt, text.length]);
      return out_({ ok: true, updatedAt: b.updatedAt });
    }
    return out_({ ok: false, error: 'unknown action' });
  } finally { lock.releaseLock(); }
}`;

/* ---------- 3-way merge ---------- */
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isIdArr = v => Array.isArray(v) && v.length > 0 && v.every(x => isObj(x) && x.id != null);
function merge3(b, l, r, preferLocal){
  if (eq(l, r)) return l;
  if (b !== undefined && eq(l, b)) return r;
  if (b !== undefined && eq(r, b)) return l;
  if ((isIdArr(l) || isIdArr(r)) && Array.isArray(l) && Array.isArray(r)) return idMerge(Array.isArray(b) ? b : [], l, r, preferLocal);
  if (isObj(l) && isObj(r)){
    const out = {}, keys = new Set([...Object.keys(l), ...Object.keys(r)]), bb = isObj(b) ? b : {};
    keys.forEach(k => {
      const inL = k in l, inR = k in r, inB = k in bb;
      if (inL && inR) out[k] = merge3(bb[k], l[k], r[k], preferLocal);
      else if (inL){ if (!(inB && eq(bb[k], l[k]))) out[k] = l[k]; }      // deleted remotely unless changed locally
      else { if (!(inB && eq(bb[k], r[k]))) out[k] = r[k]; }              // deleted locally unless changed remotely
    });
    return out;
  }
  return preferLocal ? l : r;
}
function idMerge(b, l, r, preferLocal){
  const B = new Map(b.filter(isObj).map(x => [x.id, x])), L = new Map(l.map(x => [x.id, x])), R = new Map(r.map(x => [x.id, x]));
  const ids = [...new Set([...l.map(x => x.id), ...r.map(x => x.id)])], out = [];
  ids.forEach(id => {
    const bi = B.get(id), li = L.get(id), ri = R.get(id);
    if (li && ri){ out.push(merge3(bi, li, ri, preferLocal)); return; }
    const only = li || ri;
    if (bi && eq(bi, only)) return;            // the other side deleted it and this side didn't change it
    out.push(only);
  });
  return out;
}
function mergeDb(base, local, remote){
  if (!remote) return local;
  if (local.meta && local.meta.untouched) return Object.assign({}, remote, { sync: local.sync });
  const preferLocal = (local.meta.updatedAt || 0) >= (remote.meta && remote.meta.updatedAt || 0);
  const out = {}, keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  keys.forEach(k => {
    if (SKIP.has(k)) return;
    if (!(k in remote)) out[k] = local[k]; else if (!(k in local)) out[k] = remote[k];
    else out[k] = merge3(base ? base[k] : undefined, local[k], remote[k], preferLocal);
  });
  out.meta = Object.assign({}, remote.meta || {}, local.meta || {}); delete out.meta.untouched; delete out.meta.fresh;
  out.sync = local.sync;
  if (Array.isArray(out.expenses)) out.expenses.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return out;
}
const strip = d => { const x = JSON.parse(JSON.stringify(d)); x.sync = { url: '', key: '' }; return x; };
const sig = d => { const x = strip(d); if (x.meta){ delete x.meta.updatedAt; delete x.meta.device; delete x.meta.fresh; delete x.meta.untouched; } return JSON.stringify(x); };
const loadBase = () => { try { return JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch (e) { return null; } };
const saveBase = d => { try { localStorage.setItem(BASE_KEY, JSON.stringify(strip(d))); } catch (e) {} };

/* ---------- engine ---------- */
const S = BP.sync = {
  status: 'off', msg: 'not connected', busy: false, again: false, lastOk: 0, applying: false, merge3, mergeDb, script: SCRIPT,
  cfg(){ const d = BP.db(); d.sync = Object.assign({ url: '', key: '', auto: true, lastSync: 0, remoteAt: 0 }, d.sync || {}); return d.sync; },
  configured(){ const c = S.cfg(); return !!(c.url && c.key); },
  set(st, msg){ S.status = st; if (msg != null) S.msg = msg;
    const b = document.getElementById('syncBtn'); if (b){ b.className = 'sync-btn ' + st; b.title = 'Sync: ' + S.msg; const t = b.querySelector('.sl'); if (t) t.textContent = st === 'busy' ? 'Syncing…' : st === 'ok' ? 'Synced' : st === 'err' ? 'Sync failed' : st === 'offline' ? 'Offline' : 'Sync'; }
    const d = document.getElementById('syncDot'); if (d) d.className = 'sync-dot ' + (st === 'ok' ? 'ok' : st === 'busy' ? 'busy' : st === 'err' || st === 'offline' ? 'err' : ''); },
  newKey(){ const a = new Uint8Array(18); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else a.forEach((_, i) => { a[i] = Math.random() * 256; }); return Array.from(a, x => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 55]).join(''); },
  code(){ const c = S.cfg(); return btoa(unescape(encodeURIComponent(JSON.stringify({ u: c.url, k: c.key })))).replace(/=+$/, ''); },
  parseCode(s){ try { s = String(s).trim().replace(/^.*#connect=/, ''); while (s.length % 4) s += '='; const o = JSON.parse(decodeURIComponent(escape(atob(s)))); return o.u && o.k ? { url: o.u, key: o.k } : null; } catch (e) { return null; } },
  link(){ return location.href.replace(/#.*$/, '').replace(/index\.html$/, '') + '#connect=' + S.code(); },

  async get(url, key){
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key) + '&_=' + Date.now(), { cache: 'no-store', redirect: 'follow' });
    const j = await r.json(); if (!j.ok) throw new Error(j.error === 'bad key' ? 'The secret key does not match the sheet' : (j.error || 'Bad response')); return j;
  },
  async post(body){
    const c = S.cfg();
    const r = await fetch(c.url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ key: c.key, device }, body)) });
    return r.json();
  },

  /* the whole cycle; safe to call any time */
  async run(reason){
    if (!S.configured()) { S.set('off', 'not connected'); return false; }
    if (S.busy){ S.again = true; return false; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false){ S.set('offline', 'offline — changes are saved on this device and will sync later'); return false; }
    S.busy = true; S.set('busy', 'syncing…');
    try {
      for (let attempt = 0; attempt < 3; attempt++){
        const c = S.cfg(), remote = await S.get(c.url, c.key), local = BP.db();
        const merged = remote.db ? mergeDb(loadBase(), local, remote.db) : local;
        if (sig(merged) !== sig(local)) S.applyLocal(merged);
        if (remote.db && sig(merged) === sig(remote.db)){ saveBase(remote.db); S.cfg().remoteAt = remote.updatedAt; break; }
        const at = Date.now(), res = await S.post({ action: 'push', db: strip(BP.db()), updatedAt: at, base: remote.updatedAt || 0 });
        if (res && res.ok){ saveBase(BP.db()); S.cfg().remoteAt = at; break; }
        if (!(res && res.conflict)) throw new Error((res && res.error) || 'push failed');
      }
      const c = S.cfg(); c.lastSync = Date.now(); S.applying = true; try { BP.store.persist(true); } finally { S.applying = false; } S.lastOk = Date.now();
      S.set('ok', 'synced ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      return true;
    } catch (e) {
      console.warn('sync failed', e);
      const off = (typeof navigator !== 'undefined' && navigator.onLine === false) || /Failed to fetch|NetworkError|Load failed/i.test(String(e && e.message));
      S.set(off ? 'offline' : 'err', off ? 'offline — will retry' : String((e && e.message) || e));
      return false;
    } finally {
      S.busy = false; if (S.again){ S.again = false; setTimeout(() => S.run('queued'), 300); }
    }
  },
  applyLocal(merged){
    S.applying = true;
    S.lastApply = Date.now();
    try { merged.sync = BP.db().sync; BP.store.replace(merged); }
    finally { S.applying = false; }
    if (BP.auth && BP.auth.user && !BP.db().users[BP.auth.user.name]) BP.auth.logout();
    if (BP.app && BP.app.booted && BP.auth.user) BP.app.refresh();
  },
  async now(){ const ok = await S.run('manual'); BP.toast(ok ? '☁️ Synced with your Google Sheet' : S.configured() ? '⚠️ ' + S.msg : 'Connect your Google Sheet first (Admin → Data & sync)', ok ? 'ok' : 'err'); return ok; },
  async connect(url, key){
    url = String(url || '').trim(); key = String(key || '').trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) throw new Error('That is not an Apps Script web-app URL (it starts with https://script.google.com/macros/s/…)');
    if (!key) throw new Error('Enter the secret key');
    await S.get(url, key);                       // throws on wrong key / unreachable
    const c = S.cfg(); c.url = url; c.key = key; c.auto = true; BP.store.persist(true);
    return S.run('connect');
  },
  disconnect(){ const c = S.cfg(); c.url = ''; c.key = ''; BP.store.persist(true); try { localStorage.removeItem(BASE_KEY); } catch (e) {} S.set('off', 'not connected'); },

  /* start: pull before the login screen, then keep in sync */
  async boot(){
    const m = location.hash.match(/connect=([^&]+)/);            // connection link: …/#connect=CODE
    if (m){ const o = S.parseCode(m[1]); history.replaceState(null, '', location.pathname + location.search);
      if (o){ const c = S.cfg(); c.url = o.url; c.key = o.key; c.auto = true; BP.store.persist(true); setTimeout(() => BP.toast('🔗 This device is now connected to your Google Sheet', 'ok'), 900); } }
    if (!S.configured()) S.set('off', 'not connected');
    else await Promise.race([S.run('boot'), new Promise(r => setTimeout(r, 9000))]);
    BP.store.subscribe(BP.debounce(() => { if (!S.applying && Date.now() - (S.lastApply || 0) > 3000 && S.configured() && S.cfg().auto) S.run('change'); }, 2500));
    const tick = () => { if (S.configured() && S.cfg().auto && document.visibilityState === 'visible' && Date.now() - S.lastOk > 25000) S.run('poll'); };
    setInterval(tick, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
    window.addEventListener('online', () => S.run('online'));
    window.addEventListener('focus', tick);
  }
};
})();
