import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api.js';

export default function Notificaciones({ onIrALista }) {
  const [lista, setLista] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [porAprobar, setPorAprobar] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [toasts, setToasts] = useState([]);
  const conocidas = useRef(null); // ids ya vistos; null = todavía no se hace la primera carga

  const mostrarToast = (texto) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texto }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  };

  const cargar = async () => {
    try {
      const { data } = await apiFetch('/api/notificaciones');
      if (!data.ok) return;

      setLista(data.notificaciones);
      setNoLeidas(data.no_leidas);
      setPorAprobar(data.por_aprobar);

      const ids = new Set(data.notificaciones.map((n) => n.id));

      if (conocidas.current === null) {
        // Primera carga: solo un resumen, sin repetir cada notificación vieja
        if (data.por_aprobar > 0) {
          mostrarToast(`Hay ${data.por_aprobar} solicitud(es) por aprobar.`);
        } else if (data.no_leidas > 0) {
          mostrarToast(`Tienes ${data.no_leidas} notificación(es) sin leer.`);
        }
      } else {
        // Cargas siguientes: un aviso emergente por cada notificación nueva
        data.notificaciones
          .filter((n) => !conocidas.current.has(n.id) && !n.leida)
          .forEach((n) => mostrarToast(n.mensaje));
      }
      conocidas.current = ids;
    } catch (err) {
      // Si el servidor no responde, se reintenta en el siguiente ciclo
    }
  };

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 10000); // consulta cada 10 segundos
    return () => clearInterval(intervalo);
  }, []);

  const abrirNotificacion = async (n) => {
    if (!n.leida) await apiFetch(`/api/notificaciones/${n.id}/leer`, { method: 'PUT' });
    setAbierto(false);
    onIrALista();
    cargar();
  };

  const marcarTodas = async () => {
    await apiFetch('/api/notificaciones/leer-todas', { method: 'PUT' });
    cargar();
  };

  return (
    <>
      <span className="bell-wrap">
        <button className="bell-btn" onClick={() => setAbierto(!abierto)} aria-label="Notificaciones">
          🔔
          {noLeidas > 0 && <span className="bell-badge">{noLeidas}</span>}
        </button>

        {abierto && (
          <div className="notif-panel">
            {porAprobar > 0 && (
              <div className="aviso">Tienes {porAprobar} solicitud(es) por aprobar.</div>
            )}
            <div className="notif-head">
              <b>Notificaciones</b>
              <button onClick={marcarTodas}>Marcar todas como leídas</button>
            </div>
            {lista.length === 0 && <p className="notif-vacia">Sin notificaciones.</p>}
            {lista.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${n.leida ? '' : 'nueva'}`}
                onClick={() => abrirNotificacion(n)}
              >
                <div>{n.mensaje}</div>
                <small>{new Date(n.creado_en).toLocaleString('es-MX')}</small>
              </div>
            ))}
          </div>
        )}
      </span>

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className="toast">{t.texto}</div>
        ))}
      </div>
    </>
  );
}