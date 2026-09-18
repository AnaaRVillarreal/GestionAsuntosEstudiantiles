# Sistema de Solicitudes Estudiantiles

Full-stack: **PostgreSQL (Supabase) + Node.js/Express + React**.
Implementa el flujo completo: entradas, salidas, sensores (validadores,
verificador de disponibilidad, detector de conflictos, registro de
acciones) y actuadores (generador de PDF con firma digital, motor de
notificaciones, actualizador de estados, bloqueador de fechas).

## Estructura

solicitudes-sistema/
├── database/schema.sql # esquema PostgreSQL
├── backend/ # API Express
│ ├── server.js
│ ├── db.js
│ ├── middleware/auth.js # verifica el token y el rol (JWT)
│ ├── routes/
│ │ ├── auth.js # registro de estudiante y login (ambos roles)
│ │ ├── solicitudes.js # flujo principal (crear, listar, aprobar, rechazar)
│ │ ├── calendario.js # reservas aprobadas
│ │ ├── espacios.js # lista de auditorios/espacios (para el <select>)
│ │ └── verificacion.js # ruta pública para validar autenticidad de un oficio
│ ├── services/ # sensores y actuadores
│ └── scripts/crearResponsable.js # crea cuentas de responsable (no se hace por la web)
└── frontend/ # React (Vite)
└── src/
├── App.jsx
├── api.js # fetch con token de sesión
└── components/
├── Login.jsx
├── FormularioSolicitud.jsx
├── ListaSolicitudes.jsx
└── Calendario.jsx # vista mensual dinámica


## 1) Base de datos

### Opción A — Supabase (recomendada, en la nube)

1. Crea cuenta en **supabase.com** → **New project** (guarda la contraseña que definas ahí).
2. En el proyecto, ve a **SQL Editor** → **New query**, pega el contenido de `database/schema.sql` y dale **Run** (elige "Run without RLS" si te lo pregunta — el backend no usa la API pública de Supabase, se conecta directo con usuario/contraseña).
3. Ve a **Connect** (botón verde) → pestaña **Direct** → copia el host de conexión (algo como `db.xxxxxxxxxxxx.supabase.co`).
4. Inserta al menos un espacio de prueba, desde el mismo SQL Editor:
```sql
   INSERT INTO espacios (nombre, capacidad, ubicacion) VALUES ('Auditorio A', 120, 'Edificio 1');
```

<!--
### Opción B — PostgreSQL local (alternativa, sin depender de internet)

createdb solicitudes_db
psql -d solicitudes_db -f database/schema.sql

INSERT INTO espacios (nombre, capacidad, ubicacion) VALUES ('Auditorio A', 120, 'Edificio 1');

En Windows, si `psql` no se reconoce como comando, usa la ruta completa al
ejecutable (ej. "C:\Program Files\PostgreSQL\18\bin\psql.exe") o abre
"SQL Shell (psql)" desde el menú de inicio.
-->

## 2) Backend

```bash
cd backend
cp .env.example .env      # edita con tus credenciales (ver abajo)
npm install
npm run dev                # http://localhost:4000
```

### Variables de entorno (`.env`)

```dotenv
# Base de datos — Supabase
PGHOST=db.xxxxxxxxxxxx.supabase.co
PGPORT=5432
PGUSER=postgres
PGPASSWORD=tu_contraseña_de_supabase
PGDATABASE=postgres
PGSSL=true                 # Supabase lo exige; en local sería "false"

# Servidor
PORT=4000

# Autenticación
JWT_SECRET=una_cadena_larga_y_secreta
JWT_EXPIRA_EN=8h

# Motor de notificaciones (elige uno)
EMAIL_PROVIDER=smtp        # "smtp" | "resend" | vacío (solo consola, desarrollo)
EMAIL_FROM=tu_correo@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=contraseña_de_aplicación_de_16_caracteres   # no tu contraseña normal de Gmail
# RESEND_API_KEY=          # solo si EMAIL_PROVIDER=resend
```

Para Gmail: activa verificación en dos pasos en tu cuenta y genera una
"contraseña de aplicación" en `myaccount.google.com/apppasswords` — esa
es la que va en `SMTP_PASS`, no tu contraseña normal.

## 3) Frontend

