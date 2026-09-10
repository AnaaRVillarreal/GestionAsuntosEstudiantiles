// ============================================================
// SENSOR: Detector de conflictos
// Compara la nueva solicitud con reservas ya aprobadas y
// alerta si hay duplicidad.
// ============================================================

const pool = require('../db');

/**
 * @returns {Promise<boolean>} true si hay un conflicto (duplicidad)
 */
async function detectarConflicto(espacio_id, fecha, hora_inicio, hora_fin) {
  const { rows } = await pool.query(
    `SELECT s.id, s.folio FROM solicitudes s
     JOIN reservas_bloqueadas r ON r.solicitud_id = s.id
     WHERE r.espacio_id = $1
       AND r.fecha = $2
       AND (r.hora_inicio, r.hora_fin) OVERLAPS ($3::time, $4::time)
       AND s.estado = 'aprobado'`,
    [espacio_id, fecha, hora_inicio, hora_fin]
  );

  // IF hay una solicitud aprobada que se traslapa -> conflicto / ELSE sin conflicto
  return { hayConflicto: rows.length > 0, solicitudesEnConflicto: rows };
}

module.exports = { detectarConflicto };
