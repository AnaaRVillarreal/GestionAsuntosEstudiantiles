const pool = require('../db');
const { enviarCorreo } = require('./proveedorCorreo');

async function enviarNotificacion(solicitud_id, destinatario, asunto, cuerpo, adjunto = null) {
  await enviarCorreo({ to: destinatario, subject: asunto, text: cuerpo, adjunto });

  await pool.query(
    `INSERT INTO notificaciones (solicitud_id, destinatario, asunto, cuerpo)
     VALUES ($1, $2, $3, $4)`,
    [solicitud_id, destinatario, asunto, cuerpo]
  );
}

module.exports = { enviarNotificacion };