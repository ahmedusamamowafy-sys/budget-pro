/* Budget Pro — motion engine: staggered reveals, count-up numbers, chart draw-in, bar/ring fills */
(function(){
'use strict';
const BP = window.BP;
const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = t => 1 - Math.pow(1 - t, 4);
const NUM = /^([+−-]?)([\d,]+(?:\.\d+)?)(%?)$/;
let io = null;

/* ---- Chart.js global animation: staggered, eased ---- */
function chartDefaults(){
  if (!window.Chart) return;
  Object.assign(Chart.defaults.animation, { duration: 1100, easing: 'easeOutQuart',
    delay: ctx => (ctx.type === 'data' && ctx.mode === 'default' && !M.quiet) ? Math.min(ctx.dataIndex * 28 + ctx.datasetIndex * 90, 900) : 0 });
  Chart.defaults.animations.colors = false;
  Chart.defaults.transitions.active = { animation: { duration: 250 } };
  Chart.defaults.elements.arc.hoverOffset = 10;
  Chart.defaults.elements.bar.borderSkipped = false;
  Chart.defaults.elements.point.hoverRadius = 6; Chart.defaults.elements.point.hoverBorderWidth = 3;
}

/* ---- count-up for numeric text ---- */
function tween(node, from, to, fmt, dur){
  const t0 = performance.now();
  const step = now => { const p = Math.min(1, (now - t0) / dur); node.nodeValue = fmt(from + (to - from) * easeOut(p)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function countUp(root){
  root.querySelectorAll('.kpi-val, .hero .big, .ring-c .v, .mini-stat .v, .li-v, .tbl td.num b').forEach(el => {
    const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim()); if (!tn) return;
    const raw = tn.nodeValue.trim(), m = raw.match(NUM); if (!m) return;
    const sign = m[1], digits = m[2], pct = m[3], dec = (digits.split('.')[1] || '').length, target = parseFloat(digits.replace(/,/g, '')); if (!isFinite(target) || target === 0) return;
    const lead = tn.nodeValue.match(/^\s*/)[0], trail = tn.nodeValue.match(/\s*$/)[0], commas = digits.includes(',');
    const fmt = v => lead + sign + (commas ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + pct + trail;
    tn.nodeValue = fmt(0); tween(tn, 0, target, fmt, el.classList.contains('li-v') ? 800 : 1300);
  });
}

/* ---- prepare a block so it can "fill" when revealed ---- */
function prime(card){
  card.querySelectorAll('canvas').forEach(cv => BP.charts.hold(cv));
  card.querySelectorAll('.bar>i, .stack>i').forEach(i => { if (i.dataset.w == null){ i.dataset.w = i.style.width; i.style.transition = 'none'; i.style.width = '0'; } });
  card.querySelectorAll('svg circle[stroke-dasharray]').forEach(c => { if (c.dataset.o == null){ c.dataset.o = c.getAttribute('stroke-dashoffset') || '0'; c.style.transition = 'none'; c.setAttribute('stroke-dashoffset', c.getAttribute('stroke-dasharray')); } });
  card.querySelectorAll('.spark path:last-of-type').forEach(p => { try { const L = Math.ceil(p.getTotalLength()) + 2; p.style.setProperty('--len', L); p.style.strokeDasharray = L; } catch (e) {} });
  let j = 0; card.querySelectorAll('.li, .cat-row, .insight, .leak, .plan-row, tbody tr, .heat .d, .ef-bar i.on, .chips .chip, .theme-grid .swatch').forEach(x => x.style.setProperty('--j', Math.min(j++ % 40, 40)));
}
function play(card){
  const d = parseFloat(card.style.getPropertyValue('--d')) || 0;
  card.classList.add('in');
  setTimeout(() => {
    void card.offsetWidth;
    card.querySelectorAll('.bar>i, .stack>i').forEach(i => { if (i.dataset.w != null){ i.style.transition = ''; i.style.width = i.dataset.w; delete i.dataset.w; } });
    card.querySelectorAll('svg circle[stroke-dasharray]').forEach(c => { if (c.dataset.o != null){ c.style.transition = ''; c.setAttribute('stroke-dashoffset', c.dataset.o); delete c.dataset.o; } });
    countUp(card);
    card.querySelectorAll('canvas[data-held]').forEach(cv => BP.charts.rebuild(cv));
  }, d + 60);
}
function revealAll(root){ root.querySelectorAll('.reveal:not(.in)').forEach(play); }

const M = BP.motion = {
  quiet: false,
  setQuiet(q){ M.quiet = q; if (window.Chart) Chart.defaults.animation.duration = q ? 420 : 1100; },
  init(){ chartDefaults(); },
  /* called by app.renderView after a view is rendered */
  after(root, keep){
    if (reduce()) return;
    const view = root.querySelector('.view'); if (!view) return;
    if (keep){ view.classList.add('quiet'); setTimeout(() => M.setQuiet(false), 60); return; }
    if (io) io.disconnect();
    const blocks = [...view.querySelectorAll('.card, .hero, .welcome, .month-strip, .tabs-sub, .status-pill')].filter(b => !b.parentElement.closest('.card, .hero'));
    const vh = window.innerHeight; let k = 0;
    blocks.forEach(b => { b.classList.add('reveal'); prime(b); const r = b.getBoundingClientRect(); b.style.setProperty('--d', (r.top < vh ? Math.min(k++ * 55, 600) : 0) + 'ms'); });
    io = 'IntersectionObserver' in window ? new IntersectionObserver(ents => ents.forEach(e => { if (e.isIntersecting){ io.unobserve(e.target); play(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: .08 }) : null;
    if (io) blocks.forEach(b => io.observe(b)); else revealAll(view);
    setTimeout(() => revealAll(view), 4000); // safety net
  }
};

/* ---- pointer glow on KPI cards + button ripple ---- */
document.addEventListener('pointermove', e => { const k = e.target.closest && e.target.closest('.kpi'); if (!k) return; const r = k.getBoundingClientRect(); k.style.setProperty('--mx', (e.clientX - r.left) + 'px'); k.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { passive: true });
document.addEventListener('pointerdown', e => {
  if (reduce()) return; const b = e.target.closest && e.target.closest('.btn'); if (!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = document.createElement('span'); sp.className = 'ripple';
  Object.assign(sp.style, { width: s + 'px', height: s + 'px', left: (e.clientX - r.left - s / 2) + 'px', top: (e.clientY - r.top - s / 2) + 'px' });
  if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; b.style.overflow = 'hidden'; b.appendChild(sp); setTimeout(() => sp.remove(), 650);
}, { passive: true });

if (window.Chart) chartDefaults(); else window.addEventListener('load', chartDefaults);
})();
