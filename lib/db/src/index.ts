import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMemory } from "drizzle-orm/better-sqlite3";
import pg from "pg";
import Database from "better-sqlite3";
import * as schema from "./schema";

const { Pool } = pg;

let db;
let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
  console.log("✓ Connected to PostgreSQL database");
} else {
  // Graceful fallback to in-memory SQLite for development/testing
  const memDb = new Database(":memory:");
  db = drizzleMemory(memDb, { schema });

  // Auto-create tables on startup
  Object.values(schema).forEach((table) => {
    if (table._ && table._.isTable) {
      try {
        memDb.exec(table._.sql);
      } catch {
        // Table may already exist
      }
    }
  });

  console.log("⚠ DATABASE_URL not set. Using in-memory SQLite for development.");
  console.log("ℹ To use PostgreSQL, set DATABASE_URL environment variable.");
}

export { db, pool };
export * from "./schema";
