const pool = require('../db');
const { enviarCorreo } = require('./proveedorCorreo');

// Un fallo de correo NUNCA debe tumbar una solicitud ni una aprobación:
// se registra en consola y se devuelve false.
async function enviarNotificacion(solicitud_id, destinatario, asunto, cuerpo, adjunto = null) {
  try {
    await enviarCorreo({ to: destinatario, subject: asunto, text: cuerpo, adjunto });
  } catch (err) {
    console.error(`No se pudo enviar el correo a ${destinatario}:`, err.message);
    return false;
  }

  try {
    await pool.query(
      `INSERT INTO notificaciones (solicitud_id, destinatario, asunto, cuerpo)
       VALUES ($1, $2, $3, $4)`,
      [solicitud_id, destinatario, asunto, cuerpo]
    );
  } catch (err) {
    console.error('El correo salió, pero no se pudo registrar en la base:', err.message);
  }
  return true;
}

module.exports = { enviarNotificacion };
