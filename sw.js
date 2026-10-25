/* Budget Pro service worker — works offline. App files: cached; data: localStorage + your Google Sheet. */
const V = 'budget-pro-0a2761b3';
const FILES = ["./", "css/base.css", "css/motion.css", "css/sizing.css", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "icons/maskable-512.png", "index.html", "js/app.js", "js/core/actions.js", "js/core/auth.js", "js/core/calc.js", "js/core/charts.js", "js/core/cloud.js", "js/core/demo.js", "js/core/motion.js", "js/core/seed.js", "js/core/store.js", "js/core/sync.js", "js/core/themes.js", "js/core/utils.js", "js/vendor/chart.umd.js", "js/vendor/xlsx.mini.min.js", "js/views/add.js", "js/views/admin.js", "js/views/analytics.js", "js/views/boxes.js", "js/views/budget.js", "js/views/cards.js", "js/views/dash.js", "js/views/dash2.js", "js/views/invest.js", "js/views/log.js", "js/views/networth.js", "js/views/sheet.js", "js/views/transfer.js", "js/views/wallet.js", "manifest.webmanifest"];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(ch => ch.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./'))));
});
