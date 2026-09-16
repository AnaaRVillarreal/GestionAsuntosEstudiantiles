const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const { validarDatosTramite } = require('../services/validadores');
const { verificarDisponibilidad } = require('../services/verificadorDisponibilidad');
const { detectarConflicto } = require('../services/detectorConflictos');
const { registrarAccion } = require('../services/registroAcciones');
const { generarOficioPDF } = require('../services/generadorPDF');
const { actualizarEstado } = require('../services/actualizadorEstados');
const { bloquearFecha } = require('../services/bloqueadorFechas');

router.use(requireAuth); // todas las rutas de este archivo requieren sesión

// ------------------------------------------------------------
// POST /api/solicitudes  -> el ESTUDIANTE crea una nueva solicitud
// ------------------------------------------------------------
router.post('/', requireRole('estudiante'), async (req, res) => {
  const datos = req.body;

  // 1) SENSOR: validador de campos (solo datos del trámite; los
  //    datos personales ya se validaron al registrar la cuenta)
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

    // 2) IF el trámite requiere espacio -> verificar disponibilidad y conflictos
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
    // ELSE: no requiere validar espacio, continúa directo

    // 3) Crear la solicitud, asociada al estudiante de la sesión
       const solicitud = (await cliente.query(
      `INSERT INTO solicitudes
        (estudiante_id, tipo, descripcion, fecha_evento, hora_inicio, hora_fin, espacio_id, detalles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [estudiante.id, datos.tipo, datos.descripcion, datos.fecha_evento || null,
       datos.hora_inicio || null, datos.hora_fin || null, datos.espacio_id || null,
       JSON.stringify(datos.detalles || {})]
    )).rows[0];

    await cliente.query('COMMIT');

    // 4) SENSOR: registro de acciones
    await registrarAccion(solicitud.id, 'solicitud_creada');

    // 5) ACTUADOR: actualizador de estados -> pasa a "en_revision"
    //    (esto ya dispara el correo correspondiente automáticamente)
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

// ------------------------------------------------------------
// GET /api/solicitudes
// - responsable -> ve todas (con filtro opcional ?estado=)
// - estudiante  -> solo ve las suyas
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  const { estado } = req.query;
  const params = [];
  let sql = `SELECT s.*, e.nombre, e.matricula, e.correo
             FROM solicitudes s JOIN estudiantes e ON e.id = s.estudiante_id`;
  const condiciones = [];

  // IF quien pregunta es estudiante -> filtra solo sus solicitudes / ELSE (responsable) ve todas
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
// PUT /api/solicitudes/:id/aprobar   (solo RESPONSABLE)
// ------------------------------------------------------------
router.put('/:id/aprobar', requireRole('responsable'), async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT s.*, e.nombre, e.matricula, e.correo
     FROM solicitudes s JOIN estudiantes e ON e.id = s.estudiante_id
     WHERE s.id = $1`, [id]
  );
  const solicitud = rows[0];
  if (!solicitud) return res.status(404).json({ ok: false, errores: ['Solicitud no encontrada.'] });

  // IF es reserva de espacio -> bloquear la fecha
  if (solicitud.tipo === 'reserva_espacio' && solicitud.espacio_id) {
    await bloquearFecha(solicitud.espacio_id, solicitud.id, solicitud.fecha_evento, solicitud.hora_inicio, solicitud.hora_fin);
  }

  // ACTUADOR: generador de PDF
  const { folio, ruta } = await generarOficioPDF(solicitud, solicitud);
  await pool.query(
    `UPDATE solicitudes SET folio = $2, oficio_pdf_ruta = $3 WHERE id = $1`,
    [id, folio, ruta]
  );

  const actualizada = await actualizarEstado(id, 'aprobado', { folio });
  await registrarAccion(id, 'solicitud_aprobada', `Folio: ${folio} (por ${req.usuario.nombre})`);

  res.json({ ok: true, solicitud: actualizada, folio });
});

// ------------------------------------------------------------
// PUT /api/solicitudes/:id/rechazar   (solo RESPONSABLE)
// ------------------------------------------------------------
router.put('/:id/rechazar', requireRole('responsable'), async (req, res) => {
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
});

// ------------------------------------------------------------
// GET /api/solicitudes/:id/oficio
// - responsable -> puede descargar cualquiera
// - estudiante  -> solo el oficio de su propia solicitud
// ------------------------------------------------------------
router.get('/:id/oficio', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT oficio_pdf_ruta, folio, estudiante_id FROM solicitudes WHERE id = $1', [req.params.id]
  );
  const solicitud = rows[0];
  if (!solicitud || !solicitud.oficio_pdf_ruta) {
    return res.status(404).json({ ok: false, errores: ['Oficio no disponible todavía.'] });
  }

  // IF es estudiante y no es su propia solicitud -> 403 / ELSE permite descargar
  if (req.usuario.rol === 'estudiante' && solicitud.estudiante_id !== req.usuario.estudiante_id) {
    return res.status(403).json({ ok: false, errores: ['No tienes permiso para ver este oficio.'] });
  }

  res.download(solicitud.oficio_pdf_ruta, `${solicitud.folio}.pdf`);
});

module.exports = router;
