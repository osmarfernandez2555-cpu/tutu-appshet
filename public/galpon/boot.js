/* Cargador en vivo: trae los datos reales del Panel App Ventas (mismo servidor),
   los adapta a lo que esperan los agentes, y recién ahí arranca el mundo 3D. */
(function () {
  const N = (x) => { const n = Number(x); return isNaN(n) ? 0 : n; };
  async function api(url, opts) {
    const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...(opts || {}), body: opts && opts.body ? JSON.stringify(opts.body) : undefined });
    if (!r.ok) { let e; try { e = (await r.json()).error; } catch (x) {} const err = new Error(e || ('Error ' + r.status)); err.status = r.status; throw err; }
    return r.json();
  }
  const get = (t) => api('/api/t/' + encodeURIComponent(t));

  function fatal(msg) { document.getElementById('loading').innerHTML = `<div class="l" style="max-width:420px"><p style="color:#f87171;font-size:15px">${msg}</p><a href="/" style="color:#f0a;display:inline-block;margin-top:12px">← Volver al panel</a></div>`; }

  // Pedido de contraseña (sección Ventas) reutilizando el login del panel
  function gate(msg) {
    return new Promise((resolve) => {
      const d = document.createElement('div'); d.id = 'galpon-gate';
      d.style.cssText = 'position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:#070b14;padding:16px;font-family:Fira Sans,system-ui,sans-serif';
      d.innerHTML = `<form style="background:#0f1626;border:1px solid #223049;border-radius:14px;padding:28px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px;color:#e8edf5">
        <h2 style="margin:0;font-size:19px">Galpón 3D · Ventas</h2>
        <p style="margin:0;color:#9fb0c6;font-size:13px">${msg || 'Ingresá la contraseña del panel para ver los datos.'}</p>
        <input name="password" type="password" placeholder="Contraseña" autocomplete="current-password" style="padding:11px 12px;border:1px solid #2e3f5c;border-radius:8px;background:#0c1322;color:#fff;font-size:16px">
        <input name="nombre" type="text" placeholder="Tu nombre o email" style="padding:11px 12px;border:1px solid #2e3f5c;border-radius:8px;background:#0c1322;color:#fff;font-size:15px">
        <button type="submit" style="background:#db2777;border:0;color:#fff;padding:12px;border-radius:8px;font-size:15px;cursor:pointer">Ingresar</button>
        <p class="err" style="color:#f87171;margin:0;min-height:16px;font-size:13px"></p></form>`;
      document.body.appendChild(d);
      const f = d.querySelector('form');
      f.onsubmit = async (e) => {
        e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Ingresando…';
        try { await api('/api/login', { method: 'POST', body: { password: f.password.value, nombre: f.nombre.value } }); try { localStorage.setItem('panel-nombre', f.nombre.value || ''); } catch (x) {} d.remove(); resolve(); }
        catch (err) { f.querySelector('.err').textContent = err.message; b.disabled = false; b.textContent = 'Ingresar'; }
      };
      try { f.nombre.value = localStorage.getItem('panel-nombre') || ''; } catch (x) {}
      setTimeout(() => f.password.focus(), 50);
    });
  }

  function helpers(DATA) {
    DATA.sum = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    DATA.countBy = (arr, k) => { const m = {}; for (const r of arr) { const v = r[k] || '(vacío)'; m[v] = (m[v] || 0) + 1; } return m; };
    DATA.sumBy = (arr, k, val) => { const m = {}; for (const r of arr) { const v = r[k] || '(vacío)'; m[v] = (m[v] || 0) + (Number(r[val]) || 0); } return m; };
    DATA.mes = (s) => String(s || '').slice(0, 7);
    DATA.delMes = (arr, k) => arr.filter((r) => DATA.mes(r[k] || '') === DATA.MES_ACTUAL);
  }

  const PERSONAS = [
    { nombre: 'Adrián', rol: 'CEO', area: 'Dirección', genero: 'M' },
    { nombre: 'Jorge', rol: 'Jefe de Ventas', area: 'Ventas', genero: 'M' },
    { nombre: 'Luciano', rol: 'Vendedor', area: 'Ventas', genero: 'M' },
    { nombre: 'Ariel', rol: 'Vendedor', area: 'Ventas', genero: 'M' },
    { nombre: 'Ismael', rol: 'Vendedor', area: 'Ventas', genero: 'M' },
    { nombre: 'José', rol: 'Vendedor', area: 'Sucursal San Francisco', genero: 'M' },
    { nombre: 'Fabricio', rol: 'Encargado de Créditos', area: 'Créditos', genero: 'M' },
    { nombre: 'Ruth', rol: 'Fotos y Publicaciones', area: 'Marketing', genero: 'F' },
    { nombre: 'Mariana', rol: 'Gestoría y Entregas', area: 'Gestoría', genero: 'F' },
    { nombre: 'Piki', rol: 'Recursos Humanos', area: 'RRHH', genero: 'F' },
    { nombre: 'Franco', rol: 'Contable · Taller y Posventa', area: 'Contable', genero: 'M' },
    { nombre: 'Cone', rol: 'Peritaje · Proyectos', area: 'Peritaje', genero: 'M' },
    { nombre: 'Mariana', rol: 'Limpieza', area: 'Limpieza', genero: 'F' },
    { nombre: 'Maxi', rol: 'Mecánico', area: 'Taller · Mecánica', genero: 'M' },
    { nombre: 'Mercau', rol: 'Lavado y pulido', area: 'Taller · Lavado', genero: 'M' },
  ];

  async function buildData() {
    const [carga, fp, calc, gest, ent, per, comp, caja, pos] = await Promise.all([
      get('CARGA'), get('FORMA DE PAGO'), get('CALCULADOR'), get('GESTORIA'), get('ENTREGA'), get('PERITAJE'), get('COMPRAS'), get('CAJA_COMPRAS'), get('POSVENTA'),
    ]);
    const ventas = carga.map((r) => ({
      DOMINIO: r.DOMINIO, FECHA: r.FECHA, FECHA_IMPUTACION: r.FECHA_IMPUTACION || r.FECHA, DEUDOR: r.DEUDOR,
      MARCA: r.MARCA, MODELO: r.MODELO, 'AÑO': r['AÑO'], IMPORTE_TOTAL: N(r.IMPORTE_TOTAL), COSTO: N(r.COSTO),
      MARGEN: N(r.IMPORTE_TOTAL) - N(r.COSTO), 'ESTADO_OPERACIÓN': r['ESTADO_OPERACIÓN'], VENDEDOR: r.VENDEDOR,
      DATO: r.DATO, MONEDA: r.MONEDA, TC: N(r.TC), PAGADO: r.PAGADO, SUCURSAL: r.SUCURSAL || 'POLO 52',
    }));
    const esCred = (mp) => /BANCO|CREDITO|CRÉDITO|PRENDA|FINANC|PAGARE|PAGARÉ|LEASING|UVA/i.test(mp || '');
    const creditos = fp.filter((r) => esCred(r.ID_MP)).map((r) => ({
      DOMINIO: r.DOMINIO, CLIENTE: r.CLIENTE, BANCO: r.ID_MP, IMPORTE: N(r.IMPORTE), ESTADO: r.ESTADO || 'NO SOLICITADO',
      COBRADO: r.COBRADO, VENDEDOR: r.VENDEDOR, FECHA: r.FECHA, DIAS_PRENDA: N(r['DIAS DE DE PRENDA']),
    }));
    const stock = calc.map((r) => ({
      DOMINIO: r.DOMINIO, MARCA: r.MARCA, VEHICULO: r.VEHICULO, 'AÑO': r['AÑO'], ESTADO: r.ESTADO, CONTADO: N(r.CONTADO),
      PROPIETARIO: r.PROPIETARIO, DIAS_STOCK: N(r['DIAS EN STOCK']), PERITAR: r.PERITAR, FOTOS: r.FOTOS, WEB: r.WEB,
      MELI: r.MELI, FACE: r.FACE, SEGMENTO: r.SEGMENTO, 'DÓNDE ESTÁ': r['DÓNDE ESTÁ'],
    }));
    const gestoria = gest.map((r) => ({ DOMINIO: r.DOMINIO, 'NOMBRE CLIENTE': r['NOMBRE CLIENTE'], ESTADO_GESTORIA: r.ESTADO_GESTORIA, TOTAL: N(r.TOTAL), COBRADO_CLIENTE: N(r.COBRADO_CLIENTE), FECHA: r.FECHA }));
    const entregas = ent.map((r) => ({ DOMINIO: r.DOMINIO, CLIENTE: r.CLIENTE, VENDEDOR: r.VENDEDOR, ESTADO_OPERACION: r.ESTADO_OPERACION, MECANICA: r.MECANICA, ESTETICA: r.ESTETICA, GESTORIA: r.GESTORIA, FECHA: r.FECHA }));
    const peritaje = per.map((r) => ({ DOMINIO: r.DOMINIO, VEHICULO: r.VEHICULO, ESTADO: r.ESTADO_CALCULADOR || r.ESTADO || '', PRESUPUESTO: N(r.PRESUPUESTO_FINAL), COMPRAS: N(r.COMPRAS), DIF: N(r['DIF PERITAJE - COMPRAS']), FECHA: r.FECHA, RECOMIENDA: r['RECOMIENDA _TOMA'] }));
    const compras = comp.map((r) => ({ FECHA: r.FECHA, CONCEPTO: r.CONCEPTO, IMPORTE: N(r.IMPORTE), TIPO_PAGO: r['TIPO DE PAGO'], DOMINIO: r.DOMINIO }));
    const cajaArr = caja.map((r) => ({ FECHA: r.FECHA, CUENTA: r['CONCILICACION CAJA'] || r.CAJA || 'CAJA', IMPORTE: N(r.IMPORTE) }));
    const posventa = pos.map((r) => ({ DOMINIO: r.DOMINIO, DESCRIPCION: r.DESCRIPCION, COSTO_TUTU: N(r.COSTO_TUTU), ESTADO: r.ESTADO, FECHA: r.FECHA }));
    const now = new Date(); const MES_ACTUAL = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const DATA = {
      hoy: now.toISOString().slice(0, 10), MES_ACTUAL, VENDEDORES: [...new Set(ventas.map((v) => v.VENDEDOR).filter(Boolean))],
      ventas, creditos, stock, gestoria, entregas, peritaje, compras, caja: cajaArr, posventa, personas: PERSONAS,
    };
    helpers(DATA); return DATA;
  }

  function inject(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.body.appendChild(s); }); }

  (async function () {
    try {
      let me = await api('/api/me');
      if (!me.logged) await gate();
      window.DATA = await buildData();
      await inject('world.js'); await inject('agents.js'); await inject('app.js');
    } catch (e) {
      if (e.status === 401) { try { await gate('La sesión venció. Ingresá la contraseña de nuevo.'); window.DATA = await buildData(); await inject('world.js'); await inject('agents.js'); await inject('app.js'); return; } catch (e2) { fatal(e2.message); return; } }
      fatal('No se pudieron cargar los datos: ' + e.message);
    }
  })();
})();
