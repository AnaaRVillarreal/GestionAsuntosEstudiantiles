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
  fecha_evento: '', hora_inicio: '', hora_fin: '', espacio_id: '',
  detalles: {}
};

export default function FormularioSolicitud() {
  const [datos, setDatos] = useState(INICIAL);
  const [errores, setErrores] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(null);

  const cambiar = (campo) => (e) => setDatos({ ...datos, [campo]: e.target.value });
  const cambiarDetalle = (campo) => (e) =>
    setDatos({ ...datos, detalles: { ...datos.detalles, [campo]: e.target.value } });

  const cambiarTipo = (e) => setDatos({ ...INICIAL, tipo: e.target.value });

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

  return (
    <div className="tarjeta">
      <h2>Nueva solicitud</h2>
      <form onSubmit={enviar}>
        <div className="campo">
          <label>Tipo de trámite</label>
          <select value={datos.tipo} onChange={cambiarTipo}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="campo">
          <label>Descripción</label>
          <textarea rows={3} value={datos.descripcion} onChange={cambiar('descripcion')} required />
        </div>

        {/* IF reserva de espacio -> pide fecha, hora y espacio */}
        {datos.tipo === 'reserva_espacio' && (
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

        {/* ELSE IF transporte -> pide destino y número de pasajeros */}
        {datos.tipo === 'transporte' && (
          <>
            <div className="campo">
              <label>Destino</label>
              <input value={datos.detalles.destino || ''} onChange={cambiarDetalle('destino')} />
            </div>
            <div className="campo">
              <label>Número de pasajeros</label>
              <input type="number" value={datos.detalles.num_pasajeros || ''} onChange={cambiarDetalle('num_pasajeros')} />
            </div>
          </>
        )}

        {/* ELSE IF evento -> pide nombre del evento y asistentes esperados */}
        {datos.tipo === 'evento' && (
          <>
            <div className="campo">
              <label>Nombre del evento</label>
              <input value={datos.detalles.nombre_evento || ''} onChange={cambiarDetalle('nombre_evento')} />
            </div>
            <div className="campo">
              <label>Asistentes esperados</label>
              <input type="number" value={datos.detalles.asistentes_esperados || ''} onChange={cambiarDetalle('asistentes_esperados')} />
            </div>
          </>
        )}

        {/* ELSE IF constancia -> pide tipo de constancia e institución destino */}
        {datos.tipo === 'constancia' && (
          <>
            <div className="campo">
              <label>Tipo de constancia</label>
              <input value={datos.detalles.tipo_constancia || ''} onChange={cambiarDetalle('tipo_constancia')} placeholder="Ej. de estudios, de buena conducta" />
            </div>
            <div className="campo">
              <label>¿Para qué institución es?</label>
              <input value={datos.detalles.institucion_destino || ''} onChange={cambiarDetalle('institucion_destino')} />
            </div>
          </>
        )}

        {/* ELSE (oficio_presentacion) -> pide a quién va dirigido y la institución */}
        {datos.tipo === 'oficio_presentacion' && (
          <>
            <div className="campo">
              <label>Dirigido a</label>
              <input value={datos.detalles.dirigido_a || ''} onChange={cambiarDetalle('dirigido_a')} />
            </div>
            <div className="campo">
              <label>Institución o empresa destino</label>
              <input value={datos.detalles.institucion_destino || ''} onChange={cambiarDetalle('institucion_destino')} />
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