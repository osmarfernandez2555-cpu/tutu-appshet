"""Une las tablas de TUTU - APP y TUTU - VENTAS (caché de AppSheet) en una base limpia
y genera public/tables.js con el tipo de cada columna.
Uso: python3 build_seed.py tutu-datos.json salida_dir public_dir"""
import json, sys, re, gzip, collections, datetime as dt

src, outdir, pubdir = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(src))
DROP_TABLES = {'_Per User Settings', 'MENU', 'REPORTE_FECHAS', 'DIFERENCIA'}
DROP_COL = lambda c: c == '_RowNumber' or c.startswith('Related ') or c.startswith('_geo_') or c == '_isGeoCoded' or c == 'CONTRASEÑA'
DATE = re.compile(r'^(\d{2})/(\d{2})/(\d{4})$')
DTIME = re.compile(r'^(\d{2})/(\d{2})/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$')

def norm(v):
    if v is None or v == '': return None
    m = DTIME.match(v)
    if m: mo, da, y, h, mi, s = m.groups(); return f"{y}-{mo}-{da}T{int(h):02d}:{mi}:{s}"
    m = DATE.match(v)
    if m: mo, da, y = m.groups(); return f"{y}-{mo}-{da}"
    return v

def load(app, t):
    T = d[app][t]; cols = T['cols']
    out = []
    for r in T['rows']:
        o = {}
        for c, v in zip(cols, r):
            if DROP_COL(c): continue
            v = norm(v)
            if v is not None: o[c] = v
        o['__rn'] = int(dict(zip(cols, r)).get('_RowNumber') or 0)
        out.append(o)
    return T['key'], [c for c in cols if not DROP_COL(c)], out

tables = {}
names = [t for t in d['VENTAS']] + [t for t in d['APP'] if t not in d['VENTAS']]
for t in names:
    if t in DROP_TABLES: continue
    inV, inA = t in d['VENTAS'], t in d['APP']
    if inV and inA:
        kV, cV, rV = load('VENTAS', t); kA, cA, rA = load('APP', t)
        if kV != kA:  # tablas distintas con el mismo nombre
            tables[t] = (kV, cV, rV); tables[t + ' (APP)'] = (kA, cA, rA); continue
        cols = cV + [c for c in cA if c not in cV]
        byA = {r.get(kA): r for r in rA if r.get(kA)}
        merged = []; seen = set()
        for r in rV:
            k = r.get(kV); a = byA.get(k, {})
            m = dict(a); m.update(r); merged.append(m); seen.add(k)
        for r in rA:
            if r.get(kA) not in seen: merged.append(r)
        merged.sort(key=lambda r: r['__rn'])
        tables[t] = (kV, cols, merged)
    else:
        tables[t] = load('VENTAS' if inV else 'APP', t)

