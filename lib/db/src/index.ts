import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let db;
let pool;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
  console.log("✓ Connected to PostgreSQL database");
} else {
  // Graceful fallback to in-memory SQLite for development/testing.
  // Loaded dynamically so that DATABASE_URL-configured environments (e.g.
  // production, where better-sqlite3's native addon isn't shipped) never
  // need to resolve this module.
  const { drizzle: drizzleMemory } = await import("drizzle-orm/better-sqlite3");
  const { default: Database } = await import("better-sqlite3");
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