```bash
cd frontend
npm install
npm run dev -- --host      # http://localhost:5173
```

El frontend usa un proxy (`vite.config.js`) hacia `http://localhost:4000`,
así que las peticiones a `/api/...` funcionan directo en desarrollo.

> Nota: `index.html` debe estar en la **raíz** de `frontend/` (junto a
> `package.json`), no dentro de `public/` — si Vite muestra 404 en `/`,
> es la causa más probable.

## Autenticación (dos roles)

- **estudiante**: se registra él mismo desde el frontend (`Crear cuenta`).
  Solo puede crear solicitudes y ver/descargar las suyas.
- **responsable**: aprueba o rechaza. Su cuenta se crea en el servidor,
  no desde la web:
```bash
  cd backend
  node scripts/crearResponsable.js "Nombre Apellido" correo@escuela.edu contraseña
```
  Además, **aprobar una solicitud exige volver a confirmar la contraseña**
  del responsable en ese momento (aunque ya haya iniciado sesión), como
  medida extra antes de emitir un oficio oficial.

Todas las rutas de `/api/solicitudes`, `/api/calendario` y `/api/espacios`
requieren `Authorization: Bearer <token>` (el frontend ya lo maneja vía
`src/api.js`).

## Autenticidad del oficio (firma digital + QR)

Cada oficio aprobado incluye:
- Un **código de verificación** (hash SHA-256, derivado del folio y una
  clave secreta del servidor — no se puede fabricar sin conocerla).
- Un **código QR** con ese mismo código.

Cualquiera puede validar un oficio (sin necesidad de iniciar sesión) en:

GET /api/verificar/:folio/:codigo


## Espacios y disponibilidad

- El formulario carga la lista real de auditorios desde `GET /api/espacios`
  (un `<select>`, no un ID a ciegas).
- Mientras el estudiante llena fecha/hora/espacio, el formulario consulta
  `GET /api/solicitudes/disponibilidad` y avisa en vivo si ese horario ya
  está ocupado, antes de que envíe la solicitud completa.

## Calendario dinámico

La vista de "Calendario" muestra un mes real (navegable), con cada reserva
aprobada como una etiqueta de color por espacio — ya no es una tabla
estática.

## API de mensajería: cómo se actualiza por correo en cada cambio de estado

El envío de correo está centralizado en `actualizadorEstados.js`, no se
llama manualmente en cada ruta — así ningún estado nuevo se puede olvidar
de notificar:

routes/solicitudes.js → actualizarEstado(id, nuevoEstado, opciones)
│
▼
services/actualizadorEstados.js
│ 1. UPDATE solicitudes SET estado = ...
│ 2. registrarAccion(...) ← sensor: trazabilidad
│ 3. busca la plantilla para ese estado
▼
services/plantillasCorreo.js → { asunto, cuerpo }
▼
services/motorNotificaciones.js → guarda el correo en "notificaciones"
▼
services/proveedorCorreo.js
│ IF EMAIL_PROVIDER=smtp -> Gmail/SMTP (con el PDF adjunto si fue aprobación)
│ IF EMAIL_PROVIDER=resend -> API HTTP de Resend
│ ELSE -> solo se imprime en consola (desarrollo)


## Flujo IF / ELSE implementado

- **Validador de campos**: si los datos no son válidos → 400 con errores; si son válidos → continúa.
- **Tipo de trámite**: cada tipo (reserva, transporte, evento, constancia, oficio) exige campos distintos, guardados en la columna `detalles` (JSON).
- **Verificador de disponibilidad**: si el espacio está ocupado → 409; si está libre → continúa.
- **Detector de conflictos**: si hay una solicitud aprobada traslapada → 409; si no → continúa.
- **Aprobación**: exige la contraseña del responsable; si es reserva de espacio → bloquea la fecha antes de generar el oficio.
- **Autenticación**: si el rol es "estudiante" → solo ve/crea sus propias solicitudes; si es "responsable" → ve todas y puede aprobar/rechazar.

## Notas

- Los PDFs generados se guardan en `backend/oficios/`.
- Sin `EMAIL_PROVIDER` configurado, las notificaciones solo se imprimen en la consola del backend (útil para desarrollo sin gastar envíos reales).