# ---- Inferencia de tipos ----
MONEY = re.compile(r'IMPORTE|COSTO|MARGEN(?!.*%)|PRECIO|VALOR|TOTAL|GASTOS|CONTADO|PERMUTA / FIN|INFO A|COBRADO_CLIENTE|SALDO|VENTA$|PERITAJE$|DOCUMENTACION$|MECANICA$|ALISTAJE$|COMPRAS|DEUDAS|GESTORIA$|INFRACCIONES|MUNICIPALIDAD|RENTAS|CANCELACION|COBRO_REAL|DIFERENCIA|MONTO|PRESUPUESTO|POSICION_VENTA|INTERES|^\$|ARANCELES|FORMULARIO$|CERTIFICACION FIRMA$|NOTA DENUNCIA|ALTA MUNICIPAL|BAJA MUNICIPAL|PATENTES? |MULTAS|MOVILIDAD|HONORARIOS|VERIFICACION$|IMPUESTO|PATENTAMIENTO|IMP \+|GANANCIA|NETO|SELLADO|PROCURACION|ART 25|^CARGA$|BONIFICACIONES|CONTROL|^TC$|CUOTA_MENSUAL|DIF PERITAJE|PERITAJE OFICIAL|RECIBO_SUELDO|ALICUOTA|DESCUENTO$|5% COM', re.I)
NOTNUM = re.compile(r'DNI|CUIL|CUIT|TEL|ID|CHASIS|MOTOR|DOMINIO|N° RECIBO|^OC$|^OT|ALIAS|^08$|^13D$|^01$|CUOTAS', re.I)
OVERRIDES = {
    ('*', 'USUARIO'): {'t': 'text'}, ('*', 'USUARIO_CI'): {'t': 'text'}, ('*', 'USUARIO_CARGA_INICIAL'): {'t': 'text'},
    ('*', 'MES'): {'t': 'text'}, ('*', 'AÑOMES'): {'t': 'text'}, ('*', 'DIAS_VENTA'): {'t': 'num'},
    ('CALCULADOR', 'COSTO'): {'t': 'money'}, ('GESTORIA', 'MULTAS'): {'t': 'money'}, ('GESTORIA', 'FECHA_PRESENTADO'): {'t': 'date'},
    ('GESTORIA', 'MOVILIDAD'): {'t': 'money'}, ('CARGA', 'ALISTAJE'): {'t': 'money'}, ('CARGA', 'BONIFICACIONES'): {'t': 'money'},
    ('CARGA', 'FECHA_PAGO'): {'t': 'date'}, ('FORMA DE PAGO', 'FECHA_IMPUTACION'): {'t': 'date'},
    ('PERITAJE', 'PRESUPUESTO_COMERCIAL'): {'t': 'money'}, ('PERITAJE', 'MECANICA_COMERCIAL'): {'t': 'longtext'},
    ('FORMA DE PAGO', 'VALOR_TOMA_FINAL'): {'t': 'money'}, ('FORMA DE PAGO', 'INFO_AUTO'): {'t': 'money'},
    ('COMPRAS', 'OTT'): {'t': 'text'}, ('BOT_TUTU_VENTAS', 'CUOTA_MENSUAL_MAX'): {'t': 'text'},
    ('*', 'ID_MP'): {'t': 'text'}, ('DEUDA', 'DEUDA'): {'t': 'money'}, ('CARGA', 'DEUDA'): {'t': 'money'},
}
meta = {}
for t, (key, cols, rows) in tables.items():
    cm = []
    for c in cols:
        vals = [r[c] for r in rows if c in r]
        nn = len(vals); dist = collections.Counter(vals)
        info = {'k': c}
        isdate = nn and sum(1 for v in vals if re.match(r'^\d{4}-\d{2}-\d{2}$', v)) >= 0.9 * nn
        isdt = nn and sum(1 for v in vals if re.match(r'^\d{4}-\d{2}-\d{2}T', v)) >= 0.9 * nn
        def isnum(v):
            try: float(v); return True
            except: return False
        numeric = nn and sum(1 for v in vals if isnum(v)) >= 0.97 * nn
        if c in ('FOTO', 'FOTO_AUTO', 'VIDEO', 'IMAGEN'): info['t'] = 'img'
        elif isdt or c in ('HORA', 'HORA_CI', 'HORA_CARGA_INICIAL', 'CI'): info['t'] = 'datetime'
        elif isdate or (re.match(r'^(FECHA|VENCIMIENTO|DIA_RECLAMO|DESDE|HASTA|F\.|FECHA )', c) and not numeric): info['t'] = 'date'
        elif c in ('MARGEN %', '% COBRO'): info['t'] = 'pct'
        elif numeric and not NOTNUM.search(c) and c not in ('AÑO', 'AÑO C'):
            info['t'] = 'money' if MONEY.search(c) else 'num'
        elif c in ('AÑO', 'AÑO C', 'AÑO PERMUTA') and numeric: info['t'] = 'int'
        elif re.search(r'MAIL', c) and not re.search(r'MAILS?_', c): info['t'] = 'email' if any('@' in v for v in vals[:50]) else 'text'
        elif re.match(r'^(TEL|TELEFONO)$', c): info['t'] = 'phone'
        else:
            avg = sum(len(v) for v in vals) / nn if nn else 0
            if set(dist) <= {'Y', 'N', 'TRUE', 'FALSE', 'True', 'False'} and nn: info['t'] = 'enum'; info['opts'] = ['Y', 'N'] if set(dist) <= {'Y', 'N'} else sorted(dist)
            elif set(dist) <= {'SI', 'NO'} and nn: info['t'] = 'enum'; info['opts'] = ['SI', 'NO']
            elif nn >= 8 and len(dist) <= 30 and avg < 40 and not re.search(r'OBSERV|DESCRIPCION|DEUDOR|CLIENTE|NOMBRE|MODELO|VEHICULO', c):
                info['t'] = 'enum'; info['opts'] = [v for v, _ in dist.most_common()]
            elif avg > 60: info['t'] = 'longtext'
            else: info['t'] = 'text'
        ov = OVERRIDES.get((t, c)) or OVERRIDES.get(('*', c))
        if ov: info = {'k': c, **ov}
        cm.append(info)
    meta[t] = {'key': key, 'cols': cm, 'count': len(rows)}

