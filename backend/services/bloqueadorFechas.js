// ============================================================
// ACTUADOR: Bloqueador de fechas
// Marca en el calendario los espacios ya reservados para que
// no se puedan volver a solicitar.
// ============================================================

const pool = require('../db');

async function bloquearFecha(espacio_id, solicitud_id, fecha, hora_inicio, hora_fin) {
  const { rows } = await pool.query(
    `INSERT INTO reservas_bloqueadas (espacio_id, solicitud_id, fecha, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [espacio_id, solicitud_id, fecha, hora_inicio, hora_fin]
  );
  return rows[0];
}

module.exports = { bloquearFecha };
