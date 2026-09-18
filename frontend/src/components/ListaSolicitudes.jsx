import React, { useEffect, useState } from 'react';
import { apiFetch, obtenerSesion } from '../api.js';

const ETIQUETAS_DETALLE = {
  destino: 'Destino', num_pasajeros: 'Pasajeros',
  nombre_evento: 'Nombre del evento', asistentes_esperados: 'Asistentes esperados',
  tipo_constancia: 'Tipo de constancia', institucion_destino: 'Institución destino',
  dirigido_a: 'Dirigido a'
};

export default function ListaSolicitudes({ rol }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [expandidaId, setExpandidaId] = useState(null);
  const esResponsable = rol === 'responsable';

  const cargar = async () => {
    setCargando(true);
    const { data } = await apiFetch('/api/solicitudes');
    setSolicitudes(data.solicitudes || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const aprobar = async (id) => {
    const password = window.prompt('Confirma tu contraseña para aprobar esta solicitud:');
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
    await apiFetch(`/api/solicitudes/${id}/rechazar`, {
      method: 'PUT',
      body: JSON.stringify({ motivo })
    });
    cargar();
  };

  const descargarOficio = async (id, folio) => {
    const sesion = obtenerSesion();
    const resp = await fetch(`/api/solicitudes/${id}/oficio`, {
      headers: { Authorization: `Bearer ${sesion?.token}` }
    });
    if (!resp.ok) return window.alert('No se pudo descargar el oficio.');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${folio || id}.pdf`;
    enlace.click();
    URL.revokeObjectURL(url);
  };

  const alternarDetalle = (id) => setExpandidaId(expandidaId === id ? null : id);

  if (cargando) return <p>Cargando solicitudes...</p>;

  return (
    <div className="tarjeta">
      <table>
        <thead>
          <tr>
            <th>#</th>
            {esResponsable && <th>Estudiante</th>}
            <th>Tipo</th><th>Estado</th><th>Folio</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((s) => (
            <React.Fragment key={s.id}>
              <tr>
                <td>{s.id}</td>
                {esResponsable && <td>{s.nombre} ({s.matricula})</td>}
                <td>{s.tipo}</td>
                <td><span className={`estado ${s.estado}`}>{s.estado}</span></td>
                <td>{s.folio || '-'}</td>
                <td>
                  <button className="btn-rechazar" onClick={() => alternarDetalle(s.id)}>
                    {expandidaId === s.id ? 'Ocultar' : 'Ver detalles'}
                  </button>{' '}
                  {esResponsable && s.estado === 'en_revision' && (
                    <>
                      <button className="btn-aprobar" onClick={() => aprobar(s.id)}>Aprobar</button>
                      <button className="btn-rechazar" onClick={() => rechazar(s.id)}>Rechazar</button>
                    </>
                  )}
                  {s.estado === 'aprobado' && (
                    <button className="btn-rechazar" onClick={() => descargarOficio(s.id, s.folio)}>Descargar oficio</button>
                  )}
                </td>
              </tr>

              {/* IF esta fila está expandida -> muestra el detalle completo antes de decidir */}
              {expandidaId === s.id && (
                <tr>
                  <td colSpan={esResponsable ? 6 : 5} style={{ background: 'rgba(17,112,199,0.04)' }}>
                    <div style={{ padding: '10px 4px', fontSize: 13.5 }}>
                      <p style={{ margin: '4px 0' }}><b>Descripción:</b> {s.descripcion}</p>
                      {s.fecha_evento && (
                        <p style={{ margin: '4px 0' }}>
                          <b>Fecha:</b> {s.fecha_evento} &nbsp; <b>Hora:</b> {s.hora_inicio}–{s.hora_fin}
                        </p>
                      )}
                      {s.espacio_nombre && (
                        <p style={{ margin: '4px 0' }}><b>Espacio:</b> {s.espacio_nombre}</p>
                      )}
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
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {solicitudes.length === 0 && (
            <tr><td colSpan={esResponsable ? 6 : 5}>No hay solicitudes todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}