# Panel App Ventas

Copia web de las dos apps de AppSheet de Tutu Automotores en un solo panel:

- **TUTU - VENTAS** (17 secciones): Nueva venta, Calculador, Reportes, Ventas, Bot, Preventa, Ventas mes en curso, Reportes vendedor, Reporte comisiones, Clientes, Detalle formas de pago, Control créditos, Permutas, Calculador histórico, Control costos y Finanzas.
- **TUTU - APP** (20 secciones): Calculador histórico, Ingreso auto, Calculador ventas, Ventas, Consignación, Marketing, Calendario, Permutas, Compras, Conciliación compras, Documentación, Deudas, Gestoría, Revisar, Peritajes por realizar, Peritaje, Posventa, Entregas, Entregas realizadas y Orden de pago.
- Más dos secciones del panel: **Todas las tablas** (ver cualquier tabla cruda) y **Datos y respaldo**.

## Acceso: dos zonas

- **TUTU - APP es de uso libre**, sin contraseña. Al abrir el panel entrás directo ahí (calculador, stock, peritajes, compras, documentación, deudas, gestoría, entregas, posventa, conciliación, orden de pago). Se puede ver y cargar sin clave.
- **TUTU - VENTAS pide la contraseña `Tutu2026`.** En el menú aparece con un candado; al abrir cualquiera de sus secciones (ventas, clientes, formas de pago, control de créditos, comisiones, finanzas, preventa, bot, permutas) pide la clave una vez y queda abierta hasta que salgas. "Datos y respaldo" también pide la contraseña.
- Protección real: el servidor bloquea las tablas de ventas (ventas, clientes, formas de pago, créditos, finanzas, preventa, bot, consignadores) sin la contraseña, no solo oculta el menú.

Tanto en la zona libre como en Ventas se pide tu nombre o email, que queda registrado en cada cambio (columna USUARIO). En la zona libre se guarda en tu navegador para no tener que repetirlo.

## Qué trae cargado

Vienen **todos los datos reales** exportados de AppSheet: 33.507 registros en 37 tablas (ventas, formas de pago, compras, calculador, peritajes, gestoría, entregas, clientes, etc.). Se cargan una sola vez desde el archivo `panel-datos.json.gz` incluido.

## Qué puede hacer

- Buscar, ordenar por columna, agrupar y ver el detalle de cada registro.
- Agregar, editar y borrar.
- Exportar cualquier sección a CSV (se abre en Excel).
- En el detalle de un vehículo se ven sus ventas, peritajes, compras, documentación, deudas, gestoría y posventa relacionadas.
- Al cargar una venta, el dominio completa marca, modelo, año, color, costo y consignador desde el stock; el DNI completa el cliente.
- Fórmulas calculadas en vivo (verificadas una por una contra AppSheet): margen, margen %, valor USD, margen USD, días en stock, días de venta, total de formas de pago, totales y diferencias de deudas, gestoría, peritaje y conciliación.
- "Generar PDF" en cada venta.
- Respaldo completo descargable desde "Datos y respaldo".

## Subir a Railway, paso a paso

1. **Subir a GitHub.** Creá un repositorio nuevo (por ejemplo `panel-app-ventas`) y subí todo el contenido de esta carpeta, incluido `panel-datos.json.gz`. El `.gitignore` ya excluye `node_modules` y `data.json`.
2. **Crear el proyecto en Railway.** New Project → Deploy from GitHub repo → elegí `panel-app-ventas`.
3. **Agregar la base de datos.** + New → Database → PostgreSQL.
4. **Variables del servicio `panel-app-ventas`** (pestaña Variables):
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (con el botón "Add Reference", elegí Postgres)
   - `SESSION_SECRET` = un texto largo cualquiera (40 letras al azar)
   - `NODE_ENV` = `production`
   - La contraseña ya es `Tutu2026`. Si querés cambiarla sin tocar el código, agregá `PANEL_PASSWORD` con la nueva.
5. **Generar la URL pública.** Settings → Networking → Generate Domain.
6. **Entrar.** Abrí la URL: entra directo a la zona libre (TUTU - APP). Para la sección de Ventas, poné `Tutu2026`.
7. **Cargar los datos.** La primera vez el panel aparece vacío y muestra una pantalla para subir un archivo. Subí `panel-datos.json.gz` (está en el repositorio; descargalo de GitHub o usalo desde tu computadora). Tarda un minuto y queda cargado para siempre en la base de Railway.

## Errores comunes

- **"Application failed to respond".** En Deployments → View logs tiene que decir "Panel App Ventas escuchando en puerto…". Si no, falta alguna variable del paso 4.
- **`ECONNREFUSED` o `ENOTFOUND` al iniciar.** `DATABASE_URL` no apunta a la base. Cargala de nuevo como referencia a Postgres.
- **`The server does not support SSL connections`.** Agregá la variable `PGSSL` = `false`.
- **"La base ya tiene datos" al subir el archivo.** Ya estaba cargada. Si querés reemplazar todo, usá "Datos y respaldo" → "Elegir archivo" y confirmá "Reemplazar todo".
- **La contraseña es solo para Ventas.** TUTU - APP no la pide. Si querés cambiar la de Ventas, definí `PANEL_PASSWORD` en Railway con la nueva y redeployá.
- **Tarda al abrir una sección la primera vez.** Cada tabla se baja una sola vez y queda en memoria; de la segunda vez en adelante es instantáneo.

## Probar en tu computadora

```bash
npm install
PANEL_PASSWORD=Tutu2026 npm start
```

Abrí http://localhost:3000. La primera carga de datos (pantalla de bienvenida) pide la contraseña `Tutu2026`; subí `panel-datos.json.gz`. Sin `DATABASE_URL`, los datos quedan en `data.json`.

## Seguridad

- La contraseña se guarda como hash (bcrypt), nunca en texto plano en el código.
- Máximo 10 intentos de contraseña cada 15 minutos por IP.
- La página no se indexa en buscadores.
- Los datos tienen información de clientes (CUIL, nombres, teléfonos): compartí la URL y la contraseña solo con quien corresponda.

## Pendientes respecto de AppSheet

- **Fórmulas reconstruidas.** El editor de AppSheet no está accesible, así que las fórmulas se armaron a partir de los datos y se verificaron contra el 100% de los registros reales. Las de margen, USD, días, totales y conciliación coinciden exactamente. Si aparece alguna columna calculada que no cierra, avisá y la ajusto.
- **Columnas no mostradas al editar.** Se conservan tal cual; el panel solo toca las que ves.
- **Orden de pago** guarda la orden pero no envía el mail (en AppSheet la tabla estaba vacía).
- **Reportes / Power BI:** los reportes se recrearon como tabla con filtros por fecha y estado; no incluye el enlace a Power BI.
