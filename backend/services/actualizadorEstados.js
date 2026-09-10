// ============================================================
// ACTUADOR: Actualizador de estados
// Cambia el estado de la solicitud en la base de datos y,
// automáticamente, dispara la notificación por correo que
// corresponde a ese nuevo estado (no hay que llamar al motor
// de notificaciones por separado desde cada ruta).
// ============================================================

const pool = require('../db');
const { registrarAccion } = require('./registroAcciones');
const { enviarNotificacion } = require('./motorNotificaciones');
const { obtenerPlantilla } = require('./plantillasCorreo');

/**
 * @param {number} solicitud_id
 * @param {string} nuevoEstado  'en_revision' | 'aprobado' | 'rechazado'
 * @param {object} opciones     datos extra para la plantilla (folio, motivo, etc.)
 */
async function actualizarEstado(solicitud_id, nuevoEstado, opciones = {}) {
  const { rows } = await pool.query(
    `UPDATE solicitudes
     SET estado = $2, actualizado_en = now()
     WHERE id = $1
     RETURNING *`,
    [solicitud_id, nuevoEstado]
  );
  const solicitud = rows[0];

  await registrarAccion(solicitud_id, 'cambio_estado', `Nuevo estado: ${nuevoEstado}`);

  // IF existe una plantilla de correo para este estado -> se envía automáticamente
  // ELSE (estado sin plantilla) -> solo se actualiza, sin correo
  const plantilla = obtenerPlantilla(nuevoEstado);
  if (plantilla) {
    const { rows: filasEstudiante } = await pool.query(
      'SELECT nombre, correo FROM estudiantes WHERE id = $1',
      [solicitud.estudiante_id]
    );
    const estudiante = filasEstudiante[0];
    const { asunto, cuerpo } = plantilla(estudiante, solicitud, opciones);
    await enviarNotificacion(solicitud_id, estudiante.correo, asunto, cuerpo);
  }

  return solicitud;
}

module.exports = { actualizarEstado };
