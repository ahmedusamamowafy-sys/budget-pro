/* Budget Pro — theme engine (10 presets + custom colours + optional photo background, day/night) */
(function(){
'use strict';
const BP = window.BP;
const KEY = 'bpro.theme.v1';
// each theme: night/day -> [bg, card, accent, border]
const T = {
  'neon-lime': { name:'Neon Lime', e:'🟢', night:['#070B14','#121B2E','#C8F135','#1F2B45'], day:['#F3F6FB','#FFFFFF','#4D7C0F','#DDE5F0'] },
  ocean:       { name:'Ocean Depth', e:'🌊', night:['#04121F','#0B2236','#38BDF8','#143450'], day:['#EEF7FC','#FFFFFF','#0369A1','#D2E6F2'] },
  rose:        { name:'Rose Quartz', e:'🌸', night:['#14070D','#241119','#F472B6','#3A1D2B'], day:['#FDF2F7','#FFFFFF','#BE185D','#F2D6E3'] },
  twilight:    { name:'Twilight', e:'🔮', night:['#0C0720','#1A1136','#A78BFA','#2B1F55'], day:['#F5F2FD','#FFFFFF','#6D28D9','#E1D9F5'] },
  emerald:     { name:'Emerald', e:'💚', night:['#04130E','#0C241B','#34D399','#16382B'], day:['#EEF9F4','#FFFFFF','#047857','#D0EADF'] },
  golden:      { name:'Golden Hour', e:'✨', night:['#130E04','#241B0B','#FBBF24','#3A2D12'], day:['#FDF8EC','#FFFFFF','#B45309','#F0E2BE'] },
  arctic:      { name:'Arctic Blue', e:'❄️', night:['#081321','#101F36','#7DD3FC','#1C3052'], day:['#F0F6FC','#FFFFFF','#1D4ED8','#D7E3F4'] },
  crimson:     { name:'Crimson', e:'🔴', night:['#140609','#251014','#FB7185','#3A181E'], day:['#FEF2F2','#FFFFFF','#BE123C','#F3D3D6'] },
  copper:      { name:'Copper Bronze', e:'🟤', night:['#120A06','#22160F','#FB923C','#382417'], day:['#FBF4EE','#FFFFFF','#C2410C','#EBD8C8'] },
  slate:       { name:'Slate', e:'🪨', night:['#0B0E13','#161B23','#94A3B8','#242C38'], day:['#F1F3F6','#FFFFFF','#334155','#DCE1E8'] },
  custom:      { name:'Custom', e:'🎨', night:['#070B14','#121B2E','#C8F135','#1F2B45'], day:['#F3F6FB','#FFFFFF','#4D7C0F','#DDE5F0'] }
};
const hex2 = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const rgba = (h, a) => { const [r, g, b] = hex2(h); return `rgba(${r},${g},${b},${a})`; };
const lum = h => { const [r, g, b] = hex2(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const shade = (h, amt) => '#' + hex2(h).map(v => BP.clamp(Math.round(v + amt), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex2(a), B = hex2(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

function vars(bg, card, accent, border, mode){
  const night = mode === 'night';
  const text = night ? '#EAF0FF' : '#101828', muted = night ? '#8696B8' : '#5B6B86', faint = night ? '#4B5A7A' : '#98A4BA';
  return {
    '--bg': bg, '--bg2': night ? shade(bg, 4) : shade(bg, -3), '--surface': night ? mix(bg, card, .5) : mix(bg, card, .35), '--card': card,
    '--card2': night ? shade(card, 10) : shade(card, -4), '--border': border, '--border2': night ? shade(border, 14) : shade(border, -12),
    '--text': text, '--muted': muted, '--faint': faint, '--accent': accent, '--accent-ink': lum(accent) > .42 ? '#0B1200' : '#FFFFFF',
    '--accent-soft': rgba(accent, night ? .13 : .11), '--accent-glow': rgba(accent, night ? .3 : .25),
    '--grid': night ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.08)', '--tip-bg': night ? shade(card, 6) : '#FFFFFF',
    '--glass': rgba(card, night ? .72 : .78),
    '--green': night ? '#34D399' : '#059669', '--red': night ? '#FB7185' : '#E11D48', '--amber': night ? '#FBBF24' : '#D97706',
    '--blue': night ? '#60A5FA' : '#2563EB', '--purple': night ? '#A78BFA' : '#7C3AED', '--cyan': night ? '#22D3EE' : '#0891B2', '--pink': night ? '#F472B6' : '#DB2777',
    '--shadow': night ? '0 10px 30px rgba(0,0,0,.35)' : '0 10px 30px rgba(30,41,59,.10)', '--shadow-sm': night ? '0 2px 10px rgba(0,0,0,.25)' : '0 2px 8px rgba(30,41,59,.07)',
    '--body-image': `radial-gradient(900px 480px at 8% -6%, ${rgba(accent, night ? .10 : .09)}, transparent 62%), radial-gradient(800px 460px at 100% 12%, ${night ? 'rgba(96,165,250,.08)' : 'rgba(96,165,250,.10)'}, transparent 60%)`
  };
}

BP.themes = {
  list: T, hex2, rgba, mix, shade,
  state: { id: 'neon-lime', mode: 'night', custom: { night: null, day: null }, photo: '' },
  load(){ try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.id) this.state = Object.assign(this.state, s); } catch (e) {} this.apply(); },
  save(){ try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { BP.toast('Photo too large to store — choose a smaller image', 'err'); } },
  colors(id, mode){ const s = this.state; const base = T[id] || T['neon-lime']; if (id === 'custom' && s.custom[mode]) return s.custom[mode]; return base[mode]; },
  apply(preview){
    const s = preview || this.state; const root = document.documentElement; const c = this.colors(s.id, s.mode);
    const v = vars(c[0], c[1], c[2], c[3], s.mode);
    if (s.photo && !preview) v['--body-image'] = `url(${s.photo})`;
    Object.entries(v).forEach(([k, val]) => root.style.setProperty(k, val));
    document.body.classList.toggle('has-photo', !!(s.photo && !preview));
    root.dataset.mode = s.mode; root.style.colorScheme = s.mode === 'night' ? 'dark' : 'light';
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = c[0];
    if (BP.charts && BP.charts.restyle) BP.charts.restyle();
  },
  toggleMode(){ this.state.mode = this.state.mode === 'night' ? 'day' : 'night'; this.save(); this.apply(); if (BP.app) BP.app.refresh(); },
  openModal(){
    const pend = { id: this.state.id, mode: this.state.mode, custom: BP.clone(this.state.custom), photo: this.state.photo };
    const draw = () => {
      const cur = this.colors(pend.id, pend.mode);
      const sw = Object.entries(T).map(([id, t]) => { const c = id === 'custom' && pend.custom[pend.mode] ? pend.custom[pend.mode] : t[pend.mode]; return BP.h`<div class="swatch ${pend.id === id ? 'on' : ''}" data-theme="${id}"><div class="bars"><i style="background:${c[0]}"></i><i style="background:${c[1]}"></i><i style="background:${c[2]}"></i></div><span>${t.e} ${t.name}</span></div>`; });
      return BP.h`<div class="seg" style="margin-bottom:14px"><button data-mode="night" class="${pend.mode === 'night' ? 'on' : ''}">🌙 Night</button><button data-mode="day" class="${pend.mode === 'day' ? 'on' : ''}">☀️ Day</button></div>
        <div class="theme-grid">${sw}</div>
        <div class="${pend.id === 'custom' ? '' : 'hidden'}" id="cust" style="margin-top:16px"><div class="lbl" style="margin-bottom:8px">Custom colours (${pend.mode})</div>
          <div class="form-grid" style="grid-template-columns:repeat(4,1fr)">
            ${['Background', 'Card', 'Accent', 'Border'].map((n, i) => BP.h`<div class="field"><label>${n}</label><input type="color" class="inp" style="padding:3px;height:42px" data-cc="${i}" value="${cur[i]}"></div>`)}
          </div></div>
        <div style="margin-top:16px" class="row wrap"><label class="btn sm">📷 Photo background<input type="file" accept="image/*" id="photoIn" hidden></label>
          ${pend.photo ? BP.h`<button class="btn sm danger" id="photoRm">Remove photo</button>` : ''}<span class="card-sub">Optional — stays on this device only.</span></div>`;
    };
    const m = BP.modal.open({ title: '🎨 Appearance', body: draw(), okText: 'Apply', wide: true,
      onOk: () => { Object.assign(this.state, { id: pend.id, mode: pend.mode, custom: pend.custom, photo: pend.photo }); this.save(); this.apply(); BP.app.refresh(); BP.toast('Theme applied', 'ok'); },
      onOpen: api => {
        const body = api.root.querySelector('.modal-b');
        const rerender = () => { body.innerHTML = draw().s; this.apply(pend); };
        body.addEventListener('click', e => {
          const sw = e.target.closest('[data-theme]'); if (sw){ pend.id = sw.dataset.theme; rerender(); }
          const md = e.target.closest('[data-mode]'); if (md){ pend.mode = md.dataset.mode; rerender(); }
          if (e.target.id === 'photoRm'){ pend.photo = ''; rerender(); }
        });
        body.addEventListener('input', e => { const i = e.target.dataset.cc; if (i == null) return; const cur = (pend.custom[pend.mode] || T.custom[pend.mode]).slice(); cur[+i] = e.target.value; pend.custom[pend.mode] = cur; this.apply(pend); });
        body.addEventListener('change', async e => {
          if (e.target.id !== 'photoIn' || !e.target.files[0]) return;
          const url = await BP.readFile(e.target.files[0], 'dataurl'); const img = new Image(); img.onload = () => {
            const k = Math.min(1, 1400 / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = img.width * k; cv.height = img.height * k;
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); pend.photo = cv.toDataURL('image/jpeg', .72); rerender();
          }; img.src = url;
        });
      } });
    m.el.addEventListener('mousedown', () => {}); // keep preview until closed
    const orig = m.close; m.close = () => { orig(); this.apply(); };
  }
};
})();
