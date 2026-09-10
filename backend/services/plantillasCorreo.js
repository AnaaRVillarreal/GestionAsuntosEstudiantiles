// ============================================================
// Plantillas de correo por estado de la solicitud.
// Cada función recibe (estudiante, solicitud, opciones) y
// devuelve { asunto, cuerpo }. Aquí se edita el texto de los
// correos sin tocar la lógica que decide CUÁNDO enviarlos.
// ============================================================

const PLANTILLAS = {
  en_revision: (estudiante, solicitud) => ({
    asunto: 'Tu solicitud fue recibida',
    cuerpo: `Hola ${estudiante.nombre}, tu solicitud #${solicitud.id} (${solicitud.tipo}) está en revisión. Te avisaremos por correo en cuanto haya una respuesta.`
  }),
  aprobado: (estudiante, solicitud, opciones = {}) => ({
    asunto: 'Tu solicitud fue aprobada',
    cuerpo: `Hola ${estudiante.nombre}, tu solicitud #${solicitud.id} fue aprobada. Folio: ${opciones.folio}. Puedes descargar el oficio desde el sistema.`
  }),
  rechazado: (estudiante, solicitud, opciones = {}) => ({
    asunto: 'Tu solicitud fue rechazada',
    cuerpo: `Hola ${estudiante.nombre}, tu solicitud #${solicitud.id} fue rechazada. Motivo: ${opciones.motivo || 'No especificado'}.`
  })
};

function obtenerPlantilla(estado) {
  return PLANTILLAS[estado] || null;
}

module.exports = { obtenerPlantilla };
