import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDrizzle = globalThis as unknown as {
  pool: Pool | undefined;
};

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

const pool = globalForDrizzle.pool ?? createPool();
globalForDrizzle.pool = pool;

export const db = drizzle(pool, { schema });
