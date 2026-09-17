// ============================================================
// ACTUADOR: Generador de PDF
// Produce el oficio en PDF, con un código de verificación (hash)
// y un QR que permiten comprobar la autenticidad del documento.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const CARPETA_OFICIOS = path.join(__dirname, '..', 'oficios');
if (!fs.existsSync(CARPETA_OFICIOS)) fs.mkdirSync(CARPETA_OFICIOS);

function generarFolio(solicitud_id) {
  const anio = new Date().getFullYear();
  return `OF-${anio}-${String(solicitud_id).padStart(5, '0')}`;
}

// SENSOR/ACTUADOR: genera un código único a partir del folio, el id
// y una clave secreta del servidor — nadie puede fabricarlo sin conocer JWT_SECRET.
function generarCodigoVerificacion(solicitud_id, folio) {
  return crypto
    .createHash('sha256')
    .update(`${solicitud_id}|${folio}|${process.env.JWT_SECRET}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
}

function generarOficioPDF(solicitud, estudiante) {
  return new Promise(async (resolve, reject) => {
    try {
      const folio = generarFolio(solicitud.id);
      const codigoVerificacion = generarCodigoVerificacion(solicitud.id, folio);
      const nombreArchivo = `${folio}.pdf`;
      const ruta = path.join(CARPETA_OFICIOS, nombreArchivo);

      const qrDataUrl = await QRCode.toDataURL(
        `Folio:${folio} Código:${codigoVerificacion}`,
        { margin: 1, width: 160 }
      );
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

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

      doc.moveDown(2);
      doc.fontSize(10).text('Firma digital del sistema — este código certifica la autenticidad del documento:', { width: 340 });
      doc.fontSize(13).text(codigoVerificacion, { characterSpacing: 1 });

      doc.image(qrBuffer, doc.page.width - 190, doc.y - 60, { width: 120 });

      doc.end();

      stream.on('finish', () => resolve({ folio, ruta, codigoVerificacion }));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generarOficioPDF };