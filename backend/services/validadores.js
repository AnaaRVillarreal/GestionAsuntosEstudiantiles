// ============================================================
// SENSOR: Validadores de campos
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
  if (!telefono) return true;
  return /^[0-9+()\-\s]{7,20}$/.test(telefono);
}

function validarFecha(fecha) {
  if (!fecha) return true;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return d >= hoy;
}

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

// SENSOR: valida los campos específicos según el tipo de trámite,
// almacenados en el objeto "detalles".
function validarDetallesTramite(tipo, detalles = {}) {
  const errores = [];

  // IF / ELSE según el tipo de trámite -> cada uno exige campos distintos
  if (tipo === 'transporte') {
    if (!detalles.destino || detalles.destino.trim().length < 3) {
      errores.push('Debes indicar el destino del transporte.');
    }
    if (!detalles.num_pasajeros || Number(detalles.num_pasajeros) < 1) {
      errores.push('Debes indicar el número de pasajeros (mínimo 1).');
    }
  } else if (tipo === 'evento') {
    if (!detalles.nombre_evento || detalles.nombre_evento.trim().length < 3) {
      errores.push('Debes indicar el nombre del evento.');
    }
    if (!detalles.asistentes_esperados || Number(detalles.asistentes_esperados) < 1) {
      errores.push('Debes indicar el número de asistentes esperados.');
    }
  } else if (tipo === 'constancia') {
    if (!detalles.tipo_constancia || detalles.tipo_constancia.trim().length < 3) {
      errores.push('Debes indicar el tipo de constancia solicitada.');
    }
    if (!detalles.institucion_destino || detalles.institucion_destino.trim().length < 3) {
      errores.push('Debes indicar para qué institución es la constancia.');
    }
  } else if (tipo === 'oficio_presentacion') {
    if (!detalles.dirigido_a || detalles.dirigido_a.trim().length < 3) {
      errores.push('Debes indicar a quién va dirigido el oficio.');
    }
    if (!detalles.institucion_destino || detalles.institucion_destino.trim().length < 3) {
      errores.push('Debes indicar el nombre de la institución o empresa destino.');
    }
  }
  // ELSE (tipo === 'reserva_espacio') -> no requiere "detalles" extra,
  // ya usa fecha_evento, hora_inicio, hora_fin y espacio_id directamente.

  return errores;
}

function validarDatosTramite(data) {
  const errores = [];

  if (!TIPOS_VALIDOS.includes(data.tipo)) {
    errores.push('El tipo de trámite no es válido.');
  }
  if (!data.descripcion || data.descripcion.trim().length < 10) {
    errores.push('La descripción debe tener al menos 10 caracteres.');
  }

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

  errores.push(...validarDetallesTramite(data.tipo, data.detalles));

  return { valido: errores.length === 0, errores };
}

module.exports = { validarRegistroEstudiante, validarDatosTramite };