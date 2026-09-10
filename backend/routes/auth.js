const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../db');
const { validarRegistroEstudiante } = require('../services/validadores');

function firmarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      estudiante_id: usuario.estudiante_id || null
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRA_EN || '8h' }
  );
}

// ------------------------------------------------------------
// POST /api/auth/registro-estudiante
// Único registro abierto: el estudiante crea su propia cuenta.
// Las cuentas de "responsable" se crean con el script de administración
// (backend/scripts/crearResponsable.js), no por esta ruta.
// ------------------------------------------------------------
router.post('/registro-estudiante', async (req, res) => {
  const datos = req.body;
  const { valido, errores } = validarRegistroEstudiante(datos);
  if (!valido) return res.status(400).json({ ok: false, errores });

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const existente = await cliente.query('SELECT id FROM usuarios WHERE correo = $1', [datos.correo]);
    if (existente.rows.length > 0) {
      await cliente.query('ROLLBACK');
      return res.status(409).json({ ok: false, errores: ['Ya existe una cuenta con ese correo.'] });
    }

    const estudiante = (await cliente.query(
      `INSERT INTO estudiantes (nombre, matricula, correo, telefono)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [datos.nombre, datos.matricula, datos.correo, datos.telefono || null]
    )).rows[0];

    const hash = await bcrypt.hash(datos.password, 10);
    const usuario = (await cliente.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, estudiante_id)
       VALUES ($1,$2,$3,'estudiante',$4) RETURNING *`,
      [datos.nombre, datos.correo, hash, estudiante.id]
    )).rows[0];

    await cliente.query('COMMIT');

    const token = firmarToken(usuario);
    res.status(201).json({ ok: true, token, usuario: { nombre: usuario.nombre, rol: usuario.rol } });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error interno al registrar al estudiante.'] });
  } finally {
    cliente.release();
  }
});

// ------------------------------------------------------------
// POST /api/auth/login  (sirve para ambos roles)
// ------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
  const usuario = rows[0];

  // IF el usuario no existe o la contraseña no coincide -> 401 / ELSE emite token
  if (!usuario || !(await bcrypt.compare(password || '', usuario.password_hash))) {
    return res.status(401).json({ ok: false, errores: ['Correo o contraseña incorrectos.'] });
  }

  const token = firmarToken(usuario);
  res.json({ ok: true, token, usuario: { nombre: usuario.nombre, rol: usuario.rol } });
});

module.exports = router;
