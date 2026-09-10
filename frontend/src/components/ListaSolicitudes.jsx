import React, { useEffect, useState } from 'react';
import { apiFetch, obtenerSesion } from '../api.js';

export default function ListaSolicitudes({ rol }) {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const esResponsable = rol === 'responsable';

  const cargar = async () => {
    setCargando(true);
    const { data } = await apiFetch('/api/solicitudes');
    setSolicitudes(data.solicitudes || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const aprobar = async (id) => {
    await apiFetch(`/api/solicitudes/${id}/aprobar`, { method: 'PUT' });
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

  // La descarga requiere el token de sesión, así que no puede ser un <a href> plano.
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

  if (cargando) return <p>Cargando solicitudes...</p>;

  return (
    <div className="tarjeta">
      <h2>{esResponsable ? 'Solicitudes' : 'Mis solicitudes'}</h2>
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
            <tr key={s.id}>
              <td>{s.id}</td>
              {esResponsable && <td>{s.nombre} ({s.matricula})</td>}
              <td>{s.tipo}</td>
              <td><span className={`estado ${s.estado}`}>{s.estado}</span></td>
              <td>{s.folio || '-'}</td>
              <td>
                {esResponsable && s.estado === 'en_revision' && (
                  <>
                    <button className="btn-aprobar" onClick={() => aprobar(s.id)}>Aprobar</button>
                    <button className="btn-rechazar" onClick={() => rechazar(s.id)}>Rechazar</button>
                  </>
                )}
                {s.estado === 'aprobado' && (
                  <button onClick={() => descargarOficio(s.id, s.folio)}>Descargar oficio</button>
                )}
              </td>
            </tr>
          ))}
          {solicitudes.length === 0 && (
            <tr><td colSpan={esResponsable ? 6 : 5}>No hay solicitudes todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
