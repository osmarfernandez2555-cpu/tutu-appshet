/* Panel App Ventas — interfaz */
(() => {
  const META = window.TABLE_META;
  const { APPS, FORMULAS, REFS, CHILDREN, NEW_ID } = window.PANEL;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAGE = 300;
  const ALL_VIEWS = APPS.flatMap((a) => a.views.map((v) => ({ ...v, app: a })));
  const TOOLS = { id: 'datos', title: 'DATOS Y RESPALDO', icon: 'database', type: 'datos', needLogin: true, app: { title: 'PANEL' } };
  const TABLES_VIEW = { id: 'tablas', title: 'TODAS LAS TABLAS', icon: 'table', type: 'tablas', app: { title: 'PANEL' } };
  const DEPS = { CARGA: ['FORMA DE PAGO'], PERITAJE: ['COMPRAS'] };
  const COLORS = {
    INGRESADO: 'green', PENDIENTE: 'amber', 'POR INGRESAR': 'blue', BAJA: 'gray', REVENTA: 'violet',
    ENTREGADO: 'green', CAIDO: 'red', PREVENTA: 'pink', 'SEÑADO': 'orange', 'EN PROCESO': 'amber', LIQUIDADO: 'blue',
    'POR PERITAR': 'amber', PERITADO: 'green', SEDAN: 'green', SUV: 'orange', HATCHBACK: 'pink', PICKUP: 'violet', UTILITARIO: 'red', OTROS: 'gray',
    Y: 'green', N: 'gray', SI: 'green', NO: 'gray', True: 'green', False: 'gray',
    'NO SOLICITADO': 'gray', SOLICITADO: 'amber', CARGADO: 'blue', INCOMPLETO: 'orange', 'NO CARGADO': 'gray', ABOGADO: 'red', APROBADO: 'green', RECHAZADO: 'red',
    PROPIO: 'blue', CONSIGNACION: 'violet', EXTERNO: 'orange', INVERSOR: 'pink', OK: 'green',
  };

  const S = { me: null, logged: false, protected: new Set(), pend: null, pendAction: null, counts: {}, cache: {}, loading: {}, view: null, search: '', sort: {}, month: 'ALL', collapsed: {}, limit: PAGE, cal: null, concMonth: 'ALL', rep: {} };
  const gated = (v) => (v && v.app && v.app.protegida) || (v && v.needLogin);

  const icons = () => window.lucide && window.lucide.createIcons();
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 3000); }
  async function api(url, opts = {}) {
    const blob = opts.body instanceof Blob || opts.body instanceof ArrayBuffer || opts.body instanceof Uint8Array;
    const r = await fetch(url, { credentials: 'same-origin', ...opts, headers: blob ? { 'Content-Type': 'application/octet-stream' } : { 'Content-Type': 'application/json' }, body: opts.body ? (blob ? opts.body : JSON.stringify(opts.body)) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && url !== '/api/login') { S.logged = false; if (gated(S.view)) showGate(S.view); throw new Error(j.error || 'La sesión de Ventas venció. Ingresá la contraseña de nuevo.'); }
    if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
    return j;
  }
  const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):?(\d{2})?)?/); if (!m) return String(d); const b = `${+m[3]}/${+m[2]}/${m[1]}`; return m[4] ? `${b} ${+m[4]}:${m[5]}:${m[6] || '00'}` : b; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const isNum = (c) => ['money', 'num', 'int', 'pct'].includes(c.t);
  const parseSpec = (s) => { const i = s.indexOf('='); return i < 0 ? { label: s, k: s } : { label: s.slice(0, i), k: s.slice(i + 1) }; };
  function rawView(t) { return META[t] ? { id: 't:' + encodeURIComponent(t), title: t, icon: 'table', table: t, add: true, export: true, app: { title: 'TABLA' } } : null; }
  const viewById = (id) => [...ALL_VIEWS, TOOLS, TABLES_VIEW].find((v) => v.id === id) || (id.startsWith('t:') ? rawView(decodeURIComponent(id.slice(2))) : null);

  function colOf(t, k) {
    const m = META[t]; const c = (m && m.cols.find((x) => x.k === k)) || { k, t: 'text' };
    const f = FORMULAS[t] && FORMULAS[t][k];
    return f ? { ...c, f } : c;
  }
  const IDX = {};
  const CTX = {
    sum(t, fk, v, col) {
      const key = t + '|' + fk + '|' + col;
      if (!IDX[key]) { const m = {}; for (const r of S.cache[t] || []) { const x = String(r[fk] ?? '').toUpperCase(); if (x) m[x] = (m[x] || 0) + (Number(r[col]) || 0); } IDX[key] = m; }
      return IDX[key][String(v ?? '').toUpperCase()] || 0;
    },
  };
  const resetIdx = () => { for (const k in IDX) delete IDX[k]; };
  const val = (t, r, k) => { const c = colOf(t, k); if (c.f) { try { return c.f(r, CTX); } catch (e) { return r[k]; } } return r[k]; };

  function chipIcon(v) {
    const map = { INGRESADO: 'thumbs-up', ENTREGADO: 'thumbs-up', PERITADO: 'thumbs-up', APROBADO: 'thumbs-up', OK: 'check', PENDIENTE: 'hourglass', 'POR PERITAR': 'hourglass', CAIDO: 'thumbs-down', RECHAZADO: 'thumbs-down', BAJA: 'circle-minus',
      PREVENTA: 'tags', 'SEÑADO': 'banknote', 'EN PROCESO': 'lightbulb', LIQUIDADO: 'check-check', SEDAN: 'car', SUV: 'truck', HATCHBACK: 'car-front', PICKUP: 'truck', UTILITARIO: 'truck', SOLICITADO: 'send', CARGADO: 'upload' };
    return map[v] ? `<i data-lucide="${map[v]}" aria-hidden="true"></i>` : '';
  }
  function fmt(c, v, html = true) {
    if (v === null || v === undefined || v === '') return '';
    switch (c.t) {
      case 'money': { const n = Number(v); return isNaN(n) ? (html ? esc(v) : String(v)) : '$' + nf2.format(n); }
      case 'num': { const n = Number(v); return isNaN(n) ? String(v) : nf0.format(n); }
      case 'pct': { const n = Number(v); return isNaN(n) ? String(v) : nf2.format(n * 100) + '%'; }
      case 'int': return String(v);
      case 'date': case 'datetime': return fmtDate(v);
      case 'img': return html ? (String(v).startsWith('data:') ? `<img class="thumb" src="${esc(v)}" loading="lazy" alt="">` : `<span class="chip c-gray" title="${esc(v)}"><i data-lucide="image" aria-hidden="true"></i>foto</span>`) : String(v);
      case 'enum': { if (!html) return String(v); const col = COLORS[v]; return col ? `<span class="chip c-${col}">${chipIcon(v)}${esc(v)}</span>` : esc(v); }
      case 'phone': return html ? `<a href="https://wa.me/549${String(v).replace(/\D/g, '')}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(v)}</a>` : String(v);
      case 'email': return html ? `<a href="mailto:${esc(v)}" onclick="event.stopPropagation()">${esc(v)}</a>` : String(v);
      default: return html ? esc(v) : String(v);
    }
  }
  function stockCell(v) {
    if (v === null || v === undefined || v === '') return '';
    const [col, ic] = v < 30 ? ['green', 'thumbs-up'] : v < 60 ? ['amber', 'circle-alert'] : ['red', 'thumbs-down'];
    return `<span class="chip c-${col}"><i data-lucide="${ic}" aria-hidden="true"></i>${nf0.format(v)}</span>`;
  }
  const isStock = (k) => /^DIAS/.test(k);
  const cell = (t, r, k) => { const v = val(t, r, k); return isStock(k) ? stockCell(v) : fmt(colOf(t, k), v); };

  // ---------- Carga de tablas ----------
  async function loadTable(t, force) {
    if (S.cache[t] && !force) return S.cache[t];
    if (!S.loading[t] || force) S.loading[t] = api('/api/t/' + encodeURIComponent(t)).then((rows) => { S.cache[t] = rows; resetIdx(); delete S.loading[t]; return rows; });
    return S.loading[t];
  }
  async function ensure(list) { await Promise.all([...new Set(list.flatMap((t) => [t, ...(DEPS[t] || [])]))].filter((t) => META[t]).map((t) => loadTable(t))); }
  function tablesFor(v) {
    if (v.type === 'conciliacion') return ['CAJA_COMPRAS', 'COMPRAS'];
    if (v.type === 'dashboard') return v.parts.map((p) => viewById(p.view).table);
    if (v.type === 'datos' || v.type === 'tablas') return [];
    const t = [v.table];
    if (v.type === 'form' && REFS[v.table]) REFS[v.table].forEach((r) => t.push(r.table));
    return t;
  }
  const totalRows = () => Object.values(S.counts).reduce((a, b) => a + b, 0);

  // ---------- Login e inicio ----------
  const quienLocal = () => { try { return localStorage.getItem('panel-nombre') || ''; } catch (e) { return ''; } };
  // Muestra el pedido de contraseña (zona Ventas) por encima de la app; recuerda a dónde volver.
  function showGate(targetView) {
    S.pend = targetView || S.view; $('#loginErr').textContent = '';
    $('#login').classList.remove('hidden');
    try { $('#loginForm [name=nombre]').value = quienLocal(); } catch (e) {}
    const c = $('#gateCancel'); if (c) c.style.display = S.pend ? '' : 'none';
    setTimeout(() => { const p = $('#loginForm [name=password]'); p && p.focus(); }, 50);
  }
  function hideGate() { $('#login').classList.add('hidden'); }
  $('#gateCancel') && ($('#gateCancel').onclick = (e) => { e.preventDefault(); hideGate(); if (gated(S.view)) location.hash = '#/' + ALL_VIEWS.find((v) => !gated(v)).id; });
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginErr').textContent = '';
    const f = new FormData(e.target); const b = e.target.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Ingresando…';
    try {
      await api('/api/login', { method: 'POST', body: { password: f.get('password'), nombre: f.get('nombre') } });
      try { localStorage.setItem('panel-nombre', f.get('nombre') || ''); } catch (er) {}
      e.target.reset();
      S.logged = true; S.me = await api('/api/me'); S.counts = S.me.counts || {};
      hideGate(); buildNav();
      if (S.pendAction) { const fn = S.pendAction; S.pendAction = null; S.pend = null; fn(); return; }
      const dest = S.pend; S.pend = null;
      if (dest && location.hash.replace('#/', '') !== dest.id) location.hash = '#/' + dest.id; else render();
    } catch (err) { $('#loginErr').textContent = err.message; } finally { b.disabled = false; b.textContent = 'Ingresar'; }
  });
  async function logoutVentas() { await api('/api/logout', { method: 'POST' }); S.logged = false; for (const t of S.protected) delete S.cache[t]; resetIdx(); buildNav(); if (gated(S.view)) location.hash = '#/' + ALL_VIEWS.find((v) => !gated(v)).id; else render(); toast('Saliste de Ventas'); }

  function buildNav() {
    const lockR = (locked) => locked ? '<i data-lucide="lock" aria-hidden="true" class="lock"></i>' : '';
    let rail = ''; let drawer = '';
    APPS.forEach((a, i) => {
      const locked = a.protegida && !S.logged;
      if (i) rail += '<div class="sep" aria-hidden="true"></div>';
      rail += `<div class="app-tag" aria-hidden="true">${a.id === 'ventas' ? 'VENTAS' + (locked ? ' 🔒' : '') : 'APP'}</div>`;
      rail += a.views.map((v) => `<a href="#/${v.id}" data-id="${v.id}" aria-label="${esc(a.title + ': ' + v.title)}${locked ? ' (requiere contraseña)' : ''}"><i data-lucide="${v.icon}" aria-hidden="true"></i></a>`).join('');
      drawer += `<h4>${esc(a.title)}${locked ? ' <span class="lk">con contraseña</span>' : ''}</h4>` + a.views.map((v) => `<a href="#/${v.id}" data-id="${v.id}"><i data-lucide="${v.icon}" aria-hidden="true"></i>${esc(v.title)}${locked ? lockR(true) : ''}</a>`).join('');
    });
    rail += '<div class="sep" aria-hidden="true"></div>' + [TABLES_VIEW, TOOLS].map((v) => `<a href="#/${v.id}" data-id="${v.id}" aria-label="${esc(v.title)}"><i data-lucide="${v.icon}" aria-hidden="true"></i></a>`).join('');
    drawer += '<h4>Panel</h4>' + [TABLES_VIEW, TOOLS].map((v) => `<a href="#/${v.id}" data-id="${v.id}"><i data-lucide="${v.icon}" aria-hidden="true"></i>${esc(v.title)}${v.needLogin && !S.logged ? lockR(true) : ''}</a>`).join('') +
      `<a href="/galpon/" target="_blank" rel="noopener"><i data-lucide="box" aria-hidden="true"></i>Galpón 3D</a>` +
      (S.logged ? `<hr><a href="#" id="logoutLink"><i data-lucide="log-out" aria-hidden="true"></i>Salir de Ventas (${esc(S.me.nombre)})</a>` : '<hr><a href="#" id="loginLink"><i data-lucide="lock" aria-hidden="true"></i>Ingresar a Ventas</a>');
    $('#rail').innerHTML = rail; $('#drawer').innerHTML = drawer;
    const ll = $('#logoutLink'); if (ll) ll.onclick = (e) => { e.preventDefault(); logoutVentas(); };
    const il = $('#loginLink'); if (il) il.onclick = (e) => { e.preventDefault(); showGate(null); };
    let tip = null;
    const showTip = (a) => { hideTip(); const r = a.getBoundingClientRect(); tip = document.createElement('div'); tip.className = 'rail-tip'; tip.textContent = a.getAttribute('aria-label'); tip.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(tip); };
    const hideTip = () => { if (tip) { tip.remove(); tip = null; } };
    $('#rail').querySelectorAll('a').forEach((a) => { a.addEventListener('mouseenter', () => showTip(a)); a.addEventListener('focus', () => showTip(a)); a.addEventListener('mouseleave', hideTip); a.addEventListener('blur', hideTip); a.addEventListener('click', hideTip); });
    icons();
  }
  function setDrawer(open) {
    $('#drawer').classList.toggle('hidden', !open); $('#drawerBackdrop').classList.toggle('hidden', !open);
    $('#menuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { const a = $('#drawer a.active') || $('#drawer a'); a && a.focus(); }
  }
  $('#menuBtn').onclick = () => setDrawer($('#drawer').classList.contains('hidden'));
  $('#userBtn').onclick = () => setDrawer($('#drawer').classList.contains('hidden'));
  $('#drawerBackdrop').onclick = () => setDrawer(false);
  $('#drawer').addEventListener('click', (e) => { if (e.target.closest('a')) setDrawer(false); });
  $('#syncBtn').onclick = async () => {
    const b = $('#syncBtn'); if (b.disabled) return; b.disabled = true; b.classList.add('spin');
    try { S.cache = {}; resetIdx(); S.me = await api('/api/me'); S.counts = S.me.counts || {}; await render(); toast('Datos actualizados'); } catch (e) { toast(e.message); } finally { b.disabled = false; b.classList.remove('spin'); }
  };
  let searchT;
  $('#search').addEventListener('input', (e) => { clearTimeout(searchT); searchT = setTimeout(() => { S.search = e.target.value.trim().toLowerCase(); S.limit = PAGE; render(); }, 200); });
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('#modal').classList.contains('hidden')) closeModal(); else if (!$('#drawer').classList.contains('hidden')) { setDrawer(false); $('#menuBtn').focus(); } }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); }
  });

  function route() {
    if (!S.me) return;
    const id = decodeURIComponent(location.hash.replace('#/', '')) || ALL_VIEWS[0].id;
    S.view = viewById(id) || ALL_VIEWS[0];
    S.limit = PAGE; S.month = 'ALL'; S.search = ''; $('#search').value = '';
    $('#search').placeholder = 'Buscar en ' + S.view.title.toLowerCase();
    document.title = S.view.title + ' · Panel App Ventas';
    document.querySelectorAll('#rail a, #drawer a').forEach((a) => { const on = a.dataset.id === S.view.id; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    if (gated(S.view) && !S.logged) { renderLocked($('#main'), S.view); showGate(S.view); return; }
    render();
  }
  function renderLocked(m, v) {
    m.innerHTML = head(v, '') + `<div class="empty"><i data-lucide="lock" aria-hidden="true"></i><p>Esta sección es de <strong>Ventas</strong> y necesita la contraseña.</p><button class="btn primary" id="unlockBtn"><i data-lucide="key-round" aria-hidden="true"></i>Ingresar la contraseña</button></div>`;
    $('#unlockBtn').onclick = () => showGate(v); icons();
  }

  const head = (v, extra = '') => `<div class="view-head"><div class="view-title"><span class="crumb">${esc(v.app ? v.app.title : '')}</span><h2>${esc(v.title)}</h2></div>${extra}</div>`;
  let renderSeq = 0;
  async function render() {
    const v = S.view; const m = $('#main'); const seq = ++renderSeq;
    if (totalRows() === 0 && v.type !== 'datos') return renderWelcome(m);
    const need = tablesFor(v).filter((t) => !S.cache[t]);
    if (need.length) {
      m.innerHTML = head(v) + `<div class="loading-row"><div class="progress"><div></div></div><span>Cargando ${esc(need.join(', ').toLowerCase())}…</span></div>`;
      try { await ensure(tablesFor(v)); } catch (e) { m.innerHTML = head(v) + `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
      if (seq !== renderSeq) return;
    } else await ensure(tablesFor(v));
    if (v.type === 'form') return renderFormPage(m, v);
    if (v.type === 'calendar') return renderCalendar(m, v);
    if (v.type === 'dashboard') return renderDashboard(m, v);
    if (v.type === 'conciliacion') return renderConciliacion(m, v);
    if (v.type === 'report') return renderReport(m, v);
    if (v.type === 'datos') return renderDatos(m, v);
    if (v.type === 'tablas') return renderTablas(m, v);
    return renderTableView(m, v);
  }

  // ---------- Tablas (listados) ----------
  function specs(v) { return (v.cols || META[v.table].cols.map((c) => c.k)).map(parseSpec); }
  function rowsOf(v, extra) {
    let rows = (S.cache[v.table] || []).slice();
    if (v.filter) rows = rows.filter((r) => { try { return v.filter(r); } catch (e) { return false; } });
    if (extra) rows = rows.filter(extra);
    if (v.monthPanel && S.month !== 'ALL' && S.view === v) rows = rows.filter((r) => String(r[v.monthPanel.date] || '').slice(0, 7) === S.month);
    const sp = specs(v);
    if (S.search) rows = rows.filter((r) => sp.some(({ k }) => { const c = colOf(v.table, k); if (c.t === 'img') return false; const x = val(v.table, r, k); return x !== null && x !== undefined && String(fmt(c, x, false)).toLowerCase().includes(S.search); }));
    const so = S.sort[v.id] || { k: v.sort, desc: !!v.desc };
    if (so.k) {
      const c = colOf(v.table, so.k);
      const pairs = rows.map((r) => [val(v.table, r, so.k), r]);
      pairs.sort((A, B) => {
        let x = A[0], y = B[0];
        if (isNum(c)) { x = Number(x) || 0; y = Number(y) || 0; return so.desc ? y - x : x - y; }
        x = String(x ?? ''); y = String(y ?? '');
        if (!x && y) return 1; if (x && !y) return -1;
        return so.desc ? y.localeCompare(x, 'es') : x.localeCompare(y, 'es');
      });
      rows = pairs.map((p) => p[1]);
    }
    return rows;
  }
  function tableHTML(v, rows, opts = {}) {
    const so = S.sort[v.id] || { k: v.sort, desc: !!v.desc };
    const sp = opts.specs || specs(v);
    const headRow = '<tr>' + sp.map(({ label, k }) => {
      const on = so.k === k; const num = isNum(colOf(v.table, k));
      return `<th class="${num ? 'num' : ''}" aria-sort="${on ? (so.desc ? 'descending' : 'ascending') : 'none'}">${opts.nosort ? `<button type="button" tabindex="-1">${esc(label)}</button>` : `<button type="button" data-sort="${esc(k)}">${esc(label)}${on ? `<span class="arr" aria-hidden="true">${so.desc ? '↓' : '↑'}</span>` : ''}</button>`}</th>`;
    }).join('') + '</tr>';
    const keyCol = META[v.table].key;
    const rowHTML = (r) => `<tr class="row" data-id="${r._id}" tabindex="0" aria-label="Abrir ${esc(r[keyCol] || r.DOMINIO || '')}">` + sp.map(({ k }) => `<td class="${isNum(colOf(v.table, k)) ? 'num' : ''}">${cell(v.table, r, k)}</td>`).join('') + '</tr>';
    const totRow = (rs) => v.totals ? '<tr class="tot">' + sp.map(({ k }) => v.totals.includes(k) ? `<td class="num">${fmt(colOf(v.table, k), rs.reduce((s, r) => s + (Number(val(v.table, r, k)) || 0), 0))}</td>` : '<td></td>').join('') + '</tr>' : '';
    let body = ''; let shown = 0; const limit = opts.nolimit ? Infinity : S.limit;
    if (v.group) {
      const groups = {};
      for (const r of rows) { const g = val(v.table, r, v.group) || '(vacío)'; (groups[g] = groups[g] || []).push(r); }
      const order = Object.keys(groups).sort((a, b) => {
        const o = v.groupOrder || []; const ia = o.indexOf(a), ib = o.indexOf(b);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        if (a === '(vacío)') return 1; if (b === '(vacío)') return -1;
        return a.localeCompare(b, 'es');
      });
      for (const g of order) {
        const key = v.id + '|' + g;
        const closed = key in S.collapsed ? S.collapsed[key] : (v.collapsed || []).includes(g) && !S.search;
        const label = g === '(vacío)' ? '<span class="c-gray">(vacío)</span>' : fmt(colOf(v.table, v.group), g);
        body += `<tr class="grp"><td colspan="${sp.length}"><button type="button" data-g="${esc(key)}" data-closed="${closed ? 1 : 0}" aria-expanded="${!closed}"><span class="caret ${closed ? 'closed' : ''}" aria-hidden="true"><i data-lucide="chevron-down"></i></span>${label}<span class="badge">${nf0.format(groups[g].length)}</span></button></td></tr>`;
        if (!closed) { for (const r of groups[g]) { if (shown++ >= limit) break; body += rowHTML(r); } body += totRow(groups[g]); }
      }
    } else {
      for (const r of rows) { if (shown++ >= limit) break; body += rowHTML(r); }
      body += totRow(rows);
    }
    const more = shown > limit ? `<div class="more"><button class="btn outline" data-more>Mostrar ${PAGE} más</button></div>` : '';
    const empty = `<div class="empty"><i data-lucide="${S.search ? 'search-x' : 'inbox'}" aria-hidden="true"></i><p>${S.search ? `Nada coincide con “${esc(S.search)}”.` : 'Sin registros.'}</p></div>`;
    return `<div class="table-wrap"><table class="grid"><thead>${headRow}</thead><tbody>${body}</tbody></table>${rows.length ? more : empty}</div>`;
  }
  function bindTable(root, v) {
    root.querySelectorAll('th button[data-sort]').forEach((b) => b.onclick = () => {
      const k = b.dataset.sort; const cur = S.sort[v.id] || { k: v.sort, desc: !!v.desc };
      S.sort[v.id] = { k, desc: cur.k === k ? !cur.desc : false }; render();
    });
    root.querySelectorAll('tr.row').forEach((tr) => {
      tr.onclick = () => openDetail(v.table, +tr.dataset.id, v);
      tr.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(v.table, +tr.dataset.id, v); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const all = [...root.querySelectorAll('tr.row')]; const n = all[all.indexOf(tr) + (e.key === 'ArrowDown' ? 1 : -1)]; n && n.focus(); }
      };
    });
    root.querySelectorAll('tr.grp button').forEach((b) => b.onclick = () => { S.collapsed[b.dataset.g] = b.dataset.closed !== '1'; render(); });
    const mb = root.querySelector('[data-more]'); if (mb) mb.onclick = () => { S.limit += PAGE; render(); };
  }
  function renderTableView(m, v) {
    const rows = rowsOf(v);
    let panel = ''; let monthSel = '';
    if (v.monthPanel) {
      const g = {}; for (const r of (S.cache[v.table] || []).filter((r) => !v.filter || v.filter(r))) { const k = String(r[v.monthPanel.date] || '').slice(0, 7) || '(sin fecha)'; g[k] = (g[k] || 0) + (Number(r[v.monthPanel.sum]) || 0); }
      const ks = Object.keys(g).sort().reverse();
      panel = `<nav class="month-panel" aria-label="Meses"><button data-month="ALL" class="${S.month === 'ALL' ? 'active' : ''}" aria-pressed="${S.month === 'ALL'}"><span>Todos</span></button>` + ks.map((k) => `<button data-month="${k}" class="${S.month === k ? 'active' : ''}" aria-pressed="${S.month === k}"><span>${k}</span><span>$${nf0.format(g[k])}</span></button>`).join('') + '</nav>';
      monthSel = `<label class="sr-only" for="monthSel">Mes</label><select id="monthSel" class="btn month-select"><option value="ALL">Todos los meses</option>${ks.map((k) => `<option value="${k}" ${S.month === k ? 'selected' : ''}>${k}</option>`).join('')}</select>`;
    }
    m.innerHTML = head(v, `<span class="count">${nf0.format(rows.length)} ${rows.length === 1 ? 'registro' : 'registros'}</span>${monthSel}
      ${v.export ? '<button class="btn outline" id="expBtn" aria-label="Exportar a CSV"><i data-lucide="download" aria-hidden="true"></i><span class="lbl">Exportar</span></button>' : ''}
      ${v.add ? '<button class="btn primary" id="addBtn" aria-label="Agregar registro"><i data-lucide="plus" aria-hidden="true"></i><span class="lbl">Agregar</span></button>' : ''}`) +
      `<div class="body">${panel}${tableHTML(v, rows)}</div>`;
    bindTable(m, v);
    m.querySelectorAll('[data-month]').forEach((b) => b.onclick = () => { S.month = b.dataset.month; S.limit = PAGE; render(); });
    const ms = $('#monthSel'); if (ms) ms.onchange = () => { S.month = ms.value; S.limit = PAGE; render(); };
    if (v.add) $('#addBtn').onclick = () => (typeof v.add === 'string' ? (location.hash = '#/' + v.add) : openForm(v.table, null, v, v.defaults));
    if (v.export) $('#expBtn').onclick = () => exportCSV(v, rows);
    icons();
  }

  // ---------- Detalle ----------
  function titleOf(t, r) { const k = META[t].key; return [r.DOMINIO, r.DEUDOR || r.CLIENTE || r.VEHICULO || r.MODELO].filter(Boolean).join(' · ') || String(r[k] || (t + ' #' + r._id)); }
  function openDetail(t, id, v) {
    const r = (S.cache[t] || []).find((x) => x._id === id); if (!r) return;
    const sp = v && v.table === t && v.cols ? specs(v) : [];
    const shown = new Set(sp.map((s) => s.k));
    const rest = META[t].cols.filter((c) => !shown.has(c.k)).map((c) => ({ label: c.k, k: c.k }));
    const kvItem = ({ label, k }) => {
      const c = colOf(t, k); const html = isStock(k) ? stockCell(val(t, r, k)) : fmt(c, val(t, r, k));
      return html === '' ? '' : `<div class="${c.t === 'longtext' ? 'wide' : ''}"><dt>${esc(label)}</dt><dd class="${c.f ? 'calc' : ''}">${html}</dd></div>`;
    };
    const kv = (sp.length ? sp.map(kvItem).join('') + '<div class="sec">Otros datos</div>' : '') + rest.map(kvItem).join('');
    const childList = (CHILDREN[t] || []).filter((ch) => S.logged || !S.protected.has(ch.table));
    const kids = childList.map((ch, i) => `<div class="card" data-child="${i}"></div>`).join('');
    modal(`<div class="sheet"><div class="sheet-head"><h3 id="modalTitle">${esc(titleOf(t, r))}</h3>
      ${t === 'CARGA' ? '<button class="icon-btn" id="pdfBtn" aria-label="Generar PDF"><i data-lucide="file-down" aria-hidden="true"></i></button>' : ''}
      <button class="icon-btn" id="editBtn" aria-label="Editar"><i data-lucide="pencil" aria-hidden="true"></i></button>
      <button class="icon-btn" id="delBtn" aria-label="Eliminar"><i data-lucide="trash-2" aria-hidden="true"></i></button>
      <button class="icon-btn" data-close aria-label="Cerrar"><i data-lucide="x" aria-hidden="true"></i></button></div>
      <div class="sheet-body"><dl class="kv">${kv}</dl>${kids ? `<div class="children">${kids}</div>` : ''}</div></div>`);
    $('#editBtn').onclick = () => openForm(t, r, v);
    $('#delBtn').onclick = () => confirmBox('Eliminar registro', `Se va a borrar <strong>${esc(titleOf(t, r))}</strong>. Esta acción no se puede deshacer.`, 'Eliminar', async () => {
      await api(`/api/rec/${encodeURIComponent(t)}/${r._id}`, { method: 'DELETE' });
      S.cache[t] = S.cache[t].filter((x) => x._id !== r._id); S.counts[t]--; resetIdx(); closeModal(); render(); toast('Registro eliminado');
    });
    if (t === 'CARGA') $('#pdfBtn').onclick = () => ventaPDF(r);
    childList.forEach(async (ch, i) => {
      const el = $(`[data-child="${i}"]`); if (!el) return;
      el.innerHTML = `<div class="card-head"><h3>${esc(ch.title)}</h3><span class="count">cargando…</span></div>`;
      await loadTable(ch.table); if (!document.contains(el)) return;
      const pk = String(r[ch.pk] ?? '').toUpperCase();
      const rows = pk ? S.cache[ch.table].filter((x) => String(x[ch.fk] ?? '').toUpperCase() === pk) : [];
      const cv = { id: 'child-' + ch.table, table: ch.table, cols: ch.cols, totals: ch.cols.map(parseSpec).filter((s) => colOf(ch.table, s.k).t === 'money' && /IMPORTE|TOTAL/.test(s.k)).map((s) => s.k) };
      el.innerHTML = `<div class="card-head"><h3>${esc(ch.title)}</h3><span class="count">${rows.length}</span><button class="btn ghost" data-add-child><i data-lucide="plus" aria-hidden="true"></i>Agregar</button></div>${rows.length ? tableHTML(cv, rows, { nolimit: true, nosort: true }) : '<div class="empty" style="padding:18px"><p>Sin registros relacionados.</p></div>'}`;
      el.querySelectorAll('tr.row').forEach((tr) => tr.onclick = () => openDetail(ch.table, +tr.dataset.id, null));
      el.querySelector('[data-add-child]').onclick = () => openForm(ch.table, null, null, { [ch.fk]: r[ch.pk] });
      icons();
    });
  }

  let lastFocus = null;
  function modal(html) {
    const m = $('#modal'); if (m.classList.contains('hidden')) lastFocus = document.activeElement;
    m.innerHTML = html; m.classList.remove('hidden');
    m.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeModal);
    m.onclick = (e) => { if (e.target === m) closeModal(); };
    icons();
    const first = m.querySelector('.sheet-body input, .sheet-body select, .sheet-body textarea') || m.querySelector('.sheet-head button, button');
    first && first.focus({ preventScroll: true });
    m.onkeydown = (e) => {
      if (e.key !== 'Tab') return;
      const f = [...m.querySelectorAll('button, input, select, textarea, a[href], tr[tabindex]')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
  }
  function closeModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); }
  function confirmBox(title, msg, okLabel, onOk) {
    modal(`<div class="sheet center" role="alertdialog"><div class="sheet-head"><h3 id="modalTitle">${esc(title)}</h3></div><div class="sheet-body" style="padding:18px 20px">${msg}</div>
      <div class="sheet-foot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="okBtn">${esc(okLabel)}</button></div></div>`);
    $('#okBtn').onclick = async () => { const b = $('#okBtn'); b.disabled = true; try { await onOk(); } catch (e) { toast(e.message); b.disabled = false; } };
  }

  // ---------- Formularios ----------
  const SUG = {};
  function suggestions(t, k) {
    const key = t + '|' + k; if (SUG[key]) return SUG[key];
    const c = {}; for (const r of S.cache[t] || []) { const x = r[k]; if (x) c[x] = (c[x] || 0) + 1; }
    return (SUG[key] = Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 400));
  }
  const refOf = (t, k) => (REFS[t] || []).find((r) => r.col === k);
  const AUTO = /^(USUARIO|HORA|USUARIO_CARGA_INICIAL|HORA_CARGA_INICIAL|USUARIO_CI|HORA_CI|USER|USER_CI|USUARIO CI|CI)$/;

  function fieldHTML(t, sp, c, value, idx, required) {
    const id = 'f' + idx; const lbl = esc(sp.label);
    const hint = refOf(t, c.k) ? '<p class="hint">Al elegir un valor se completan los datos relacionados</p>' : '';
    const wrapOpen = `<div class="field ${['longtext', 'img'].includes(c.t) ? 'wide' : ''}" data-field="${esc(c.k)}"><label for="${id}" id="${id}lb">${lbl}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>`;
    const wrapEnd = `<p class="field-err hidden" id="${id}e"></p>${hint}</div>`;
    const base = `id="${id}" data-k="${esc(c.k)}" ${required ? 'required aria-required="true"' : ''} aria-describedby="${id}e"`;
    const v = value ?? '';
    const sug = (extra) => `<datalist id="${id}l">${[...new Set((extra || []).concat(suggestions(t, c.k)))].map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`;
    let inner;
    if (c.t === 'enum' && (c.opts || []).length <= 4 && !c.allowOther) inner = `<div class="seg" data-k="${esc(c.k)}" role="group" aria-labelledby="${id}lb" id="${id}">${c.opts.map((o) => `<button type="button" aria-pressed="${o === v}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    else if (c.t === 'enum') inner = `<input ${base} list="${id}l" value="${esc(v)}" autocomplete="off">${sug(c.opts)}`;
    else if (c.t === 'longtext') inner = `<textarea ${base}>${esc(v)}</textarea>`;
    else if (c.t === 'money' || c.t === 'pct') inner = `<div class="money"><span aria-hidden="true">${c.t === 'pct' ? '%' : '$'}</span><input ${base} type="number" step="any" inputmode="decimal" value="${esc(v)}"></div>`;
    else if (c.t === 'num' || c.t === 'int') inner = `<input ${base} type="number" step="${c.t === 'int' ? 1 : 'any'}" inputmode="numeric" value="${esc(v)}">`;
    else if (c.t === 'date') inner = `<input ${base} type="date" value="${esc(String(v).slice(0, 10))}">`;
    else if (c.t === 'datetime') inner = `<input ${base} type="datetime-local" value="${esc(String(v).slice(0, 16))}">`;
    else if (c.t === 'email') inner = `<input ${base} type="email" inputmode="email" value="${esc(v)}">`;
    else if (c.t === 'phone') inner = `<input ${base} type="tel" inputmode="tel" value="${esc(v)}">`;
    else if (c.t === 'img') inner = `<div class="img-field" data-k="${esc(c.k)}" data-v="${esc(v)}">${v && String(v).startsWith('data:') ? `<img src="${esc(v)}" alt="Foto actual">` : ''}<label class="btn outline" for="${id}"><i data-lucide="camera" aria-hidden="true"></i>${v ? 'Cambiar foto' : 'Sacar o elegir foto'}</label><input class="sr-only" id="${id}" type="file" accept="image/*" capture="environment"></div>`;
    else { const ref = refOf(t, c.k); inner = `<input ${base} ${ref ? `data-ref="${esc(c.k)}"` : ''} list="${id}l" value="${esc(v)}" autocomplete="off">${sug(ref ? suggestions(ref.table, ref.key) : [])}`; }
    return wrapOpen + inner + wrapEnd;
  }
  function formHTML(t, rec, cols, defaults) {
    const list = (cols ? cols.map(parseSpec) : META[t].cols.map((c) => ({ label: c.k, k: c.k }))).filter((s) => !AUTO.test(s.k) && !(colOf(t, s.k).f) && s.k !== META[t].key);
    const req = new Set((S.view && S.view.required) || []);
    return '<div class="err-summary hidden" tabindex="-1" role="alert"></div>' + list.map((sp, i) => {
      const c = colOf(t, sp.k);
      let v = rec ? rec[sp.k] : (defaults && sp.k in defaults ? defaults[sp.k] : undefined);
      if (v === 'today') v = today();
      return fieldHTML(t, sp, c, v, i, req.has(sp.k));
    }).join('');
  }
  function readForm(root, base) {
    const d = { ...(base || {}) };
    root.querySelectorAll('input[data-k], select[data-k], textarea[data-k]').forEach((el) => { d[el.dataset.k] = el.value; });
    root.querySelectorAll('.seg[data-k]').forEach((el) => { const on = el.querySelector('[aria-pressed="true"]'); d[el.dataset.k] = on ? on.dataset.v : ''; });
    root.querySelectorAll('.img-field[data-k]').forEach((el) => { d[el.dataset.k] = el.dataset.v || ''; });
    return d;
  }
  function validate(root, t, d, required) {
    const errs = [];
    root.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
    root.querySelectorAll('.field-err').forEach((p) => { p.classList.add('hidden'); p.innerHTML = ''; });
    for (const key of required || []) {
      const f = root.querySelector(`.field[data-field="${CSS.escape(key)}"]`); if (!f) continue;
      if (d[key] === undefined || String(d[key]).trim() === '') {
        f.classList.add('invalid'); const p = f.querySelector('.field-err');
        p.innerHTML = `<i data-lucide="circle-alert" aria-hidden="true"></i>Completá ${esc(key.toLowerCase())}.`; p.classList.remove('hidden');
        const ctl = f.querySelector('[data-k]'); if (ctl) ctl.setAttribute('aria-invalid', 'true');
        errs.push({ id: (f.querySelector('[id]') || {}).id, msg: `Completá ${key.toLowerCase()}` });
      }
    }
    const sum = root.querySelector('.err-summary');
    if (errs.length) {
      sum.innerHTML = `<strong>Revisá ${errs.length === 1 ? 'este campo' : `estos ${errs.length} campos`}:</strong>` + errs.map((e) => `<br><a href="#${e.id}" data-jump="${e.id}">${esc(e.msg)}</a>`).join('');
      sum.classList.remove('hidden'); sum.querySelectorAll('[data-jump]').forEach((a) => a.onclick = (ev) => { ev.preventDefault(); const el = document.getElementById(a.dataset.jump); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } });
      sum.focus(); icons();
    } else sum.classList.add('hidden');
    return !errs.length;
  }
  function resizeImage(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader(); fr.onerror = rej;
      fr.onload = () => { const img = new Image(); img.onerror = rej; img.onload = () => {
        const max = 1000; const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.8));
      }; img.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  function bindForm(root, t, base) {
    root.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const was = b.getAttribute('aria-pressed') === 'true';
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      if (!was) b.setAttribute('aria-pressed', 'true');
      const f = seg.closest('.field.invalid'); if (f) { f.classList.remove('invalid'); f.querySelector('.field-err').classList.add('hidden'); }
      refreshCalc();
    }));
    root.querySelectorAll('.img-field input[type=file]').forEach((inp) => inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return; const box = inp.parentElement; const lb = box.querySelector('label');
      lb.textContent = 'Procesando…';
      try { const url = await resizeImage(file); box.dataset.v = url; let img = box.querySelector('img'); if (!img) { img = document.createElement('img'); img.alt = 'Foto nueva'; box.prepend(img); } img.src = url; lb.innerHTML = '<i data-lucide="camera" aria-hidden="true"></i>Cambiar foto'; icons(); }
      catch (e) { lb.textContent = 'No se pudo leer la foto'; }
    });
    root.addEventListener('input', (e) => { const f = e.target.closest('.field.invalid'); if (f && String(e.target.value).trim() !== '') { f.classList.remove('invalid'); f.querySelector('.field-err').classList.add('hidden'); e.target.removeAttribute('aria-invalid'); } });
    root.querySelectorAll('input[data-ref]').forEach((inp) => inp.addEventListener('change', () => {
      const ref = refOf(t, inp.dataset.ref); if (!ref) return;
      const target = String(inp.value).trim().toUpperCase();
      const src = (S.cache[ref.table] || []).find((r) => String(r[ref.key] ?? '').toUpperCase() === target); if (!src) return;
      let n = 0;
      for (const [dst, from] of Object.entries(ref.fill)) {
        const el = root.querySelector(`[data-k="${CSS.escape(dst)}"]`); if (!el) continue;
        const x = src[from]; if (x === undefined || x === null || x === '') continue;
        if (el.classList.contains('seg')) { el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === x))); n++; }
        else if (!el.value) { el.value = x; n++; }
      }
      if (n) toast(`Se completaron ${n} datos de ${target}`);
      refreshCalc();
    }));
    const refreshCalc = () => {
      const d = readForm(root, base);
      root.querySelectorAll('[data-calc]').forEach((el) => { const c = colOf(t, el.dataset.calc); el.innerHTML = fmt(c, c.f(d, CTX)) || '—'; });
      icons();
    };
    refreshCalc();
  }
  async function askDuplicate(key, value) {
    return new Promise((resolve) => {
      const h = document.createElement('div'); h.className = 'modal'; h.style.zIndex = 70; h.setAttribute('role', 'alertdialog');
      h.innerHTML = `<div class="sheet center"><div class="sheet-head"><h3>Registro repetido</h3></div><div class="sheet-body" style="padding:18px 20px">Ya existe un registro con ${esc(key)} <strong>${esc(value)}</strong>. ¿Guardarlo igual?</div><div class="sheet-foot"><button class="btn" data-no>No, revisar</button><button class="btn primary" data-yes>Guardar igual</button></div></div>`;
      document.body.appendChild(h);
      const done = (x) => { h.remove(); resolve(x); };
      h.querySelector('[data-no]').onclick = () => done(false); h.querySelector('[data-yes]').onclick = () => done(true);
      h.querySelector('[data-no]').focus();
    });
  }
  async function saveRecord(t, rec, d) {
    const key = META[t].key;
    if (key && !rec && d[key]) { const dup = (S.cache[t] || []).some((r) => String(r[key] ?? '').toUpperCase() === String(d[key]).trim().toUpperCase()); if (dup && !(await askDuplicate(key, String(d[key]).toUpperCase()))) throw new Error('Cancelado'); }
    if (!S.logged) d.__quien = quienLocal(); // en la zona libre, el nombre guardado va a la columna USUARIO
    const saved = rec ? await api(`/api/rec/${encodeURIComponent(t)}/${rec._id}`, { method: 'PUT', body: d }) : await api(`/api/rec/${encodeURIComponent(t)}`, { method: 'POST', body: d });
    if (rec) S.cache[t] = (S.cache[t] || []).map((x) => (x._id === saved._id ? saved : x)); else { S.cache[t] = (S.cache[t] || []).concat(saved); S.counts[t] = (S.counts[t] || 0) + 1; }
    resetIdx(); return saved;
  }
  async function submitState(btn, fn) { if (btn.disabled) return; const html = btn.innerHTML; btn.disabled = true; btn.textContent = 'Guardando…'; try { await fn(); } finally { if (document.contains(btn)) { btn.disabled = false; btn.innerHTML = html; } } }
  function openForm(t, rec, v, defaults) {
    const cols = v && v.table === t ? v.cols : null; const required = (v && v.table === t && v.required) || [];
    modal(`<div class="sheet"><div class="sheet-head"><h3 id="modalTitle">${rec ? 'Editar' : 'Nuevo'} · ${esc(t)}</h3><button class="icon-btn" data-close aria-label="Cerrar"><i data-lucide="x" aria-hidden="true"></i></button></div>
      <form class="sheet-body form" id="recForm" novalidate>${formHTML(t, rec, cols, defaults)}</form>
      <div class="sheet-foot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="saveBtn" type="submit" form="recForm">Guardar</button></div></div>`);
    const f = $('#recForm'); bindForm(f, t, rec);
    f.onsubmit = (e) => { e.preventDefault(); const d = readForm(f, rec || defaults); if (!validate(f, t, d, required)) return; submitState($('#saveBtn'), async () => { try { const s = await saveRecord(t, rec, d); closeModal(); render(); toast('Guardado'); openDetail(t, s._id, v); } catch (err) { if (err.message !== 'Cancelado') toast(err.message); } }); };
  }
  function renderFormPage(m, v) {
    m.innerHTML = head(v, '<span class="count">Campos con <span class="req" style="color:var(--brand-text)">*</span> obligatorios</span>') +
      `<div class="form-page"><form class="form" id="pageForm" novalidate>${formHTML(v.table, null, v.cols, v.defaults)}<div class="form-actions"><button type="button" class="btn" id="cancelBtn">Limpiar</button><button type="submit" class="btn primary" id="pageSave">Guardar</button></div></form></div>`;
    const f = $('#pageForm'); bindForm(f, v.table, null);
    $('#cancelBtn').onclick = () => render();
    f.onsubmit = (e) => { e.preventDefault(); const d = readForm(f, v.defaults); if (!validate(f, v.table, d, v.required || [])) return; submitState($('#pageSave'), async () => { try { const s = await saveRecord(v.table, null, d); toast(`Guardado ${s[META[v.table].key] || ''}`); if (v.done) location.hash = '#/' + v.done; else render(); } catch (err) { if (err.message !== 'Cancelado') toast(err.message); } }); };
    icons();
  }

  // ---------- Calendario ----------
  function renderCalendar(m, v) {
    if (!S.cal) { const d = new Date(); S.cal = new Date(d.getFullYear(), d.getMonth(), 1); }
    const y = S.cal.getFullYear(), mo = S.cal.getMonth();
    const first = new Date(y, mo, 1); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const ev = {};
    for (const r of S.cache[v.table] || []) { const d = String(r[v.dateCol] || '').slice(0, 10); if (d && (!S.search || v.label(r).toLowerCase().includes(S.search))) (ev[d] = ev[d] || []).push(r); }
    let cells = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'].map((x) => `<div class="dow">${x}</div>`).join('');
    const td = today();
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells += `<div class="day ${d.getMonth() !== mo ? 'out' : ''} ${iso === td ? 'today' : ''}"><div class="n">${d.getDate()}</div>${(ev[iso] || []).slice(0, 20).map((r) => `<button class="cal-ev" data-id="${r._id}" aria-label="${esc(v.label(r))}">${esc(v.label(r))}</button>`).join('')}</div>`;
    }
    const mesTxt = first.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    m.innerHTML = head(v, '') + `<div class="cal"><div class="cal-head"><button class="icon-btn" id="prev" aria-label="Mes anterior"><i data-lucide="chevron-left" aria-hidden="true"></i></button><button class="icon-btn" id="next" aria-label="Mes siguiente"><i data-lucide="chevron-right" aria-hidden="true"></i></button><button class="btn outline" id="hoy">Hoy</button><h3 aria-live="polite">${mesTxt}</h3></div><div class="cal-grid">${cells}</div></div>`;
    $('#prev').onclick = () => { S.cal = new Date(y, mo - 1, 1); render(); };
    $('#next').onclick = () => { S.cal = new Date(y, mo + 1, 1); render(); };
    $('#hoy').onclick = () => { S.cal = null; render(); };
    m.querySelectorAll('.cal-ev').forEach((b) => b.onclick = () => openDetail(v.table, +b.dataset.id, null));
    icons();
  }

  // ---------- Dashboard (REVISAR) ----------
  function renderDashboard(m, v) {
    m.innerHTML = head(v, '') + `<div class="dash">${v.parts.map((p, i) => `<div class="card" id="part${i}"></div>`).join('')}</div>`;
    v.parts.forEach((p, i) => {
      const base = viewById(p.view); const pv = { ...base, id: v.id + '-' + base.id, collapsed: [] };
      const rows = rowsOf(pv, p.filter);
      const el = $('#part' + i);
      el.innerHTML = `<div class="card-head"><h3>${esc(p.title)}</h3><span class="count">${rows.length}</span></div>${tableHTML(pv, rows, { nolimit: true })}`;
      bindTable(el, pv);
    });
    icons();
  }

  // ---------- Conciliación de compras ----------
  function renderConciliacion(m, v) {
    const inMonth = (r) => S.concMonth === 'ALL' || String(r.FECHA || '').slice(0, 7) === S.concMonth;
    const ingresos = (S.cache.CAJA_COMPRAS || []).filter(inMonth);
    const compras = (S.cache.COMPRAS || []).filter(inMonth);
    const meses = [...new Set([...(S.cache.CAJA_COMPRAS || []), ...(S.cache.COMPRAS || [])].map((r) => String(r.FECHA || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    const cuentas = {};
    for (const r of ingresos) { const c = r['CONCILICACION CAJA'] || '(sin cuenta)'; (cuentas[c] = cuentas[c] || { ing: 0, comp: 0 }).ing += Number(r.IMPORTE) || 0; }
    for (const r of compras) { const c = r['CONCILIACION CAJA'] || '(sin asignar)'; (cuentas[c] = cuentas[c] || { ing: 0, comp: 0 }).comp += Number(r.IMPORTE) || 0; }
    const money = (n) => '$' + nf2.format(n);
    const rowsC = Object.entries(cuentas).sort((a, b) => b[1].comp - a[1].comp).map(([c, x]) => `<tr><td>${esc(c)}</td><td class="num">${money(x.ing)}</td><td class="num">${money(x.comp)}</td><td class="num ${x.ing - x.comp < 0 ? 'c-red' : 'c-green'}">${money(x.ing - x.comp)}</td></tr>`).join('');
    const tI = Object.values(cuentas).reduce((s, x) => s + x.ing, 0), tC = Object.values(cuentas).reduce((s, x) => s + x.comp, 0);
    const iv = { id: 'conc-ingresos', table: 'CAJA_COMPRAS', cols: ['FECHA', 'CONCILICACION CAJA', 'IMPORTE', 'CAJA', 'RETIRO', 'N° RECIBO', 'OBSERVACIONES'], sort: 'FECHA', desc: true, totals: ['IMPORTE'], add: true, export: true };
    m.innerHTML = head(v, `<label class="sr-only" for="concMes">Mes</label><select id="concMes" class="btn"><option value="ALL">Todos los meses</option>${meses.map((x) => `<option ${x === S.concMonth ? 'selected' : ''}>${x}</option>`).join('')}</select>`) +
      `<div class="dash">
        <div class="sum-cards"><div class="sum-card"><div class="t">Ingreso a caja</div><div class="v">${money(tI)}</div></div><div class="sum-card"><div class="t">Compras total</div><div class="v">${money(tC)}</div></div><div class="sum-card"><div class="t">Diferencia</div><div class="v ${tI - tC < 0 ? 'c-red' : 'c-green'}">${money(tI - tC)}</div></div></div>
        <div class="card"><div class="card-head"><h3>CONCILIACION</h3></div><div class="table-wrap"><table class="grid"><thead><tr><th style="padding:12px 14px">CUENTA</th><th class="num" style="padding:12px 14px">INGRESO A CAJA</th><th class="num" style="padding:12px 14px">COMPRAS TOTAL</th><th class="num" style="padding:12px 14px">DIF</th></tr></thead><tbody>${rowsC || '<tr><td colspan="4"><div class="empty"><p>Sin movimientos.</p></div></td></tr>'}</tbody></table></div></div>
        <div class="card" id="ingCard"><div class="card-head"><h3>CAJA COMPRAS - INGRESO</h3><button class="btn ghost" id="addIng"><i data-lucide="plus" aria-hidden="true"></i>Agregar</button></div>${tableHTML(iv, ingresos.slice().sort((a, b) => String(b.FECHA).localeCompare(String(a.FECHA))), { nolimit: true })}</div>
      </div>`;
    $('#concMes').onchange = (e) => { S.concMonth = e.target.value; render(); };
    $('#addIng').onclick = () => openForm('CAJA_COMPRAS', null, iv, { FECHA: today() });
    bindTable($('#ingCard'), iv);
    icons();
  }

  // ---------- Reportes ----------
  function renderReport(m, v) {
    const st = S.rep[v.id] = S.rep[v.id] || { desde: '', hasta: '', estados: [] };
    const rows = (S.cache[v.table] || []).filter((r) => {
      const f = String(r.FECHA_IMPUTACION || '').slice(0, 10);
      if (st.desde && f < st.desde) return false; if (st.hasta && f > st.hasta) return false;
      if (st.estados.length && !st.estados.includes(r['ESTADO_OPERACIÓN'])) return false;
      return true;
    });
    const agg = {};
    for (const r of rows) { const k = r[v.by] || '(sin dato)'; const a = agg[k] = agg[k] || { n: 0, venta: 0, margen: 0 }; a.n++; a.venta += Number(r.IMPORTE_TOTAL) || 0; a.margen += Number(r.MARGEN) || 0; }
    const list = Object.entries(agg).sort((a, b) => b[1].venta - a[1].venta);
    const maxV = Math.max(1, ...list.map(([, a]) => a.venta));
    const tot = list.reduce((s, [, a]) => ({ n: s.n + a.n, venta: s.venta + a.venta, margen: s.margen + a.margen }), { n: 0, venta: 0, margen: 0 });
    const estadosAll = [...new Set((S.cache[v.table] || []).map((r) => r['ESTADO_OPERACIÓN']).filter(Boolean))];
    m.innerHTML = head(v, '') + `<div class="report-filters">
      <label>Desde (imputación)<input type="date" id="rDesde" value="${st.desde}"></label>
      <label>Hasta<input type="date" id="rHasta" value="${st.hasta}"></label>
      <label>Estado operación<select id="rEstado"><option value="">Todos</option>${estadosAll.map((e) => `<option ${st.estados[0] === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></label>
      <button class="btn" id="rLimpiar">Limpiar</button></div>
      <div class="table-wrap"><table class="grid"><thead><tr><th style="padding:12px 14px">${esc(v.by)}</th><th class="num" style="padding:12px 14px">OPERACIONES</th><th class="num" style="padding:12px 14px">VENTA TOTAL</th><th class="num" style="padding:12px 14px">MARGEN</th><th style="padding:12px 14px"></th></tr></thead><tbody>
      ${list.map(([k, a]) => `<tr><td>${esc(k)}</td><td class="num">${a.n}</td><td class="num">$${nf0.format(a.venta)}</td><td class="num">$${nf0.format(a.margen)}</td><td class="bar-cell"><div class="bar" style="width:${Math.round(100 * a.venta / maxV)}%"></div></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty"><p>Sin datos en el período.</p></div></td></tr>'}
      </tbody>${list.length ? `<tfoot><tr class="tot"><td>TOTAL</td><td class="num">${tot.n}</td><td class="num">$${nf0.format(tot.venta)}</td><td class="num">$${nf0.format(tot.margen)}</td><td></td></tr></tfoot>` : ''}</table></div>`;
    const upd = () => { st.desde = $('#rDesde').value; st.hasta = $('#rHasta').value; const e = $('#rEstado').value; st.estados = e ? [e] : []; render(); };
    $('#rDesde').onchange = upd; $('#rHasta').onchange = upd; $('#rEstado').onchange = upd;
    $('#rLimpiar').onclick = () => { S.rep[v.id] = { desde: '', hasta: '', estados: [] }; render(); };
    icons();
  }

  // ---------- Todas las tablas ----------
  function renderTablas(m, v) {
    const rows = Object.keys(META).sort().map((t) => `<tr class="row" data-t="${esc(t)}" tabindex="0"><td><strong>${esc(t)}</strong></td><td class="num">${nf0.format(S.counts[t] || 0)}</td><td>${META[t].cols.length} columnas</td></tr>`).join('');
    m.innerHTML = head(v, `<span class="count">${Object.keys(META).length} tablas</span>`) +
      `<div class="table-wrap"><table class="grid"><thead><tr><th style="padding:12px 14px">TABLA</th><th class="num" style="padding:12px 14px">REGISTROS</th><th style="padding:12px 14px">ESTRUCTURA</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    m.querySelectorAll('tr.row').forEach((tr) => { const go = () => { location.hash = '#/t:' + encodeURIComponent(tr.dataset.t); }; tr.onclick = go; tr.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; });
  }

  // ---------- Exportar CSV ----------
  function exportCSV(v, rows) {
    const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const sp = specs(v).filter((s) => colOf(v.table, s.k).t !== 'img');
    const lines = [sp.map((s) => q(s.label)).join(';')].concat(rows.map((r) => sp.map(({ k }) => {
      const c = colOf(v.table, k); const x = val(v.table, r, k);
      if (isNum(c)) return x === null || x === undefined || x === '' ? '' : String(x).replace('.', ',');
      return q(fmt(c, x, false));
    }).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${v.title.replace(/\s+/g, '_')}_${today()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- PDF de venta ----------
  function ventaPDF(r) {
    const w = window.open('', '_blank'); if (!w) return toast('Habilitá las ventanas emergentes');
    const row = (label, k) => { const c = colOf('CARGA', k); const x = fmt(c, val('CARGA', r, k), false); return x ? `<tr><th>${esc(label)}</th><td>${esc(x)}</td></tr>` : ''; };
    const sec = (titulo, pares) => `<h2>${titulo}</h2><table>${pares.map(([l, k]) => row(l, k)).join('')}</table>`;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Venta ${esc(r.DOMINIO || '')}</title><style>
      body{font-family:Arial,sans-serif;color:#222;margin:32px;font-size:13px}h1{font-size:20px;margin:0;color:#a3175d}h2{font-size:14px;border-bottom:2px solid #be1e6e;padding-bottom:4px;margin:22px 0 8px}
      .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #ddd;padding-bottom:10px}table{width:100%;border-collapse:collapse}th{text-align:left;width:42%;color:#555;font-weight:normal;padding:5px 0;border-bottom:1px solid #eee}td{padding:5px 0;border-bottom:1px solid #eee;font-weight:bold}
      .firmas{display:flex;justify-content:space-between;margin-top:70px}.firmas div{border-top:1px solid #333;width:40%;text-align:center;padding-top:6px}@media print{button{display:none}}</style></head><body>
      <div class="top"><div><h1>TUTU AUTOMOTORES</h1><div>Resumen de operación</div></div><div>${esc(fmtDate(r.FECHA || ''))}<br>Estado: <b>${esc(r['ESTADO_OPERACIÓN'] || '')}</b></div></div>
      ${sec('Cliente', [['Cliente', 'DEUDOR'], ['CUIL', 'DNI'], ['Teléfono', 'TEL']])}
      ${sec('Vehículo', [['Dominio', 'DOMINIO'], ['Marca', 'MARCA'], ['Modelo', 'MODELO'], ['Año', 'AÑO'], ['Color', 'COLOR']])}
      ${sec('Operación', [['Tipo', 'TIPO_OPERACIÓN'], ['Moneda', 'MONEDA'], ['Valor venta', 'IMPORTE_TOTAL'], ['Valor contado', 'VALOR_CONTADO'], ['Cotización USD', 'TC'], ['Valor USD', 'VALOR_USD'], ['Vendedor', 'VENDEDOR'], ['Sucursal', 'SUCURSAL']])}
      ${r.OBSERVACIONES ? `<h2>Observaciones</h2><p>${esc(r.OBSERVACIONES)}</p>` : ''}
      <div class="firmas"><div>Firma cliente</div><div>Firma TUTU AUTOMOTORES</div></div>
      <p><button onclick="print()">Imprimir / Guardar PDF</button></p></body></html>`);
    w.document.close(); setTimeout(() => { try { w.print(); } catch (e) {} }, 400);
  }

  // ---------- Bienvenida / carga inicial ----------
  function renderWelcome(m) {
    m.innerHTML = `<div class="welcome"><h2>Panel vacío</h2>
      <p>Todavía no hay datos cargados. Subí el archivo <strong>panel-datos.json.gz</strong> (el respaldo que se generó desde AppSheet) para cargar las dos apps de una vez.</p>
      <p class="note" style="color:var(--muted)">La primera carga pide la contraseña de Ventas (<strong>Tutu2026</strong>): al elegir el archivo te la va a preguntar.</p>
      <div class="drop" id="drop" tabindex="0" role="button" aria-label="Elegir archivo"><i data-lucide="upload-cloud" aria-hidden="true"></i><p>Arrastrá el archivo acá o tocá para elegirlo</p></div>
      <input type="file" id="seedFile" accept=".gz,.json" class="sr-only">
      <div id="seedProgress"></div></div>`;
    const inp = $('#seedFile'); const drop = $('#drop');
    drop.onclick = () => inp.click(); drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) subirSeed(e.dataTransfer.files[0]); };
    inp.onchange = () => inp.files[0] && subirSeed(inp.files[0]);
    icons();
  }
  async function subirSeed(file, reemplazar) {
    if (!S.logged) { S.pendAction = () => subirSeed(file, reemplazar); showGate(null); return; }
    const p = $('#seedProgress'); if (p) p.innerHTML = '<div class="progress"><div></div></div><p class="note" style="color:var(--muted);text-align:center">Subiendo y cargando… puede tardar un minuto.</p>';
    try {
      const buf = await file.arrayBuffer();
      const res = await api('/api/seed' + (reemplazar ? '?reemplazar=1' : ''), { method: 'POST', body: buf });
      toast(`Cargadas ${nf0.format(res.filas)} filas en ${res.tablas} tablas`);
      S.cache = {}; resetIdx(); S.me = await api('/api/me'); S.counts = S.me.counts || {};
      location.hash = '#/' + ALL_VIEWS[0].id; render();
    } catch (e) { if (p) p.innerHTML = `<p class="err">${esc(e.message)}</p>`; toast(e.message); }
  }

  // ---------- Datos y respaldo ----------
  function renderDatos(m, v) {
    const total = totalRows();
    m.innerHTML = head(v, '') + `<div class="admin-wrap"><div class="admin">
      <section><h3>Estado</h3><p class="note">Almacenamiento: <strong>${esc(S.me.almacenamiento || '—')}</strong>. Total de registros: <strong>${nf0.format(total)}</strong> en ${Object.keys(META).length} tablas.</p></section>
      <section><h3>Respaldo</h3><p class="note">Descargá una copia completa de todos los datos (comprimida). Sirve para guardar o para mover a otra instancia.</p><div class="row-f"><button class="btn primary" id="dlBackup"><i data-lucide="download" aria-hidden="true"></i>Descargar respaldo</button></div></section>
      <section><h3>Cargar datos</h3><p class="note">Subí un <strong>panel-datos.json.gz</strong> o un respaldo. Con la base vacía carga directo; con datos, reemplaza todo (pedí confirmación).</p>
        <input type="file" id="seedFile2" accept=".gz,.json" class="sr-only"><div class="row-f"><button class="btn" id="pickSeed"><i data-lucide="upload" aria-hidden="true"></i>Elegir archivo</button></div><div id="seedProgress"></div></section>
    </div></div>`;
    $('#dlBackup').onclick = async () => { const b = $('#dlBackup'); b.disabled = true; try { const r = await fetch('/api/backup', { credentials: 'same-origin' }); const blob = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `panel-respaldo-${today()}.json.gz`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch (e) { toast('No se pudo generar el respaldo'); } finally { b.disabled = false; } };
    const inp = $('#seedFile2');
    $('#pickSeed').onclick = () => inp.click();
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; if (total > 0) confirmBox('Reemplazar todos los datos', 'Esto <strong>borra todo</strong> lo que hay ahora y lo reemplaza por el archivo. ¿Seguir?', 'Reemplazar todo', async () => { closeModal(); await subirSeed(f, true); }); else subirSeed(f); };
    icons();
  }

  // Arranque
  (async () => {
    try {
      const me = await api('/api/me'); S.me = me; S.counts = me.counts || {}; S.logged = !!me.logged; S.protected = new Set(me.protegidas || []);
      $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
      const nombre = me.nombre || quienLocal(); $('#userBtn').textContent = (nombre || 'P')[0].toUpperCase(); $('#userBtn').title = me.logged ? ('Ventas: ' + me.nombre) : 'Zona libre';
      buildNav(); if (!location.hash) location.hash = '#/' + ALL_VIEWS.find((v) => !gated(v)).id; else route();
    } catch (e) { $('#main') && ($('#main').innerHTML = `<div class="empty"><p>No se pudo conectar: ${esc(e.message)}</p></div>`); $('#app').classList.remove('hidden'); $('#login').classList.add('hidden'); }
  })();
})();
