const fs = require('fs');
const nodemailer = require('nodemailer');

const TIEMPO_MAXIMO_MS = 15000; // si el proveedor no responde en 15 s, se da por fallido

// EMAIL_FROM puede ser "correo@dominio.com" o "Nombre <correo@dominio.com>"
function separarRemitente(valor = '') {
  const m = valor.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || 'Sistema de Solicitudes', email: m[2].trim() };
  return { name: 'Sistema de Solicitudes', email: valor.trim() };
}

let transportadorSMTP = null;
function obtenerTransportadorSMTP() {
  if (!transportadorSMTP) {
    transportadorSMTP = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    });
  }
  return transportadorSMTP;
}

async function enviarPorSMTP({ to, subject, text, adjunto }) {
  await obtenerTransportadorSMTP().sendMail({
    from: process.env.EMAIL_FROM,
    to, subject, text,
    attachments: adjunto ? [{ filename: adjunto.filename, path: adjunto.path }] : undefined
  });
}

async function enviarPorResend({ to, subject, text, adjunto }) {
  const body = { from: process.env.EMAIL_FROM, to, subject, text };
  if (adjunto) {
    body.attachments = [{ filename: adjunto.filename, content: fs.readFileSync(adjunto.path).toString('base64') }];
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
  });
  if (!resp.ok) throw new Error(`Resend respondió ${resp.status}: ${await resp.text()}`);
}

// Brevo: API web (funciona en Render gratuito, que bloquea los puertos SMTP)
async function enviarPorBrevo({ to, subject, text, adjunto }) {
  if (!process.env.BREVO_API_KEY) throw new Error('Falta la variable BREVO_API_KEY.');

  const body = {
    sender: separarRemitente(process.env.EMAIL_FROM),
    to: [{ email: to }],
    subject,
    textContent: text
  };
  if (adjunto) {
    body.attachment = [{ name: adjunto.filename, content: fs.readFileSync(adjunto.path).toString('base64') }];
  }

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
  });
  if (!resp.ok) throw new Error(`Brevo respondió ${resp.status}: ${await resp.text()}`);
}

async function enviarCorreo({ to, subject, text, adjunto }) {
  const proveedor = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (proveedor === 'brevo') return enviarPorBrevo({ to, subject, text, adjunto });
  if (proveedor === 'resend') return enviarPorResend({ to, subject, text, adjunto });
  if (proveedor === 'smtp') return enviarPorSMTP({ to, subject, text, adjunto });

  // Sin proveedor configurado: modo de prueba, solo se imprime en la terminal o en los Logs
  console.log(`[correo simulado] Para: ${to} | Asunto: ${subject}${adjunto ? ' | Adjunto: ' + adjunto.filename : ''}\n${text}`);
}

module.exports = { enviarCorreo };
