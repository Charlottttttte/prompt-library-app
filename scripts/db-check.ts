/**
 * Check the database configuration before you rely on it.
 *   npm run db:check
 *
 * Answers the questions that actually go wrong when pointing this app at a
 * hosted Postgres: is each URL reachable, did you paste the pooled and direct
 * strings into the right variables, and have the migrations run?
 */
import "./load-env";
import postgres from "postgres";

const RESET = "\x1b[0m";
const paint = (code: string, s: string) => `${code}${s}${RESET}`;
const ok = (s: string) => paint("\x1b[32m", s);
const bad = (s: string) => paint("\x1b[31m", s);
const warn = (s: string) => paint("\x1b[33m", s);
const dim = (s: string) => paint("\x1b[2m", s);

const EXPECTED_TABLES = [
  "categories",
  "folders",
  "prompt_categories",
  "prompt_versions",
  "prompts",
];

let problems = 0;

/** Hide the password when echoing a connection string back. */
function redact(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(unparseable URL)";
  }
}

/** Neon and most PgBouncer setups mark the pooled endpoint in the hostname. */
function isPooled(url: string): boolean {
  try {
    return new URL(url).hostname.includes("-pooler");
  } catch {
    return false;
  }
}

function isLocal(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
}

async function probe(label: string, url: string) {
  console.log(`\n${label}`);
  console.log(dim(`  ${redact(url)}`));
  console.log(
    dim(`  looks ${isPooled(url) ? "pooled" : "direct"}${isLocal(url) ? ", local" : ""}`),
  );

  const sql = postgres(url, { max: 1, idle_timeout: 2, connect_timeout: 10 });
  try {
    const [{ version }] = await sql<{ version: string }[]>`SELECT version()`;
    console.log(`  ${ok("connected")}  ${dim(version.split(",")[0])}`);

    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    const present = new Set(rows.map((r) => r.table_name));
    const missing = EXPECTED_TABLES.filter((t) => !present.has(t));

    if (missing.length === 0) {
      const [{ count: prompts }] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM prompts
      `;
      const [{ count: folders }] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM folders
      `;
      console.log(
        `  ${ok("migrated")}   ${dim(`${prompts} prompt(s), ${folders} folder(s)`)}`,
      );
    } else if (missing.length === EXPECTED_TABLES.length) {
      console.log(`  ${warn("no tables")}  run: npm run db:migrate`);
      problems++;
    } else {
      console.log(
        `  ${bad("partial")}    missing: ${missing.join(", ")} — run: npm run db:migrate`,
      );
      problems++;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ${bad("failed")}     ${message}`);
    if (/self.signed|certificate/i.test(message)) {
      console.log(dim("  hosted Postgres usually needs ?sslmode=require"));
    }
    if (/ECONNREFUSED/.test(message) && isLocal(url)) {
      console.log(dim("  is the database running? try: docker compose up -d"));
    }
    problems++;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const app = process.env.DATABASE_URL;
  const direct = process.env.DATABASE_URL_UNPOOLED;

  console.log("Database check");

  if (!app) {
    console.log(`\n${bad("DATABASE_URL is not set.")}`);
    console.log("Copy .env.example to .env.local and fill it in.");
    process.exit(1);
  }

  await probe("DATABASE_URL          (used by the app)", app);

  if (direct) {
    await probe("DATABASE_URL_UNPOOLED (used by migrations)", direct);
  } else if (isPooled(app)) {
    console.log(
      `\n${warn("DATABASE_URL_UNPOOLED is not set, but DATABASE_URL looks pooled.")}`,
    );
    console.log(
      "Migrations need a direct connection — pooled endpoints run in transaction",
    );
    console.log(
      "mode and can't run them. Copy the non -pooler string into DATABASE_URL_UNPOOLED.",
    );
    problems++;
  } else {
    console.log(
      `\n${dim("DATABASE_URL_UNPOOLED not set — fine, DATABASE_URL is not pooled.")}`,
    );
  }

  // The classic mix-up: the two strings pasted into the wrong variables.
  if (direct && !isPooled(app) && isPooled(direct)) {
    console.log(
      `\n${bad("These look swapped.")} DATABASE_URL should be the -pooler string,`,
    );
    console.log("DATABASE_URL_UNPOOLED the one without it.");
    problems++;
  }

  console.log(
    problems === 0
      ? `\n${ok("All good.")} Start the app with: npm run dev`
      : `\n${warn(`${problems} thing(s) to fix above.`)}`,
  );
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
