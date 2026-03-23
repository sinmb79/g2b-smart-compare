/**
 * PostgreSQL client singleton using pg-promise
 * Reuses connection pool across Next.js hot-reloads in development
 */

import pgPromise from "pg-promise";

const pgp = pgPromise({
  // Connection event hooks for monitoring
  connect() {
    if (process.env.NODE_ENV === "development") {
      console.debug("[DB] Connected");
    }
  },
  disconnect() {
    if (process.env.NODE_ENV === "development") {
      console.debug("[DB] Disconnected");
    }
  },
  error(err, e) {
    console.error("[DB] Error:", err, "Context:", e.cn);
  },
});

const connectionConfig = {
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "g2b_smart_compare",
  user: process.env.POSTGRES_USER ?? "g2b",
  password: process.env.POSTGRES_PASSWORD ?? "g2bpassword",
  max: 20, // max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Prevent multiple instances during Next.js hot reload
declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof pgp> | undefined;
}

const db = global.__db ?? pgp(connectionConfig);

if (process.env.NODE_ENV !== "production") {
  global.__db = db;
}

export { db, pgp };
export default db;
