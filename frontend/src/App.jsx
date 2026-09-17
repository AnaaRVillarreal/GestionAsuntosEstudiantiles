import React, { useState } from 'react';
import Login from './components/Login.jsx';
import FormularioSolicitud from './components/FormularioSolicitud.jsx';
import ListaSolicitudes from './components/ListaSolicitudes.jsx';
import Calendario from './components/Calendario.jsx';
import { obtenerSesion, cerrarSesion } from './api.js';

const TITULOS = {
  formulario: { titulo: 'Nueva solicitud', sub: 'Completa los datos de tu trámite.' },
  lista_estudiante: { titulo: 'Mis solicitudes', sub: 'Consulta el estado de tus trámites.' },
  lista_responsable: { titulo: 'Revisión', sub: 'Solicitudes enviadas por los estudiantes.' },
  calendario: { titulo: 'Calendario de reservas', sub: 'Espacios y auditorios ya confirmados.' }
};

export default function App() {
  const sesionGuardada = obtenerSesion();
  const [usuario, setUsuario] = useState(sesionGuardada?.usuario || null);
  const [tab, setTab] = useState(usuario?.rol === 'responsable' ? 'lista' : 'formulario');

  if (!usuario) {
    return <Login onSesionIniciada={(u) => { setUsuario(u); setTab(u.rol === 'responsable' ? 'lista' : 'formulario'); }} />;
  }

  const salir = () => { cerrarSesion(); setUsuario(null); };

  const claveTitulo = tab === 'lista'
    ? (usuario.rol === 'responsable' ? 'lista_responsable' : 'lista_estudiante')
    : tab;
  const { titulo, sub } = TITULOS[claveTitulo] || TITULOS.calendario;

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div>
            <h1>{titulo}</h1>
            <p>{sub}</p>
          </div>
          <span className="session-tag">
            {usuario.nombre} · <b>{usuario.rol}</b>
            <button onClick={salir}>Cerrar sesión</button>
          </span>
        </div>
      </div>

      <div className="contenedor">
        <nav className="tabs">
          {usuario.rol === 'estudiante' && (
            <button className={tab === 'formulario' ? 'activo' : ''} onClick={() => setTab('formulario')}>Nueva solicitud</button>
          )}
          {usuario.rol === 'estudiante' && (
            <button className={tab === 'lista' ? 'activo' : ''} onClick={() => setTab('lista')}>Mis solicitudes</button>
          )}
          {usuario.rol === 'responsable' && (
            <button className={tab === 'lista' ? 'activo' : ''} onClick={() => setTab('lista')}>Revisión</button>
          )}
          <button className={tab === 'calendario' ? 'activo' : ''} onClick={() => setTab('calendario')}>Calendario</button>
        </nav>

        {tab === 'formulario' && usuario.rol === 'estudiante' && <FormularioSolicitud />}
        {tab === 'lista' && <ListaSolicitudes rol={usuario.rol} />}
        {tab === 'calendario' && <Calendario />}
      </div>
    </>
  );
}