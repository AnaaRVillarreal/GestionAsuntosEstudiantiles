import React, { useState } from 'react';
import { apiFetch } from '../api.js';

const TIPOS = [
  { value: 'reserva_espacio', label: 'Reserva de espacio' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'evento', label: 'Evento' },
  { value: 'constancia', label: 'Constancia' },
  { value: 'oficio_presentacion', label: 'Oficio de presentación' }
];

const INICIAL = {
  tipo: 'reserva_espacio', descripcion: '',
  fecha_evento: '', hora_inicio: '', hora_fin: '', espacio_id: ''
};

export default function FormularioSolicitud() {
  const [datos, setDatos] = useState(INICIAL);
  const [errores, setErrores] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(null);

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setErrores([]);
    setExito(null);
    setEnviando(true);

    const { status, data } = await apiFetch('/api/solicitudes', {
      method: 'POST',
      body: JSON.stringify(datos)
    });

    setEnviando(false);
    if (status >= 400) {
      setErrores(data.errores || ['Ocurrió un error.']);
    } else {
      setExito(`Solicitud #${data.solicitud.id} creada correctamente.`);
      setDatos(INICIAL);
    }
  };

  const esReserva = datos.tipo === 'reserva_espacio';

  return (
    <div className="tarjeta">
      <h2>Nueva solicitud</h2>
      <form onSubmit={enviar}>
        <div className="campo">
          <label>Tipo de trámite</label>
          <select value={datos.tipo} onChange={cambiar('tipo')}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="campo">
          <label>Descripción</label>
          <textarea rows={3} value={datos.descripcion} onChange={cambiar('descripcion')} required />
        </div>

        {esReserva && (
          <>
            <div className="campo">
              <label>Fecha</label>
              <input type="date" value={datos.fecha_evento} onChange={cambiar('fecha_evento')} />
            </div>
            <div className="campo">
              <label>Hora inicio</label>
              <input type="time" value={datos.hora_inicio} onChange={cambiar('hora_inicio')} />
            </div>
            <div className="campo">
              <label>Hora fin</label>
              <input type="time" value={datos.hora_fin} onChange={cambiar('hora_fin')} />
            </div>
            <div className="campo">
              <label>ID del espacio/auditorio</label>
              <input type="number" value={datos.espacio_id} onChange={cambiar('espacio_id')} />
            </div>
          </>
        )}

        <button className="btn-principal" disabled={enviando} type="submit">
          {enviando ? 'Enviando...' : 'Enviar solicitud'}
        </button>

        {errores.length > 0 && (
          <div className="error">
            {errores.map((err, i) => <div key={i}>• {err}</div>)}
          </div>
        )}
        {exito && <p style={{ color: '#27500A' }}>{exito}</p>}
      </form>
    </div>
  );
}
