const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { NIVELES } = require('../services/flujoAprobacion');

router.use(requireAuth);

// Mis notificaciones + contadores
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, solicitud_id, mensaje, leida, creado_en
       FROM notificaciones_app WHERE usuario_id = $1
       ORDER BY creado_en DESC LIMIT 30`,
      [req.usuario.id]
    );

    const noLeidas = Number((await pool.query(
      'SELECT COUNT(*) FROM notificaciones_app WHERE usuario_id = $1 AND leida = FALSE',
      [req.usuario.id]
    )).rows[0].count);

    // IF el usuario es Logística/Jefatura/Dirección -> cuenta lo que le toca aprobar ahora
    let porAprobar = 0;
    if (NIVELES.includes(req.usuario.rol)) {
      porAprobar = Number((await pool.query(
        `SELECT COUNT(*) FROM solicitudes WHERE estado = 'en_revision' AND nivel_actual = $1`,
        [req.usuario.rol]
      )).rows[0].count);
    }

    res.json({ ok: true, notificaciones: rows, no_leidas: noLeidas, por_aprobar: porAprobar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al consultar las notificaciones.'] });
  }
});

router.put('/leer-todas', async (req, res) => {
  await pool.query('UPDATE notificaciones_app SET leida = TRUE WHERE usuario_id = $1', [req.usuario.id]);
  res.json({ ok: true });
});

router.put('/:id/leer', async (req, res) => {
  await pool.query(
    'UPDATE notificaciones_app SET leida = TRUE WHERE id = $1 AND usuario_id = $2',
    [req.params.id, req.usuario.id]
  );
  res.json({ ok: true });
});

module.exports = router;