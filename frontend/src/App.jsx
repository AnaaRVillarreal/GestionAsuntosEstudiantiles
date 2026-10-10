import React, { useState } from 'react';
import Login from './components/Login.jsx';
import FormularioSolicitud from './components/FormularioSolicitud.jsx';
import ListaSolicitudes from './components/ListaSolicitudes.jsx';
import Calendario from './components/Calendario.jsx';
import GestionUsuarios from './components/GestionUsuarios.jsx';
import Notificaciones from './components/Notificaciones.jsx';
import { obtenerSesion, cerrarSesion } from './api.js';

const ETIQUETA_ROL = {
  estudiante: 'estudiante',
  responsable: 'administrador',
  logistica: 'Logística',
  jefatura: 'Jefatura',
  direccion: 'Dirección'
};

const tabInicial = (rol) => (rol === 'estudiante' ? 'formulario' : 'lista');

function titulos(tab, rol) {
  if (tab === 'formulario') return ['Nueva solicitud', 'Completa los datos de tu trámite.'];
  if (tab === 'calendario') return ['Calendario de reservas', 'Espacios y auditorios ya confirmados.'];
  if (tab === 'usuarios') return ['Usuarios', 'Administra el acceso de Logística, Jefatura y Dirección.'];
  if (rol === 'estudiante') return ['Mis solicitudes', 'Consulta el estado de tus trámites.'];
  if (rol === 'responsable') return ['Solicitudes', 'Seguimiento de todas las solicitudes.'];
  return ['Revisión', 'Solicitudes pendientes de tu aprobación y su seguimiento.'];
}

export default function App() {
  const sesionGuardada = obtenerSesion();
  const [usuario, setUsuario] = useState(sesionGuardada?.usuario || null);
  const [tab, setTab] = useState(usuario ? tabInicial(usuario.rol) : 'formulario');

  if (!usuario) {
    return (
      <Login
        onSesionIniciada={(u) => { setUsuario(u); setTab(tabInicial(u.rol)); }}
      />
    );
  }

  const salir = () => { cerrarSesion(); setUsuario(null); };
  const [titulo, sub] = titulos(tab, usuario.rol);
  const etiquetaLista =
    usuario.rol === 'estudiante' ? 'Mis solicitudes' :
    usuario.rol === 'responsable' ? 'Solicitudes' : 'Revisión';

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div>
            <h1>{titulo}</h1>
            <p>{sub}</p>
          </div>
          <span className="session-tag">
            <Notificaciones onIrALista={() => setTab('lista')} />
            {usuario.nombre} · <b>{ETIQUETA_ROL[usuario.rol] || usuario.rol}</b>
            <button onClick={salir}>Cerrar sesión</button>
          </span>
        </div>
      </div>

      <div className="contenedor">
        <nav className="tabs">
          {usuario.rol === 'estudiante' && (
            <button className={tab === 'formulario' ? 'activo' : ''} onClick={() => setTab('formulario')}>Nueva solicitud</button>
          )}
          <button className={tab === 'lista' ? 'activo' : ''} onClick={() => setTab('lista')}>{etiquetaLista}</button>
          {usuario.rol === 'responsable' && (
            <button className={tab === 'usuarios' ? 'activo' : ''} onClick={() => setTab('usuarios')}>Usuarios</button>
          )}
          <button className={tab === 'calendario' ? 'activo' : ''} onClick={() => setTab('calendario')}>Calendario</button>
        </nav>

        {tab === 'formulario' && usuario.rol === 'estudiante' && <FormularioSolicitud />}
        {tab === 'lista' && <ListaSolicitudes rol={usuario.rol} />}
        {tab === 'usuarios' && usuario.rol === 'responsable' && <GestionUsuarios />}
        {tab === 'calendario' && <Calendario />}
      </div>
    </>
  );
}