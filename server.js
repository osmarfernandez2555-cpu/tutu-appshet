// Panel App Ventas — servidor (Express + PostgreSQL en Railway; archivo JSON local si no hay DATABASE_URL)
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const bcrypt = require('bcryptjs');
const META = require('./public/tables.js');
const PANEL = require('./public/views.js');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
// Contraseña de acceso: "Tutu2026" guardada como hash (nunca en texto plano).
// Para cambiarla sin tocar el código, definí la variable PANEL_PASSWORD en Railway.
const PASS_HASH = process.env.PANEL_PASSWORD
  ? bcrypt.hashSync(process.env.PANEL_PASSWORD, 10)
  : '$2a$10$MxfixESdhelgJsmzVZ/eP.YV0tEGdqCKarcvhq08sGKfEaVFY7/fC';
const TABLAS = Object.keys(META);
const TZ = 'America/Argentina/Cordoba';

// ---------- Almacenamiento ----------
function makeStore() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const url = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString: url, ssl: process.env.PGSSL === 'false' || /localhost|127\.0\.0\.1|railway\.internal/.test(url) ? false : { rejectUnauthorized: false } });
    return {
      kind: 'postgres',
      async init() {
        await pool.query(`CREATE TABLE IF NOT EXISTS records (id BIGSERIAL PRIMARY KEY, tabla TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ DEFAULT now())`);
        await pool.query('CREATE INDEX IF NOT EXISTS records_tabla ON records(tabla, id)');
      },
      async counts() { const r = await pool.query('SELECT tabla, count(*)::int AS n FROM records GROUP BY tabla'); return Object.fromEntries(r.rows.map((x) => [x.tabla, x.n])); },
      async table(t) { return (await pool.query('SELECT id, data FROM records WHERE tabla=$1 ORDER BY id', [t])).rows; },
      async get(id) { return (await pool.query('SELECT id, tabla, data FROM records WHERE id=$1', [id])).rows[0]; },
      async insert(t, data) { return (await pool.query('INSERT INTO records(tabla,data) VALUES($1,$2) RETURNING id, data', [t, data])).rows[0]; },
      async update(id, data) { return (await pool.query('UPDATE records SET data=$2, updated_at=now() WHERE id=$1 RETURNING id, data', [id, data])).rows[0]; },
      async remove(id) { await pool.query('DELETE FROM records WHERE id=$1', [id]); },
      async replaceAll(tablas) {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          await c.query('DELETE FROM records');
          for (const [t, rows] of Object.entries(tablas)) {
            for (let i = 0; i < rows.length; i += 500) {
              const chunk = rows.slice(i, i + 500);
              const vals = []; const params = [];
              chunk.forEach((r, j) => { vals.push(`($${2 * j + 1}, $${2 * j + 2})`); params.push(t, r); });
              await c.query(`INSERT INTO records(tabla,data) VALUES ${vals.join(',')}`, params);
            }
          }
          await c.query('COMMIT');
        } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      },
    };
  }
  const file = process.env.DATA_FILE || path.join(__dirname, 'data.json');
  let db = { seq: 0, records: [] };
  const save = () => fs.writeFileSync(file, JSON.stringify(db));
  return {
    kind: 'archivo',
    async init() { if (fs.existsSync(file)) db = JSON.parse(fs.readFileSync(file, 'utf8')); console.log('Sin DATABASE_URL: datos en', file); },
    async counts() { const c = {}; for (const r of db.records) c[r.tabla] = (c[r.tabla] || 0) + 1; return c; },
    async table(t) { return db.records.filter((r) => r.tabla === t).map(({ id, data }) => ({ id, data })); },
    async get(id) { return db.records.find((r) => r.id == id); },
    async insert(t, data) { const r = { id: ++db.seq, tabla: t, data }; db.records.push(r); save(); return r; },
    async update(id, data) { const r = db.records.find((x) => x.id == id); if (r) { r.data = data; save(); } return r; },
    async remove(id) { db.records = db.records.filter((r) => r.id != id); save(); },
    async replaceAll(tablas) { db = { seq: 0, records: [] }; for (const [t, rows] of Object.entries(tablas)) for (const d of rows) db.records.push({ id: ++db.seq, tabla: t, data: d }); save(); },
  };
}
const store = makeStore();

