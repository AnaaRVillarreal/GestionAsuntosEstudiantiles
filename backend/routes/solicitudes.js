const express = require('express');
const fs = require('fs');
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
const { enviarNotificacion } = require('../services/motorNotificaciones');
const { notificarRol, notificarEstudiante } = require('../services/notificacionesApp');
const { NIVELES, ETIQUETAS, siguienteNivel, generarFirma } = require('../services/flujoAprobacion');

router.use(requireAuth);

// Guarda (o actualiza, si se reintenta) la firma de un nivel
async function guardarAprobacion(solicitud_id, usuario_id, rol, firma, fecha) {
  await pool.query(
    `INSERT INTO aprobaciones (solicitud_id, usuario_id, rol, firma, creado_en)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (solicitud_id, rol) DO UPDATE
       SET usuario_id = EXCLUDED.usuario_id, firma = EXCLUDED.firma, creado_en = EXCLUDED.creado_en`,
    [solicitud_id, usuario_id, rol, firma, fecha]
  );
}

// ------------------------------------------------------------
// GET /api/solicitudes/disponibilidad  (aviso en vivo en el formulario)
// ------------------------------------------------------------
router.get('/disponibilidad', async (req, res) => {
  const { espacio_id, fecha, hora_inicio, hora_fin } = req.query;
  if (!espacio_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ ok: false, errores: ['Faltan datos para verificar disponibilidad.'] });
  }
  const disponible = await verificarDisponibilidad(espacio_id, fecha, hora_inicio, hora_fin);
  res.json({ ok: true, disponible });
});

