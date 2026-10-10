const crypto = require('crypto');

// Orden de la cadena de aprobación
const NIVELES = ['logistica', 'jefatura', 'direccion'];

const ETIQUETAS = {
  logistica: 'Logística',
  jefatura: 'Jefatura',
  direccion: 'Dirección'
};

// Devuelve el nivel que sigue, o null si ya es el último (Dirección)
function siguienteNivel(nivel) {
  const i = NIVELES.indexOf(nivel);
  return i >= 0 && i < NIVELES.length - 1 ? NIVELES[i + 1] : null;
}

// Firma digital de cada aprobador: depende de la solicitud, el rol, la persona,
// la fecha y una clave secreta del servidor (no se puede fabricar sin JWT_SECRET)
function generarFirma(solicitud_id, rol, usuario_id, fechaISO) {
  return crypto
    .createHash('sha256')
    .update(`${solicitud_id}|${rol}|${usuario_id}|${fechaISO}|${process.env.JWT_SECRET}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
}

module.exports = { NIVELES, ETIQUETAS, siguienteNivel, generarFirma };