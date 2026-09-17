import React, { useState } from 'react';
import { guardarSesion } from '../api.js';

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
            <button className={modo === 'login' ? 'activo' : ''} onClick={() => setModo('login')}>Iniciar sesión</button>
            <button className={modo === 'registro' ? 'activo' : ''} onClick={() => setModo('registro')}>Crear cuenta (estudiante)</button>
          </nav>

          {modo === 'login' && (
            <form onSubmit={iniciarSesion}>
              <div className="campo">
                <label>Correo</label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              </div>
              <div className="campo">
                <label>Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
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
              <div className="campo">
                <label>Contraseña</label>
                <input type="password" value={registro.password} onChange={(e) => setRegistro({ ...registro, password: e.target.value })} required />
              </div>
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
              ¿Eres responsable de aprobar solicitudes? Tu cuenta se crea desde el servidor; inicia sesión aquí normalmente.
            </p>
          )}
        </div>
      </div>
    </>
  );
}