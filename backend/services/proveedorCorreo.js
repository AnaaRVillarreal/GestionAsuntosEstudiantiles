// ============================================================
// Proveedor de correo (capa intercambiable)
// IF EMAIL_PROVIDER=resend -> usa la API HTTP de Resend
// IF EMAIL_PROVIDER=smtp   -> usa SMTP tradicional (nodemailer)
// ELSE (sin configurar)    -> solo imprime en consola (modo desarrollo)
//
// Esto permite cambiar de proveedor sin tocar el resto del código:
// solo se modifica esta capa (o se agrega otra función enviarPorX).
// ============================================================

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

async function enviarPorSMTP({ to, subject, text }) {
  await obtenerTransportadorSMTP().sendMail({
    from: process.env.EMAIL_FROM,
    to, subject, text
  });
}

// API de mensajería transaccional (ejemplo con Resend, https://resend.com/docs/api-reference/emails/send-email)
// Cambia esta función por la de tu proveedor (SendGrid, Mailgun, SES, etc.)
// si el formato del endpoint es distinto.
async function enviarPorResend({ to, subject, text }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text })
  });

  if (!resp.ok) {
    const detalle = await resp.text();
    throw new Error(`Resend API respondió ${resp.status}: ${detalle}`);
  }
}

async function enviarCorreo({ to, subject, text }) {
  const proveedor = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (proveedor === 'resend') return enviarPorResend({ to, subject, text });
  if (proveedor === 'smtp') return enviarPorSMTP({ to, subject, text });

  // Modo desarrollo: sin proveedor configurado, solo se imprime en consola
  console.log(`[correo simulado] Para: ${to} | Asunto: ${subject}\n${text}`);
}

module.exports = { enviarCorreo };
