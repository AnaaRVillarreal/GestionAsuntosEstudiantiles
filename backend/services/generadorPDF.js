// ============================================================
// ACTUADOR: Generador de PDF
// Produce el oficio con las firmas digitales de cada nivel de
// aprobación, un código de verificación (hash) y un QR.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { ETIQUETAS } = require('./flujoAprobacion');

const CARPETA_OFICIOS = path.join(__dirname, '..', 'oficios');
if (!fs.existsSync(CARPETA_OFICIOS)) fs.mkdirSync(CARPETA_OFICIOS);

function generarFolio(solicitud_id) {
  const anio = new Date().getFullYear();
  return `OF-${anio}-${String(solicitud_id).padStart(5, '0')}`;
}

function generarCodigoVerificacion(solicitud_id, folio) {
  return crypto
    .createHash('sha256')
    .update(`${solicitud_id}|${folio}|${process.env.JWT_SECRET}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
}

// Convierte una fecha (texto 'AAAA-MM-DD' o Date) a DD/MM/AAAA sin desfases de zona horaria
function fechaLegible(f) {
  if (!f) return '';
  if (typeof f === 'string') {
    const [a, m, d] = f.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
  const d = new Date(f);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fechaHoraLegible(f) {
  const d = new Date(f);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${fechaLegible(d)} ${hh}:${mm}`;
}

/**
 * @param solicitud  fila de la solicitud
 * @param estudiante datos del estudiante (nombre, matricula, correo)
 * @param firmas     [{ rol, nombre, firma, creado_en }] en orden de aprobación
 */
function generarOficioPDF(solicitud, estudiante, firmas = []) {
  return new Promise(async (resolve, reject) => {
    try {
      const folio = generarFolio(solicitud.id);
      const codigoVerificacion = generarCodigoVerificacion(solicitud.id, folio);
      const ruta = path.join(CARPETA_OFICIOS, `${folio}.pdf`);

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
        doc.text(`Fecha: ${fechaLegible(solicitud.fecha_evento)}   Hora: ${solicitud.hora_inicio} - ${solicitud.hora_fin}`);
      }

      if (solicitud.detalles && Object.keys(solicitud.detalles).length > 0) {
        doc.moveDown(0.5);
        doc.fontSize(11).text('Detalles adicionales:', { underline: true });
        Object.entries(solicitud.detalles).forEach(([clave, valor]) => {
          doc.fontSize(11).text(`${clave}: ${valor}`);
        });
      }

      // ---- Firmas digitales de cada nivel de aprobación ----
      doc.moveDown(1.5);
      doc.fontSize(12).fillColor('#000000').text('Firmas digitales de autorización', { underline: true });
      doc.moveDown(0.5);
      firmas.forEach((f) => {
        doc.fontSize(11).fillColor('#000000').text(`${ETIQUETAS[f.rol] || f.rol}: ${f.nombre}`);
        doc.fontSize(9).fillColor('#555555').text(`Firmado el ${fechaHoraLegible(f.creado_en)}  ·  Firma: ${f.firma}`);
        doc.moveDown(0.6);
      });
      doc.fillColor('#000000');

      // ---- Código de verificación del documento + QR ----
      if (doc.y > doc.page.height - 200) doc.addPage();
      doc.moveDown(1);
      const yBloque = doc.y;
      doc.fontSize(10).text('Código de verificación del documento:', 50, yBloque, { width: 330 });
      doc.fontSize(13).text(codigoVerificacion, 50, doc.y, { width: 330, characterSpacing: 1 });
      doc.fontSize(9).fillColor('#555555').text(
        'Escanea el QR para comprobar la autenticidad del oficio.',
        50, doc.y + 4, { width: 330 }
      );
      doc.fillColor('#000000');
      doc.image(qrBuffer, doc.page.width - 170, yBloque, { width: 110 });

      doc.end();

      stream.on('finish', () => resolve({ folio, ruta, codigoVerificacion }));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generarOficioPDF };