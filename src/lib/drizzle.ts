// src/server/db/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../../drizzle";

// Wire WS for Node (Neon serverless uses WebSockets under the hood)
neonConfig.webSocketConstructor = ws;

// Guard: env must exist
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Prevent duplicate pools in dev (HMR / tsx watch)
const globalForDb = globalThis as unknown as {
  __NEON_POOL__?: Pool;
  __DRIZZLE_DB__?: ReturnType<typeof drizzle>;
};

const pool =
  globalForDb.__NEON_POOL__ ??
  new Pool({
    connectionString: DATABASE_URL,
    // Optional: Neon is TLS by default; if you ever pass a naked PG URL locally,
    // uncomment the next line to enforce SSL in non-local envs.
    // ssl: { rejectUnauthorized: true },
    // Optional: keep things sane under load
    max: 10,             // pool size
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

const db =
  globalForDb.__DRIZZLE_DB__ ??
  drizzle(pool, { schema });

// Cache in dev to avoid pool churn on reloads
if (process.env.NODE_ENV !== "production") {
  globalForDb.__NEON_POOL__ = pool;
  globalForDb.__DRIZZLE_DB__ = db;
}

// Graceful shutdown (don’t leave sockets hanging)
// let shuttingDown = false;
// async function shutdown() {
//   if (shuttingDown) return;
//   shuttingDown = true;
//   try {
//     await pool.end();
//   } catch {
//     // swallow; nothing heroic to do here
//   }
// }
// process.on("SIGINT", shutdown);
// process.on("SIGTERM", shutdown);

export { db, pool, schema };