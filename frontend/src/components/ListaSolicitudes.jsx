import React, { useEffect, useState } from 'react';
import { apiFetch, obtenerSesion } from '../api.js';

const ETIQ = { logistica: 'Logística', jefatura: 'Jefatura', direccion: 'Dirección' };
const NIVELES = Object.keys(ETIQ);

const ETIQUETAS_DETALLE = {
  destino: 'Destino', num_pasajeros: 'Pasajeros',
  nombre_evento: 'Nombre del evento', asistentes_esperados: 'Asistentes esperados',
  tipo_constancia: 'Tipo de constancia', institucion_destino: 'Institución destino',
  dirigido_a: 'Dirigido a'
};

export default function ListaSolicitudes({ rol }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [expandidaId, setExpandidaId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState(null);

  const esNivel = NIVELES.includes(rol);
  const esAdmin = rol === 'responsable';
  const veTodo = esNivel || esAdmin;
  const puedeDescargar = rol === 'estudiante' || rol === 'direccion' || esAdmin;
  // La columna de recepción la ven el estudiante, Dirección y el administrador
  const verRecepcion = puedeDescargar;
  const columnas = 6 + (veTodo ? 1 : 0) + (verRecepcion ? 1 : 0);

  // IF es el turno de este rol -> puede aprobar / rechazar
  const puedeActuar = (s) => esNivel && s.estado === 'en_revision' && s.nivel_actual === rol;
  const puedeEditar = (s) => s.estado === 'en_revision' && (esAdmin || (esNivel && s.nivel_actual === rol));

  const avance = (s) => {
    if (s.estado === 'en_revision') return `En espera de ${ETIQ[s.nivel_actual]}`;
    if (s.estado === 'aprobado') return 'Completa';
    return '—';
  };

  const celdaRecepcion = (s) => {
    if (s.estado !== 'aprobado') return '—';
    if (s.recepcion_estado === 'recibido') return <span className="estado aprobado">✓ Recibido</span>;
    if (s.recepcion_estado === 'no_recibido') return <span className="estado rechazado">✗ No recibido</span>;
    return <span className="estado enviado">Pendiente</span>;
  };

  const cargar = async () => {
    setCargando(true);
    const { data } = await apiFetch('/api/solicitudes');
    setSolicitudes(data.solicitudes || []);
    setCargando(false);
  };

  useEffect(() => {
    cargar();
    if (esAdmin || esNivel) {
      apiFetch('/api/espacios').then(({ data }) => { if (data.ok) setEspacios(data.espacios); });
    }
  }, []);

  const aprobar = async (id) => {
    const password = window.prompt(`Confirma tu contraseña para aprobar como ${ETIQ[rol]}:`);
    if (!password) return;
    const { data } = await apiFetch(`/api/solicitudes/${id}/aprobar`, {
      method: 'PUT',
      body: JSON.stringify({ password })
    });
    if (!data.ok) return window.alert(data.errores?.[0] || 'No se pudo aprobar.');
    cargar();
  };

  const rechazar = async (id) => {
    const motivo = window.prompt('Motivo de rechazo (opcional):') || '';
    const { data } = await apiFetch(`/api/solicitudes/${id}/rechazar`, {
      method: 'PUT',
      body: JSON.stringify({ motivo })
    });
    if (!data.ok) return window.alert(data.errores?.[0] || 'No se pudo rechazar.');
    cargar();
  };

  const descargarOficio = async (id, folio) => {
    const sesion = obtenerSesion();
    const resp = await fetch(`/api/solicitudes/${id}/oficio`, {
      headers: { Authorization: `Bearer ${sesion?.token}` }
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return window.alert(data.errores?.[0] || 'No se pudo descargar el oficio.');
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${folio || id}.pdf`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  // Palomita (true) o tacha (false) del estudiante
  const confirmarRecepcion = async (id, recibido) => {
    const { data } = await apiFetch(`/api/solicitudes/${id}/confirmar-recepcion`, {
      method: 'PUT',
      body: JSON.stringify({ recibido })
    });
    if (!data.ok) return window.alert(data.errores?.[0] || 'No se pudo registrar tu respuesta.');
    cargar();
  };

  // Dirección o administrador, cuando el estudiante marcó la tacha
  const reenviarOficio = async (id) => {
    if (!window.confirm('¿Reenviar el oficio por correo al estudiante?')) return;
    const { data } = await apiFetch(`/api/solicitudes/${id}/reenviar-oficio`, { method: 'POST' });
    if (!data.ok) return window.alert(data.errores?.[0] || 'No se pudo reenviar el oficio.');
    window.alert('Oficio reenviado por correo.');
    cargar();
  };

  const alternarDetalle = (id) => { setExpandidaId(expandidaId === id ? null : id); setEditandoId(null); };

  const iniciarEdicion = (s) => {
    setEditandoId(s.id);
    setExpandidaId(s.id);
    setFormEdicion({
      descripcion: s.descripcion || '',
      fecha_evento: s.fecha_evento ? s.fecha_evento.slice(0, 10) : '',
      hora_inicio: s.hora_inicio || '',
      hora_fin: s.hora_fin || '',
      espacio_id: s.espacio_id || '',
      detalles: s.detalles || {}
    });
  };

  const guardarEdicion = async (id) => {
    const { data } = await apiFetch(`/api/solicitudes/${id}/editar`, {
      method: 'PUT',
      body: JSON.stringify(formEdicion)
    });
    if (!data.ok) return window.alert(data.errores?.[0] || 'No se pudo guardar la edición.');
    setEditandoId(null);
    cargar();
  };

  if (cargando) return <p>Cargando solicitudes...</p>;

  return (
    <div className="tarjeta">
      <table>
        <thead>
          <tr>
            <th>#</th>
            {veTodo && <th>Estudiante</th>}
            <th>Tipo</th><th>Estado</th><th>Avance</th><th>Folio</th>
            {verRecepcion && <th>Recepción</th>}
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((s) => (
            <React.Fragment key={s.id}>
              <tr>
                <td>{s.id}</td>
                {veTodo && <td>{s.nombre} ({s.matricula})</td>}
                <td>{s.tipo}</td>
                <td><span className={`estado ${s.estado}`}>{s.estado}</span></td>
                <td>{avance(s)}</td>
                <td>{s.folio || '-'}</td>
                {verRecepcion && <td>{celdaRecepcion(s)}</td>}
                <td>
                  <button className="btn-rechazar" onClick={() => alternarDetalle(s.id)}>
                    {expandidaId === s.id ? 'Ocultar' : 'Ver detalles'}
                  </button>{' '}
                  {puedeEditar(s) && (
                    <><button className="btn-rechazar" onClick={() => iniciarEdicion(s)}>Editar</button>{' '}</>
                  )}
                  {puedeActuar(s) && (
                    <>
                      <button className="btn-aprobar" onClick={() => aprobar(s.id)}>Aprobar</button>
                      <button className="btn-rechazar" onClick={() => rechazar(s.id)}>Rechazar</button>
                    </>
                  )}
                  {s.estado === 'aprobado' && puedeDescargar && (
                    <button className="btn-rechazar" onClick={() => descargarOficio(s.id, s.folio)}>Descargar oficio</button>
                  )}

                  {/* ESTUDIANTE: palomita o tacha para confirmar que recibió el oficio */}
                  {rol === 'estudiante' && s.estado === 'aprobado' && s.recepcion_estado === 'pendiente' && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      ¿Recibiste tu oficio?{' '}
                      <button className="btn-aprobar" onClick={() => confirmarRecepcion(s.id, true)}>✓ Sí</button>
                      <button className="btn-rechazar" onClick={() => confirmarRecepcion(s.id, false)}>✗ No</button>
                    </div>
                  )}
                  {rol === 'estudiante' && s.estado === 'aprobado' && s.recepcion_estado === 'no_recibido' && (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <button className="btn-aprobar" onClick={() => confirmarRecepcion(s.id, true)}>✓ Ya lo recibí</button>
                    </div>
                  )}

                  {/* DIRECCIÓN / ADMINISTRADOR: si marcó la tacha, pueden reenviar el oficio */}
                  {(rol === 'direccion' || esAdmin) && s.estado === 'aprobado' && s.recepcion_estado === 'no_recibido' && (
                    <div style={{ marginTop: 6 }}>
                      <button className="btn-aprobar" onClick={() => reenviarOficio(s.id)}>Reenviar por correo</button>
                    </div>
                  )}
                </td>
              </tr>

              {expandidaId === s.id && editandoId !== s.id && (
                <tr>
                  <td colSpan={columnas} style={{ background: 'rgba(17,112,199,0.04)' }}>
                    <div style={{ padding: '10px 4px', fontSize: 13.5 }}>
                      <p style={{ margin: '4px 0' }}><b>Descripción:</b> {s.descripcion}</p>
                      {s.fecha_evento && (
                        <p style={{ margin: '4px 0' }}>
                          <b>Fecha:</b> {s.fecha_evento?.slice(0, 10)} &nbsp; <b>Hora:</b> {s.hora_inicio}–{s.hora_fin}
                        </p>
                      )}
                      {s.espacio_nombre && <p style={{ margin: '4px 0' }}><b>Espacio:</b> {s.espacio_nombre}</p>}
                      {s.detalles && Object.keys(s.detalles).length > 0 && (
                        <div style={{ margin: '4px 0' }}>
                          <b>Detalles del trámite:</b>
                          <ul style={{ margin: '4px 0 0 18px' }}>
                            {Object.entries(s.detalles).map(([clave, valor]) => (
                              <li key={clave}>{ETIQUETAS_DETALLE[clave] || clave}: {valor}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div style={{ margin: '4px 0' }}>
                        <b>Aprobaciones:</b>
                        {s.aprobaciones?.length > 0 ? (
                          <ul style={{ margin: '4px 0 0 18px' }}>
                            {s.aprobaciones.map((a, i) => (
                              <li key={i}>
                                {ETIQ[a.rol]} — {a.nombre} ({new Date(a.fecha).toLocaleString('es-MX')})
                              </li>
                            ))}
                          </ul>
                        ) : ' ninguna todavía'}
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {editandoId === s.id && formEdicion && (
                <tr>
                  <td colSpan={columnas} style={{ background: 'rgba(255,195,0,0.08)' }}>
                    <div style={{ padding: '14px 4px', fontSize: 13.5 }}>
                      <div className="campo">
                        <label>Descripción</label>
                        <textarea rows={2} value={formEdicion.descripcion}
                          onChange={(e) => setFormEdicion({ ...formEdicion, descripcion: e.target.value })} />
                      </div>
                      {s.tipo === 'reserva_espacio' && (
                        <>
                          <div className="campo">
                            <label>Fecha</label>
                            <input type="date" value={formEdicion.fecha_evento}
                              onChange={(e) => setFormEdicion({ ...formEdicion, fecha_evento: e.target.value })} />
                          </div>
                          <div className="campo">
                            <label>Hora inicio</label>
                            <input type="time" value={formEdicion.hora_inicio}
                              onChange={(e) => setFormEdicion({ ...formEdicion, hora_inicio: e.target.value })} />
                          </div>
                          <div className="campo">
                            <label>Hora fin</label>
                            <input type="time" value={formEdicion.hora_fin}
                              onChange={(e) => setFormEdicion({ ...formEdicion, hora_fin: e.target.value })} />
                          </div>
                          <div className="campo">
                            <label>Espacio</label>
                            <select value={formEdicion.espacio_id}
                              onChange={(e) => setFormEdicion({ ...formEdicion, espacio_id: e.target.value })}>
                              <option value="">Selecciona un espacio</option>
                              {espacios.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                      <button className="btn-aprobar" onClick={() => guardarEdicion(s.id)}>Guardar cambios</button>{' '}
                      <button className="btn-rechazar" onClick={() => setEditandoId(null)}>Cancelar</button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {solicitudes.length === 0 && (
            <tr><td colSpan={columnas}>No hay solicitudes todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}