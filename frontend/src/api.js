// Helper centralizado para llamadas a la API con el token de sesión

export function obtenerSesion() {
  const guardado = localStorage.getItem('sesion');
  return guardado ? JSON.parse(guardado) : null;
}

export function guardarSesion(sesion) {
  localStorage.setItem('sesion', JSON.stringify(sesion));
}

export function cerrarSesion() {
  localStorage.removeItem('sesion');
}

export async function apiFetch(url, opciones = {}) {
  const sesion = obtenerSesion();
  const headers = { ...(opciones.headers || {}) };
  if (sesion?.token) headers['Authorization'] = `Bearer ${sesion.token}`;
  if (opciones.body) headers['Content-Type'] = 'application/json';

  const resp = await fetch(url, { ...opciones, headers });
  const data = await resp.json().catch(() => ({}));

  // IF el token venció o es inválido -> cierra sesión localmente
  if (resp.status === 401) {
    cerrarSesion();
    window.location.reload();
  }
  return { status: resp.status, data };
}
