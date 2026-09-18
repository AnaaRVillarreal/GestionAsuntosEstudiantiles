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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));