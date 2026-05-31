import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool, Client } = pg;

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL is not set");
    _pool = new Pool({ connectionString: url });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

export function hasDb(): boolean {
  return !!process.env["DATABASE_URL"];
}

export async function runMigrations(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (!url) return;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id       SERIAL PRIMARY KEY,
        time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip       TEXT NOT NULL,
        username TEXT NOT NULL,
        action   TEXT NOT NULL,
        detail   TEXT
      );
    `);
  } finally {
    await client.end().catch(() => {});
  }
}

export * from "./schema";