// ------------------------------------------------------------
// POST /api/solicitudes  -> el ESTUDIANTE crea una solicitud
// ------------------------------------------------------------
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

    // La solicitud entra a la cadena en el primer nivel: aviso en pantalla y correo a Logística
    await notificarRol(
      'logistica',
      `Hay una solicitud por aprobar: #${solicitud.id} (${solicitud.tipo}).`,
      solicitud.id
    );

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
// - estudiante -> solo las suyas
// - administrador y niveles de aprobación -> todas
// La confirmación de recepción solo la ven el estudiante, Dirección y el administrador
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    const params = [];
    let sql = `SELECT s.*, e.nombre, e.matricula, e.correo, esp.nombre AS espacio_nombre,
                 COALESCE((
                   SELECT json_agg(
                     json_build_object('rol', a.rol, 'nombre', u.nombre, 'fecha', a.creado_en)
                     ORDER BY a.creado_en)
                   FROM aprobaciones a JOIN usuarios u ON u.id = a.usuario_id
                   WHERE a.solicitud_id = s.id
                 ), '[]'::json) AS aprobaciones
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

    // IF es Logística o Jefatura -> el servidor ni siquiera les manda la confirmación
    if (req.usuario.rol === 'logistica' || req.usuario.rol === 'jefatura') {
      rows.forEach((r) => { delete r.recepcion_estado; delete r.recepcion_en; });
    }

    res.json({ ok: true, solicitudes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al consultar las solicitudes.'] });
  }
});

// ------------------------------------------------------------
// PUT /api/solicitudes/:id/aprobar
// Lo ejecuta Logística, Jefatura o Dirección, SOLO cuando es su turno.
// Cada aprobación exige la contraseña de quien firma.
// ------------------------------------------------------------
router.put('/:id/aprobar', requireRole(...NIVELES), async (req, res) => {
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

    // IF no es el turno de este rol -> 403 / ELSE continúa
    if (solicitud.nivel_actual !== req.usuario.rol) {
      return res.status(403).json({
        ok: false,
        errores: [`Esta solicitud está en espera de ${ETIQUETAS[solicitud.nivel_actual]}, no de ${ETIQUETAS[req.usuario.rol]}.`]
      });
    }

    const rol = req.usuario.rol;
    const siguiente = siguienteNivel(rol);
    const fecha = new Date();
    const firma = generarFirma(solicitud.id, rol, req.usuario.id, fecha.toISOString());
    const esReserva = solicitud.tipo === 'reserva_espacio' && solicitud.espacio_id;

    // ---------- IF hay un nivel siguiente -> la solicitud avanza ----------
    if (siguiente) {
      await guardarAprobacion(solicitud.id, req.usuario.id, rol, firma, fecha);
      await pool.query(
        'UPDATE solicitudes SET nivel_actual = $2, actualizado_en = now() WHERE id = $1',
        [id, siguiente]
      );
      await registrarAccion(
        id, 'aprobacion_parcial',
        `${ETIQUETAS[rol]} (${req.usuario.nombre}) aprobó; pasa a ${ETIQUETAS[siguiente]}`
      );

      // Aviso en pantalla y correo al nivel que sigue
      await notificarRol(siguiente, `Hay una solicitud por aprobar: #${id} (${solicitud.tipo}).`, solicitud.id);
      await notificarEstudiante(
        solicitud.estudiante_id,
        `Tu solicitud #${id} fue aprobada por ${ETIQUETAS[rol]} y pasó a ${ETIQUETAS[siguiente]}.`,
        solicitud.id
      );

      return res.json({ ok: true, avance: siguiente });
    }

    // ---------- ELSE: es Dirección (último nivel) -> aprobación final ----------
    if (esReserva) {
      const disponible = await verificarDisponibilidad(
        solicitud.espacio_id, solicitud.fecha_evento, solicitud.hora_inicio, solicitud.hora_fin
      );
      if (!disponible) {
        return res.status(409).json({
          ok: false,
          errores: ['Ese espacio y horario ya fueron tomados por otra solicitud aprobada. Esta solicitud debe rechazarse o reprogramarse.']
        });
      }
    }

    const { rows: previas } = await pool.query(
      `SELECT a.rol, a.firma, a.creado_en, u.nombre
       FROM aprobaciones a JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.solicitud_id = $1 ORDER BY a.creado_en`,
      [id]
    );
    const firmas = [
      ...previas.filter((p) => p.rol !== rol),
      { rol, firma, creado_en: fecha, nombre: req.usuario.nombre }
    ];

    // Primero se genera el PDF; si falla, no queda nada a medias en la base
    const { folio, ruta, codigoVerificacion } = await generarOficioPDF(solicitud, solicitud, firmas);

    await guardarAprobacion(solicitud.id, req.usuario.id, rol, firma, fecha);
    if (esReserva) {
      await bloquearFecha(solicitud.espacio_id, solicitud.id, solicitud.fecha_evento, solicitud.hora_inicio, solicitud.hora_fin);
    }
    await pool.query(
      `UPDATE solicitudes SET folio = $2, oficio_pdf_ruta = $3, codigo_verificacion = $4,
         recepcion_estado = 'pendiente', recepcion_en = NULL
       WHERE id = $1`,
      [id, folio, ruta, codigoVerificacion]
    );

    // Esto también envía el correo al estudiante con el PDF adjunto
    const actualizada = await actualizarEstado(id, 'aprobado', { folio, rutaPDF: ruta });
    await registrarAccion(id, 'solicitud_aprobada', `Folio: ${folio} (aprobación final por ${req.usuario.nombre})`);

    await notificarEstudiante(
      solicitud.estudiante_id,
      `Tu solicitud #${id} fue aprobada. Ya puedes descargar tu oficio (${folio}) y confirmar que lo recibiste.`,
      solicitud.id
    );

    res.json({ ok: true, solicitud: actualizada, folio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error interno al aprobar la solicitud.'] });
  }
});

// ------------------------------------------------------------
// PUT /api/solicitudes/:id/rechazar  (el nivel al que le toca)
// ------------------------------------------------------------
router.put('/:id/rechazar', requireRole(...NIVELES), async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const { rows } = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = rows[0];
    if (!solicitud) return res.status(404).json({ ok: false, errores: ['Solicitud no encontrada.'] });

    if (solicitud.estado !== 'en_revision') {
      return res.status(409).json({ ok: false, errores: ['Esta solicitud ya fue procesada.'] });
    }
    if (solicitud.nivel_actual !== req.usuario.rol) {
      return res.status(403).json({
        ok: false,
        errores: [`Esta solicitud está en espera de ${ETIQUETAS[solicitud.nivel_actual]}.`]
      });
    }

    const actualizada = await actualizarEstado(id, 'rechazado', { motivo });
    await registrarAccion(
      id, 'solicitud_rechazada',
      `${ETIQUETAS[req.usuario.rol]}: ${motivo || 'Sin motivo especificado'} (por ${req.usuario.nombre})`
    );
    await notificarEstudiante(
      solicitud.estudiante_id,
      `Tu solicitud #${id} fue rechazada por ${ETIQUETAS[req.usuario.rol]}. Motivo: ${motivo || 'No especificado'}.`,
      solicitud.id
    );

    res.json({ ok: true, solicitud: actualizada });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error interno al rechazar la solicitud.'] });
  }
});

