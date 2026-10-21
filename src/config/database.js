/**
 * Database connection - auto-detect PostgreSQL or SQLite
 */
const dotenv = require('dotenv');
dotenv.config();

let dbModule;

// Try PostgreSQL first, fall back to SQLite
const useSQLite = process.env.DB_TYPE === 'sqlite' || !process.env.DB_HOST;

if (useSQLite) {
  console.log('[DB] Using SQLite (no PostgreSQL detected)');
  dbModule = require('./database-sqlite');
} else {
  console.log('[DB] Using PostgreSQL');
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hospital_accreditation',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
  });

  dbModule = {
    pool,
    query: async (text, params) => {
      const start = Date.now();
      try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 500) console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
        return res;
      } catch (err) {
        console.error('[DB] Query error:', err.message);
        throw err;
      }
    },
    getClient: async () => pool.connect(),
  };
}

module.exports = dbModule;
