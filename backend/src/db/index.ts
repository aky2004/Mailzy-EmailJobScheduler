import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema';

const isCloud = env.DATABASE_URL.includes('neon.tech') || env.DATABASE_URL.includes('sslmode=require');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});

export const db = drizzle(pool, { schema });

export async function testDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ PostgreSQL connected');
  } finally {
    client.release();
  }
}
