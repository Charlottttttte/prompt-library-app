import type { Config } from "drizzle-kit";
import "./scripts/load-env";

/**
 * Migrations must run over a DIRECT connection. Neon's pooled endpoint (and
 * PgBouncer generally) runs in transaction pooling mode, which doesn't support
 * the session-level statements migration tools rely on.
 *
 * `DATABASE_URL_UNPOOLED` is the name Neon's Vercel integration already uses
 * for the direct string, so this picks it up with no extra configuration.
 * Falls back to DATABASE_URL for plain, unpooled Postgres.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Set DATABASE_URL (or DATABASE_URL_UNPOOLED for a pooled provider like Neon).",
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