// ---------- Sesión (cookie firmada) ----------
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const makeToken = (nombre) => { const p = Buffer.from(JSON.stringify({ n: nombre, x: Date.now() + 14 * 864e5 })).toString('base64url'); return p + '.' + sign(p); };
function readToken(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)panel=([^;]+)/); if (!m) return null;
  const [p, s] = m[1].split('.'); if (!p || !s) return null;
  const a = Buffer.from(sign(p)); const b = Buffer.from(s);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.x > Date.now() ? d : null; } catch { return null; }
}
const auth = (req, res, next) => { const u = readToken(req); if (!u) return res.status(401).json({ error: 'Ingresá la contraseña' }); req.user = u; next(); };
// La app TUTU - VENTAS (contraseña) toca estas tablas; el resto es de uso libre.
const PROTEGIDAS = new Set(['CARGA', 'FORMA DE PAGO', 'DEUDOR', 'FINANZAS', '0KM_NACIONALES', 'BOT_TUTU_VENTAS', 'CREDITOS EXTERNOS', 'PREVENTA', 'CONSIGNADORES']);
const maybeAuth = (req, res, next) => { req.user = readToken(req) || null; next(); };
const needTable = (req, res, next) => { if (PROTEGIDAS.has(req.params.tabla) && !req.user) return res.status(401).json({ error: 'Esta sección es de Ventas: ingresá la contraseña.' }); next(); };
const quien = (req) => (req.user ? req.user.n : (String((req.body && req.body.__quien) || '').trim().slice(0, 80) || 'público'));

// Límite de intentos de contraseña: 10 cada 15 minutos por IP
const intentos = new Map();
function limitar(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const now = Date.now(); const e = (intentos.get(ip) || []).filter((t) => now - t < 15 * 60e3);
  if (e.length >= 10) return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' });
  e.push(now); intentos.set(ip, e); next();
}

const ahora = () => new Date().toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T');
const nuevoId = () => crypto.randomBytes(4).toString('hex');
const AUDIT_EDIT = [['USUARIO', 'HORA'], ['USER', 'HORA']];
const AUDIT_NEW = [['USUARIO_CARGA_INICIAL', 'HORA_CARGA_INICIAL'], ['USUARIO_CI', 'HORA_CI'], ['USER_CI', 'HORA_CI'], ['USUARIO CI', 'CI']];
const tiene = (t, k) => META[t].cols.some((c) => c.k === k);

function limpiar(t, data) {
  const out = {};
  for (const c of META[t].cols) {
    let v = data[c.k];
    if (v === undefined || v === null || v === '') continue;
    if (['money', 'num', 'int', 'pct'].includes(c.t)) { v = Number(v); if (isNaN(v)) continue; }
    else if (typeof v === 'string') v = v.trim();
    out[c.k] = v;
  }
  return out;
}
function auditar(t, d, quien, nuevo, prev) {
  const now = ahora();
  for (const [u, h] of AUDIT_EDIT) if (tiene(t, u)) { d[u] = quien; if (tiene(t, h)) d[h] = now; }
  for (const [u, h] of AUDIT_NEW) if (tiene(t, u)) {
    if (nuevo) { d[u] = quien; if (tiene(t, h)) d[h] = now; }
    else if (prev) { if (prev[u]) d[u] = prev[u]; if (prev[h]) d[h] = prev[h]; }
  }
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '5m' }));

