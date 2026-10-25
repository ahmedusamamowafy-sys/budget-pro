/* Budget Pro — utilities, icons, html templating, modal, toast */
(function(){
'use strict';
const BP = window.BP = window.BP || {};
BP.views = {}; BP.core = {};

/* ---------- html templating with auto-escape ---------- */
const ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
BP.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
class Raw { constructor(s){ this.s = s; } toString(){ return this.s; } }
BP.raw = s => new Raw(String(s == null ? '' : s));
function part(v){
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return BP.esc(v);
}
BP.h = (strings, ...vals) => new Raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ''), ''));
BP.str = v => part(v);

/* ---------- DOM ---------- */
BP.$ = (sel, root) => (root || document).querySelector(sel);
BP.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
BP.mount = (el, tpl) => { el.innerHTML = part(tpl); return el; };
BP.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
BP.clone = o => JSON.parse(JSON.stringify(o));
BP.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------- number formatting ---------- */
BP.fmt = n => { n = Number(n) || 0; return Math.round(n).toLocaleString('en-US'); };
BP.fmt2 = n => (Number(n) || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
BP.fmtK = n => { n = Number(n) || 0; const a = Math.abs(n); return (n < 0 ? '-' : '') + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k' : Math.round(a)); };
BP.sar = n => BP.fmt(n) + ' SAR';
BP.signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + BP.fmt(Math.abs(n));
BP.pct = (a, b, d = 0) => b ? (a / b * 100).toFixed(d) + '%' : '—';
BP.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
BP.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x || 0), 0);

/* ---------- dates (always local, YYYY-MM-DD strings) ---------- */
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MNL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const p2 = n => String(n).padStart(2, '0');
BP.MN = MN; BP.MNL = MNL;
BP.toISO = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
BP.today = () => BP.toISO(new Date());
BP.ymNow = () => BP.today().slice(0, 7);
BP.parseDate = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
BP.fmtMonth = (ym, long) => { if (!ym) return ''; const [y, m] = ym.split('-'); return (long ? MNL : MN)[+m - 1] + ' ' + y; };
BP.monthShort = ym => MN[+ym.split('-')[1] - 1];
BP.addMonths = (ym, n) => { let [y, m] = ym.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '-' + p2(m); };
BP.monthsBetween = (a, b) => { const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number); return (by - ay) * 12 + (bm - am); };
BP.daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
BP.addDays = (iso, n) => { const d = BP.parseDate(iso); d.setDate(d.getDate() + n); return BP.toISO(d); };
BP.fmtDate = iso => { if (!iso) return '—'; const d = BP.parseDate(iso); return `${MN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
BP.fmtDT = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${BP.toISO(d)} · ${p2(h)}:${p2(d.getMinutes())} ${ap}`; };
BP.dayName = iso => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][BP.parseDate(iso).getDay()];

/* ---------- icons (stroke icons, 24px grid) ---------- */
const I = {
  plus:'M12 5v14M5 12h14', list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  chart:'M3 3v18h18M7 15l4-5 3 3 5-7', pie:'M21 12A9 9 0 1 1 12 3v9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  wallet:'M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16a2 2 0 0 1 2 2v3h-5a2 2 0 0 0 0 4h5',
  box:'M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12.5l8.7-5M12 22V12.5',
  coins:'M12 6c4.4 0 8-1 8-2.5S16.4 1 12 1 4 2 4 3.5 7.6 6 12 6zM4 3.5v5C4 10 7.6 11 12 11s8-1 8-2.5v-5M4 8.5v5C4 15 7.6 16 12 16s8-1 8-2.5v-5M4 13.5v5C4 20 7.6 21 12 21s8-1 8-2.5v-5',
  gem:'M6 3h12l4 6-10 12L2 9zM2 9h20M12 21L8 9l4-6 4 6z',
  swap:'M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4', gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff:'M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22',
  palette:'M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4a4.6 4.6 0 0 0 4.6-4.6C22 6 17.5 2 12 2zM6.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM15.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  trash:'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z', x:'M18 6L6 18M6 6l12 12', check:'M20 6L9 17l-5-5',
  logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', upload:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  copy:'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  repeat:'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  target:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  cloud:'M18 10h-1.3A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z', search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  more:'M12 12h.01M19 12h.01M5 12h.01', arrowup:'M12 19V5M5 12l7-7 7 7', arrowdown:'M12 5v14M19 12l-7 7-7-7',
  sun:'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', spark:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  card:'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4',
  home:'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', calendar:'M3 9h18M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  trend:'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6', file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  lock:'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4', filter:'M22 3H2l8 9.5V19l4 2v-8.5z',
  refresh:'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15'
};
BP.icon = (name, cls) => BP.raw(`<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${I[name] || I.more}"/></svg>`);

/* ---------- toast ---------- */
let tt;
BP.toast = (msg, kind) => {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('show'), 2600);
};

/* ---------- modal ---------- */
BP.modal = {
  stack: [],
  open(opts){
    const ov = document.createElement('div'); ov.className = 'overlay';
    const html = BP.h`<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-h"><h3>${opts.title || ''}</h3><button class="icon-btn" data-close aria-label="Close">${BP.icon('x')}</button></div>
      <div class="modal-b">${opts.body || ''}</div>
      ${opts.actions === false ? '' : BP.h`<div class="modal-f">
        ${opts.cancel === false ? '' : BP.h`<button class="btn" data-close>${opts.cancelText || 'Cancel'}</button>`}
        ${opts.okText === null ? '' : BP.h`<button class="btn ${opts.danger ? 'danger' : 'primary'}" data-ok>${opts.okText || 'Save'}</button>`}
      </div>`}
    </div>`;
    ov.innerHTML = html.s;
    document.body.appendChild(ov);
    const api = { el: ov, root: ov.querySelector('.modal'), close(){ ov.remove(); BP.modal.stack = BP.modal.stack.filter(m => m !== api); } };
    ov.addEventListener('mousedown', e => { if (e.target === ov && !opts.sticky) api.close(); });
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) api.close();
      else if (e.target.closest('[data-ok]')) { const r = opts.onOk ? opts.onOk(api) : undefined; if (r !== false) api.close(); }
    });
    BP.modal.stack.push(api);
    if (opts.onOpen) opts.onOpen(api);
    const first = ov.querySelector('input:not([type=hidden]),select,textarea'); if (first && opts.focus !== false) setTimeout(() => first.focus(), 60);
    return api;
  },
  confirm(msg, onYes, o){
    return BP.modal.open({ title: (o && o.title) || 'Please confirm', body: BP.h`<p style="line-height:1.6">${msg}</p>`, okText: (o && o.okText) || 'Confirm', danger: !o || o.danger !== false, onOk: () => { onYes(); } });
  }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && BP.modal.stack.length) BP.modal.stack[BP.modal.stack.length - 1].close(); });

/* ---------- misc ---------- */
BP.download = (name, text, type) => {
  const blob = new Blob([text], { type: type || 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};
BP.copyText = async text => {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} ta.remove(); return ok;
  }
};
BP.readFile = (file, as) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; as === 'buffer' ? r.readAsArrayBuffer(file) : as === 'dataurl' ? r.readAsDataURL(file) : r.readAsText(file); });
BP.loadScript = src => new Promise((res, rej) => { if (BP._scripts && BP._scripts[src]) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => { (BP._scripts = BP._scripts || {})[src] = 1; res(); }; s.onerror = rej; document.head.appendChild(s); });

/* sha-256 password hashing with a safe fallback for non-secure contexts */
BP.hash = async str => {
  try {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bpro::' + str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57; const s = 'bpro::' + str;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'f' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};
})();
