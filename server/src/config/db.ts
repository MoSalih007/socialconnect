import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
      connectionString: process.env.DATABASE_URL,
      // NOTE: rejectUnauthorized: false is required for free-tier hosting (Render, Railway, Supabase)
      // as they use self-signed SSL certificates. For paid hosting with proper certs, set to true.
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      // Production needs more connections than dev (handles real traffic)
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      // Kill queries running > 5 seconds to prevent connection starvation
      statement_timeout: 5000,
      query_timeout: 5000,
    }
    : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
      query_timeout: 10000,
    }
);
let dbConnected = false;
pool.on('connect', () => {
  if (!dbConnected) {
    console.log('✅ Connected to PostgreSQL');
    dbConnected = true;
  }
});
pool.on('error', (err) => { console.error('❌ DB pool error (non-fatal):', err.message); });
export default pool;
