/* Budget Pro — chart helpers (Chart.js 4 + lightweight SVG widgets) */
(function(){
'use strict';
const BP = window.BP;
const reg = new Map(); // canvas -> build fn

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const centerText = {
  id: 'centerText',
  afterDraw(chart, _a, o){
    if (!o || !o.text) return;
    const { ctx, chartArea: a } = chart; if (!a) return;
    const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = css('--text'); ctx.font = `700 ${o.size || 22}px ${css('--mono')}`; ctx.fillText(o.text, x, y - (o.sub ? 8 : 0));
    if (o.sub){ ctx.fillStyle = css('--muted'); ctx.font = `500 11px ${css('--font')}`; ctx.fillText(o.sub, x, y + 15); }
    ctx.restore();
  }
};
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, _a, o){
    if (!o || !o.show) return; const { ctx } = chart; ctx.save(); ctx.font = `600 10px ${css('--mono')}`; ctx.textAlign = 'center';
    chart.data.datasets.forEach((ds, di) => {
      if (ds.noLabel) return; const meta = chart.getDatasetMeta(di); if (meta.hidden) return;
      meta.data.forEach((el, i) => { const v = ds.data[i]; if (!v) return; ctx.fillStyle = css('--muted');
        if (chart.options.indexAxis === 'y'){ ctx.textAlign = 'left'; ctx.fillText(BP.fmtK(v), el.x + 6, el.y + 3); } else { ctx.textAlign = 'center'; ctx.fillText(BP.fmtK(v), el.x, el.y - 5); } });
    }); ctx.restore();
  }
};
const nowLine = {
  id: 'nowLine',
  afterDraw(chart, _a, o){
    if (!o || o.index == null || o.index < 0) return; const x = chart.scales.x.getPixelForValue(o.index), { top, bottom } = chart.chartArea; const ctx = chart.ctx;
    ctx.save(); ctx.strokeStyle = css('--muted'); ctx.setLineDash([4, 4]); ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = css('--muted'); ctx.font = `600 9px ${css('--mono')}`; ctx.textAlign = 'center'; ctx.fillText('NOW', x, top - 5); ctx.restore();
  }
};

function setDefaults(){
  if (!window.Chart) return;
  const C = Chart;
  C.defaults.font.family = css('--font') || 'sans-serif'; C.defaults.font.size = 11;
  C.defaults.color = css('--muted'); C.defaults.borderColor = css('--grid');
  C.defaults.animation = { duration: 650, easing: 'easeOutCubic' };
  C.defaults.plugins.legend.labels.usePointStyle = true; C.defaults.plugins.legend.labels.boxWidth = 8; C.defaults.plugins.legend.labels.boxHeight = 8; C.defaults.plugins.legend.labels.padding = 14;
  const tt = C.defaults.plugins.tooltip; tt.backgroundColor = css('--tip-bg'); tt.titleColor = css('--text'); tt.bodyColor = css('--text'); tt.borderColor = css('--border2'); tt.borderWidth = 1;
  tt.padding = 11; tt.cornerRadius = 10; tt.boxPadding = 5; tt.usePointStyle = true; tt.titleFont = { weight: '700', family: css('--font') }; tt.bodyFont = { family: css('--mono'), size: 11.5 };
  C.defaults.maintainAspectRatio = false; C.defaults.responsive = true;
}

const hexA = (c, a) => { if (c.startsWith('#')){ const [r, g, b] = BP.themes.hex2(c); return `rgba(${r},${g},${b},${a})`; } return c.replace(/rgba?\(([^)]+)\)/, (_, x) => { const p = x.split(',').slice(0, 3); return `rgba(${p.join(',')},${a})`; }); };
const vert = (ctx, area, c1, c2) => { const g = ctx.createLinearGradient(0, area.top, 0, area.bottom); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; };

