import React, { useState } from 'react';
import Login from './components/Login.jsx';
import FormularioSolicitud from './components/FormularioSolicitud.jsx';
import ListaSolicitudes from './components/ListaSolicitudes.jsx';
import Calendario from './components/Calendario.jsx';
import { obtenerSesion, cerrarSesion } from './api.js';

export default function App() {
  const sesionGuardada = obtenerSesion();
  const [usuario, setUsuario] = useState(sesionGuardada?.usuario || null);

  // Pestaña inicial según el rol
  const [tab, setTab] = useState(usuario?.rol === 'responsable' ? 'lista' : 'formulario');

  // IF no hay sesión iniciada -> mostrar login / ELSE mostrar la app
  if (!usuario) {
    return <Login onSesionIniciada={(u) => { setUsuario(u); setTab(u.rol === 'responsable' ? 'lista' : 'formulario'); }} />;
  }

  const salir = () => { cerrarSesion(); setUsuario(null); };

  return (
    <div className="contenedor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Sistema de Solicitudes Estudiantiles</h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13 }}>{usuario.nombre} · <strong>{usuario.rol}</strong></div>
          <button onClick={salir} style={{ fontSize: 12, marginTop: 4 }}>Cerrar sesión</button>
        </div>
      </div>

      <nav className="tabs">
        {/* IF el rol es estudiante -> puede crear y ver sus solicitudes */}
        {usuario.rol === 'estudiante' && (
          <button className={tab === 'formulario' ? 'activo' : ''} onClick={() => setTab('formulario')}>Nueva solicitud</button>
        )}
        {usuario.rol === 'estudiante' && (
          <button className={tab === 'lista' ? 'activo' : ''} onClick={() => setTab('lista')}>Mis solicitudes</button>
        )}
        {/* ELSE (responsable) -> revisa y aprueba/rechaza todas */}
        {usuario.rol === 'responsable' && (
          <button className={tab === 'lista' ? 'activo' : ''} onClick={() => setTab('lista')}>Revisión</button>
        )}
        <button className={tab === 'calendario' ? 'activo' : ''} onClick={() => setTab('calendario')}>Calendario</button>
      </nav>

      {tab === 'formulario' && usuario.rol === 'estudiante' && <FormularioSolicitud />}
      {tab === 'lista' && <ListaSolicitudes rol={usuario.rol} />}
      {tab === 'calendario' && <Calendario />}
    </div>
  );
}