app.post('/api/login', limitar, (req, res) => {
  const ok = bcrypt.compareSync(String(req.body.password || ''), PASS_HASH);
  if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const nombre = String(req.body.nombre || '').trim().slice(0, 80) || 'panel';
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `panel=${makeToken(nombre)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${secure}`);
  res.json({ nombre });
});
app.post('/api/logout', (req, res) => { res.setHeader('Set-Cookie', 'panel=; Path=/; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/me', maybeAuth, async (req, res) => res.json({ logged: !!req.user, nombre: req.user ? req.user.n : null, counts: await store.counts(), almacenamiento: store.kind, protegidas: [...PROTEGIDAS] }));

app.get('/api/t/:tabla', maybeAuth, needTable, async (req, res) => {
  const t = req.params.tabla; if (!TABLAS.includes(t)) return res.status(404).json({ error: 'Tabla inexistente' });
  const rows = await store.table(t);
  res.json(rows.map((r) => ({ _id: Number(r.id), ...r.data })));
});

app.post('/api/rec/:tabla', maybeAuth, needTable, async (req, res) => {
  const t = req.params.tabla; if (!TABLAS.includes(t)) return res.status(404).json({ error: 'Tabla inexistente' });
  const d = limpiar(t, req.body);
  const idCol = PANEL.NEW_ID[t]; if (idCol && !d[idCol]) d[idCol] = nuevoId();
  auditar(t, d, quien(req), true);
  const r = await store.insert(t, d);
  res.json({ _id: Number(r.id), ...r.data });
});
app.put('/api/rec/:tabla/:id', maybeAuth, needTable, async (req, res) => {
  const { tabla: t, id } = req.params;
  const prev = await store.get(id); if (!prev || prev.tabla !== t) return res.status(404).json({ error: 'Registro inexistente' });
  const d = limpiar(t, req.body);
  // Las columnas que el panel no muestra se conservan tal cual estaban
  for (const [k, v] of Object.entries(prev.data)) if (!(k in req.body)) d[k] = v;
  auditar(t, d, quien(req), false, prev.data);
  const r = await store.update(id, d);
  res.json({ _id: Number(r.id), ...r.data });
});
app.delete('/api/rec/:tabla/:id', maybeAuth, needTable, async (req, res) => {
  const prev = await store.get(req.params.id); if (!prev || prev.tabla !== req.params.tabla) return res.status(404).json({ error: 'Registro inexistente' });
  await store.remove(req.params.id); res.json({ ok: true });
});

// Carga inicial: se sube panel-datos.json.gz desde la pantalla de bienvenida (solo si la base está vacía,
// o con reemplazar=1 para volver a cargar todo).
app.post('/api/seed', auth, express.raw({ type: '*/*', limit: '60mb' }), async (req, res) => {
  try {
    const counts = await store.counts(); const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0 && req.query.reemplazar !== '1') return res.status(409).json({ error: 'La base ya tiene datos. Usá "Reemplazar todo" si querés volver a cargarla.' });
    let buf = req.body; if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    const j = JSON.parse(buf.toString('utf8'));
    if (!j.tablas) return res.status(400).json({ error: 'El archivo no es un respaldo del panel (falta "tablas").' });
    const tablas = {}; let n = 0;
    for (const [t, rows] of Object.entries(j.tablas)) { if (!TABLAS.includes(t)) continue; tablas[t] = rows.map((r) => limpiar(t, r)); n += rows.length; }
    await store.replaceAll(tablas);
    res.json({ ok: true, filas: n, tablas: Object.keys(tablas).length });
  } catch (e) { console.error(e); res.status(400).json({ error: 'No se pudo leer el archivo: ' + e.message }); }
});

// Respaldo completo descargable
app.get('/api/backup', auth, async (req, res) => {
  const tablas = {}; for (const t of TABLAS) tablas[t] = (await store.table(t)).map((r) => r.data);
  const gz = zlib.gzipSync(JSON.stringify({ version: 1, generado: ahora(), tablas }));
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="panel-respaldo-${ahora().slice(0, 10)}.json.gz"`);
  res.send(gz);
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

(async () => {
  await store.init();
  app.listen(PORT, () => console.log('Panel App Ventas escuchando en puerto', PORT, '· almacenamiento:', store.kind));
})().catch((e) => { console.error('Error al iniciar:', e); process.exit(1); });
