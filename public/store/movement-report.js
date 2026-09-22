/* Shared movement calculations and presentation for both embedded Store modules. */
(function (root) {
  'use strict';
  const day = value => String(value || '').slice(0, 10);
  const utc = value => Date.parse(day(value) + 'T00:00:00Z');
  const iso = value => new Date(value).toISOString().slice(0, 10);
  const addDays = (value, n) => iso(utc(value) + n * 86400000);
  const fmt = value => day(value).split('-').reverse().join('/');
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const round = n => Math.round((n + Number.EPSILON) * 1e6) / 1e6;
  const number = n => Number(n || 0);
  const display = n => number(n).toLocaleString('en-GB', { maximumFractionDigits: 6 });
  function periods(from, to, mode) {
    if (!Number.isFinite(utc(from)) || !Number.isFinite(utc(to)) || from > to) throw Error('Choose a valid From date on or before To date.');
    const result = [];
    for (let start = from; start <= to;) {
      let end = start;
      if (mode === 'weekly') end = addDays(start, 6);
      else if (mode === 'monthly') {
        const date = new Date(utc(start));
        end = iso(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
      }
      if (end > to) end = to;
      const label = mode === 'weekly' ? 'Week ' + (result.length + 1)
        : mode === 'monthly' ? new Date(utc(start)).toLocaleDateString('en-GB', {month:'short',year:'numeric',timeZone:'UTC'})
        : fmt(start);
      result.push({ start, end, label });
      if (result.length > 366) throw Error('This range has too many columns. Choose weekly/monthly or a shorter date range.');
      start = addDays(end, 1);
    }
    return result;
  }
  function build(parts, transactions, from, to, mode, category = '', search = '') {
    const groups = periods(from, to, mode);
    const byPart = new Map();
    for (const t of transactions) {
      if (t.type !== 'in' && t.type !== 'out') continue;
      const key = String(t.partId);
      if (!byPart.has(key)) byPart.set(key, []);
      byPart.get(key).push(t);
    }
    const query = search.trim().toLowerCase();
    const rows = parts.filter(p => (!category || p.category === category) &&
      (!query || [p.name,p.sku,p.category,p.brand,p.supplier].join(' ').toLowerCase().includes(query)))
      .map(p => {
        const txns = byPart.get(String(p.id)) || [];
        // Undo every retained movement from the start date onwards, including
        // those after the report end, to reconstruct the opening quantity.
        const opening = round(number(p.qty) - txns.reduce((sum,t) =>
          day(t.date) >= from ? sum + (t.type === 'in' ? number(t.qty) : -number(t.qty)) : sum, 0));
        let balance = opening, totalOut = 0;
        const values = groups.map(g => {
          let incoming = 0, outgoing = 0;
          for (const t of txns) if (day(t.date) >= g.start && day(t.date) <= g.end) {
            if (t.type === 'in') incoming += number(t.qty); else outgoing += number(t.qty);
          }
          incoming = round(incoming); outgoing = round(outgoing);
          balance = round(balance + incoming - outgoing); totalOut += outgoing;
          return { incoming, outgoing, balance };
        });
        return { id:p.id, name:(p.sku ? '[' + p.sku + '] ' : '') + p.name,
          unit:p.unit || '', opening, values, totalOut:round(totalOut), stockNow:number(p.qty) };
      }).sort((a,b) => a.name.localeCompare(b.name));
    return { from,to,mode,groups,rows,category };
  }
  const api = { build, periods, category:'', current:null, selected:new Set() };
  const el = id => document.getElementById(id);
  api.setCategory = value => { api.category = value; api.selected.clear(); renderIssuance(); };
  api.categories = function () {
    const host = el('movement-categories');
    if (!host) return;
    const categories = [...new Set(state.parts.map(p => p.category).filter(Boolean))].sort();
    if (api.category && !categories.includes(api.category)) api.category = '';
    host.replaceChildren();
    for (const value of ['', ...categories]) {
      const button = document.createElement('button');
      button.className = 'btn btn-sm' + (value === api.category ? ' btn-primary' : '');
      button.textContent = value || 'All categories';
      button.onclick = () => api.setCategory(value);
      host.appendChild(button);
    }
  };
  api.change = function () {
    api.selected.clear();
    if (el('movement-view').value !== 'history' && !el('iss-date-from').value && !el('iss-date-to').value) {
      const now = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Karachi'});
      el('iss-date-from').value = now.slice(0, 7) + '-01';
      el('iss-date-to').value = now;
    }
    renderIssuance();
  };
  function tableHead(model, start = 0, end = model.groups.length, checks = false) {
    const leading = checks ? '<th rowspan="2"><input type="checkbox" aria-label="Select all report parts" onchange="StoreMovement.selectAll(this.checked)"></th>' : '';
    return '<thead><tr>' + leading + '<th rowspan="2">Part name</th><th rowspan="2">Unit</th><th rowspan="2">Opening bal</th>' +
      model.groups.slice(start,end).map(g => '<th colspan="3">' + esc(g.label) + '<small>' + fmt(g.start) + ' – ' + fmt(g.end) + '</small></th>').join('') +
      '<th rowspan="2">Total out</th><th rowspan="2">Stock now</th></tr><tr>' +
      model.groups.slice(start,end).map(() => '<th>In</th><th>Out</th><th>Balance</th>').join('') + '</tr></thead>';
  }
  function tableRows(model, start = 0, end = model.groups.length, checks = false) {
    return '<tbody>' + model.rows.map(r => '<tr>' +
      (checks ? '<td><input type="checkbox" aria-label="Select part" data-movement-id="' + esc(r.id) + '"' + (api.selected.has(String(r.id)) ? ' checked' : '') + '></td>' : '') +
      '<td class="part-name">' + esc(r.name) + '</td><td>' + esc(r.unit) + '</td><td>' + display(start ? r.values[start-1].balance : r.opening) + '</td>' +
      r.values.slice(start,end).map(v => '<td class="incoming">' + display(v.incoming) + '</td><td class="outgoing">' + display(v.outgoing) + '</td><td>' + display(v.balance) + '</td>').join('') +
      '<td class="outgoing">' + display(r.totalOut) + '</td><td><b>' + display(r.stockNow) + '</b></td></tr>').join('') + '</tbody>';
  }
  const css = '.movement-table{border-collapse:collapse;width:100%;background:#fff;font:11px Arial,sans-serif}.movement-table th,.movement-table td{border:1px solid #bbb;padding:3px 5px;white-space:nowrap;text-align:right}.movement-table td{background:#fff}.movement-table th{background:#f3eee4;color:#111;text-align:center}.movement-table td.part-name{text-align:right;white-space:normal;overflow-wrap:anywhere;min-width:160px;max-width:260px}.movement-table small{display:block;font-size:9px;font-weight:normal}.movement-table .incoming{color:#15803d}.movement-table .outgoing{color:#a32d2d}.movement-table tbody tr{transform:none!important;box-shadow:none!important;break-inside:avoid}.movement-table thead{display:table-header-group}';
  api.selectAll = checked => {
    for (const r of api.current?.rows || []) checked ? api.selected.add(String(r.id)) : api.selected.delete(String(r.id));
    el('movement-output').querySelectorAll('[data-movement-id]').forEach(c => c.checked = checked);
  };
  api.render = function () {
    api.categories();
    const mode = el('movement-view')?.value || 'history';
    const history = el('issuance-table')?.closest('.card');
    const output = el('movement-output');
    if (!output) return false;
    if (history) history.style.display = mode === 'history' ? '' : 'none';
    el('iss-bulk-info').style.display = mode === 'history' ? '' : 'none';
    if (mode === 'history') { output.style.display = 'none'; return false; }
    el('iss-bulk-purge').style.display = 'none';
    output.style.display = '';
    try {
      const now = new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Karachi'});
      const from = el('iss-date-from').value || now.slice(0,7) + '-01';
      const to = el('iss-date-to').value || now;
      el('iss-date-from').value = from; el('iss-date-to').value = to;
      api.current = build(state.parts,state.transactions,from,to,mode,api.category,el('iss-search').value);
      const visible = new Set(api.current.rows.map(r => String(r.id)));
      api.selected.forEach(id => { if (!visible.has(id)) api.selected.delete(id); });
      output.innerHTML = '<style>' + css + '</style><p style="font-size:12px;margin:8px 0">Balances are reconstructed from current stock and retained history. Stock now is current inventory. Deleted history or unlogged adjustments can affect historical balances.</p>' +
        (api.current.rows.length ? '<div style="overflow:auto;max-height:65vh;touch-action:pan-x pan-y"><table class="movement-table">' + tableHead(api.current,0,api.current.groups.length,true) + tableRows(api.current,0,api.current.groups.length,true) + '</table></div>' : '<p>No parts match these filters.</p>');
      output.querySelectorAll('[data-movement-id]').forEach(c => c.onchange = () => c.checked ? api.selected.add(c.dataset.movementId) : api.selected.delete(c.dataset.movementId));
    } catch (error) { api.current = null; output.textContent = error.message; }
    return true;
  };
  api.output = function (kind) {
    if ((el('movement-view')?.value || 'history') === 'history') return false;
    api.render();
    if (!api.current) return true;
    const model = {...api.current, rows:api.current.rows.filter(r => !api.selected.size || api.selected.has(String(r.id)))};
    if (!model.rows.length) { warnDialog('Nothing to export','No parts match these filters.'); return true; }
    const moduleName = state.module === 'consumables' ? 'INKS & CONSUMABLES' : 'MACHINERY & ELECTRICAL';
    const title = moduleName + ' — ISSUANCE MOVEMENT REPORT';
    const code = state.module === 'consumables' ? 'STR/QR/008/B' : 'STR/QR/008/A';
    if (kind === 'excel') {
      const headers = ['Part name','Unit','Opening bal',...model.groups.flatMap(() => ['In','Out','Balance']),'Total out','Stock now'];
      const groups = model.groups.map((g,i) => ({label:g.label + ' (' + fmt(g.start) + '–' + fmt(g.end) + ')',start:3+i*3,span:3}));
      window.parent.postMessage({type:'store-excel-export',section:'issuance',title,from:model.from,to:model.to,
        filename:state.module+'-issuance-'+model.mode+'-'+model.from+'-to-'+model.to,
        headers,headerGroups:groups,colWidths:[34,9,14,...model.groups.flatMap(() => [12,12,14]),14,14],
        rows:model.rows.map(r => [r.name,r.unit,r.opening,...r.values.flatMap(v => [v.incoming,v.outgoing,v.balance]),r.totalOut,r.stockNow])},location.origin);
      return true;
    }
    const win = window.open('','_blank','width=1100,height=750');
    if (!win) { warnDialog('Pop-up blocked','Allow pop-ups to print this report.'); return true; }
    let pages = '';
    for (let start=0;start<model.groups.length;start+=4) {
      const end = Math.min(start+4,model.groups.length);
      pages += '<section><header><div class="logo"><img src="/logo-urdu.png">SUPREME ART PRIVATE LIMITED</div><div class="heading"><h1>' + esc(title) + '</h1><p>' + code + ' · Date: ' + fmt(model.from) + ' to ' + fmt(model.to) + ' · Category: ' + esc(model.category || 'All') + '</p></div></header>' +
        '<p class="note">Periods ' + (start+1) + '–' + end + ' of ' + model.groups.length + '. Opening balance is at the first displayed period. Total out covers the full selected range; stock now is current inventory.</p>' +
        '<table class="movement-table">' + tableHead(model,start,end) + tableRows(model,start,end) + '</table></section>';
    }
    win.document.write('<!doctype html><html><head><title>' + esc(title) + '</title><style>' + css +
      '@page{size:A4 landscape;margin:5mm}body{margin:0;color:#111}header{display:flex;align-items:center;background:#f3eee4;border:1px solid #222;padding:2px 4px;gap:8px;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}.logo{width:150px;text-align:center;color:#a32d2d;font:bold 9px Arial}.logo img{display:block;width:80px;height:39px;object-fit:contain;margin:auto}.heading{flex:1;text-align:center}.heading h1{font:bold 14px Georgia;color:#111;margin:2px}.heading p,.note{font:8px Arial;margin:3px}section{margin-bottom:8px;break-after:auto}.movement-table{font-size:9px;line-height:1.15}.movement-table th,.movement-table td{padding:2px 3px;white-space:normal}.movement-table th{background:#f3eee4!important;color:#111!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}.movement-table td.part-name{width:18%;min-width:0;max-width:180px;text-align:right;overflow-wrap:anywhere}.movement-table small{font-size:8px}</style></head><body>' + pages + '</body></html>');
    win.document.close();
    const image = win.document.querySelector('img');
    (image?.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => win.print());
    return true;
  };
  root.StoreMovement = api;
  if (typeof module !== 'undefined') module.exports = { build, periods };
})(typeof window !== 'undefined' ? window : globalThis);
