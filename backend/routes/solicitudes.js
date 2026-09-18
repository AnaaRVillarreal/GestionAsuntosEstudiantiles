const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const { validarDatosTramite } = require('../services/validadores');
const { verificarDisponibilidad } = require('../services/verificadorDisponibilidad');
const { detectarConflicto } = require('../services/detectorConflictos');
const { registrarAccion } = require('../services/registroAcciones');
const { generarOficioPDF } = require('../services/generadorPDF');
const { actualizarEstado } = require('../services/actualizadorEstados');
const { bloquearFecha } = require('../services/bloqueadorFechas');

router.use(requireAuth);

router.get('/disponibilidad', async (req, res) => {
  const { espacio_id, fecha, hora_inicio, hora_fin } = req.query;
  if (!espacio_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ ok: false, errores: ['Faltan datos para verificar disponibilidad.'] });
  }
  const disponible = await verificarDisponibilidad(espacio_id, fecha, hora_inicio, hora_fin);
  res.json({ ok: true, disponible });
});

router.post('/', requireRole('estudiante'), async (req, res) => {
  const datos = req.body;

  const { valido, errores } = validarDatosTramite(datos);
  if (!valido) {
    return res.status(400).json({ ok: false, errores });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const estudiante = (await cliente.query(
      'SELECT * FROM estudiantes WHERE id = $1', [req.usuario.estudiante_id]
    )).rows[0];

    if (datos.tipo === 'reserva_espacio') {
      const disponible = await verificarDisponibilidad(
        datos.espacio_id, datos.fecha_evento, datos.hora_inicio, datos.hora_fin
      );
      if (!disponible) {
        await cliente.query('ROLLBACK');
        return res.status(409).json({ ok: false, errores: ['El espacio no está disponible en esa fecha y hora.'] });
      }

      const { hayConflicto } = await detectarConflicto(
        datos.espacio_id, datos.fecha_evento, datos.hora_inicio, datos.hora_fin
      );
      if (hayConflicto) {
        await cliente.query('ROLLBACK');
        return res.status(409).json({ ok: false, errores: ['Ya existe una solicitud aprobada que se traslapa con esta fecha/hora.'] });
      }
    }

    const solicitud = (await cliente.query(
      `INSERT INTO solicitudes
        (estudiante_id, tipo, descripcion, fecha_evento, hora_inicio, hora_fin, espacio_id, detalles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [estudiante.id, datos.tipo, datos.descripcion, datos.fecha_evento || null,
       datos.hora_inicio || null, datos.hora_fin || null, datos.espacio_id || null,
       JSON.stringify(datos.detalles || {})]
    )).rows[0];

    await cliente.query('COMMIT');

    await registrarAccion(solicitud.id, 'solicitud_creada');
    await actualizarEstado(solicitud.id, 'en_revision');

    res.status(201).json({ ok: true, solicitud });
  } catch (err) {
    await cliente.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error interno al crear la solicitud.'] });
  } finally {
    cliente.release();
  }
});

router.get('/', async (req, res) => {
  const { estado } = req.query;
  const params = [];
  let sql = `SELECT s.*, e.nombre, e.matricula, e.correo, esp.nombre AS espacio_nombre
             FROM solicitudes s
             JOIN estudiantes e ON e.id = s.estudiante_id
             LEFT JOIN espacios esp ON esp.id = s.espacio_id`;
  const condiciones = [];

  if (req.usuario.rol === 'estudiante') {
    params.push(req.usuario.estudiante_id);
    condiciones.push(`s.estudiante_id = $${params.length}`);
  }
  if (estado) {
    params.push(estado);
    condiciones.push(`s.estado = $${params.length}`);
  }
  if (condiciones.length) sql += ' WHERE ' + condiciones.join(' AND ');
  sql += ' ORDER BY s.creado_en DESC';

  const { rows } = await pool.query(sql, params);
  res.json({ ok: true, solicitudes: rows });
});

// ------------------------------------------------------------
// PUT /api/solicitudes/:id/aprobar   (solo RESPONSABLE, requiere su contraseña)
// ------------------------------------------------------------
router.put('/:id/aprobar', requireRole('responsable'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const { rows: filasUsuario } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1', [req.usuario.id]
    );
    const passwordValida = filasUsuario[0] && await bcrypt.compare(password || '', filasUsuario[0].password_hash);
    if (!passwordValida) {
      return res.status(401).json({ ok: false, errores: ['Contraseña incorrecta. No se aprobó la solicitud.'] });
    }

    const { rows } = await pool.query(
      `SELECT s.*, e.nombre, e.matricula, e.correo
       FROM solicitudes s JOIN estudiantes e ON e.id = s.estudiante_id
       WHERE s.id = $1`, [id]
    );
    const solicitud = rows[0];
    if (!solicitud) return res.status(404).json({ ok: false, errores: ['Solicitud no encontrada.'] });

    if (solicitud.estado !== 'en_revision') {
      return res.status(409).json({ ok: false, errores: ['Esta solicitud ya fue procesada (no está en revisión).'] });
    }

    // IF es reserva de espacio -> vuelve a checar disponibilidad justo antes de aprobar,
    // por si otra solicitud para el mismo horario se aprobó primero mientras tanto.
    if (solicitud.tipo === 'reserva_espacio' && solicitud.espacio_id) {
      const disponible = await verificarDisponibilidad(
        solicitud.espacio_id, solicitud.fecha_evento, solicitud.hora_inicio, solicitud.hora_fin
      );
      if (!disponible) {
        return res.status(409).json({
          ok: false,
          errores: ['Ese espacio y horario ya fueron tomados por otra solicitud aprobada. Esta solicitud debe rechazarse o reprogramarse.']
        });
      }
      await bloquearFecha(solicitud.espacio_id, solicitud.id, solicitud.fecha_evento, solicitud.hora_inicio, solicitud.hora_fin);
    }

    const { folio, ruta, codigoVerificacion } = await generarOficioPDF(solicitud, solicitud);
    await pool.query(
      `UPDATE solicitudes SET folio = $2, oficio_pdf_ruta = $3, codigo_verificacion = $4 WHERE id = $1`,
      [id, folio, ruta, codigoVerificacion]
    );

    const actualizada = await actualizarEstado(id, 'aprobado', { folio, rutaPDF: ruta });
    await registrarAccion(id, 'solicitud_aprobada', `Folio: ${folio} (por ${req.usuario.nombre})`);

    res.json({ ok: true, solicitud: actualizada, folio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error interno al aprobar la solicitud.'] });
  }
});

router.put('/:id/rechazar', requireRole('responsable'), async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const { rows } = await pool.query(
      `SELECT s.*, e.nombre, e.correo FROM solicitudes s
       JOIN estudiantes e ON e.id = s.estudiante_id WHERE s.id = $1`, [id]
    );
    const solicitud = rows[0];
    if (!solicitud) return res.status(404).json({ ok: false, errores: ['Solicitud no encontrada.'] });

    const actualizada = await actualizarEstado(id, 'rechazado', { motivo });
    await registrarAccion(id, 'solicitud_rechazada', `${motivo || 'Sin motivo especificado'} (por ${req.usuario.nombre})`);

    res.json({ ok: true, solicitud: actualizada });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error interno al rechazar la solicitud.'] });
  }
});

router.get('/:id/oficio', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT oficio_pdf_ruta, folio, estudiante_id FROM solicitudes WHERE id = $1', [req.params.id]
  );
  const solicitud = rows[0];
  if (!solicitud || !solicitud.oficio_pdf_ruta) {
    return res.status(404).json({ ok: false, errores: ['Oficio no disponible todavía.'] });
  }

  if (req.usuario.rol === 'estudiante' && solicitud.estudiante_id !== req.usuario.estudiante_id) {
    return res.status(403).json({ ok: false, errores: ['No tienes permiso para ver este oficio.'] });
  }

  res.download(solicitud.oficio_pdf_ruta, `${solicitud.folio}.pdf`);
});

module.exports = router;