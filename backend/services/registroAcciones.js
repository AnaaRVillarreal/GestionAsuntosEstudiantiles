// ============================================================
// SENSOR: Registro de acciones
// Cada clic o cambio de estado queda registrado como una
// "medición" del sistema para mantener trazabilidad.
// ============================================================

const pool = require('../db');

async function registrarAccion(solicitud_id, accion, detalle = null) {
  await pool.query(
    `INSERT INTO registro_acciones (solicitud_id, accion, detalle)
     VALUES ($1, $2, $3)`,
    [solicitud_id, accion, detalle]
  );
}

module.exports = { registrarAccion };