// ------------------------------------------------------------
// PUT /api/solicitudes/:id/editar
// Administrador (siempre) o el nivel al que le toca, solo "en revisión"
// ------------------------------------------------------------
router.put('/:id/editar', requireRole('responsable', ...NIVELES), async (req, res) => {
  try {
    const { id } = req.params;
    const datos = req.body;

    const { rows } = await pool.query('SELECT * FROM solicitudes WHERE id = $1', [id]);
    const solicitud = rows[0];
    if (!solicitud) return res.status(404).json({ ok: false, errores: ['Solicitud no encontrada.'] });

    if (solicitud.estado !== 'en_revision') {
      return res.status(409).json({ ok: false, errores: ['Solo se pueden editar solicitudes que están en revisión.'] });
    }
    if (req.usuario.rol !== 'responsable' && solicitud.nivel_actual !== req.usuario.rol) {
      return res.status(403).json({ ok: false, errores: ['Solo puedes editar solicitudes que están en tu turno.'] });
    }

    const { valido, errores } = validarDatosTramite({ ...datos, tipo: solicitud.tipo });
    if (!valido) return res.status(400).json({ ok: false, errores });

    if (solicitud.tipo === 'reserva_espacio') {
      const disponible = await verificarDisponibilidad(
        datos.espacio_id, datos.fecha_evento, datos.hora_inicio, datos.hora_fin
      );
      if (!disponible) {
        return res.status(409).json({ ok: false, errores: ['El nuevo horario no está disponible.'] });
      }
    }

    const actualizada = (await pool.query(
      `UPDATE solicitudes
       SET descripcion = $2, fecha_evento = $3, hora_inicio = $4, hora_fin = $5,
           espacio_id = $6, detalles = $7, actualizado_en = now()
       WHERE id = $1 RETURNING *`,
      [id, datos.descripcion, datos.fecha_evento || null, datos.hora_inicio || null,
       datos.hora_fin || null, datos.espacio_id || null, JSON.stringify(datos.detalles || {})]
    )).rows[0];

    await registrarAccion(id, 'solicitud_editada', `Editado por ${req.usuario.nombre} (${req.usuario.rol})`);
    await notificarEstudiante(
      solicitud.estudiante_id,
      `Tu solicitud #${id} fue modificada por ${req.usuario.nombre}. Revisa los cambios.`,
      solicitud.id
    );

    res.json({ ok: true, solicitud: actualizada });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error interno al editar la solicitud.'] });
  }
});

