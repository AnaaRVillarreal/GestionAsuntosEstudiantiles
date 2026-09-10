// ============================================================
// Script de administración: crea una cuenta con rol "responsable".
// No existe una ruta HTTP abierta para esto por seguridad: se
// ejecuta directamente en el servidor.
//
// Uso:
//   node scripts/crearResponsable.js "Nombre Apellido" correo@escuela.edu contraseña
// ============================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
  const [, , nombre, correo, password] = process.argv;

  if (!nombre || !correo || !password) {
    console.error('Uso: node scripts/crearResponsable.js "Nombre" correo password');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol)
       VALUES ($1, $2, $3, 'responsable')`,
      [nombre, correo, hash]
    );
    console.log(`Cuenta de responsable creada para: ${correo}`);
  } catch (err) {
    console.error('No se pudo crear la cuenta:', err.message);
  } finally {
    await pool.end();
  }
}

main();
