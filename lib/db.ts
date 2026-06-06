import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

type DrizzleDb = ReturnType<typeof drizzle>;

function createDb(): DrizzleDb {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  const sql = neon(connectionString);
  return drizzle(sql);
}

let _db: DrizzleDb | null = null;

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop: string) {
    if (!_db) _db = createDb();
    return (_db as any)[prop];
  }
});
