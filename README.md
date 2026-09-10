# Sistema de Solicitudes Estudiantiles

Full-stack: **PostgreSQL + Node.js/Express + React**.
Implementa el flujo completo descrito: entradas, salidas, sensores
(validadores, verificador de disponibilidad, detector de conflictos,
registro de acciones) y actuadores (generador de PDF, motor de
notificaciones, actualizador de estados, bloqueador de fechas).

## Estructura

```
solicitudes-sistema/
├── database/schema.sql          # esquema PostgreSQL
├── backend/                     # API Express
│   ├── server.js
│   ├── db.js
│   ├── routes/                  # solicitudes.js, calendario.js
│   └── services/                # sensores y actuadores (ver comentarios)
└── frontend/                    # React (Vite)
    └── src/
        ├── App.jsx
        └── components/          # FormularioSolicitud, ListaSolicitudes, Calendario
```

## 1) Base de datos

```bash
createdb solicitudes_db
psql -d solicitudes_db -f database/schema.sql
```

Inserta al menos un espacio de prueba:

```sql
INSERT INTO espacios (nombre, capacidad, ubicacion) VALUES ('Auditorio A', 120, 'Edificio 1');
```

## 2) Backend

```bash
cd backend
cp .env.example .env      # edita con tus credenciales de PostgreSQL
npm install
npm run dev                # http://localhost:4000
```

## 3) Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

El frontend usa un proxy (`vite.config.js`) hacia `http://localhost:4000`,
así que las peticiones a `/api/...` funcionan directo en desarrollo.

## Autenticación (dos roles)

- **estudiante**: se registra él mismo desde el frontend (`Crear cuenta`).
  Solo puede crear solicitudes y ver/descargar las suyas.
- **responsable**: aprueba o rechaza. Su cuenta **no** se crea desde el
  frontend por seguridad; se crea en el servidor con:

  ```bash
  cd backend
  node scripts/crearResponsable.js "Nombre Apellido" correo@escuela.edu contraseña
  ```

  Luego inicia sesión normalmente desde la pantalla de login.

Todas las rutas de `/api/solicitudes` y `/api/calendario` requieren el
encabezado `Authorization: Bearer <token>` (el frontend ya lo maneja
automáticamente a través de `src/api.js`). El token se firma con
`JWT_SECRET` (defínelo en `.env`) y expira según `JWT_EXPIRA_EN`.

## API de mensajería: cómo se actualiza por correo en cada cambio de estado

El envío de correo **no se llama manualmente en cada ruta**: vive centralizado
dentro del actuador `actualizadorEstados.js`. El flujo es:

```
routes/solicitudes.js
      │  actualizarEstado(id, 'aprobado', { folio })
      ▼
services/actualizadorEstados.js
      │  1. UPDATE solicitudes SET estado = ...
      │  2. registrarAccion(...)                 ← sensor: trazabilidad
      │  3. busca la plantilla para ese estado
      ▼
services/plantillasCorreo.js
      │  arma { asunto, cuerpo } según el estado
      ▼
services/motorNotificaciones.js
      │  guarda el correo en la tabla "notificaciones"
      ▼
services/proveedorCorreo.js
      │  IF EMAIL_PROVIDER=resend -> llama a la API HTTP de Resend
      │  IF EMAIL_PROVIDER=smtp   -> envía por SMTP (nodemailer)
      │  ELSE                     -> solo lo imprime en consola (dev)
```

Ventajas de esta separación:

- **Ningún estado nuevo se puede olvidar de notificar**: basta con llamar
  `actualizarEstado(id, nuevoEstado, opciones)` desde cualquier parte del
  código, y si existe una plantilla para ese estado, el correo sale solo.
- **Cambiar de proveedor de correo no toca el resto del sistema**: para
  usar SendGrid, Mailgun o Amazon SES en vez de Resend, solo se agrega
  una función `enviarPorX()` en `proveedorCorreo.js` y se cambia
  `EMAIL_PROVIDER` en `.env`.
- **Nuevos estados o avisos** (por ejemplo, "recordatorio" o "en espera de
  documentos") solo requieren agregar una entrada en `plantillasCorreo.js`.

Para producción real, lo ideal es que `enviarNotificacion` no bloquee la
respuesta HTTP: se puede encolar (por ejemplo con BullMQ + Redis) y que un
worker aparte llame a `proveedorCorreo.enviarCorreo`, reintentando si el
proveedor falla. No está incluido aquí para mantener el proyecto simple,
pero es el siguiente paso natural si el volumen de solicitudes crece.

## Flujo IF / ELSE implementado

- **Validador de campos**: si los datos no son válidos → 400 con errores; si son válidos → continúa.
- **Tipo de trámite = reserva de espacio** → se valida disponibilidad y conflictos; si NO es reserva → se omite ese paso.
- **Verificador de disponibilidad**: si el espacio está ocupado → 409; si está libre → continúa.
- **Detector de conflictos**: si hay una solicitud aprobada traslapada → 409; si no → continúa.
- **Aprobación**: si es reserva de espacio → bloquea la fecha antes de generar el oficio.
- **Autenticación**: si el rol es "estudiante" → solo ve/crea sus propias solicitudes; si es "responsable" → ve todas y puede aprobar/rechazar.

## Notas

- El envío de correos es opcional: si no configuras `SMTP_HOST` en `.env`,
  las notificaciones solo se imprimen en la consola del backend (modo desarrollo).
- Los PDFs generados se guardan en `backend/oficios/`.
