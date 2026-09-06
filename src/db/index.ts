import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your Postgres instance.",
  );
}

/**
 * Reuse a single postgres client across hot reloads in development — Next.js
 * re-evaluates modules on every change, which would otherwise open a new pool
 * each time and exhaust the database's connection limit.
 */
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    // Serverless-friendly: keep the pool small and let idle connections go.
    max: process.env.NODE_ENV === "production" ? 5 : 1,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
