require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const solicitudesRouter = require('./routes/solicitudes');
const calendarioRouter = require('./routes/calendario');
const verificacionRouter = require('./routes/verificacion');
const espaciosRouter = require('./routes/espacios');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/calendario', calendarioRouter);
app.use('/api/verificar', verificacionRouter);
app.use('/api/espacios', espaciosRouter);

app.get('/api/salud', (req, res) => res.json({ ok: true, mensaje: 'API funcionando' }));

// Red de seguridad: si algo truena sin ser atrapado, se registra pero
// el servidor sigue vivo, en vez de morir por completo.
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ ok: false, errores: ['Error interno del servidor.'] });
});

process.on('unhandledRejection', (err) => {
  console.error('Promesa no manejada:', err);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));