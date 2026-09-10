// ============================================================
// SENSOR: Verificador de disponibilidad
// Consulta la base de datos para saber si el espacio solicitado
// está libre en la fecha y hora indicadas.
// ============================================================

const pool = require('../db');

/**
 * @returns {Promise<boolean>} true si el espacio está disponible
 */
async function verificarDisponibilidad(espacio_id, fecha, hora_inicio, hora_fin) {
  const { rows } = await pool.query(
    `SELECT 1 FROM reservas_bloqueadas
     WHERE espacio_id = $1
       AND fecha = $2
       AND (hora_inicio, hora_fin) OVERLAPS ($3::time, $4::time)
     LIMIT 1`,
    [espacio_id, fecha, hora_inicio, hora_fin]
  );

  // IF ya existe una reserva que se traslapa -> no disponible / ELSE disponible
  return rows.length === 0;
}

module.exports = { verificarDisponibilidad };