# Tabla nueva (no existe en AppSheet con datos): órdenes de pago
meta['ORDEN_PAGO'] = {'key': 'ID_OP', 'count': 0, 'cols': [
    {'k': 'ID_OP', 't': 'text'}, {'k': 'CBU/CVU/Alias/Nro cuenta', 't': 'text'}, {'k': 'Importe', 't': 'money'},
    {'k': 'Motivo', 't': 'enum', 'opts': ['PROVEEDOR', 'SUELDO', 'SERVICIO', 'IMPUESTO', 'DEVOLUCION', 'OTRO']},
    {'k': 'Descripción gasto', 't': 'longtext'}, {'k': 'Email destinatario', 't': 'email'}, {'k': 'Mensaje del email', 't': 'longtext'},
    {'k': 'AUTORIZO', 't': 'text'}, {'k': 'AREA', 't': 'enum', 'opts': ['RECURSOS HUMANOS', 'ADMINISTRACION', 'COMERCIAL', 'DIRECCION', 'MARKETING', 'GESTORIA', 'ALISTAJE', '0KM', 'CONSIGNACION']},
    {'k': 'VENCIMIENTO', 't': 'date'}, {'k': 'DOMINIO', 't': 'text'}, {'k': 'VEHICULO', 't': 'text'}, {'k': 'OBSERVACIONES', 't': 'longtext'},
    {'k': 'RECURRENTE', 't': 'enum', 'opts': ['N', 'Y']}, {'k': 'USUARIO', 't': 'text'}, {'k': 'HORA', 't': 'datetime'}]}

seed = {t: [{k: v for k, v in r.items() if k != '__rn'} for r in rows] for t, (key, cols, rows) in tables.items()}
with gzip.open(f'{outdir}/panel-datos.json.gz', 'wt', encoding='utf-8') as f:
    json.dump({'version': 1, 'generado': dt.datetime.now().isoformat(timespec='seconds'), 'tablas': seed}, f, ensure_ascii=False, separators=(',', ':'))
with open(f'{pubdir}/tables.js', 'w') as f:
    f.write('/* Generado por scripts/build_seed.py a partir de las tablas de AppSheet */\n')
    f.write('(function (r) { const T = ' + json.dumps(meta, ensure_ascii=False) + ';\n')
    f.write("if (typeof module !== 'undefined' && module.exports) module.exports = T; else r.TABLE_META = T; })(typeof window !== 'undefined' ? window : globalThis);\n")
tot = sum(len(r) for _, _, r in tables.values())
print('tablas', len(tables), 'filas', tot)
for t, m in meta.items(): print(f"  {t}: {m['count']}")
