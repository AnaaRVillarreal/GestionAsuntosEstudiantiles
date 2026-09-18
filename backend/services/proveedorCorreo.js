const nodemailer = require('nodemailer');

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
  const fs = require('fs');
  const body = { from: process.env.EMAIL_FROM, to, subject, text };

  if (adjunto) {
    const contenidoBase64 = fs.readFileSync(adjunto.path).toString('base64');
    body.attachments = [{ filename: adjunto.filename, content: contenidoBase64 }];
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`Resend API respondió ${resp.status}: ${detalle}`);
  }
}

async function enviarCorreo({ to, subject, text, adjunto }) {
  const proveedor = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (proveedor === 'resend') return enviarPorResend({ to, subject, text, adjunto });
  if (proveedor === 'smtp') return enviarPorSMTP({ to, subject, text, adjunto });

  console.log(`[correo simulado] Para: ${to} | Asunto: ${subject}${adjunto ? ' | Adjunto: ' + adjunto.filename : ''}\n${text}`);
}

module.exports = { enviarCorreo };