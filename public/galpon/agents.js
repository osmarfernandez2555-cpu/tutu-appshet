/* Oficinas (layout 3D) + agentes con informes desde datos. */
(function (root) {
  const D = root.DATA;
  const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
  const M = (n) => '$' + nf0.format(Math.round(n || 0));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- helpers de render (devuelven HTML) ----
  const H = {
    msg: (title, inner) => `<div class="msg">${title ? `<h4>${esc(title)}</h4>` : ''}${inner}</div>`,
    kpis: (arr) => `<div class="kpis">${arr.map(([t, v]) => `<div class="kpi"><div class="t">${esc(t)}</div><div class="v">${v}</div></div>`).join('')}</div>`,
    table: (head, rows) => `<table class="rep"><thead><tr>${head.map((h) => `<th class="${h.n ? 'n' : ''}">${esc(h.t || h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${head[i] && head[i].n ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    bars: (pairs, fmt) => { const max = Math.max(1, ...pairs.map((p) => p[1])); return `<div class="bars">${pairs.map(([l, v]) => `<div class="bar-row"><span class="lab">${esc(l)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(100 * v / max)}%"></div></div><span class="val">${(fmt || nf0.format)(v)}</span></div>`).join('')}</div>`; },
    pend: (items) => items.length ? `<ul class="pend">${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p style="color:var(--ink-2)">Nada pendiente por acá 👍</p>',
    diagram: (nodes) => `<div class="diagram">${nodes.map((n, i) => `${i ? '<span class="arrow">→</span>' : ''}<div class="node"><div class="n">${n.n}</div><div class="l">${esc(n.l)}</div></div>`).join('')}</div>`,
    tag: (txt, cls) => `<span class="tag t-${cls}">${esc(txt)}</span>`,
  };

  const ESTADO_CLS = { ENTREGADO: 'green', LIQUIDADO: 'blue', 'EN PROCESO': 'amber', 'SEÑADO': 'amber', PREVENTA: 'gray', CAIDO: 'red' };

  // ====== Agentes ======
  const AGENTS = {
    ventas: {
      name: 'Jorge', role: 'Jefe de Ventas', color: '#db2777', soft: '#3b0a24',
      keywords: ['venta', 'vendedor', 'vendi', 'facturacion', 'facturado', 'margen', 'cliente', 'operacion', 'caida', 'caído', 'caido', 'embudo', 'preventa', 'señado', 'senado', 'cierre', 'jorge', 'luciano', 'ariel', 'ismael', 'polo 52', 'equipo de ventas'],
      hello: 'Soy Jorge, jefe de ventas (Polo 52). Mi equipo es Luciano, Ariel e Ismael. ¿Qué querés ver?',
      sucursal: 'POLO 52',
      actions: [
        ['Ventas del mes', () => {
          const m = D.delMes(D.ventas, 'FECHA_IMPUTACION').filter((v) => v.SUCURSAL !== 'SAN FRANCISCO');
          const fact = D.sum(m, 'IMPORTE_TOTAL'), marg = D.sum(m, 'MARGEN');
          const porVend = Object.entries(D.sumBy(m, 'VENDEDOR', 'MARGEN')).filter((x) => x[0] && x[0] !== '(vacío)').sort((a, b) => b[1] - a[1]).slice(0, 8);
          return H.msg('Ventas del mes', H.kpis([['Operaciones', m.length], ['Facturado', M(fact)], ['Margen', M(marg)], ['Margen %', fact ? (marg / fact * 100).toFixed(1) + '%' : '—']])) +
            H.msg('Margen por vendedor', H.bars(porVend.length ? porVend : [['—', 0]], M));
        }],
        ['Ranking vendedores', () => {
          const base = D.ventas.filter((v) => v.SUCURSAL !== 'SAN FRANCISCO');
          const vends = [...new Set(base.map((v) => v.VENDEDOR).filter(Boolean))];
          const rows = vends.map((v) => { const vs = base.filter((x) => x.VENDEDOR === v); return [v, vs.length, D.sum(vs, 'IMPORTE_TOTAL'), D.sum(vs, 'MARGEN')]; }).sort((a, b) => b[3] - a[3]).slice(0, 12);
          return H.msg('Ranking de vendedores', H.table([{ t: 'Vendedor' }, { t: 'Ops', n: 1 }, { t: 'Facturado', n: 1 }, { t: 'Margen', n: 1 }], rows.map((r) => [esc(r[0]), r[1], M(r[2]), M(r[3])])));
        }],
        ['Embudo', () => {
          const by = D.countBy(D.ventas.filter((v) => v.SUCURSAL !== 'SAN FRANCISCO'), 'ESTADO_OPERACIÓN');
          const order = ['PREVENTA', 'SEÑADO', 'EN PROCESO', 'LIQUIDADO', 'ENTREGADO', 'CAIDO'];
          return H.msg('Embudo de ventas', H.diagram(order.slice(0, 5).map((e) => ({ n: by[e] || 0, l: e }))) + '<div style="height:10px"></div>' + H.bars(order.map((e) => [e, by[e] || 0]))); }],
        ['Pendientes', () => {
          const p = D.ventas.filter((v) => v.SUCURSAL !== 'SAN FRANCISCO' && ['PREVENTA', 'SEÑADO', 'EN PROCESO'].includes(v['ESTADO_OPERACIÓN']));
          return H.msg('En qué estamos trabajando', H.pend(p.slice(0, 12).map((v) => `${H.tag(v['ESTADO_OPERACIÓN'], ESTADO_CLS[v['ESTADO_OPERACIÓN']])} <b>${esc(v.DOMINIO)}</b> ${esc(v.MARCA)} ${esc(v.MODELO)} · ${esc(v.DEUDOR)} · ${M(v.IMPORTE_TOTAL)} (${esc(v.VENDEDOR)})`)) +
            `<p style="color:var(--ink-2);margin-top:8px">${p.length} operaciones abiertas.</p>`);
        }],
        ['Caídas', () => { const c = D.ventas.filter((v) => v.SUCURSAL !== 'SAN FRANCISCO' && v['ESTADO_OPERACIÓN'] === 'CAIDO'); return H.msg('Operaciones caídas', H.pend(c.slice(0, 12).map((v) => `<b>${esc(v.DOMINIO)}</b> ${esc(v.MARCA)} ${esc(v.MODELO)} · ${esc(v.DEUDOR)} · ${M(v.IMPORTE_TOTAL)}`))); }],
      ],
    },
    sucursal: {
      name: 'José', role: 'Vendedor · Sucursal San Francisco', color: '#14b8a6', soft: '#042f2a',
      keywords: ['jose', 'josé', 'sucursal', 'san francisco', 'otra sucursal', 'segunda sucursal', 'galpon 2', 'galpón 2'],
      hello: 'Soy José, vendo en la sucursal de San Francisco. Te paso mis operaciones.',
      actions: [
        ['Ventas del mes', () => {
          const m = D.delMes(D.ventas, 'FECHA_IMPUTACION').filter((v) => v.SUCURSAL === 'SAN FRANCISCO');
          return H.msg('Ventas del mes · San Francisco', H.kpis([['Operaciones', m.length], ['Facturado', M(D.sum(m, 'IMPORTE_TOTAL'))], ['Margen', M(D.sum(m, 'MARGEN'))], ['Sucursal', 'San Francisco']]));
        }],
        ['Histórico', () => { const vs = D.ventas.filter((v) => v.SUCURSAL === 'SAN FRANCISCO'); return H.msg('Histórico San Francisco', H.kpis([['Operaciones', vs.length], ['Facturado', M(D.sum(vs, 'IMPORTE_TOTAL'))], ['Margen', M(D.sum(vs, 'MARGEN'))], ['Entregadas', vs.filter((v) => v['ESTADO_OPERACIÓN'] === 'ENTREGADO').length]])); }],
        ['Pendientes', () => { const p = D.ventas.filter((v) => v.SUCURSAL === 'SAN FRANCISCO' && ['PREVENTA', 'SEÑADO', 'EN PROCESO'].includes(v['ESTADO_OPERACIÓN'])); return H.msg('En qué estamos trabajando', H.pend(p.slice(0, 12).map((v) => `${H.tag(v['ESTADO_OPERACIÓN'], ESTADO_CLS[v['ESTADO_OPERACIÓN']])} <b>${esc(v.DOMINIO)}</b> ${esc(v.MARCA)} ${esc(v.MODELO)} · ${esc(v.DEUDOR)} · ${M(v.IMPORTE_TOTAL)}`))); }],
      ],
    },
    creditos: {
      name: 'Fabricio', role: 'Encargado de Créditos', color: '#60a5fa', soft: '#0c1f45',
      keywords: ['credito', 'crédito', 'prenda', 'prendario', 'banco', 'cuota', 'financiacion', 'financiación', 'cobrado', 'fabricio'],
      hello: 'Soy Fabricio, de créditos. Te muestro cómo vienen las prendas y financiaciones.',
      actions: [
        ['Por estado', () => H.msg('Créditos por estado', H.bars(Object.entries(D.countBy(D.creditos, 'ESTADO')).sort((a, b) => b[1] - a[1])))],
        ['Por banco', () => { const b = D.sumBy(D.creditos, 'BANCO', 'IMPORTE'); return H.msg('Monto por banco', H.bars(Object.entries(b).sort((a, b) => b[1] - a[1]), M)); }],
        ['Pendientes de carga', () => { const p = D.creditos.filter((c) => ['NO SOLICITADO', 'SOLICITADO', 'INCOMPLETO'].includes(c.ESTADO)); return H.msg('Pendientes', H.pend(p.slice(0, 10).map((c) => `${H.tag(c.ESTADO, c.ESTADO === 'INCOMPLETO' ? 'amber' : 'gray')} <b>${esc(c.DOMINIO)}</b> ${esc(c.CLIENTE)} · ${esc(c.BANCO)} · ${M(c.IMPORTE)}`))); }],
        ['Cobrados vs no', () => { const y = D.creditos.filter((c) => c.COBRADO === 'Y'); const n = D.creditos.filter((c) => c.COBRADO !== 'Y'); return H.msg('Cobranza', H.kpis([['Cobrados', y.length], ['Monto cobrado', M(D.sum(y, 'IMPORTE'))], ['Sin cobrar', n.length], ['Monto a cobrar', M(D.sum(n, 'IMPORTE'))]])); }],
      ],
    },
    marketing: {
      name: 'Ruth', role: 'Fotos y Publicaciones', color: '#c084fc', soft: '#2a0f45',
      keywords: ['foto', 'fotos', 'publicacion', 'publicación', 'publicar', 'web', 'meli', 'mercado libre', 'face', 'facebook', 'instagram', 'marketing', 'ruth', 'aviso'],
      hello: 'Hola, soy Ruth. Me encargo de las fotos y publicaciones del stock.',
      actions: [
        ['Estado publicaciones', () => { const st = D.stock.filter((s) => s.ESTADO === 'INGRESADO'); const pct = (k) => st.length ? Math.round(100 * st.filter((s) => s[k] === 'SI').length / st.length) : 0; return H.msg('Publicado sobre stock activo (' + st.length + ')', H.kpis([['Con fotos', pct('FOTOS') + '%'], ['En Web', pct('WEB') + '%'], ['En MercadoLibre', pct('MELI') + '%'], ['En Facebook', pct('FACE') + '%']])); }],
        ['Sin fotos', () => { const p = D.stock.filter((s) => s.ESTADO === 'INGRESADO' && s.FOTOS !== 'SI'); return H.msg('Autos sin fotos', H.pend(p.slice(0, 12).map((s) => `<b>${esc(s.DOMINIO)}</b> ${esc(s.MARCA)} ${esc(s.VEHICULO)} · ${esc(s['DÓNDE ESTÁ'])}`))); }],
        ['Pendientes de publicar', () => { const p = D.stock.filter((s) => s.ESTADO === 'INGRESADO' && (s.WEB !== 'SI' || s.MELI !== 'SI')); return H.msg('Faltan subir', H.pend(p.slice(0, 12).map((s) => `<b>${esc(s.DOMINIO)}</b> ${esc(s.MARCA)} ${esc(s.VEHICULO)} ${s.WEB !== 'SI' ? H.tag('sin web', 'amber') : ''} ${s.MELI !== 'SI' ? H.tag('sin MeLi', 'gray') : ''}`))); }],
      ],
    },
    direccion: {
      name: 'Adrián', role: 'CEO', color: '#22d3ee', soft: '#083344',
      keywords: ['ceo', 'adrian', 'adrián', 'resumen general', 'kpi', 'rentabilidad', 'global', 'empresa', 'agencia', 'direccion', 'dirección', 'foto de la agencia', 'facturacion por mes', 'facturación por mes'],
      hello: 'Soy Adrián, CEO. Te doy la foto general de la agencia.',
      actions: [
        ['Resumen general', () => {
          const stockAct = D.stock.filter((s) => s.ESTADO === 'INGRESADO');
          const m = D.delMes(D.ventas, 'FECHA_IMPUTACION');
          const ing = D.sum(D.caja, 'IMPORTE'), egr = D.sum(D.compras, 'IMPORTE');
          return H.msg('Foto de la agencia', H.kpis([['Stock activo', stockAct.length + ' autos'], ['Ventas del mes', m.length], ['Facturado mes', M(D.sum(m, 'IMPORTE_TOTAL'))], ['Margen mes', M(D.sum(m, 'MARGEN'))], ['Ingresos caja', M(ing)], ['Egresos compras', M(egr)]])) +
            H.msg('Flujo de una venta', H.diagram([{ n: '1', l: 'Ingreso' }, { n: '2', l: 'Peritaje' }, { n: '3', l: 'Publicación' }, { n: '4', l: 'Venta' }, { n: '5', l: 'Gestoría' }, { n: '6', l: 'Entrega' }]));
        }],
        ['Ventas por mes', () => { const by = D.sumBy(D.ventas, null, 'MARGEN'); const mm = {}; D.ventas.forEach((v) => { const k = D.mes(v.FECHA_IMPUTACION); mm[k] = (mm[k] || 0) + v.IMPORTE_TOTAL; }); const pairs = Object.entries(mm).sort().slice(-6); return H.msg('Facturación por mes', H.bars(pairs, M)); }],
        ['Rentabilidad', () => { const f = D.sum(D.ventas, 'IMPORTE_TOTAL'), mg = D.sum(D.ventas, 'MARGEN'); return H.msg('Rentabilidad (histórico)', H.kpis([['Facturado total', M(f)], ['Margen total', M(mg)], ['Margen %', (mg / f * 100).toFixed(1) + '%'], ['Ticket promedio', M(f / D.ventas.length)]])); }],
      ],
    },
    gestoria: {
      name: 'Mariana', role: 'Gestoría y Entregas', color: '#fbbf24', soft: '#3a2405',
      keywords: ['gestoria', 'gestoría', 'tramite', 'trámite', 'transferencia', 'patente', 'documentacion', 'documentación', 'entrega', 'entregas', 'mariana', 'prenda cancelacion'],
      hello: 'Soy Mariana, gestoría y entregas. Te muestro los trámites y entregas.',
      actions: [
        ['Gestorías por estado', () => H.msg('Trámites por estado', H.bars(Object.entries(D.countBy(D.gestoria, 'ESTADO_GESTORIA')).sort()))],
        ['Entregas pendientes', () => { const p = D.entregas.filter((e) => e.ESTADO_OPERACION !== 'ENTREGADO'); return H.msg('Entregas en curso', H.pend(p.slice(0, 10).map((e) => `<b>${esc(e.DOMINIO)}</b> ${esc(e.CLIENTE)} · Mec ${e.MECANICA === 'APROBADO' ? '✅' : '⏳'} Est ${e.ESTETICA === 'APROBADO' ? '✅' : '⏳'} Gest ${e.GESTORIA === 'APROBADO' ? '✅' : '⏳'}`))); }],
        ['Cobranza gestoría', () => { const tot = D.sum(D.gestoria, 'TOTAL'), cob = D.sum(D.gestoria, 'COBRADO_CLIENTE'); return H.msg('Cobranza de trámites', H.kpis([['Total gestoría', M(tot)], ['Cobrado', M(cob)], ['Saldo', M(tot - cob)], ['Trámites', D.gestoria.length]])); }],
      ],
    },
    rrhh: {
      name: 'Piki', role: 'Recursos Humanos', color: '#4ade80', soft: '#052e16',
      keywords: ['rrhh', 'recursos humanos', 'personal', 'empleado', 'equipo', 'dotacion', 'dotación', 'piki', 'gente', 'quien', 'quién'],
      hello: 'Hola, soy Piki, de RRHH. Te paso cómo está el equipo.',
      actions: [
        ['Dotación', () => { const by = {}; D.personas.forEach((p) => { (by[p.area] = by[p.area] || []).push(p); }); return H.msg('Equipo por área', H.table([{ t: 'Área' }, { t: 'Personas', n: 1 }, { t: 'Quiénes' }], Object.entries(by).map(([a, arr]) => [esc(a), arr.length, arr.map((p) => esc(p.nombre)).join(', ')]))); }],
        ['Equipo de ventas', () => { const v = D.personas.filter((p) => p.area === 'Ventas'); return H.msg('Área de ventas', H.pend(v.map((p) => `${p.genero === 'F' ? '👩' : '👨'} <b>${esc(p.nombre)}</b> · ${esc(p.rol)}`))); }],
        ['Dotación total', () => H.msg('Resumen', H.kpis([['Total personas', D.personas.length], ['Mujeres', D.personas.filter((p) => p.genero === 'F').length], ['Varones', D.personas.filter((p) => p.genero === 'M').length], ['Áreas', new Set(D.personas.map((p) => p.area)).size]]))],
      ],
    },
    contable: {
      name: 'Franco', role: 'Contable · Taller y Posventa', color: '#fb923c', soft: '#3b1a06',
      keywords: ['contable', 'contabilidad', 'ingreso', 'egreso', 'caja', 'dinero', 'plata', 'conciliacion', 'conciliación', 'compra', 'compras', 'gasto', 'gastos', 'franco', 'taller', 'posventa', 'post venta', 'combustible'],
      hello: 'Soy Franco. Llevo lo contable (ingresos/egresos) y el taller/posventa.',
      actions: [
        ['Ingresos vs egresos', () => { const ing = D.sum(D.caja, 'IMPORTE'), egr = D.sum(D.compras, 'IMPORTE'); return H.msg('Caja', H.kpis([['Ingresos', M(ing)], ['Egresos', M(egr)], ['Diferencia', M(ing - egr)], ['Movimientos', D.caja.length + D.compras.length]])); }],
        ['Compras por concepto', () => H.msg('Egresos por concepto', H.bars(Object.entries(D.sumBy(D.compras, 'CONCEPTO', 'IMPORTE')).sort((a, b) => b[1] - a[1]), M))],
        ['Compras por mes', () => { const mm = {}; D.compras.forEach((c) => { const k = D.mes(c.FECHA); mm[k] = (mm[k] || 0) + c.IMPORTE; }); return H.msg('Egresos por mes', H.bars(Object.entries(mm).sort().slice(-6), M)); }],
        ['Taller / Posventa', () => { const p = D.posventa.filter((x) => x.ESTADO !== 'RESUELTO'); return H.msg('Posventa abierta', H.pend(p.map((x) => `<b>${esc(x.DOMINIO)}</b> ${esc(x.DESCRIPCION)} · ${M(x.COSTO_TUTU)} ${H.tag(x.ESTADO, 'amber')}`))); }],
      ],
    },
    peritaje: {
      name: 'Cone', role: 'Peritaje · Proyectos', color: '#f87171', soft: '#3f0d0d',
      keywords: ['peritaje', 'peritar', 'presupuesto', 'mecanica', 'mecánica', 'estetica', 'estética', 'cubiertas', 'arreglo', 'proyecto', 'implementacion', 'implementación', 'cone', 'alistaje'],
      hello: 'Soy Cone, peritaje e implementaciones. Te muestro arreglos y proyectos.',
      actions: [
        ['Por realizar', () => { const p = D.stock.filter((s) => s.PERITAR === 'POR PERITAR'); return H.msg('Peritajes por realizar', H.pend(p.slice(0, 12).map((s) => `<b>${esc(s.DOMINIO)}</b> ${esc(s.MARCA)} ${esc(s.VEHICULO)} · ${esc(s['DÓNDE ESTÁ'])}`))); }],
        ['Presupuesto vs compras', () => { const rows = D.peritaje.slice(0, 10).map((p) => [esc(p.DOMINIO), M(p.PRESUPUESTO), M(p.COMPRAS), `<span style="color:${p.DIF < 0 ? 'var(--red)' : 'var(--green)'}">${M(p.DIF)}</span>`]); return H.msg('Presupuesto vs gastado', H.table([{ t: 'Dominio' }, { t: 'Presup.', n: 1 }, { t: 'Compras', n: 1 }, { t: 'Dif', n: 1 }], rows)); }],
        ['Proyectos', () => H.msg('Implementaciones en curso', H.pend(['🟢 Panel App Ventas — <b>en producción</b>', '🟡 Galpón 3D con agentes — <b>en construcción</b>', '🟡 Conectar agentes al panel real — pendiente', '⚪ Bot de grupos de reventa — en análisis']) + H.msg('Pipeline', H.diagram([{ n: '1', l: 'Idea' }, { n: '2', l: 'Prototipo' }, { n: '3', l: 'Prueba' }, { n: '4', l: 'Producción' }])))],
      ],
    },
  };

  // Intenciones genéricas que cualquier agente entiende
  function generic(agent, text) {
    const t = text.toLowerCase();
    if (/pendiente|pendientes|trabajando|haciendo|en que|en qué|prioridad/.test(t)) {
      const act = agent.actions.find((a) => /pendiente|por realizar|pendientes|entregas pendientes|taller/i.test(a[0])); if (act) return act[1]();
    }
    if (/informe|resumen|estado|como|cómo|reporte|tabla/.test(t)) return agent.actions[0][1]();
    return null;
  }

  // Oficinas en el galpón (layout + personas)
  const AREAS = [
    { id: 'ventas', color: 0xdb2777, pos: { x: -11, z: 6 }, size: { w: 11, d: 10 }, people: [{ genero: 'M', name: 'Luciano' }, { genero: 'M', name: 'Ariel' }, { genero: 'M', name: 'Ismael' }], walker: { genero: 'M', name: 'Jorge', color: 0xdb2777 } },
    { id: 'sucursal', color: 0x14b8a6, pos: { x: 30, z: 4 }, size: { w: 10, d: 9 }, galpon2: true, people: [{ genero: 'M', color: 0x14b8a6 }] },
    { id: 'creditos', color: 0x3b82f6, pos: { x: 1, z: 7 }, size: { w: 7, d: 8 }, people: [{ genero: 'M' }] },
    { id: 'marketing', color: 0xa855f7, pos: { x: 10, z: 7 }, size: { w: 7, d: 8 }, people: [{ genero: 'F' }] },
    { id: 'peritaje', color: 0xef4444, pos: { x: 16, z: -4 }, size: { w: 6, d: 9 }, people: [{ genero: 'M' }] },
    { id: 'direccion', color: 0x06b6d4, pos: { x: -15, z: -7 }, size: { w: 7, d: 8 }, people: [{ genero: 'M' }] },
    { id: 'gestoria', color: 0xf59e0b, pos: { x: -6, z: -7 }, size: { w: 7, d: 8 }, people: [{ genero: 'F' }] },
    { id: 'rrhh', color: 0x22c55e, pos: { x: 2, z: -7 }, size: { w: 6, d: 8 }, people: [{ genero: 'F' }] },
    { id: 'contable', color: 0xf97316, pos: { x: 10, z: -7 }, size: { w: 7, d: 8 }, people: [{ genero: 'M' }] },
  ];
  const AREA_NAME = { ventas: 'Ventas', creditos: 'Créditos', marketing: 'Fotos', peritaje: 'Peritaje', direccion: 'Dirección', gestoria: 'Gestoría', rrhh: 'RRHH', contable: 'Contable', sucursal: 'San Francisco' };

  function route(text) {
    const t = ' ' + text.toLowerCase() + ' ';
    let best = null, score = 0;
    for (const id in AGENTS) { let s = 0; for (const k of AGENTS[id].keywords) if (t.includes(k)) s += k.length; if (s > score) { score = s; best = id; } }
    return best;
  }

  root.APP_AGENTS = { AGENTS, AREAS, AREA_NAME, H, route, generic, hex: (n) => '#' + n.toString(16).padStart(6, '0') };
})(typeof window !== 'undefined' ? window : globalThis);
