/* Panel App Ventas — secciones copiadas de AppSheet (TUTU - VENTAS y TUTU - APP).
   Columnas: 'ETIQUETA=COLUMNA_REAL' cuando AppSheet muestra un nombre distinto al de la planilla. */
(function (root) {
  const N = (r, k) => { const v = Number(r[k]); return isNaN(v) ? 0 : v; };
  const D = (s) => { if (!s) return null; const t = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(t) ? null : t; };
  const hoy = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const dias = (a, b) => (a && b ? Math.round((a - b) / 86400000) : null);
  const ym = (s) => (s ? String(s).slice(0, 7) : null);
  const mesActual = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
  const U = (s) => String(s || '').toUpperCase().trim();

  // Fórmulas verificadas contra todos los registros de AppSheet (100% de coincidencia)
  const FORMULAS = {
    CARGA: {
      MARGEN: (r) => N(r, 'IMPORTE_TOTAL') - N(r, 'COSTO'),
      'MARGEN %': (r) => (N(r, 'IMPORTE_TOTAL') ? (N(r, 'IMPORTE_TOTAL') - N(r, 'COSTO')) / N(r, 'IMPORTE_TOTAL') : 0),
      VALOR_USD: (r) => (N(r, 'TC') ? N(r, 'IMPORTE_TOTAL') / N(r, 'TC') : null),
      MARGEN_USD: (r) => (N(r, 'TC') ? (N(r, 'IMPORTE_TOTAL') - N(r, 'COSTO')) / N(r, 'TC') : null),
      MES: (r) => ym(r.FECHA_IMPUTACION),
      'AÑO C': (r) => (r.FECHA_IMPUTACION ? String(r.FECHA_IMPUTACION).slice(0, 4) : null),
      DIAS_VENTA: (r) => dias(hoy(), D(r.FECHA)),
      IMPORTE_TOTAL_FORMA_PAGO: (r, c) => c.sum('FORMA DE PAGO', 'ID', r.ID, 'IMPORTE'),
      IMPORTE_TOTAL_FORMA_PAGO_USD: (r, c) => c.sum('FORMA DE PAGO', 'ID', r.ID, 'IMPORTE_USD'),
    },
    CALCULADOR: {
      MARGEN: (r) => N(r, 'CONTADO') - N(r, 'COSTO'),
      'DIAS EN STOCK': (r) => dias(hoy(), D(r.FECHA)),
    },
    'FORMA DE PAGO': {
      'DIFERENCIA CON CREDITO REAL': (r) => N(r, 'IMPORTE_REAL_CRED') - N(r, 'IMPORTE'),
      'DIF PERITAJE': (r) => N(r, 'GASTOS_PERITAJE') - N(r, 'PERITAJE OFICIAL'),
    },
    GESTORIA: { 'TUTU NETO': (r) => N(r, 'COBRADO_CLIENTE') - N(r, 'TOTAL') },
    DEUDA: {
      TOTAL: (r) => N(r, 'INFRACCIONES') + N(r, 'MUNICIPALIDAD') + N(r, 'RENTAS') + N(r, 'CANCELACION PRENDA'),
      DIFERENCIA: (r) => N(r, 'INFRACCIONES') + N(r, 'MUNICIPALIDAD') + N(r, 'RENTAS') + N(r, 'CANCELACION PRENDA') - N(r, 'COBRO_REAL_DEUDA'),
    },
    POSVENTA: { TOTAL: (r) => N(r, 'COSTO_CLIENTE') + N(r, 'COSTO_TUTU') },
    PERITAJE: {
      COMPRAS: (r, c) => c.sum('COMPRAS', 'DOMINIO', r.DOMINIO, 'IMPORTE'),
      'DIF PERITAJE - COMPRAS': (r, c) => N(r, 'PRESUPUESTO_FINAL') - c.sum('COMPRAS', 'DOMINIO', r.DOMINIO, 'IMPORTE'),
    },
    PREVENTA: { DIAS_DEMORA: (r) => dias(hoy(), D(r.FECHA_CARGA)) },
    '0KM_NACIONALES': { MARGEN: (r) => N(r, 'IMPORTE_TOTAL') - N(r, 'COSTO'), 'AÑOMES': (r) => ym(r.FECHA) },
    CAJA_COMPRAS: { 'AÑOMES': (r) => ym(r.FECHA) },
    COMPRAS: { MES: (r) => ym(r.FECHA) },
  };

  // Columnas que AppSheet completa sola: claves nuevas y auditoría
  const NEW_ID = { CARGA: 'ID', 'FORMA DE PAGO': 'ID_FP', GESTORIA: 'ID_GESTORIA', PERITAJE: 'ID_ARREGLOS', DEUDA: 'DEUDA_ID', POSVENTA: 'ID_POSVENTA', ENTREGA: 'ENTREGA_ID', ENTREGAS: 'ENTREGAS_ID', DOCUMENTACION_VEHICULO: 'ID_DOCUMENTACION', COMPRAS: 'ID_ALISTAJE', CAJA_COMPRAS: 'ID_CC', FINANZAS: 'ID_FINANZAS', BOT_TUTU_VENTAS: 'ID_TUTU_VENTAS', '0KM_NACIONALES': 'ID', PREVENTA: 'ID_PREVENTA', 'CREDITOS EXTERNOS': 'ID_CREDITO_EXTERNO', ALISTAJE: 'ID_ALISTAJE', MECANICA: 'MECANICA_ID', ORDEN_PAGO: 'ID_OP' };

  // Al elegir un valor de referencia se completan otros campos (como los Ref de AppSheet)
  const REFS = {
    CARGA: [
      { col: 'DOMINIO', table: 'CALCULADOR', key: 'DOMINIO', fill: { MARCA: 'MARCA', MODELO: 'VEHICULO', 'AÑO': 'AÑO', COLOR: 'COLOR', COSTO: 'COSTO', CONSIGNADOR: 'DE QUIEN ES?', 'DE QUIEN ES?': 'DE QUIEN ES?', MODALIDAD: 'PROPIETARIO', VALOR_CONTADO: 'CONTADO', VALOR_PERMUTA: 'PERMUTA / FINANCIADO', KMS: 'KM', NRO_CHASIS: 'NRO CHASIS' } },
      { col: 'DNI', table: 'DEUDOR', key: 'DNI', fill: { DEUDOR: 'DEUDOR', TEL: 'TELEFONO' } },
    ],
    'FORMA DE PAGO': [
      { col: 'ID', table: 'CARGA', key: 'ID', fill: { DOMINIO: 'DOMINIO', CLIENTE: 'DEUDOR', MARCA: 'MARCA', VEHICULO: 'MODELO', VENDEDOR: 'VENDEDOR', ESTADO_OPERACION: 'ESTADO_OPERACIÓN', FECHA_IMPUTACION: 'FECHA_IMPUTACION', EMPRESA: 'EMPRESA' } },
    ],
    PERITAJE: [{ col: 'DOMINIO', table: 'CALCULADOR', key: 'DOMINIO', fill: { VEHICULO: 'VEHICULO', PROPIETARIO: 'PROPIETARIO', UBICACION: 'DÓNDE ESTÁ', ESTADO_CALCULADOR: 'ESTADO', ESTADO_OPERACION: 'ESTADO_OPERACIÓN', KILOMETROS: 'KM' } }],
    GESTORIA: [{ col: 'DOMINIO', table: 'CALCULADOR', key: 'DOMINIO', fill: { VEHICULO: 'VEHICULO', MARCA: 'MARCA', 'DE QUIEN ES?': 'DE QUIEN ES?', ESTADO_OPERACION: 'ESTADO_OPERACIÓN' } }],
    DOCUMENTACION_VEHICULO: [{ col: 'DOMINIO', table: 'CALCULADOR', key: 'DOMINIO', fill: { VEHICULO: 'VEHICULO', PROPIETARIO: 'PROPIETARIO', ESTADO: 'ESTADO', ESTADO_OPERACION: 'ESTADO_OPERACIÓN' } }],
    DEUDA: [{ col: 'DOMINIO', table: 'CALCULADOR', key: 'DOMINIO', fill: { PROPIETARIO: 'PROPIETARIO' } }],
    ENTREGA: [{ col: 'DOMINIO', table: 'CARGA', key: 'DOMINIO', fill: { MODELO: 'MODELO', CLIENTE: 'DEUDOR', VENDEDOR: 'VENDEDOR', ESTADO_OPERACION: 'ESTADO_OPERACIÓN', 'DE QUIEN ES?': 'DE QUIEN ES?' } }],
    COMPRAS: [{ col: 'DOMINIO', table: 'CALCULADOR', key: 'DOMINIO', fill: { AUTO: 'VEHICULO' } }],
    POSVENTA: [{ col: 'DOMINIO', table: 'CARGA', key: 'DOMINIO', fill: { TEL: 'TEL' } }],
  };

  // Registros relacionados que se ven en el detalle (como las "Related" de AppSheet)
  const CHILDREN = {
    CARGA: [{ table: 'FORMA DE PAGO', fk: 'ID', pk: 'ID', title: 'DETALLE DE FORMA DE PAGO', cols: ['FORMA DE PAGO=ID_MP', 'FECHA', 'IMPORTE', 'IMPORTE_USD', 'ESTADO', 'COBRADO', 'DOMINIO_PERMUTA=DOMINIO1', 'CUOTAS'] }],
    CALCULADOR: [
      { table: 'CARGA', fk: 'DOMINIO', pk: 'DOMINIO', title: 'VENTAS', cols: ['FECHA', 'ESTADO_OPERACIÓN', 'NOMBRE CLIENTE=DEUDOR', 'VENDEDOR', 'VALOR_VENTA=IMPORTE_TOTAL', 'MARGEN'] },
      { table: 'PERITAJE', fk: 'DOMINIO', pk: 'DOMINIO', title: 'PERITAJES', cols: ['FECHA', 'PRESUPUESTO_FINAL', 'COMPRAS', 'DIF PERITAJE - COMPRAS', 'ESTADO'] },
      { table: 'COMPRAS', fk: 'DOMINIO', pk: 'DOMINIO', title: 'COMPRAS', cols: ['FECHA', 'CONCEPTO', 'PROVEEDOR', 'ELEMENTOS', 'IMPORTE', 'TIPO DE PAGO'] },
      { table: 'DOCUMENTACION_VEHICULO', fk: 'DOMINIO', pk: 'DOMINIO', title: 'DOCUMENTACIÓN', cols: ['FECHA', 'ESTADO_DOCUMENTACION', 'TITULO_AUTOMOTOR', '08', 'VERIFICACION'] },
      { table: 'DEUDA', fk: 'DOMINIO', pk: 'DOMINIO', title: 'DEUDAS', cols: ['TOTAL', 'COBRO_REAL_DEUDA', 'DIFERENCIA', 'RESPONSABLE'] },
      { table: 'GESTORIA', fk: 'DOMINIO', pk: 'DOMINIO', title: 'GESTORÍA', cols: ['FECHA', 'ESTADO_GESTORIA', 'TOTAL', 'COBRADO_CLIENTE'] },
      { table: 'POSVENTA', fk: 'DOMINIO', pk: 'DOMINIO', title: 'POSVENTA', cols: ['FECHA', 'DESCRIPCION', 'TOTAL', 'ESTADO'] },
    ],
    DEUDOR: [{ table: 'CARGA', fk: 'DNI', pk: 'DNI', title: 'COMPRAS DEL CLIENTE', cols: ['FECHA', 'DOMINIO', 'MODELO', 'VALOR_VENTA=IMPORTE_TOTAL', 'ESTADO_OPERACIÓN', 'VENDEDOR'] }],
  };

  const ACTIVOS = ['PREVENTA', 'SEÑADO', 'EN PROCESO', 'LIQUIDADO', 'ENTREGADO', 'CAIDO'];
  const C_HIST_V = ['MARGEN', 'DOMINIO', 'ESTADO_OPERACIÓN', 'FOTO', 'MARCA', 'VEHICULO', 'KM', 'AÑO', 'COLOR', 'CONTADO', 'COSTO COMERCIAL=COSTO', 'COSTO_FABRICA', 'PRECIO LISTA=PERMUTA / FINANCIADO', 'INFO ANTERIOR', 'INFO ACTUAL', 'DE QUIEN ES?', 'RESPONSABLE', 'DÓNDE ESTÁ', 'OBSERVACIONES', 'ESTADO', 'PERITAR', 'PROPIETARIO', 'USUARIO', 'HORA'];
  const C_VENTAS = ['DIAS_VENTA', 'MARGEN %', 'MARGEN', 'FECHA', 'FECHA_IMPUTACION', 'NOMBRE CLIENTE=DEUDOR', 'VENDEDOR', 'MARCA', 'MODELO', 'DOMINIO', 'AÑO', 'VALOR_VENTA=IMPORTE_TOTAL', 'COSTO COMERCIAL=COSTO', 'CONTROL', '% COBRO', 'TIPO_OPERACIÓN', 'MODALIDAD', 'GASTOS_PERITAJE', 'ESTADO_OPERACIÓN', 'MONEDA', 'COTIZACION USD=TC', 'GASTOS TRANSFERENCIAS (5% O 6%)=GASTOS TRANSFERENCIAS', 'GASTOS DE CREDITO (4,2%)=GASTOS CREDITO', 'OBSERVACIONES', 'DATO', 'SUCURSAL', 'EMPRESA', 'PAGADO', 'FECHA PAGO CONSIGNA=FECHA_PAGO', 'HOJA DE OPERACION', 'RESEÑA', 'DOMINIO_ASIGNADO', 'NRO_CHASIS', 'USUARIO', 'HORA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'];
  const C_FP = ['FORMA DE PAGO=ID_MP', 'CLIENTE', 'FECHA', 'FECHA_IMPUTACION', 'ESTADO_OPERACION', 'DOMINIO', 'MARCA', 'VEHICULO', 'IMPORTE', 'IMPORTE_USD', 'ESTADO', 'MARCA PERMUTA=MARCA1', 'MODELO PERMUTA=MODELO1', 'DOMINIO_PERMUTA=DOMINIO1', 'AÑO PERMUTA=AÑO', 'KM PERMUTA=KM', 'COLOR PERMUTA=COLOR', 'INFO AUTO PERMUTA=INFO_AUTO', 'CUOTAS', 'GASTOS_PERITAJE', 'PRECIO_CONTADO', 'PRECIO_PERMUTA', 'DESCRIPCION', 'MERCADO', 'FECHA_CARGA_CREDITO', 'COBRADO', 'FECHA_COBRO', 'USUARIO', 'HORA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'];
  const esBanco = (r) => U(r.ID_MP).includes('BANCO');

  const VENTAS = [
    { id: 'v-nueva-venta', title: 'NUEVA VENTA', icon: 'plus', table: 'CARGA', type: 'form', done: 'v-ventas',
      cols: ['FECHA', 'FECHA_IMPUTACION', 'CUIL=DNI', 'NOMBRE CLIENTE=DEUDOR', 'TEL', 'TIPO_OPERACIÓN', 'MONEDA', 'COTIZACION USD=TC', 'DOMINIO', 'MODALIDAD', 'MARCA', 'MODELO', 'AÑO', 'COLOR', 'COSTO COMERCIAL=COSTO', 'COSTO_USD', 'VENDEDOR', 'EMPRESA', 'SUCURSAL', 'DATO', 'VALOR_VENTA=IMPORTE_TOTAL', 'VALOR_USD', 'GASTOS TRANSFERENCIAS (5% O 6%)=GASTOS TRANSFERENCIAS', 'GASTOS DE CREDITO (4,2%)=GASTOS CREDITO', 'POSICION_VENTA', 'OBSERVACIONES', 'GASTOS_PERITAJE', 'OTROS INGRESOS=BONIFICACIONES', 'CONSIGNADOR', 'ESTADO_OPERACIÓN', 'IMPORTE_TOTAL_FINAL', 'CONTROL', 'VALOR_CONTADO', 'PRECIO LISTA=VALOR_PERMUTA', 'CONFORMIDADES', 'CON_DESCUENTO', 'RESPONSABLE VEHICULO=RESPONSABLE COSIGNA', 'HOJA DE OPERACION', 'RESEÑA'],
      defaults: { FECHA: 'today', FECHA_IMPUTACION: 'today', MONEDA: 'ARS', EMPRESA: 'TUTU', 'ESTADO_OPERACIÓN': 'PREVENTA', CON_DESCUENTO: 'N', 'HOJA DE OPERACION': 'N', 'RESEÑA': 'N', PAGADO: 'N', 'CAIDO Y LEVANTADO': 'N' },
      required: ['FECHA', 'DOMINIO', 'DEUDOR', 'ESTADO_OPERACIÓN', 'IMPORTE_TOTAL'] },
    { id: 'v-calculador', title: 'CALCULADOR', icon: 'calculator', table: 'CALCULADOR', filter: (r) => r.ESTADO === 'INGRESADO', sort: 'MARCA', export: true,
      cols: ['ESTADO', 'DOMINIO', 'FOTO', 'MARCA', 'VEHICULO', 'KM', 'AÑO', 'COLOR', 'CONTADO', 'PRECIO LISTA=PERMUTA / FINANCIADO', 'INFO ANTERIOR', 'INFO ACTUAL', 'DE QUIEN ES?', 'RESPONSABLE', 'DÓNDE ESTÁ', 'OBSERVACIONES', 'PERITAR', 'PROPIETARIO', 'ESTADO_OPERACIÓN', 'USUARIO', 'HORA'] },
    { id: 'v-reportes', title: 'REPORTES', icon: 'pie-chart', type: 'report', table: 'CARGA', by: 'ESTADO_OPERACIÓN' },
    { id: 'v-ventas', title: 'VENTAS', icon: 'trending-up', table: 'CARGA', group: 'ESTADO_OPERACIÓN', groupOrder: ACTIVOS, collapsed: ['ENTREGADO', 'CAIDO'], sort: 'FECHA', desc: true, add: 'v-nueva-venta', export: true, cols: C_VENTAS },
    { id: 'v-bot', title: 'BOT', icon: 'bot', table: 'BOT_TUTU_VENTAS', group: 'CONTACTADO', sort: 'FECHA', desc: true, add: true, export: true,
      cols: ['VENDEDOR_ASIGNADO', 'FECHA', 'TEL', 'UNIDAD_BUSCADA', 'USO', 'AUTO_ENTREGA', 'RECIBO_SUELDO', 'CUOTA_MENSUAL_MAX', 'DNI', 'CONTACTADO', 'FECHA_CONTACTO', 'OBSERVACIONES', 'PROXIMA_ACCION', 'ESTADO_OPERACIÒN'] },
    { id: 'v-preventa', title: 'PREVENTA', icon: 'radio', table: '0KM_NACIONALES', group: 'SITUACION', sort: 'FECHA', desc: true, add: true, export: true,
      cols: ['FECHA', 'TITULAR PRENDARIO', 'TITULAR FABRICA', 'PROVEEDOR', 'MARGEN', 'IMPORTE_TOTAL', 'COSTO', 'PERSONAL', 'SITUACION_PRENDARIO=SITUACION', 'SITUACION_RCI=SITUACION_12', 'PRENDARIO', 'FECHA LIQ', 'VENDEDOR', 'VEHICULO', 'CHASIS', 'MOTOR', 'COLOR', 'PAGOS', 'UNIDADES', 'FECHA FIRMA', 'DOCUMENTACION', 'INFO EXTRA', 'HORA_CI', 'HORA'] },
    { id: 'v-ventas-mes', title: 'VENTAS MES EN CURSO', icon: 'star', table: 'CARGA', filter: (r) => ym(r.FECHA_IMPUTACION) === mesActual(), group: 'ESTADO_OPERACIÓN', groupOrder: ACTIVOS, sort: 'FECHA_IMPUTACION', desc: true, export: true, totals: ['MARGEN', 'IMPORTE_TOTAL'],
      cols: ['DIAS_VENTA', 'MARGEN %', 'MARGEN', 'FECHA_IMPUTACION', 'NOMBRE CLIENTE=DEUDOR', 'VENDEDOR', 'MARCA', 'MODELO', 'DOMINIO', 'AÑO', 'COLOR', 'VALOR_VENTA=IMPORTE_TOTAL', 'GASTOS TRANSFERENCIAS (5% O 6%)=GASTOS TRANSFERENCIAS', 'GASTOS DE CREDITO (4,2%)=GASTOS CREDITO', 'POSICION_VENTA', 'GASTOS_PERITAJE', 'CONSIGNADOR', 'COSTO COMERCIAL=COSTO', 'MODALIDAD', 'DE QUIEN ES?', 'TIPO_OPERACIÓN', 'ESTADO_OPERACIÓN', 'VALOR_USD', 'VALOR_CONTADO', 'PRECIO LISTA=VALOR_PERMUTA', 'HOJA DE OPERACION', 'RESEÑA', 'COTIZACION USD=TC', 'COSTO_USD', 'DATO', 'CON_DESCUENTO', 'RESPONSABLE VEHICULO=RESPONSABLE COSIGNA', 'SUCURSAL', 'EMPRESA', 'OBSERVACIONES', 'PAGADO', 'FECHA PAGO CONSIGNA=FECHA_PAGO', 'CAIDO Y LEVANTADO', 'MES', 'CONTROL', 'IMPORTE_TOTAL_FINAL', 'MARGEN_USD', 'CONFORMIDADES', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL', 'USUARIO', 'HORA'] },
    { id: 'v-reportes-vendedor', title: 'REPORTES VENDEDOR', icon: 'users', type: 'report', table: 'CARGA', by: 'VENDEDOR' },
    { id: 'v-comisiones', title: 'REPORTE COMISIONES', icon: 'badge-dollar-sign', table: 'CARGA', filter: (r) => ['LIQUIDADO', 'ENTREGADO'].includes(r['ESTADO_OPERACIÓN']), monthPanel: { date: 'FECHA_IMPUTACION', sum: 'IMPORTE_TOTAL' }, group: 'VENDEDOR', sort: 'FECHA_IMPUTACION', desc: true, export: true, totals: ['IMPORTE_TOTAL'],
      cols: ['VENDEDOR', 'FECHA', 'FECHA_IMPUTACION', 'MODELO', 'DOMINIO', 'VALOR_VENTA=IMPORTE_TOTAL', 'CON_DESCUENTO', 'RESPONSABLE VEHICULO=RESPONSABLE COSIGNA', 'SUCURSAL'] },
    { id: 'v-clientes', title: 'CLIENTES', icon: 'contact', table: 'DEUDOR', sort: 'DEUDOR', add: true, export: true,
      cols: ['CUIL=DNI', 'APELLIDO Y NOMBRE CLIENTE=DEUDOR', 'TIPO', 'TELEFONO', 'MAIL', 'FECHA_NACIMIENTO', 'DIRECCION', 'USUARIO', 'HORA'] },
    { id: 'v-formas-pago', title: 'DETALLE FORMAS DE PAGO', icon: 'wallet', table: 'FORMA DE PAGO', group: 'ESTADO_OPERACION', groupOrder: ACTIVOS, collapsed: ['ENTREGADO', 'CAIDO'], sort: 'FECHA', desc: true, add: true, export: true, cols: C_FP },
    { id: 'v-control-creditos', title: 'CONTROL CREDITOS', icon: 'landmark', table: 'FORMA DE PAGO', filter: (r) => esBanco(r) && !['ENTREGADO', 'CAIDO', 'LIQUIDADO'].includes(r.ESTADO_OPERACION) && r.ESTADO !== 'LIQUIDADO', group: 'ESTADO', groupOrder: ['NO SOLICITADO', 'SOLICITADO', 'CARGADO', 'INCOMPLETO', 'NO CARGADO', 'ABOGADO'], sort: 'FECHA', desc: true, add: true, export: true,
      cols: ['DIAS DE DE PRENDA', 'FECHA', 'VENDEDOR', 'ESTADO', 'COBRADO', 'FORMA DE PAGO=ID_MP', 'DOMINIO', 'VEHICULO', 'CLIENTE', 'CUOTAS', 'FECHA_CARGA_CREDITO', 'DIAS COBRO VS CARGA CREDITO', 'FECHA_COBRO', 'IMPORTE', 'IMPORTE_REAL_CRED', 'DIFERENCIA CON CREDITO REAL', 'MERCADO', 'FECHA_IMPUTACION', 'ESTADO_OPERACION', 'IMPORTE_USD', 'EMPRESA', 'FECHA_CARGA_PRENDA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'] },
    { id: 'v-permutas', title: 'PERMUTAS', icon: 'repeat', table: 'FORMA DE PAGO', filter: (r) => r.ID_MP === 'Vehiculo', group: 'ESTADO_OPERACION', groupOrder: ACTIVOS, collapsed: ['ENTREGADO', 'CAIDO'], sort: 'FECHA', desc: true, add: true, defaults: { ID_MP: 'Vehiculo' }, export: true,
      cols: ['FORMA DE PAGO=ID_MP', 'CLIENTE', 'FECHA', 'FECHA_IMPUTACION', 'ESTADO_OPERACION', 'DOMINIO', 'IMPORTE', 'IMPORTE_USD', 'MARCA PERMUTA=MARCA1', 'MODELO PERMUTA=MODELO1', 'DOMINIO_PERMUTA=DOMINIO1', 'AÑO PERMUTA=AÑO', 'KM PERMUTA=KM', 'COLOR PERMUTA=COLOR', 'INFO AUTO PERMUTA=INFO_AUTO', 'GASTOS_PERITAJE', 'PRECIO_CONTADO', 'PRECIO_PERMUTA', 'COBRADO', 'FECHA_COBRO', 'POSICION_VENTA', 'USUARIO', 'HORA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'] },
    { id: 'v-calc-historico', title: 'CALCULADOR HISTORICO', icon: 'car', table: 'CALCULADOR', sort: 'MARCA', export: true, cols: C_HIST_V },
    { id: 'v-control-costos', title: 'CONTROL COSTOS', icon: 'calculator', table: 'CALCULADOR', filter: (r) => r.ESTADO === 'INGRESADO', sort: 'MARCA', export: true,
      cols: ['ESTADO', 'DOMINIO', 'FOTO', 'MARCA', 'VEHICULO', 'CONTADO', 'PRECIO LISTA=PERMUTA / FINANCIADO', 'COSTO COMERCIAL=COSTO', 'COSTO COMERCIAL USD=COSTO USD', 'INFO ANTERIOR', 'INFO ACTUAL', 'PROPIETARIO', 'ESTADO_OPERACIÓN', 'USUARIO', 'HORA'] },
    { id: 'v-finanzas', title: 'FINANZAS', icon: 'bookmark', table: 'FINANZAS', sort: 'FECHA', desc: true, add: true, export: true,
      cols: ['ID_FINANZAS', 'FECHA', 'DOMINIO', 'VENTA', 'GASTOS_CREDITO', 'GASTOS_TRANSFERENCIAS', 'COSTO', 'PERITAJE', 'DOCUMENTACION', 'MECANICA', 'ALISTAJE', 'COMPRAS', 'DEUDAS', 'GESTORIA'] },
  ];

  const C_HIST_A = ['ESTADO', 'ESTADO_OPERACIÓN', 'FECHA', 'DOMINIO', 'FOTO_AUTO=FOTO', 'MARCA', 'VEHICULO', 'NRO CHASIS', 'NRO MOTOR', 'KM', 'AÑO', 'COLOR', 'MONEDA OPERACION', 'CONTADO', 'COSTO FABRICA/ADMINISTRATIVO=COSTO_FABRICA', 'PRECIO LISTA=PERMUTA / FINANCIADO', 'INFO ACTUAL', 'SEGMENTO', 'PROPIETARIO', 'DE QUIEN ES?', 'RESPONSABLE TUTU=RESPONSABLE', 'DÓNDE ESTÁ', 'OBSERVACIONES', 'PERITAR', 'USUARIO', 'HORA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'];
  const enStock = (r) => r.ESTADO === 'INGRESADO' && (!r['ESTADO_OPERACIÓN'] || r['ESTADO_OPERACIÓN'] === 'CAIDO');
  const C_ENTREGA = ['ESTADO_OPERACION', 'ESTADO', 'FECHA_ENTREGA=FECHA', 'CLIENTE', 'MODELO', 'DOMINIO', 'VENDEDOR', 'APROBACION MECANICA=MECANICA', 'FECHA_MECANICA', 'APROBACION ESTETICA=ESTETICA', 'FECHA_ESTETICA', 'APROBACION GESTORIA=GESTORIA', 'FECHA_GESTORIA', 'OBSERVACION ENTREGA=ENTREGADO', 'PROPIETARIOS', 'USUARIO', 'HORA', 'ENTREGA_ID'];

  const APP = [
    { id: 'a-calc-historico', title: 'CALCULADOR HISTORICO', icon: 'calculator', table: 'CALCULADOR', sort: 'MARCA', export: true, cols: C_HIST_A },
    { id: 'a-ingreso-auto', title: 'INGRESO AUTO', icon: 'car-front', table: 'CALCULADOR', type: 'form', done: 'a-calc-ventas',
      cols: ['FECHA', 'DOMINIO', 'MARCA', 'VEHICULO', 'SEGMENTO', 'KM', 'NRO CHASIS', 'NRO MOTOR', 'RESPONSABLE TUTU=RESPONSABLE', 'FOTO_AUTO=FOTO', 'AÑO', 'COLOR', 'MONEDA OPERACION', 'CONTADO', 'PRECIO LISTA=PERMUTA / FINANCIADO', 'INFO ACTUAL', 'COSTO', 'DÓNDE ESTÁ', 'OBSERVACIONES', 'PROPIETARIO', 'DE QUIEN ES?', 'ESTADO', 'PERITAR', 'FECHA_PERITAJE'],
      defaults: { FECHA: 'today', ESTADO: 'PENDIENTE', PERITAR: 'POR PERITAR', 'MONEDA OPERACION': 'ARS' }, required: ['FECHA', 'DOMINIO'] },
    { id: 'a-calc-ventas', title: 'CALCULADOR VENTAS', icon: 'calculator', table: 'CALCULADOR', filter: enStock, group: 'ESTADO', sort: 'MARCA', export: true,
      cols: ['DIAS EN STOCK', 'ESTADO', 'DOMINIO', 'FECHA', 'FOTO_AUTO=FOTO', 'SEGMENTO', 'MARCA', 'VEHICULO', 'KM', 'AÑO', 'COLOR', 'CONTADO', 'PRECIO LISTA=PERMUTA / FINANCIADO', 'INFO ACTUAL', 'PROPIETARIO', 'DE QUIEN ES?', 'RESPONSABLE TUTU=RESPONSABLE', 'DÓNDE ESTÁ', 'OBSERVACIONES', 'PERITAR', 'ESTADO_OPERACIÓN', 'MONEDA OPERACION', 'NRO CHASIS', 'NRO MOTOR', 'USUARIO', 'HORA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'] },
{ id: 'a-consignacion', title: 'CONSIGNACION', icon: 'tags', table: 'CALCULADOR', filter: (r) => r.PROPIETARIO === 'CONSIGNACION', group: 'ESTADO', groupOrder: ['INGRESADO', 'PENDIENTE', 'POR INGRESAR', 'REVENTA', 'BAJA'], collapsed: ['BAJA'], sort: 'MARCA', export: true,
      cols: ['ESTADO', 'ESTADO_OPERACIÓN', 'DOMINIO', 'FECHA', 'FOTO_AUTO=FOTO', 'MARCA', 'VEHICULO', 'KM', 'AÑO', 'COLOR', 'COSTO COMERCIAL=COSTO', 'COSTO COMERCIAL USD=COSTO USD', 'CONTADO', 'PRECIO LISTA=PERMUTA / FINANCIADO', 'INFO ANTERIOR', 'INFO ACTUAL', 'DE QUIEN ES?', 'RESPONSABLE TUTU=RESPONSABLE', 'DÓNDE ESTÁ', 'OBSERVACIONES', 'PERITAR', 'MONEDA OPERACION', 'NRO CHASIS', 'PROPIETARIO', 'ESTADO_CONSIGNA', 'USUARIO', 'HORA'] },
    { id: 'a-marketing', title: 'MARKETING', icon: 'camera', table: 'CALCULADOR', filter: enStock, sort: 'MARCA', export: true,
      cols: ['DOMINIO', 'DÓNDE ESTÁ', 'FECHA', 'FOTO_AUTO=FOTO', 'MARCA', 'VEHICULO', 'KM', 'AÑO', 'COLOR', 'FOTOS', 'WEB', 'MELI', 'FACE', 'OBSERVACIONES_FOTO', 'USUARIO', 'HORA'] },
    { id: 'a-calendario', title: 'CALENDARIO', icon: 'calendar-days', table: 'CALCULADOR', type: 'calendar', dateCol: 'FECHA_PERITAJE', label: (r) => `PERITAJE - ${r.DOMINIO || ''} - ${r.VEHICULO || ''}` },
{ id: 'a-compras', title: 'COMPRAS', icon: 'shopping-cart', table: 'COMPRAS', monthPanel: { date: 'FECHA', sum: 'IMPORTE' }, sort: 'FECHA', desc: true, add: true, export: true, totals: ['IMPORTE'],
      cols: ['FECHA', 'CONCEPTO', 'OC', 'OT', 'OTPV', 'OTT', 'AUTO', 'DOMINIO', 'PROVEEDOR', 'ELEMENTOS', 'IMPORTE', 'TIPO DE PAGO', 'OBSERVACIONES FRANCO', 'STOCK', 'CONCILIACION CAJA', 'USUARIO', 'HORA', 'USUARIO_CI', 'HORA_CI'] },
    { id: 'a-conciliacion', title: 'CONCILIACION COMPRAS', icon: 'scale', type: 'conciliacion' },
    { id: 'a-documentacion', title: 'DOCUMENTACION VEHICULO', icon: 'file-text', table: 'DOCUMENTACION_VEHICULO', group: 'ESTADO_DOCUMENTACION', sort: 'FECHA', desc: true, add: true, export: true,
      cols: ['FECHA', 'ESTADO', 'PROPIETARIO', 'ESTADO_OPERACION', 'DOMINIO', 'VEHICULO', 'CLIENTE', 'TITULO_AUTOMOTOR', 'TARJETA VERDE=CANT_TARJETA_VERDE', 'INFORME_DOMINIO', '13D', '08', 'VERIFICACION', 'FECHA_VERIFICACION', 'VENCIMIENTO_VERIFICACION', 'ESTADO_DOCUMENTACION', 'PLAZO_CONTRATO', 'TOTAL', 'PAGADO', 'USUARIO', 'HORA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'] },
    { id: 'a-deudas', title: 'DEUDAS TUTU', icon: 'badge-dollar-sign', table: 'DEUDA', group: 'COBRADO_CLIENTE', groupOrder: ['N', 'Y'], add: true, export: true, totals: ['TOTAL', 'COBRO_REAL_DEUDA', 'DIFERENCIA'],
      cols: ['COBRADO_CLIENTE', 'DOMINIO', 'PROPIETARIO', 'TOTAL', 'OBSERVACION', 'POSICION_VENTA', 'INFRACCIONES', 'MUNICIPALIDAD', 'RENTAS', 'CANCELACION PRENDA', 'RESPONSABLE', 'COBRO_REAL_DEUDA', 'DIFERENCIA', 'USUARIO', 'HORA', 'USUARIO_CI', 'HORA_CI'] },
    { id: 'a-gestoria', title: 'GESTORIA', icon: 'list-checks', table: 'GESTORIA', group: 'ESTADO_GESTORIA', collapsed: ['4. ENTREGADO CLIENTE', '5. ENTREGADO CLIENTE'], sort: 'FECHA', desc: true, add: true, export: true, totals: ['TOTAL', 'COBRADO_CLIENTE', 'TUTU NETO'],
      cols: ['ESTADO_OPERACION', 'ESTADO_GESTORIA', 'PRESUPUESTO_FINAL', 'TOTAL', 'TUTU NETO', 'FECHA', 'DOMINIO', 'NOMBRE CLIENTE', 'COBRADO_CLIENTE', 'OBSERVACIONES', 'PRENDARIO', 'VEHICULO', 'MARCA', 'ARANCELES REGISTRALES', 'FORMULARIO', 'CERTIFICACION FIRMA', 'NOTA DENUNCIA DE CEDULA/TITULO/C.AZUL', 'ALTA MUNICIPAL', 'BAJA MUNICIPAL', 'PATENTES MUNICIPALES', 'PATENTE DE RENTAS', 'MULTAS', 'MOVILIDAD', 'PRENDA CANCELACION', 'HONORARIOS TRANSFERENCIA', 'VERIFICACION', 'HONORARIOS ALTA / BAJA', 'TOTAL COMPRADOR', 'TOTAL VENDEDOR', 'SALDO', 'USUARIO', 'HORA'] },
    { id: 'a-revisar', title: 'REVISAR', icon: 'eye', type: 'dashboard', parts: [
      { view: 'a-gestoria', title: 'GESTORIA PENDIENTE', filter: (r) => !/ENTREGADO CLIENTE/.test(r.ESTADO_GESTORIA || '') },
      { view: 'a-deudas', title: 'DEUDAS NO COBRADAS', filter: (r) => r.COBRADO_CLIENTE !== 'Y' },
    ] },
    { id: 'a-peritajes-pend', title: 'PERITAJES POR REALIZAR', icon: 'glasses', table: 'CALCULADOR', filter: (r) => r.PERITAR === 'POR PERITAR' && r.ESTADO !== 'BAJA', group: 'DÓNDE ESTÁ', sort: 'FECHA_PERITAJE', export: true,
      cols: ['FECHA_PERITAJE', 'ESTADO', 'PERITAR', 'DÓNDE ESTÁ', 'ESTADO_OPERACIÓN', 'DOMINIO', 'FOTO_AUTO=FOTO', 'VEHICULO', 'KM', 'AÑO', 'COLOR', 'MARCA', 'RESPONSABLE TUTU=RESPONSABLE', 'NRO CHASIS', 'USUARIO', 'HORA'] },
    { id: 'a-peritaje', title: 'PERITAJE', icon: 'clipboard-check', table: 'PERITAJE', group: 'ESTADO_CALCULADOR', groupOrder: ['INGRESADO', 'PENDIENTE', 'POR INGRESAR', 'REVENTA', 'BAJA'], collapsed: ['BAJA'], sort: 'FECHA', desc: true, add: true, export: true,
      cols: ['CONFORMIDADES', 'ESTADO_CALCULADOR', 'PROPIETARIO', 'UBICACION', 'FECHA_PERITAJE=FECHA', 'DOMINIO', 'VEHICULO', 'PRESUPUESTO_FINAL', 'COMPRAS', 'DIF PERITAJE - COMPRAS', 'POSVENTA', 'ESTADO_OPERACION', 'MECANICA', 'MECANICA_COMERCIAL', 'TOTAL_MECANICA', 'PRESUPUESTO_COMERCIAL', 'ESTETICA', 'TOTAL_ESTETICA', 'TOTAL_CUBIERTAS', 'TOTAL_BATERIA', 'ESTADO', 'KILOMETROS', 'RECOMIENDA _TOMA', 'DUPLICADO_LLAVE', 'MONTO_DUPLICADO_LLAVE', 'USUARIO', 'HORA', 'USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'] },
    { id: 'a-posventa', title: 'POSVENTA', icon: 'wrench', table: 'POSVENTA', sort: 'FECHA', desc: true, add: true, export: true, totals: ['COSTO_CLIENTE', 'COSTO_TUTU', 'TOTAL'],
      cols: ['FECHA', 'DOMINIO', 'DESCRIPCION', 'COSTO_CLIENTE', 'COSTO_TUTU', 'TOTAL', 'ESTADO', 'KMS AL MOMENTO DEL POST VENTA', 'DIA_RECLAMO', 'TEL', 'CONTACTO_CLIENTES', 'USUARIO', 'HORA'] },
    { id: 'a-entregas', title: 'ENTREGAS', icon: 'key-round', table: 'ENTREGA', filter: (r) => ['PREVENTA', 'SEÑADO', 'EN PROCESO', 'LIQUIDADO'].includes(r.ESTADO_OPERACION), group: 'ESTADO_OPERACION', groupOrder: ACTIVOS, sort: 'FECHA', add: true, export: true, cols: C_ENTREGA },
    { id: 'a-entregas-ok', title: 'ENTREGAS REALIZADAS', icon: 'circle-check-big', table: 'ENTREGA', filter: (r) => r.ESTADO_OPERACION === 'ENTREGADO', sort: 'FECHA', desc: true, export: true, cols: C_ENTREGA },
    { id: 'a-orden-pago', title: 'ORDEN DE PAGO', icon: 'banknote', table: 'ORDEN_PAGO', sort: 'VENCIMIENTO', add: true, export: true, totals: ['Importe'],
      cols: ['VENCIMIENTO', 'AREA', 'Motivo', 'Importe', 'CBU/CVU/Alias/Nro cuenta', 'Descripción gasto', 'Email destinatario', 'Mensaje del email', 'AUTORIZO', 'DOMINIO', 'VEHICULO', 'RECURRENTE', 'OBSERVACIONES', 'USUARIO', 'HORA'] },
  ];

  const APPS = [
    { id: 'ventas', title: 'TUTU - VENTAS', protegida: true, views: VENTAS },
    { id: 'app', title: 'TUTU - APP', views: APP },
  ];
  const out = { APPS, FORMULAS, NEW_ID, REFS, CHILDREN };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.PANEL = out;
})(typeof window !== 'undefined' ? window : globalThis);
