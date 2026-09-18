const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// Lista de espacios disponibles, para llenar el <select> del formulario.
// Ambos roles pueden consultarla (solo lectura).
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, capacidad, ubicacion FROM espacios ORDER BY nombre'
  );
  res.json({ ok: true, espacios: rows });
});

module.exports = router;