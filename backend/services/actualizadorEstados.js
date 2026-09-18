const pool = require('../db');
const { registrarAccion } = require('./registroAcciones');
const { enviarNotificacion } = require('./motorNotificaciones');
const { obtenerPlantilla } = require('./plantillasCorreo');

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

  const plantilla = obtenerPlantilla(nuevoEstado);
  if (plantilla) {
    const { rows: filasEstudiante } = await pool.query(
      'SELECT nombre, correo FROM estudiantes WHERE id = $1',
      [solicitud.estudiante_id]
    );
    const estudiante = filasEstudiante[0];
    const { asunto, cuerpo } = plantilla(estudiante, solicitud, opciones);

    // IF la solicitud fue aprobada y ya existe el PDF -> se adjunta al correo
    const adjunto = (nuevoEstado === 'aprobado' && opciones.rutaPDF)
      ? { filename: `${opciones.folio}.pdf`, path: opciones.rutaPDF }
      : null;

    await enviarNotificacion(solicitud_id, estudiante.correo, asunto, cuerpo, adjunto);
  }

  return solicitud;
}

module.exports = { actualizarEstado };