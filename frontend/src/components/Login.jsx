import React, { useState } from 'react';
import { guardarSesion } from '../api.js';
import CampoPassword from './CampoPassword.jsx';

const INICIAL_REGISTRO = { nombre: '', matricula: '', correo: '', telefono: '', password: '' };

export default function Login({ onSesionIniciada }) {
  const [modo, setModo] = useState('login');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [registro, setRegistro] = useState(INICIAL_REGISTRO);
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(false);

  const iniciarSesion = async (e) => {
    e.preventDefault();
    setErrores([]);
    setCargando(true);
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });
    const data = await resp.json();
    setCargando(false);
    if (!data.ok) return setErrores(data.errores || ['No se pudo iniciar sesión.']);
    guardarSesion({ token: data.token, usuario: data.usuario });
    onSesionIniciada(data.usuario);
  };

  const registrarEstudiante = async (e) => {
    e.preventDefault();
    setErrores([]);
    setCargando(true);
    const resp = await fetch('/api/auth/registro-estudiante', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registro)
    });
    const data = await resp.json();
    setCargando(false);
    if (!data.ok) return setErrores(data.errores || ['No se pudo crear la cuenta.']);
    guardarSesion({ token: data.token, usuario: data.usuario });
    onSesionIniciada(data.usuario);
  };

  const cambiarModo = (nuevo) => { setModo(nuevo); setErrores([]); };

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div>
            <h1>Sistema de solicitudes</h1>
            <p>Trámites y reservas de espacios, en un solo lugar.</p>
          </div>
        </div>
      </div>

      <div className="contenedor angosto">
        <div className="tarjeta">
          <nav className="tabs">
            <button className={modo === 'login' ? 'activo' : ''} onClick={() => cambiarModo('login')}>Iniciar sesión</button>
            <button className={modo === 'registro' ? 'activo' : ''} onClick={() => cambiarModo('registro')}>Crear cuenta (estudiante)</button>
          </nav>

          {modo === 'login' && (
            <form onSubmit={iniciarSesion}>
              <div className="campo">
                <label>Correo</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              </div>
              <CampoPassword
                value={password}
                onChange={setPassword}
                mostrarFuerza={false}
                autoComplete="current-password"
              />
              <button className="btn-principal" disabled={cargando} type="submit">
                {cargando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {modo === 'registro' && (
            <form onSubmit={registrarEstudiante}>
              <div className="campo">
                <label>Nombre</label>
                <input value={registro.nombre} onChange={(e) => setRegistro({ ...registro, nombre: e.target.value })} required />
              </div>
              <div className="campo">
                <label>Matrícula</label>
                <input value={registro.matricula} onChange={(e) => setRegistro({ ...registro, matricula: e.target.value })} required />
              </div>
              <div className="campo">
                <label>Correo</label>
                <input type="email" value={registro.correo} onChange={(e) => setRegistro({ ...registro, correo: e.target.value })} required />
              </div>
              <div className="campo">
                <label>Teléfono</label>
                <input value={registro.telefono} onChange={(e) => setRegistro({ ...registro, telefono: e.target.value })} />
              </div>
              <CampoPassword
                value={registro.password}
                onChange={(valor) => setRegistro({ ...registro, password: valor })}
              />
              <button className="btn-principal" disabled={cargando} type="submit">
                {cargando ? 'Creando...' : 'Crear cuenta'}
              </button>
            </form>
          )}

          {errores.length > 0 && (
            <div className="error">{errores.map((err, i) => <div key={i}>• {err}</div>)}</div>
          )}

          {modo === 'login' && (
            <p style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 12, textAlign: 'center' }}>
              ¿Eres personal de Logística, Jefatura, Dirección o administrador? Tu cuenta la crea el administrador; inicia sesión aquí normalmente.
            </p>
          )}
        </div>
      </div>
    </>
  );
}