BP.charts = {
  css, hexA, vert,
  palette(){ return [css('--accent'), css('--blue'), css('--purple'), css('--green'), css('--amber'), css('--pink'), css('--cyan'), css('--red')]; },
  /* build: () => Chart config. Re-invoked automatically on theme change. */
  make(canvas, build){
    if (typeof canvas === 'string') canvas = document.getElementById(canvas);
    if (!canvas || !window.Chart) return null;
    const old = Chart.getChart(canvas); if (old) old.destroy();
    reg.set(canvas, build);
    canvas.classList.add('m-chart');
    const cfg = build(); cfg.plugins = [...(cfg.plugins || []), centerText, valueLabels, nowLine];
    return new Chart(canvas.getContext('2d'), cfg);
  },
  hold(cv){ const c = Chart.getChart(cv); if (c && reg.has(cv)){ c.destroy(); cv.dataset.held = '1'; } },
  rebuild(cv){ const build = reg.get(cv); if (!build) return; const old = Chart.getChart(cv); if (old) old.destroy(); delete cv.dataset.held; try { const cfg = build(); cfg.plugins = [...(cfg.plugins || []), centerText, valueLabels, nowLine]; new Chart(cv.getContext('2d'), cfg); } catch (e) { console.error(e); } },
  restyle(){
    setDefaults();
    for (const [cv, build] of reg){ if (!document.body.contains(cv)){ reg.delete(cv); continue; } try { const old = Chart.getChart(cv); if (old) old.destroy(); const cfg = build(); cfg.plugins = [...(cfg.plugins || []), centerText, valueLabels, nowLine]; new Chart(cv.getContext('2d'), cfg); } catch (e) {} }
  },
  gc(){ for (const [cv] of reg) if (!document.body.contains(cv)){ const c = Chart.getChart(cv); if (c) c.destroy(); reg.delete(cv); } },
  scales(opts){
    opts = opts || {};
    return {
      x: Object.assign({ grid: { display: false }, border: { display: false }, ticks: { maxRotation: opts.rot ?? 0, autoSkip: true } }, opts.x || {}),
      y: Object.assign({ beginAtZero: true, grid: { color: css('--grid') }, border: { display: false }, ticks: { callback: v => BP.fmtK(v), maxTicksLimit: 6 } }, opts.y || {})
    };
  },
  tipMoney: { callbacks: { label: c => ` ${c.dataset.label || c.label}: ${BP.fmt(c.parsed.y ?? c.parsed ?? c.raw)} SAR` } },

  /* ----- inline SVG widgets ----- */
  ring(pct, o){
    o = o || {}; const size = o.size || 120, sw = o.stroke || 12, r = (size - sw) / 2, c = 2 * Math.PI * r; const p = BP.clamp(pct, 0, 100); const col = o.color || css('--accent');
    return BP.raw(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${css('--surface')}" stroke-width="${sw}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" style="transition:stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1);filter:drop-shadow(0 0 6px ${hexA(col, .5)})"/></svg>`);
  },
  spark(values, o){
    o = o || {}; const w = 120, h = 34, col = o.color || css('--accent'); const v = values.length > 1 ? values : [0, ...(values.length ? values : [0])];
    const mx = Math.max(...v), mn = Math.min(...v), rg = mx - mn || 1; const pts = v.map((x, i) => [i / (v.length - 1) * w, h - 4 - (x - mn) / rg * (h - 10)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const id = 'sp' + Math.random().toString(36).slice(2, 7); const last = pts[pts.length - 1];
    return BP.raw(`<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" width="100%" height="34"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="${col}"/></svg>`);
  },
  /* Salary flow: single stacked bar with labelled segments + legend */
  flowBar(parts){
    const tot = BP.sum(parts, p => Math.max(0, p.v)) || 1;
    const seg = parts.filter(p => p.v > 0).map(p => `<i title="${BP.esc(p.l)}: ${BP.fmt(p.v)}" style="width:${p.v / tot * 100}%;background:${p.c}"></i>`).join('');
    const leg = parts.map(p => `<span><b style="background:${p.c}"></b>${BP.esc(p.l)} <span class="num m-sal" style="color:var(--text)">${BP.fmt(p.v)}</span> <span class="faint">${(Math.max(0, p.v) / tot * 100).toFixed(0)}%</span></span>`).join('');
    return BP.raw(`<div class="stack" style="height:22px">${seg}</div><div class="legend" style="margin-top:12px">${leg}</div>`);
  }
};
window.addEventListener('load', setDefaults);
})();
