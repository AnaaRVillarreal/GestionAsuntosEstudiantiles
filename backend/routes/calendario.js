const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// Salida: visualización en el calendario compartido de reservas aprobadas
// Ambos roles (estudiante y responsable) pueden consultarlo.
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.fecha, r.hora_inicio, r.hora_fin, esp.nombre AS espacio,
            s.id AS solicitud_id, s.folio, s.descripcion
     FROM reservas_bloqueadas r
     JOIN espacios esp ON esp.id = r.espacio_id
     JOIN solicitudes s ON s.id = r.solicitud_id
     WHERE s.estado = 'aprobado'
     ORDER BY r.fecha, r.hora_inicio`
  );
  res.json({ ok: true, reservas: rows });
});

module.exports = router;
