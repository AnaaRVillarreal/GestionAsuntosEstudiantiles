// Gestión de accesos: solo el administrador (rol "responsable") puede usar estas rutas.
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { NIVELES } = require('../services/flujoAprobacion');

router.use(requireAuth, requireRole('responsable'));

const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c || '');

// Lista de usuarios del personal (todo menos estudiantes)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, correo, rol, activo, creado_en
       FROM usuarios WHERE rol <> 'estudiante' ORDER BY rol, nombre`
    );
    // Si un nivel se queda sin usuarios activos, la cadena de aprobación se detiene
    const nivelesSinUsuario = NIVELES.filter((n) => !rows.some((u) => u.rol === n && u.activo));
    res.json({ ok: true, usuarios: rows, niveles_sin_usuario: nivelesSinUsuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al listar usuarios.'] });
  }
});

// Crear un usuario de Logística, Jefatura o Dirección
router.post('/', async (req, res) => {
  try {
    const { nombre, correo, password, rol } = req.body;
    const errores = [];
    if (!nombre || nombre.trim().length < 3) errores.push('El nombre es obligatorio (mínimo 3 caracteres).');
    if (!correoValido(correo)) errores.push('El correo no tiene un formato válido.');
    if (!password || password.length < 6) errores.push('La contraseña debe tener al menos 6 caracteres.');
    if (!NIVELES.includes(rol)) errores.push('El rol debe ser Logística, Jefatura o Dirección.');
    if (errores.length) return res.status(400).json({ ok: false, errores });

    const existe = await pool.query('SELECT 1 FROM usuarios WHERE correo = $1', [correo]);
    if (existe.rows.length) {
      return res.status(409).json({ ok: false, errores: ['Ya existe una cuenta con ese correo.'] });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol)
       VALUES ($1, $2, $3, $4) RETURNING id, nombre, correo, rol, activo`,
      [nombre.trim(), correo, hash, rol]
    );
    res.status(201).json({ ok: true, usuario: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al crear el usuario.'] });
  }
});

// Modificar acceso: activar/desactivar, cambiar rol, nombre o contraseña
router.put('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, rol FROM usuarios WHERE id = $1', [req.params.id]);
    const objetivo = rows[0];
    if (!objetivo) return res.status(404).json({ ok: false, errores: ['Usuario no encontrado.'] });

    // El administrador solo gestiona a Logística, Jefatura y Dirección
    if (!NIVELES.includes(objetivo.rol)) {
      return res.status(403).json({ ok: false, errores: ['Solo se puede modificar el acceso de Logística, Jefatura y Dirección.'] });
    }

    const { activo, rol, password, nombre } = req.body;
    const sets = [];
    const params = [req.params.id];

    if (typeof activo === 'boolean') {
      params.push(activo);
      sets.push(`activo = $${params.length}`);
    }
    if (rol !== undefined) {
      if (!NIVELES.includes(rol)) return res.status(400).json({ ok: false, errores: ['Rol no válido.'] });
      params.push(rol);
      sets.push(`rol = $${params.length}`);
    }
    if (password !== undefined) {
      if (password.length < 6) return res.status(400).json({ ok: false, errores: ['La contraseña debe tener al menos 6 caracteres.'] });
      params.push(await bcrypt.hash(password, 10));
      sets.push(`password_hash = $${params.length}`);
    }
    if (nombre !== undefined) {
      if (nombre.trim().length < 3) return res.status(400).json({ ok: false, errores: ['Nombre no válido.'] });
      params.push(nombre.trim());
      sets.push(`nombre = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ ok: false, errores: ['No hay cambios que guardar.'] });

    await pool.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = $1`, params);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al modificar el usuario.'] });
  }
});

module.exports = router;