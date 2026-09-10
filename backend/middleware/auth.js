const jwt = require('jsonwebtoken');

// IF no hay token o es inválido -> 401 / ELSE continúa con req.usuario disponible
function requireAuth(req, res, next) {
  const encabezado = req.headers.authorization || '';
  const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, errores: ['No se proporcionó un token de acceso.'] });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, errores: ['Token inválido o expirado.'] });
  }
}

// IF el rol del usuario no coincide -> 403 / ELSE continúa
function requireRole(rolEsperado) {
  return (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== rolEsperado) {
      return res.status(403).json({ ok: false, errores: [`Esta acción requiere el rol "${rolEsperado}".`] });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
