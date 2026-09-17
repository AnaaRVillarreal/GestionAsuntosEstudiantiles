import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api.js';

const PALETA = ['#0D4593', '#0A2A5E', '#B8860B', '#1170C7', '#5B6B8C'];
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function claveFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Calendario() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mesActual, setMesActual] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });

  useEffect(() => {
    apiFetch('/api/calendario').then(({ data }) => {
      setReservas(data.reservas || []);
      setCargando(false);
    });
  }, []);

  // SENSOR: asigna un color distinto a cada espacio, para diferenciarlos en el calendario
  const espacios = useMemo(() => {
    const nombres = [...new Set(reservas.map((r) => r.espacio))];
    const mapa = {};
    nombres.forEach((n, i) => { mapa[n] = PALETA[i % PALETA.length]; });
    return mapa;
  }, [reservas]);

  const reservasPorDia = useMemo(() => {
    const mapa = {};
    reservas.forEach((r) => {
      const clave = claveFecha(new Date(r.fecha));
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(r);
    });
    return mapa;
  }, [reservas]);

  const celdas = useMemo(() => {
    const primerDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1);
    const inicioGrid = new Date(primerDiaMes);
    inicioGrid.setDate(inicioGrid.getDate() - primerDiaMes.getDay());

    const dias = [];
    for (let i = 0; i < 42; i++) {
      const fecha = new Date(inicioGrid);
      fecha.setDate(inicioGrid.getDate() + i);
      dias.push(fecha);
    }
    return dias;
  }, [mesActual]);

  const hoy = new Date();
  const esHoy = (d) => d.toDateString() === hoy.toDateString();
  const esMesActual = (d) => d.getMonth() === mesActual.getMonth();
  const nombreMes = mesActual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  const cambiarMes = (delta) => setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + delta, 1));

  if (cargando) return <div className="tarjeta">Cargando calendario...</div>;

  return (
    <div className="tarjeta cal-tarjeta">
      <div className="cal-header">
        <div className="cal-month" style={{ textTransform: 'capitalize' }}>{nombreMes}</div>
        <div className="cal-legend">
          {Object.entries(espacios).map(([nombre, color]) => (
            <span key={nombre}><i className="cal-dot" style={{ background: color }}></i>{nombre}</span>
          ))}
          {Object.keys(espacios).length === 0 && <span>Sin reservas aprobadas todavía</span>}
        </div>
        <div className="cal-nav">
          <button onClick={() => cambiarMes(-1)} aria-label="Mes anterior">‹</button>
          <button onClick={() => cambiarMes(1)} aria-label="Mes siguiente">›</button>
        </div>
      </div>

      <div className="cal-grid">
        {DIAS_SEMANA.map((d) => <div className="cal-weekday" key={d}>{d}</div>)}
        {celdas.map((fecha, i) => {
          const reservasDelDia = reservasPorDia[claveFecha(fecha)] || [];
          return (
            <div key={i} className={`cal-day ${!esMesActual(fecha) ? 'faded' : ''} ${esHoy(fecha) ? 'today' : ''}`}>
              <span className="num">{fecha.getDate()}</span>
              {reservasDelDia.map((r, j) => (
                <div
                  key={j}
                  className="cal-chip"
                  style={{ background: espacios[r.espacio] }}
                  title={`${r.espacio} · ${r.hora_inicio}–${r.hora_fin} · Folio ${r.folio || '—'} · ${r.descripcion}`}
                >
                  {r.espacio} {r.hora_inicio?.slice(0, 5)}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="cal-foot">Solo se muestran reservas ya aprobadas. Pasa el cursor sobre una reserva para ver el detalle.</div>
    </div>
  );
}