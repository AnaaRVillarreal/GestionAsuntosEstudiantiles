require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const solicitudesRouter = require('./routes/solicitudes');
const calendarioRouter = require('./routes/calendario');
const verificacionRouter = require('./routes/verificacion');
const espaciosRouter = require('./routes/espacios');
const notificacionesRouter = require('./routes/notificaciones');
const usuariosRouter = require('./routes/usuarios');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/calendario', calendarioRouter);
app.use('/api/verificar', verificacionRouter);
app.use('/api/espacios', espaciosRouter);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/usuarios', usuariosRouter);

app.get('/api/salud', (req, res) => res.json({ ok: true, mensaje: 'API funcionando' }));

// ---- Producción: el mismo servidor entrega el frontend ya compilado ----
// (En tu computadora no existe frontend/dist, así que este bloque no hace nada.)
const carpetaFrontend = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(carpetaFrontend)) {
  app.use(express.static(carpetaFrontend));
  // Cualquier ruta que no sea /api devuelve la aplicación de React
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(carpetaFrontend, 'index.html')));
}

// Red de seguridad: si algo truena sin ser atrapado, el servidor sigue vivo
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ ok: false, errores: ['Error interno del servidor.'] });
});

process.on('unhandledRejection', (err) => {
  console.error('Promesa no manejada:', err);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
