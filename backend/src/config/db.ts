import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '15432', 10),
        database: process.env.DB_NAME || 'apartment_db',
        user: process.env.DB_USER || 'apartment_admin',
        password: process.env.DB_PASSWORD || 'apartment_secure_password_2026',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.error('[Database Pool Error]:', err.message);
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
