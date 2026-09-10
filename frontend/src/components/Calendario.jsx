import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

export default function Calendario() {
  const [reservas, setReservas] = useState([]);

  useEffect(() => {
    apiFetch('/api/calendario').then(({ data }) => setReservas(data.reservas || []));
  }, []);

  return (
    <div className="tarjeta">
      <h2>Calendario de reservas aprobadas</h2>
      <table>
        <thead>
          <tr><th>Fecha</th><th>Hora</th><th>Espacio</th><th>Folio</th><th>Descripción</th></tr>
        </thead>
        <tbody>
          {reservas.map((r, i) => (
            <tr key={i}>
              <td>{r.fecha}</td>
              <td>{r.hora_inicio} - {r.hora_fin}</td>
              <td>{r.espacio}</td>
              <td>{r.folio}</td>
              <td>{r.descripcion}</td>
            </tr>
          ))}
          {reservas.length === 0 && (
            <tr><td colSpan={5}>No hay reservas aprobadas todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
