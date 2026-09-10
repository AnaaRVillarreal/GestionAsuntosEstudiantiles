require('dotenv').config();
const { Pool } = require('pg');

// Conexión centralizada a PostgreSQL.
// IF PGSSL=true (necesario para Supabase y otros proveedores en la nube)
// -> se activa SSL. ELSE (PostgreSQL local) -> se conecta sin SSL.
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

module.exports = pool;