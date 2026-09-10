// ============================================================
// ACTUADOR: Motor de notificaciones
// Envía correos electrónicos automáticos al estudiante y a
// los responsables cuando la solicitud cambia de estado.
//
// No decide el contenido del correo (eso vive en plantillasCorreo.js);
// solo se encarga de: 1) enviarlo mediante proveedorCorreo, y
// 2) dejar un registro en la tabla "notificaciones" para trazabilidad.
// ============================================================

const pool = require('../db');
const { enviarCorreo } = require('./proveedorCorreo');

async function enviarNotificacion(solicitud_id, destinatario, asunto, cuerpo) {
  await enviarCorreo({ to: destinatario, subject: asunto, text: cuerpo });

  await pool.query(
    `INSERT INTO notificaciones (solicitud_id, destinatario, asunto, cuerpo)
     VALUES ($1, $2, $3, $4)`,
    [solicitud_id, destinatario, asunto, cuerpo]
  );
}

module.exports = { enviarNotificacion };
