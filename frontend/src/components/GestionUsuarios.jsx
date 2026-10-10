import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import CampoPassword from './CampoPassword.jsx';

const ROLES = [
  { value: 'logistica', label: 'Logística' },
  { value: 'jefatura', label: 'Jefatura' },
  { value: 'direccion', label: 'Dirección' }
];
const etiquetaRol = (rol) => ROLES.find((r) => r.value === rol)?.label || 'Administrador';
const INICIAL = { nombre: '', correo: '', password: '', rol: 'logistica' };

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [sinUsuario, setSinUsuario] = useState([]);
  const [form, setForm] = useState(INICIAL);
  const [errores, setErrores] = useState([]);
  const [exito, setExito] = useState(null);

  const cargar = async () => {
    const { data } = await apiFetch('/api/usuarios');
    if (data.ok) {
      setUsuarios(data.usuarios);
      setSinUsuario(data.niveles_sin_usuario);
    }
  };

  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    setErrores([]);
    setExito(null);
    const { status, data } = await apiFetch('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify(form)
    });
    if (status >= 400) return setErrores(data.errores || ['No se pudo crear el usuario.']);
    setExito(`Usuario creado: ${data.usuario.nombre} (${etiquetaRol(data.usuario.rol)}).`);
    setForm(INICIAL);
    cargar();
  };

  const modificar = async (id, cambios) => {
    const { data } = await apiFetch(`/api/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cambios)
    });
    if (!data.ok) window.alert(data.errores?.[0] || 'No se pudo guardar el cambio.');
    cargar();
  };

  const cambiarPassword = (u) => {
    const nueva = window.prompt(`Nueva contraseña para ${u.nombre} (mínimo 6 caracteres):`);
    if (!nueva) return;
    modificar(u.id, { password: nueva });
  };

  return (
    <>
      {sinUsuario.length > 0 && (
        <div className="aviso" style={{ borderRadius: 10, marginBottom: 16 }}>
          Atención: no hay usuarios activos en {sinUsuario.map(etiquetaRol).join(', ')}.
          Las solicitudes que lleguen a ese nivel quedarán detenidas hasta que crees o actives a alguien.
        </div>
      )}

      <div className="tarjeta" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 14 }}>Crear usuario</h3>
        <form onSubmit={crear}>
          <div className="campo">
            <label>Nombre</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="campo">
            <label>Correo (aquí recibirá los avisos de solicitudes por revisar)</label>
            <input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} required />
          </div>
          <CampoPassword
            etiqueta="Contraseña inicial"
            value={form.password}
            onChange={(valor) => setForm({ ...form, password: valor })}
          />
          <div className="campo">
            <label>Rol</label>
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button className="btn-principal" type="submit">Crear usuario</button>
          {errores.length > 0 && <div className="error">{errores.map((e, i) => <div key={i}>• {e}</div>)}</div>}
          {exito && <p style={{ color: '#27500A' }}>{exito}</p>}
        </form>
      </div>

      <div className="tarjeta">
        <h3 style={{ marginBottom: 14 }}>Personal con acceso</h3>
        <table>
          <thead>
            <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const esAdmin = u.rol === 'responsable';
              return (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.correo}</td>
                  <td>
                    {esAdmin ? 'Administrador' : (
                      <select value={u.rol} onChange={(e) => modificar(u.id, { rol: e.target.value })}>
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    <span className={`estado ${u.activo ? 'aprobado' : 'rechazado'}`}>
                      {u.activo ? 'activo' : 'desactivado'}
                    </span>
                  </td>
                  <td>
                    {esAdmin ? '—' : (
                      <>
                        <button className="btn-rechazar" onClick={() => modificar(u.id, { activo: !u.activo })}>
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>{' '}
                        <button className="btn-rechazar" onClick={() => cambiarPassword(u)}>Cambiar contraseña</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}