// ------------------------------------------------------------
// PUT /api/solicitudes/:id/confirmar-recepcion   (solo el ESTUDIANTE dueño)
// Palomita (recibido: true) o tacha (recibido: false)
// ------------------------------------------------------------
router.put('/:id/confirmar-recepcion', requireRole('estudiante'), async (req, res) => {
  try {
    const { id } = req.params;
    const { recibido } = req.body;
    if (typeof recibido !== 'boolean') {
      return res.status(400).json({ ok: false, errores: ['Indica si recibiste el oficio (sí o no).'] });
    }

    const { rows } = await pool.query(
      `SELECT s.id, s.estado, s.estudiante_id, s.folio, e.nombre
       FROM solicitudes s JOIN estudiantes e ON e.id = s.estudiante_id
       WHERE s.id = $1`, [id]
    );
    const solicitud = rows[0];
    if (!solicitud || solicitud.estudiante_id !== req.usuario.estudiante_id) {
      return res.status(404).json({ ok: false, errores: ['Solicitud no encontrada.'] });
    }
    if (solicitud.estado !== 'aprobado') {
      return res.status(409).json({ ok: false, errores: ['Solo puedes confirmar la recepción de solicitudes aprobadas.'] });
    }

    const nuevoEstado = recibido ? 'recibido' : 'no_recibido';
    await pool.query(
      'UPDATE solicitudes SET recepcion_estado = $2, recepcion_en = now() WHERE id = $1',
      [id, nuevoEstado]
    );
    await registrarAccion(
      id, recibido ? 'oficio_recibido' : 'oficio_no_recibido',
      `Confirmado por el estudiante ${solicitud.nombre}`
    );

    // Se avisa a Dirección y al administrador. La palomita solo en pantalla;
    // la tacha también por correo, porque requiere acción (reenviar el oficio).
    const mensaje = recibido
      ? `${solicitud.nombre} confirmó que recibió el oficio de la solicitud #${id} (${solicitud.folio}).`
      : `${solicitud.nombre} reporta que NO recibió el oficio de la solicitud #${id} (${solicitud.folio}). Puedes reenviarlo por correo.`;
    const opciones = recibido
      ? { correo: false }
      : { correo: true, asunto: 'Un estudiante no recibió su oficio' };
    await notificarRol('direccion', mensaje, solicitud.id, opciones);
    await notificarRol('responsable', mensaje, solicitud.id, opciones);

    res.json({ ok: true, recepcion_estado: nuevoEstado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al registrar la confirmación.'] });
  }
});

// ------------------------------------------------------------
// POST /api/solicitudes/:id/reenviar-oficio   (Dirección o administrador)
// ------------------------------------------------------------
router.post('/:id/reenviar-oficio', requireRole('direccion', 'responsable'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.estado, s.estudiante_id, s.folio, s.oficio_pdf_ruta, e.nombre, e.correo
       FROM solicitudes s JOIN estudiantes e ON e.id = s.estudiante_id
       WHERE s.id = $1`, [req.params.id]
    );
    const s = rows[0];
    if (!s) return res.status(404).json({ ok: false, errores: ['Solicitud no encontrada.'] });
    if (s.estado !== 'aprobado' || !s.oficio_pdf_ruta) {
      return res.status(409).json({ ok: false, errores: ['Esta solicitud no tiene un oficio generado.'] });
    }
    if (!fs.existsSync(s.oficio_pdf_ruta)) {
      return res.status(409).json({
        ok: false,
        errores: ['El archivo del oficio no está en este servidor (pudo generarse en otra computadora).']
      });
    }

    await enviarNotificacion(
      s.id, s.correo,
      'Reenvío de tu oficio',
      `Hola ${s.nombre}, te reenviamos el oficio de tu solicitud #${s.id} (Folio ${s.folio}).`,
      { filename: `${s.folio}.pdf`, path: s.oficio_pdf_ruta }
    );

    // La confirmación vuelve a "pendiente" para que el estudiante responda de nuevo
    await pool.query(
      "UPDATE solicitudes SET recepcion_estado = 'pendiente', recepcion_en = NULL WHERE id = $1",
      [s.id]
    );
    await registrarAccion(s.id, 'oficio_reenviado', `Reenviado por ${req.usuario.nombre} (${req.usuario.rol})`);
    await notificarEstudiante(
      s.estudiante_id,
      `Te reenviamos por correo el oficio de tu solicitud #${s.id}. Cuando lo tengas, confírmalo.`,
      s.id
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al reenviar el oficio.'] });
  }
});

// ------------------------------------------------------------
// GET /api/solicitudes/:id/oficio
// Pueden descargarlo: el estudiante dueño, Dirección y el administrador
// ------------------------------------------------------------
router.get('/:id/oficio', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT oficio_pdf_ruta, folio, estudiante_id FROM solicitudes WHERE id = $1', [req.params.id]
    );
    const solicitud = rows[0];
    if (!solicitud || !solicitud.oficio_pdf_ruta) {
      return res.status(404).json({ ok: false, errores: ['Oficio no disponible todavía.'] });
    }

    const rol = req.usuario.rol;
    const esDueno = rol === 'estudiante' && solicitud.estudiante_id === req.usuario.estudiante_id;
    const autorizado = esDueno || rol === 'direccion' || rol === 'responsable';
    if (!autorizado) {
      return res.status(403).json({ ok: false, errores: ['No tienes permiso para descargar este oficio.'] });
    }

    if (!fs.existsSync(solicitud.oficio_pdf_ruta)) {
      return res.status(404).json({
        ok: false,
        errores: ['El archivo del oficio no está disponible en este servidor (pudo generarse en otra computadora).']
      });
    }

    res.download(solicitud.oficio_pdf_ruta, `${solicitud.folio}.pdf`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, errores: ['Error al descargar el oficio.'] });
  }
});

module.exports = router;