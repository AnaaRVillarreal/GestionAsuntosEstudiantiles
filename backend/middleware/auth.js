const jwt = require('jsonwebtoken');
const pool = require('../db');

// IF no hay token, es inválido o la cuenta está desactivada -> 401 / ELSE continúa
async function requireAuth(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, errores: ['No se proporcionó un token de acceso.'] });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ ok: false, errores: ['Token inválido o expirado.'] });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, rol, estudiante_id, activo FROM usuarios WHERE id = $1',
      [payload.id]
    );
    const usuario = rows[0];
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ ok: false, errores: ['Tu cuenta está desactivada o ya no existe.'] });
    }
    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      estudiante_id: usuario.estudiante_id
    };
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al validar la sesión.'] });
  }
}

// Acepta uno o varios roles: requireRole('estudiante') o requireRole('logistica', 'jefatura')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ ok: false, errores: ['No tienes permiso para realizar esta acción.'] });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };