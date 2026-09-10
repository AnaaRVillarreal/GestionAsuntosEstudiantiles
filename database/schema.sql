-- ============================================================
-- Esquema de base de datos: Sistema de Solicitudes Estudiantiles
-- PostgreSQL
-- ============================================================

CREATE TYPE tipo_tramite AS ENUM (
  'reserva_espacio',
  'transporte',
  'evento',
  'constancia',
  'oficio_presentacion'
);

CREATE TYPE estado_solicitud AS ENUM (
  'enviado',
  'en_revision',
  'aprobado',
  'rechazado'
);

-- Entradas: datos del estudiante
CREATE TABLE estudiantes (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  matricula     VARCHAR(20)  NOT NULL UNIQUE,
  correo        VARCHAR(150) NOT NULL,
  telefono      VARCHAR(20),
  creado_en     TIMESTAMP NOT NULL DEFAULT now()
);

-- Espacios/auditorios reservables
CREATE TABLE espacios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  capacidad     INTEGER,
  ubicacion     VARCHAR(150)
);

-- Entradas: la solicitud / trámite en sí
CREATE TABLE solicitudes (
  id              SERIAL PRIMARY KEY,
  estudiante_id   INTEGER NOT NULL REFERENCES estudiantes(id),
  tipo            tipo_tramite NOT NULL,
  descripcion     TEXT NOT NULL,
  fecha_evento    DATE,
  hora_inicio     TIME,
  hora_fin        TIME,
  espacio_id      INTEGER REFERENCES espacios(id),
  estado          estado_solicitud NOT NULL DEFAULT 'enviado',
  folio           VARCHAR(30) UNIQUE,
  oficio_pdf_ruta TEXT,
  creado_en       TIMESTAMP NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMP NOT NULL DEFAULT now()
);

-- Entradas: archivos adjuntos (programas de evento, etc.)
CREATE TABLE archivos_adjuntos (
  id              SERIAL PRIMARY KEY,
  solicitud_id    INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  nombre_original VARCHAR(255) NOT NULL,
  ruta_archivo    TEXT NOT NULL,
  subido_en       TIMESTAMP NOT NULL DEFAULT now()
);

-- Actuador: motor de notificaciones -> historial de correos enviados
CREATE TABLE notificaciones (
  id            SERIAL PRIMARY KEY,
  solicitud_id  INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  destinatario  VARCHAR(150) NOT NULL,
  asunto        VARCHAR(200) NOT NULL,
  cuerpo        TEXT NOT NULL,
  enviado_en    TIMESTAMP NOT NULL DEFAULT now()
);

-- Sensor: registro de acciones (trazabilidad / "mediciones" del sistema)
CREATE TABLE registro_acciones (
  id            SERIAL PRIMARY KEY,
  solicitud_id  INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  accion        VARCHAR(100) NOT NULL,
  detalle       TEXT,
  creado_en     TIMESTAMP NOT NULL DEFAULT now()
);

-- Actuador: bloqueador de fechas -> espacios ya reservados por fecha/hora
CREATE TABLE reservas_bloqueadas (
  id            SERIAL PRIMARY KEY,
  espacio_id    INTEGER NOT NULL REFERENCES espacios(id),
  solicitud_id  INTEGER NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL,
  hora_inicio   TIME NOT NULL,
  hora_fin      TIME NOT NULL,
  UNIQUE (espacio_id, fecha, hora_inicio, hora_fin)
);

CREATE INDEX idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX idx_reservas_espacio_fecha ON reservas_bloqueadas(espacio_id, fecha);

-- ============================================================
-- Autenticación: dos roles -> estudiante y responsable
-- ============================================================

CREATE TYPE rol_usuario AS ENUM ('estudiante', 'responsable');

CREATE TABLE usuarios (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  correo         VARCHAR(150) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  rol            rol_usuario NOT NULL,
  estudiante_id  INTEGER REFERENCES estudiantes(id), -- solo aplica si rol = 'estudiante'
  creado_en      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_correo ON usuarios(correo);
