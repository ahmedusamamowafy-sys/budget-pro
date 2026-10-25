/* Budget Pro — Import / Export: paste, Excel import, CSV/XLSX export, JSON backup, clear month */
(function(){
'use strict';
const BP = window.BP, C = () => BP.calc;
const st = { rows: null, src: '' };
const XLSX_SRC = 'js/vendor/xlsx.mini.min.js';

function excelDate(v){
  if (v == null || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000){ const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  if (v instanceof Date) return BP.toISO(v);
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))){ const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  const d = new Date(s); return isNaN(d) ? null : BP.toISO(d);
}
function mapRows(grid){
  grid = grid.filter(r => r && r.some(x => String(x ?? '').trim() !== '')); if (!grid.length) return [];
  const head = grid[0].map(x => String(x ?? '').toLowerCase().trim());
  const find = keys => head.findIndex(h => keys.some(k => h.includes(k)));
  let ix = { date: find(['date', 'تاريخ']), sub: find(['sub', 'item', 'category', 'cat']), amount: find(['amount', 'value', 'sar', 'cost', 'price']), pay: find(['pay', 'method', 'card', 'account']), desc: find(['desc', 'note', 'comment', 'detail']) };
  let body = grid.slice(1);
  if (ix.date < 0 || ix.amount < 0 || ix.sub < 0){ ix = { date: 0, sub: 1, amount: 2, pay: 3, desc: 4 }; body = grid; }
  return body.map(r => {
    const amt = parseFloat(String(r[ix.amount] ?? '').replace(/[^\d.-]/g, '')), date = excelDate(r[ix.date]); const sub = String(r[ix.sub] ?? '').trim();
    const cat = C().cat(sub) || C().cats().find(c => c.sub.toLowerCase() === sub.toLowerCase());
    return { date, sub: cat ? cat.sub : sub, amount: amt, pay: ix.pay >= 0 ? String(r[ix.pay] ?? '').trim() || BP.db().payMethods[0] : BP.db().payMethods[0], desc: ix.desc >= 0 ? String(r[ix.desc] ?? '').trim() : '', ok: !!(date && amt > 0 && sub), known: !!cat };
  });
}
function toGrid(list){ return [['Date', 'Main', 'Sub', 'Type', 'Amount', 'Pay', 'Description', 'Added by'], ...list.map(e => [e.date, e.main, e.sub, e.type, e.amount, e.pay, e.desc || '', e.addedBy || ''])]; }

BP.views.import = {
  render(el){
    const m = BP.ui.month, d = BP.db(), can = BP.auth.canEdit('import'), n = C().expOf(m).length;
    const r = st.rows, good = r ? r.filter(x => x.ok) : [];
    BP.mount(el, BP.h`${BP.ui.monthStrip(C().months(), m)}
    <div class="grid g2" style="margin-top:8px">
      <div class="card"><div class="card-h"><div class="card-t big">📥 Import expenses</div></div>
        ${can ? BP.h`<div class="dropzone" id="imDrop" style="padding:22px;text-align:center"><div style="font-size:30px">📊</div><b>Drop an Excel / CSV file here</b><div class="card-sub" style="margin:6px 0 12px">.xlsx · .xls · .csv — columns Date, Sub-category, Amount, Pay, Description</div><label class="btn sm primary">Choose file<input type="file" id="imFile" accept=".xlsx,.xls,.csv,.tsv,.txt" hidden></label></div>
        <div class="sp"></div><div class="field"><label>…or paste rows copied from Excel</label><textarea class="inp" id="imPaste" rows="5" placeholder="2026-06-03\tGroceries\t245\tCB\tPanda" style="font-family:var(--mono);font-size:12px"></textarea></div>
        <button class="btn" data-act="parsePaste" style="margin-top:10px">🔍 Preview pasted rows</button>` : BP.h`<div class="tipbox">View-only access.</div>`}</div>
      <div class="card"><div class="card-h"><div class="card-t big">📤 Export</div></div>
        <div class="list">
          <div class="li"><div class="li-ic">📋</div><div class="li-main"><div class="li-t">Copy ${BP.fmtMonth(m)} for Excel</div><div class="li-s">${n} rows · tab-separated, paste straight into a sheet</div></div><button class="btn sm" data-act="copyTSV">Copy</button></div>
          <div class="li"><div class="li-ic">🧾</div><div class="li-main"><div class="li-t">Download CSV</div><div class="li-s">this month or everything</div></div><div class="row"><button class="btn sm" data-act="csv" data-all="0">Month</button><button class="btn sm" data-act="csv" data-all="1">All</button></div></div>
          <div class="li"><div class="li-ic">📗</div><div class="li-main"><div class="li-t">Download Excel workbook</div><div class="li-s">expenses, plans, categories, wallet</div></div><button class="btn sm primary" data-act="xlsx">.xlsx</button></div>
          <div class="li"><div class="li-ic">💾</div><div class="li-main"><div class="li-t">Full backup (JSON)</div><div class="li-s">everything, restorable on any device</div></div><button class="btn sm" data-act="backup">Backup</button></div>
          ${can ? BP.h`<div class="li"><div class="li-ic">♻️</div><div class="li-main"><div class="li-t">Restore backup</div><div class="li-s">replaces all data in this app</div></div><label class="btn sm">Restore<input type="file" id="imRestore" accept=".json" hidden></label></div>
          <div class="li"><div class="li-ic">🧹</div><div class="li-main"><div class="li-t">Clear ${BP.fmtMonth(m)}</div><div class="li-s">delete this month's ${n} expenses</div></div><button class="btn sm danger" data-act="clear" ${n ? '' : 'disabled'}>Clear</button></div>` : ''}
        </div></div>
      ${r ? BP.h`<div class="card span2"><div class="card-h"><div class="card-t big">Preview · ${st.src}</div><div class="row"><span class="tag sp">${good.length} ready</span>${r.length - good.length ? BP.h`<span class="tag must">${r.length - good.length} skipped</span>` : ''}<button class="btn sm" data-act="cancel">Cancel</button><button class="btn sm primary" data-act="commit" ${good.length ? '' : 'disabled'}>Import ${good.length} rows</button></div></div>
        <div class="tbl-wrap" style="max-height:420px"><table class="tbl"><thead><tr><th></th><th>Date</th><th>Sub-category</th><th class="r">Amount</th><th>Pay</th><th>Description</th></tr></thead><tbody>
        ${r.slice(0, 300).map(x => BP.h`<tr style="${x.ok ? '' : 'opacity:.45'}"><td>${x.ok ? (x.known ? '✅' : '🆕') : '⛔'}</td><td>${x.date || '—'}</td><td>${x.sub || '—'}</td><td class="r num">${isNaN(x.amount) ? '—' : BP.fmt(x.amount)}</td><td>${x.pay}</td><td class="muted">${x.desc}</td></tr>`)}</tbody></table></div>
        <div class="card-sub" style="margin-top:8px">✅ known category · 🆕 not in your categories (imported as “Other”) · ⛔ missing date, amount or category</div></div>` : ''}
    </div>`);
    const dz = BP.$('#imDrop', el);
    if (dz){ dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); }); dz.addEventListener('dragleave', () => dz.classList.remove('over')); dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readSheet(f); }); }
  },
  onChange(e){
    if (e.target.id === 'imFile' && e.target.files[0]) readSheet(e.target.files[0]);
    if (e.target.id === 'imRestore' && e.target.files[0]) restore(e.target.files[0]);
  },
  actions: {
    parsePaste(){ const t = BP.$('#imPaste').value; if (!t.trim()) return BP.toast('Paste some rows first', 'err'); st.rows = mapRows(t.split(/\r?\n/).map(l => l.split(l.includes('\t') ? '\t' : ','))); st.src = 'pasted rows'; BP.app.renderView(true); },
    cancel(){ st.rows = null; BP.app.renderView(true); },
    commit(){ const good = st.rows.filter(x => x.ok); const n = BP.actions.importRows(good); st.rows = null; if (good[0]) BP.ui.month = good[0].date.slice(0, 7); BP.toast(`Imported ${n} expenses`, 'ok'); BP.app.refresh(); },
    async copyTSV(){ const g = toGrid(C().expOf(BP.ui.month)); await BP.copyText(g.map(r => r.join('\t')).join('\n')); BP.toast('Copied — paste into Excel', 'ok'); },
    csv(el){ const all = el.dataset.all === '1', list = all ? BP.db().expenses : C().expOf(BP.ui.month); const q = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
      BP.download(`budget-pro-${all ? 'all' : BP.ui.month}.csv`, '﻿' + toGrid(list).map(r => r.map(q).join(',')).join('\n'), 'text/csv'); },
    async xlsx(){
      try { await BP.loadScript(XLSX_SRC); } catch (e) { return BP.toast('Excel library failed to load', 'err'); }
      const d = BP.db(), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(toGrid(d.expenses)), 'Expenses');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Main', 'Category', 'Sub', 'Type', 'Necessity', 'Pay type', 'Default budget'], ...d.categories.map(c => [c.main, c.category, c.sub, c.type, c.necessity, c.payType, d.defaultBudgets[c.sub] || 0])]), 'Categories');
      const pm = Object.keys(d.plans).sort(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Sub', ...pm], ['_Salary', ...pm.map(m => d.plans[m]._salary)], ['_Investments', ...pm.map(m => d.plans[m]._investments)], ...d.categories.map(c => [c.sub, ...pm.map(m => (d.plans[m].budgets || {})[c.sub] || 0)])]), 'Plans');
      const wm = Object.keys(d.wallet).sort(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Month', 'Source', 'Amount', 'Method', 'Allocated'], ...wm.flatMap(m => Object.entries(d.wallet[m].alloc).map(([k, v]) => [m, d.wallet[m].source ? d.wallet[m].source.name : '', d.wallet[m].source ? d.wallet[m].source.amount : '', k, v]))]), 'Wallet');
      XLSX.writeFile(wb, `budget-pro-${BP.today()}.xlsx`); BP.toast('Workbook downloaded', 'ok');
    },
    backup(){ BP.download(`budget-pro-backup-${BP.today()}.json`, BP.store.exportJSON(), 'application/json'); BP.toast('Backup downloaded', 'ok'); },
    clear(){ const m = BP.ui.month; BP.modal.confirm(`Delete all ${C().expOf(m).length} expenses in ${BP.fmtMonth(m)}? This cannot be undone (download a backup first if unsure).`, () => { const n = BP.actions.clearMonth(m); BP.toast(`${n} expenses removed`, 'ok'); BP.app.refresh(); }, { okText: 'Delete' }); }
  }
};

async function readSheet(f){
  try {
    let grid;
    if (/\.(xlsx|xls)$/i.test(f.name)){ await BP.loadScript(XLSX_SRC); const wb = XLSX.read(await BP.readFile(f, 'buffer'), { type: 'array', cellDates: true });
      const name = wb.SheetNames.find(n => /expense|log|data/i.test(n)) || wb.SheetNames[0]; grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true }); st.src = `${f.name} → ${name}`; }
    else { const t = await BP.readFile(f, 'text'); grid = t.split(/\r?\n/).map(l => l.split(l.includes('\t') ? '\t' : ',').map(x => x.replace(/^"|"$/g, ''))); st.src = f.name; }
    st.rows = mapRows(grid); if (!st.rows.length) BP.toast('No rows found', 'err'); BP.app.renderView(true);
  } catch (e) { console.error(e); BP.toast('Could not read that file', 'err'); }
}
async function restore(f){
  try { const j = JSON.parse(await BP.readFile(f, 'text')); if (!j || !j.categories || !j.expenses) throw new Error('bad');
    BP.modal.confirm(`Restore backup “${f.name}” with ${j.expenses.length} expenses? Current data in this app will be replaced.`, () => { BP.store.replace(j); BP.toast('Backup restored', 'ok'); BP.app.refresh(); }, { okText: 'Restore' });
  } catch (e) { BP.toast('That is not a Budget Pro backup', 'err'); }
}
})();
