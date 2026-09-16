// ============================================================
// ACTUADOR: Generador de PDF
// Toma los datos de la solicitud aprobada y produce el oficio
// en formato PDF con las firmas correspondientes.
// ============================================================

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const CARPETA_OFICIOS = path.join(__dirname, '..', 'oficios');
if (!fs.existsSync(CARPETA_OFICIOS)) fs.mkdirSync(CARPETA_OFICIOS);

function generarFolio(solicitud_id) {
  const anio = new Date().getFullYear();
  return `OF-${anio}-${String(solicitud_id).padStart(5, '0')}`;
}

/**
 * Genera el oficio en PDF y devuelve { folio, ruta }.
 */
function generarOficioPDF(solicitud, estudiante) {
  return new Promise((resolve, reject) => {
    const folio = generarFolio(solicitud.id);
    const nombreArchivo = `${folio}.pdf`;
    const ruta = path.join(CARPETA_OFICIOS, nombreArchivo);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(ruta);
    doc.pipe(stream);

    doc.fontSize(16).text('OFICIO DE AUTORIZACIÓN', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Folio: ${folio}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(12).text(`Estudiante: ${estudiante.nombre}`);
    doc.text(`Matrícula: ${estudiante.matricula}`);
    doc.text(`Correo: ${estudiante.correo}`);
    doc.moveDown();

    doc.text(`Tipo de trámite: ${solicitud.tipo}`);
    doc.text(`Descripción: ${solicitud.descripcion}`);
    if (solicitud.fecha_evento) {
      doc.text(`Fecha: ${solicitud.fecha_evento}  Hora: ${solicitud.hora_inicio} - ${solicitud.hora_fin}`);
    }
        if (solicitud.detalles && Object.keys(solicitud.detalles).length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(11).text('Detalles adicionales:', { underline: true });
      Object.entries(solicitud.detalles).forEach(([clave, valor]) => {
        doc.fontSize(11).text(`${clave}: ${valor}`);
      });
    }
    doc.moveDown(3);

    doc.text('_____________________________', { align: 'left' });
    doc.text('Firma del responsable', { align: 'left' });
    doc.moveDown();
    doc.text('_____________________________', { align: 'left' });
    doc.text('Firma digital del sistema', { align: 'left' });

    doc.end();

    stream.on('finish', () => resolve({ folio, ruta }));
    stream.on('error', reject);
  });
}

module.exports = { generarOficioPDF };
