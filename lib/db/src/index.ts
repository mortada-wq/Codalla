import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required. Codalla's schema is Postgres-specific (jsonb, " +
    "Postgres timestamp semantics) — there is no working SQLite fallback. " +
    "Start a Postgres instance and set DATABASE_URL, e.g. " +
    "postgres://postgres:postgres@localhost:5432/codalla, then run " +
    "`pnpm --filter @workspace/db run push`.",
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// node-postgres emits 'error' on the pool when an *idle* client's connection
// drops (network blip, Postgres restart) — with no listener, that's an
// unhandled 'error' event, which crashes the entire Node process. A logged
// warning here is enough: the pool recovers the connection on the next
// query itself.
pool.on("error", (err) => {
  console.error("Postgres pool error (connection to an idle client was lost):", err.message);
});
const db = drizzle(pool, { schema });
console.log("✓ Connected to PostgreSQL database");

export { db, pool };
export * from "./schema";
