/**
 * Load .env.local / .env for the command-line tooling.
 *
 * `next dev` does this for the app, but drizzle-kit and the scripts here are
 * plain Node processes that would otherwise see none of it — so putting
 * DATABASE_URL in .env.local and running `npm run db:migrate` would fail with
 * "not set". Uses Next's own loader so precedence matches the running app
 * exactly, including that a variable already in the environment wins.
 *
 * Import this for its side effect, before anything reads process.env.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
