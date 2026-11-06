// ============================================================
// ACTUADOR: Generador de PDF
// Oficio con logos, texto personalizado según el tipo de trámite,
// firmas digitales de cada nivel, código de verificación y QR.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const pool = require('../db');
const { ETIQUETAS } = require('./flujoAprobacion');

// ---------- PERSONALIZA AQUÍ EL ENCABEZADO ----------
const INSTITUCION = 'Universidad Autónoma de Nuevo León';
const DEPENDENCIA = 'Facultad de Ingeniería Mecánica y Eléctrica';
const SISTEMA = 'Sistema de Gestión de Asuntos Estudiantiles';

// Logos (PNG o JPG) dentro de backend/assets/:
//   logo_izquierdo.png  -> UANL
//   logo_derecho.png    -> FIME
// Si un archivo no existe, simplemente no se dibuja.
const CARPETA_ASSETS = path.join(__dirname, '..', 'assets');
const CARPETA_OFICIOS = path.join(__dirname, '..', 'oficios');
if (!fs.existsSync(CARPETA_OFICIOS)) fs.mkdirSync(CARPETA_OFICIOS);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function buscarLogo(nombreBase) {
  for (const ext of ['png', 'jpg', 'jpeg']) {
    const ruta = path.join(CARPETA_ASSETS, `${nombreBase}.${ext}`);
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

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

// 'AAAA-MM-DD' o Date -> "9 de octubre de 2026"
function fechaLarga(f) {
  if (typeof f === 'string') {
    const [a, m, d] = f.slice(0, 10).split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
  }
  const d = new Date(f);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function fechaHoraCorta(f) {
  const d = new Date(f);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}

const hora = (h) => (h ? String(h).slice(0, 5) : '');

async function nombreEspacio(espacio_id) {
  if (!espacio_id) return null;
  try {
    const { rows } = await pool.query('SELECT nombre FROM espacios WHERE id = $1', [espacio_id]);
    return rows[0]?.nombre || null;
  } catch (err) {
    return null;
  }
}

// ---------- Texto del oficio, personalizado según el tipo de trámite ----------
// Para cambiar la redacción de un tipo de trámite, edita su "case".
function construirContenido(solicitud, estudiante, espacio) {
  const d = solicitud.detalles || {};
  const desc = String(solicitud.descripcion || '').trim().replace(/[.\s]+$/, '');
  const quien = `el/la estudiante ${estudiante.nombre}, con matrícula ${estudiante.matricula}`;
  const quienA = `al/a la estudiante ${estudiante.nombre}, con matrícula ${estudiante.matricula}`;
  const fecha = solicitud.fecha_evento ? fechaLarga(solicitud.fecha_evento) : null;
  const revisada = 'Dicha solicitud fue revisada y aprobada por las instancias correspondientes';
  const cierreGeneral = 'Se extiende el presente para los fines que a la persona interesada convengan.';

  switch (solicitud.tipo) {
    case 'reserva_espacio': {
      const lugar = espacio ? `del espacio "${espacio}"` : 'de un espacio institucional';
      const horario = solicitud.hora_inicio && solicitud.hora_fin
        ? `, en el horario de ${hora(solicitud.hora_inicio)} a ${hora(solicitud.hora_fin)} horas` : '';
      return {
        titulo: 'OFICIO DE AUTORIZACIÓN',
        asunto: 'Autorización de reserva de espacio',
        destinatario: ['A QUIEN CORRESPONDA:'],
        parrafo: `Por medio del presente se hace constar que ${quien}, solicitó la reserva ${lugar}${fecha ? ` para el día ${fecha}` : ''}${horario}, con el siguiente propósito: ${desc}. ${revisada}, por lo que se otorga la presente autorización.`,
        cierre: cierreGeneral
      };
    }
    case 'transporte':
      return {
        titulo: 'OFICIO DE AUTORIZACIÓN',
        asunto: 'Autorización de servicio de transporte',
        destinatario: ['A QUIEN CORRESPONDA:'],
        parrafo: `Por medio del presente se hace constar que ${quien}, solicitó el servicio de transporte con destino a ${d.destino || 'el lugar indicado'}${d.num_pasajeros ? `, para ${d.num_pasajeros} pasajero(s)` : ''}, con el siguiente motivo: ${desc}. ${revisada}, por lo que se autoriza el servicio.`,
        cierre: cierreGeneral
      };
    case 'evento':
      return {
        titulo: 'OFICIO DE AUTORIZACIÓN',
        asunto: 'Autorización para la realización de un evento',
        destinatario: ['A QUIEN CORRESPONDA:'],
        parrafo: `Por medio del presente se hace constar que ${quien}, solicitó autorización para realizar el evento "${d.nombre_evento || 'sin nombre'}"${d.asistentes_esperados ? `, con una asistencia esperada de ${d.asistentes_esperados} persona(s)` : ''}, con el siguiente propósito: ${desc}. ${revisada}, por lo que se otorga la presente autorización.`,
        cierre: cierreGeneral
      };
    case 'constancia':
      return {
        titulo: 'OFICIO DE AUTORIZACIÓN',
        asunto: 'Autorización de constancia',
        destinatario: ['A QUIEN CORRESPONDA:'],
        parrafo: `Por medio del presente se hace constar que ${quien}, solicitó la expedición de una constancia de tipo "${d.tipo_constancia || 'general'}"${d.institucion_destino ? `, dirigida a ${d.institucion_destino}` : ''}, por el siguiente motivo: ${desc}. ${revisada}, por lo que se autoriza su expedición.`,
        cierre: cierreGeneral
      };
    case 'oficio_presentacion':
      return {
        titulo: 'OFICIO DE PRESENTACIÓN',
        asunto: 'Presentación de estudiante',
        destinatario: [d.dirigido_a, d.institucion_destino, 'PRESENTE.'].filter(Boolean),
        parrafo: `Por medio del presente se presenta ${quienA}, ante ${d.dirigido_a || 'quien corresponda'}${d.institucion_destino ? ` de ${d.institucion_destino}` : ''}, con el siguiente propósito: ${desc}. ${revisada}.`,
        cierre: 'Agradecemos de antemano las atenciones que se sirvan brindar a la persona portadora del presente.'
      };
    default:
      return {
        titulo: 'OFICIO DE AUTORIZACIÓN',
        asunto: 'Autorización de trámite',
        destinatario: ['A QUIEN CORRESPONDA:'],
        parrafo: `Por medio del presente se hace constar que ${quien}, presentó una solicitud con el siguiente propósito: ${desc}. ${revisada}.`,
        cierre: cierreGeneral
      };
  }
}

/**
 * @param solicitud  fila de la solicitud
 * @param estudiante datos del estudiante (nombre, matricula, correo)
 * @param firmas     [{ rol, nombre, firma, creado_en }] en orden de aprobación
 */
async function generarOficioPDF(solicitud, estudiante, firmas = []) {
  const folio = generarFolio(solicitud.id);
  const codigoVerificacion = generarCodigoVerificacion(solicitud.id, folio);
  const ruta = path.join(CARPETA_OFICIOS, `${folio}.pdf`);
  const espacio = await nombreEspacio(solicitud.espacio_id);
  const contenido = construirContenido(solicitud, estudiante, espacio);

  const qrDataUrl = await QRCode.toDataURL(`Folio:${folio} Código:${codigoVerificacion}`, { margin: 1, width: 200 });
  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const stream = fs.createWriteStream(ruta);
      doc.pipe(stream);

      const ancho = doc.page.width - 100;
      const derecha = doc.page.width - 50;
      const espacioLibre = () => doc.page.height - doc.page.margins.bottom - doc.y;

      // ---- Encabezado: logos a los lados y nombre de la institución al centro ----
      const yTop = 36;
      const dibujarLogo = (archivo, x) => {
        if (!archivo) return;
        try {
          doc.image(archivo, x, yTop, { fit: [80, 80], align: 'center', valign: 'center' });
        } catch (err) {
          console.error(`No se pudo dibujar el logo ${archivo}:`, err.message);
        }
      };
      dibujarLogo(buscarLogo('logo_izquierdo'), 50);
      dibujarLogo(buscarLogo('logo_derecho'), derecha - 80);

      const xCentro = 145;
      const anchoCentro = doc.page.width - 290;
      doc.fillColor('#0A2A5E').font('Helvetica-Bold').fontSize(13)
        .text(INSTITUCION, xCentro, yTop + 10, { width: anchoCentro, align: 'center' });
      doc.fillColor('#0A2A5E').font('Helvetica-Bold').fontSize(11)
        .text(DEPENDENCIA, xCentro, doc.y + 2, { width: anchoCentro, align: 'center' });
      doc.fillColor('#555555').font('Helvetica').fontSize(9)
        .text(SISTEMA, xCentro, doc.y + 4, { width: anchoCentro, align: 'center' });

      doc.moveTo(50, 126).lineTo(derecha, 126).lineWidth(1.2).strokeColor('#0A2A5E').stroke();

      // ---- Título, folio y fecha ----
      doc.x = 50;
      doc.y = 142;
      doc.fillColor('#0A2A5E').font('Helvetica-Bold').fontSize(15)
        .text(contenido.titulo, { width: ancho, align: 'center' });

      doc.moveDown(0.8);
      doc.fillColor('#000000').font('Helvetica').fontSize(10);
      doc.text(`Folio: ${folio}`, { width: ancho, align: 'right' });
      doc.text(`Fecha de emisión: ${fechaLarga(new Date())}`, { width: ancho, align: 'right' });

      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(11).text(`Asunto: ${contenido.asunto}`, { width: ancho });

      doc.moveDown(1);
      contenido.destinatario.forEach((linea) => {
        doc.font('Helvetica-Bold').fontSize(11).text(linea, { width: ancho });
      });

      // ---- Cuerpo del oficio (texto personalizado) ----
      doc.moveDown(1);
      doc.font('Helvetica').fontSize(11).text(contenido.parrafo, { width: ancho, align: 'justify', lineGap: 3 });
      doc.moveDown(0.8);
      doc.text(contenido.cierre, { width: ancho, align: 'justify', lineGap: 3 });

      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(11).text('ATENTAMENTE', { width: ancho, align: 'center' });

      // ---- Firmas digitales: una columna por nivel de aprobación ----
      if (espacioLibre() < 130) doc.addPage();
      doc.x = 50;
      const yFirmas = doc.y + 20;
      const n = Math.max(firmas.length, 1);
      const colAncho = ancho / n;
      firmas.forEach((f, i) => {
        const x = 50 + i * colAncho + 6;
        const w = colAncho - 12;
        doc.fillColor('#555555').font('Courier').fontSize(9)
          .text(f.firma, x, yFirmas, { width: w, align: 'center' });
        doc.moveTo(x, yFirmas + 16).lineTo(x + w, yFirmas + 16).lineWidth(0.8).strokeColor('#000000').stroke();
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10)
          .text(f.nombre, x, yFirmas + 22, { width: w, align: 'center' });
        doc.font('Helvetica').fontSize(10)
          .text(ETIQUETAS[f.rol] || f.rol, x, doc.y, { width: w, align: 'center' });
        doc.fillColor('#555555').fontSize(8)
          .text(`Firmado el ${fechaHoraCorta(f.creado_en)}`, x, doc.y + 1, { width: w, align: 'center' });
      });
      doc.x = 50;
      doc.y = yFirmas + 85;

      // ---- Código de verificación y QR ----
      if (espacioLibre() < 130) doc.addPage();
      doc.x = 50;
      const yVer = doc.y + 6;
      doc.moveTo(50, yVer).lineTo(derecha, yVer).lineWidth(0.6).strokeColor('#BBBBBB').stroke();
      doc.image(qrBuffer, 50, yVer + 12, { width: 90 });
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10)
        .text('Código de verificación del documento', 155, yVer + 16, { width: ancho - 105 });
      doc.font('Courier-Bold').fontSize(14)
        .text(codigoVerificacion, 155, doc.y + 2, { width: ancho - 105, characterSpacing: 1 });
      doc.font('Helvetica').fontSize(8.5).fillColor('#555555')
        .text('Este oficio se emitió de forma electrónica y lleva las firmas digitales de cada nivel de aprobación. '
          + 'Para comprobar su autenticidad, escanea el código QR o consulta el folio junto con este código de verificación.',
          155, doc.y + 6, { width: ancho - 105 });

      doc.end();
      stream.on('finish', () => resolve({ folio, ruta, codigoVerificacion }));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generarOficioPDF };
