const express = require('express');
const router = express.Router();
const pool = require('../db');

// Público, sin autenticación: valida la autenticidad de un oficio
router.get('/:folio/:codigo', async (req, res) => {
  const { folio, codigo } = req.params;
  const { rows } = await pool.query(
    `SELECT s.folio, s.codigo_verificacion, s.tipo, s.estado, s.creado_en, e.nombre
     FROM solicitudes s JOIN estudiantes e ON e.id = s.estudiante_id
     WHERE s.folio = $1`,
    [folio]
  );
  const solicitud = rows[0];

  if (!solicitud || solicitud.codigo_verificacion !== codigo.toUpperCase()) {
    return res.status(404).json({ ok: false, valido: false, mensaje: 'Documento no válido o no encontrado.' });
  }

  res.json({
    ok: true, valido: true,
    folio: solicitud.folio, tipo: solicitud.tipo, estado: solicitud.estado,
    estudiante: solicitud.nombre, emitido: solicitud.creado_en
  });
});

module.exports = router;