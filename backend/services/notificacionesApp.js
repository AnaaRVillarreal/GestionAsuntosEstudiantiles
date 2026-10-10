// Notificaciones dentro de la interfaz (campana y avisos emergentes) y,
// en el caso de los roles, también por correo.
// Si algo falla aquí solo se registra en consola: nunca debe romper una aprobación.

const pool = require('../db');
const { enviarNotificacion } = require('./motorNotificaciones');
const { enviarCorreo } = require('./proveedorCorreo');

async function notificarUsuario(usuario_id, mensaje, solicitud_id = null) {
  try {
    await pool.query(
      'INSERT INTO notificaciones_app (usuario_id, solicitud_id, mensaje) VALUES ($1, $2, $3)',
      [usuario_id, solicitud_id, mensaje]
    );
  } catch (err) {
    console.error('No se pudo crear la notificación:', err.message);
  }
}

// Envía los correos sin esperar: un SMTP lento no debe retrasar la respuesta de la API
function enviarCorreosEnSegundoPlano(destinatarios, solicitud_id, asunto, mensaje) {
  destinatarios.forEach(async (d) => {
    const cuerpo = `Hola ${d.nombre},\n\n${mensaje}\n\nEntra al sistema para revisarla.`;
    try {
      if (solicitud_id) await enviarNotificacion(solicitud_id, d.correo, asunto, cuerpo);
      else await enviarCorreo({ to: d.correo, subject: asunto, text: cuerpo });
    } catch (err) {
      console.error(`No se pudo enviar el correo a ${d.correo}:`, err.message);
    }
  });
}

/**
 * Avisa a TODOS los usuarios activos de un rol.
 * opciones.correo  (por defecto true)  -> además del aviso en pantalla, manda correo
 * opciones.asunto                      -> asunto del correo
 */
async function notificarRol(rol, mensaje, solicitud_id = null, opciones = {}) {
  const { correo = true, asunto = 'Hay solicitudes por revisar' } = opciones;
  try {
    await pool.query(
      `INSERT INTO notificaciones_app (usuario_id, solicitud_id, mensaje)
       SELECT id, $2::integer, $3::text FROM usuarios
       WHERE rol = $1::rol_usuario AND activo = TRUE`,
      [rol, solicitud_id, mensaje]
    );

    if (correo) {
      const { rows } = await pool.query(
        'SELECT nombre, correo FROM usuarios WHERE rol = $1::rol_usuario AND activo = TRUE',
        [rol]
      );
      enviarCorreosEnSegundoPlano(rows, solicitud_id, asunto, mensaje);
    }
  } catch (err) {
    console.error('No se pudo notificar al rol:', err.message);
  }
}

// Avisa a la cuenta del estudiante dueño de la solicitud (solo en pantalla;
// su correo ya lo envía el actualizador de estados)
async function notificarEstudiante(estudiante_id, mensaje, solicitud_id = null) {
  try {
    await pool.query(
      `INSERT INTO notificaciones_app (usuario_id, solicitud_id, mensaje)
       SELECT id, $2::integer, $3::text FROM usuarios WHERE estudiante_id = $1`,
      [estudiante_id, solicitud_id, mensaje]
    );
  } catch (err) {
    console.error('No se pudo notificar al estudiante:', err.message);
  }
}

module.exports = { notificarUsuario, notificarRol, notificarEstudiante };