// ============================================================
// SENSOR: Validadores de campos
// Revisa en tiempo real que los datos ingresados tengan el
// formato correcto (matrícula, correo, fechas, etc.)
// ============================================================

const TIPOS_VALIDOS = [
  'reserva_espacio',
  'transporte',
  'evento',
  'constancia',
  'oficio_presentacion'
];

function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo || '');
}

function validarMatricula(matricula) {
  return /^[A-Za-z0-9]{5,20}$/.test(matricula || '');
}

function validarTelefono(telefono) {
  if (!telefono) return true; // opcional
  return /^[0-9+()\-\s]{7,20}$/.test(telefono);
}

function validarFecha(fecha) {
  if (!fecha) return true; // no todos los trámites requieren fecha
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return d >= hoy; // IF fecha es pasada -> inválida
}

/**
 * Valida los datos personales al registrar una cuenta de estudiante.
 * @returns {{valido: boolean, errores: string[]}}
 */
function validarRegistroEstudiante(data) {
  const errores = [];

  if (!data.nombre || data.nombre.trim().length < 3) {
    errores.push('El nombre es obligatorio (mínimo 3 caracteres).');
  }
  if (!validarMatricula(data.matricula)) {
    errores.push('La matrícula no tiene un formato válido.');
  }
  if (!validarCorreo(data.correo)) {
    errores.push('El correo electrónico no tiene un formato válido.');
  }
  if (!validarTelefono(data.telefono)) {
    errores.push('El teléfono no tiene un formato válido.');
  }
  if (!data.password || data.password.length < 6) {
    errores.push('La contraseña debe tener al menos 6 caracteres.');
  }

  return { valido: errores.length === 0, errores };
}

/**
 * Valida los datos del trámite al crear una solicitud
 * (los datos personales ya se validaron al registrar la cuenta).
 * @returns {{valido: boolean, errores: string[]}}
 */
function validarDatosTramite(data) {
  const errores = [];

  if (!TIPOS_VALIDOS.includes(data.tipo)) {
    errores.push('El tipo de trámite no es válido.');
  }
  if (!data.descripcion || data.descripcion.trim().length < 10) {
    errores.push('La descripción debe tener al menos 10 caracteres.');
  }
  // IF el trámite es una reserva de espacio -> ELSE se exige fecha, hora y espacio
  if (data.tipo === 'reserva_espacio') {
    if (!validarFecha(data.fecha_evento)) {
      errores.push('La fecha del evento no es válida o ya pasó.');
    }
    if (!data.hora_inicio || !data.hora_fin) {
      errores.push('Debe indicar hora de inicio y fin para la reserva.');
    }
    if (!data.espacio_id) {
      errores.push('Debe seleccionar un espacio o auditorio.');
    }
  }

  return { valido: errores.length === 0, errores };
}

module.exports = { validarRegistroEstudiante, validarDatosTramite };
