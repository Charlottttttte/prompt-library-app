# Prompt Library

A Next.js app for saving, organizing, and optimizing prompts.

- Save prompts into a searchable library
- Organize them into nested folders
- Tag and filter by category
- Rewrite prompts with AI assistance, with full version history

Tracked in Linear: [Prompt Library App](https://linear.app/minglin/project/prompt-library-app-33ae29ffe740)

## Stack

| Layer     | Choice                                       |
| --------- | -------------------------------------------- |
| Framework | Next.js 16 (App Router) + React 19           |
| Language  | TypeScript                                    |
| Styling   | Tailwind CSS v4, light and dark              |
| Database  | Postgres                                      |
| ORM       | Drizzle ORM + `postgres` driver              |
| Validation| Zod                                           |
| AI        | OpenAI Chat Completions, strict JSON schema  |

Auth is intentionally out of scope — this is a single-user tool.

## Getting started

Needs Node 20.9+ and a Postgres. If you have Docker, the bundled compose file
gives you one and nothing else is hosted:

```bash
npm install
docker compose up -d                 # Postgres on localhost:5433

cp .env.example .env.local
# then set, for the compose database:
#   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/prompt_library"

npm run db:migrate                   # create the tables
npm run db:seed                      # optional: a few example prompts
npm run dev
```

Open http://localhost:3000. The AI optimize panel needs `OPENAI_API_KEY`, but
everything else — saving, folders, tags, search, version history — works
without it.

Already have a Postgres, or using Neon/Supabase? Skip the compose step and
point `DATABASE_URL` at it instead.

## Environment variables

| Variable                | Required | Purpose                                          |
| ----------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`          | yes      | Postgres connection string. Use the **pooled** string on Neon/Supabase. |
| `DATABASE_URL_UNPOOLED` | pooled providers | Direct string, used only for migrations. Pooled connections run in transaction mode and can't run them. Neon's Vercel integration sets this for you. |
| `OPENAI_API_KEY`        | for AI   | Enables "Optimize with AI". Without it the app works fully; the optimize panel just explains the key is missing. Never prefix with `NEXT_PUBLIC_`. |
| `OPTIMIZER_MODEL`       | no       | Defaults to `gpt-5.6-terra`.                      |
| `OPENAI_BASE_URL`       | no       | Point at any OpenAI-compatible endpoint (Azure OpenAI, OpenRouter, a local server). Defaults to `https://api.openai.com/v1`. |

## Scripts

| Script                   | What it does                                  |
| ------------------------ | --------------------------------------------- |
| `npm run dev`            | Dev server                                     |
| `npm run build`          | Production build                               |
| `npm run typecheck`      | `tsc --noEmit`                                 |
| `npm run lint`           | ESLint                                         |
| `npm run test:schema`    | Schema/cascade checks against a live database  |
| `npm run test:optimizer` | Unit tests for optimizer response parsing      |
| `npm run test:api`       | End-to-end HTTP tests (needs the dev server)   |
| `npm run test:ui`        | Browser tests via Playwright                   |
| `npm run mock:openai`    | Stand-in OpenAI server for the two below       |
| `npm run test:optimize-api` | Optimizer over HTTP, all failure paths      |
| `npm run test:optimize-ui`  | Optimize → review → accept in the browser   |
| `npm run db:generate`    | Generate a migration from the schema           |
| `npm run db:migrate`     | Apply pending migrations                       |
| `npm run db:seed`        | Insert example folders, tags, and prompts      |
| `npm run db:studio`      | Drizzle Studio                                 |

`test:api` and `test:ui` expect an **empty** database and a running dev server.

The two `optimize-*` suites run against `scripts/mock-openai.mjs` rather than the
real API, so they cost nothing and can assert the failure paths (bad key, rate
limit, refusal, truncation, unparseable output) that are hard to trigger for
real. The mock also asserts the request the app sends — auth header, message
roles, and a strict JSON schema — so a broken request shape fails the test
rather than surfacing as a confusing 400 in production. Run them with:

```bash
npm run mock:openai &
OPENAI_API_KEY=anything OPENAI_BASE_URL=http://localhost:4010/v1 npm run dev
npm run db:seed && npm run test:optimize-api && npm run test:optimize-ui
```

## Data model

Defined in [`src/db/schema.ts`](src/db/schema.ts), migrations in [`drizzle/`](drizzle).

- **folders** — self-referencing `parent_id` for arbitrary nesting. Deleting a
  folder cascades to its subfolders but **never** deletes prompts: their
  `folder_id` is set to `null`, moving them to the root.
- **prompts** — title, content, optional notes, optional folder.
- **categories** — flat, uniquely-named tags.
- **prompt_categories** — many-to-many join between prompts and categories.
- **prompt_versions** — append-only history. Each row records whether the
  content came from a hand edit (`manual`) or an accepted AI rewrite
  (`optimized`, with the model used), so an optimization can always be compared
  against, or reverted to, what came before.

Selecting a folder in the sidebar includes everything nested beneath it, resolved
in a single recursive CTE.

## HTTP API

The UI uses server actions, but every operation is also reachable over HTTP so
prompts can be pulled from scripts or an editor.

| Method | Path                        | Notes                                        |
| ------ | --------------------------- | -------------------------------------------- |
| GET    | `/api/prompts`              | `?q=`, `?folderId=`, `?categoryIds=a,b`      |
| POST   | `/api/prompts`              | Create                                        |
| GET    | `/api/prompts/[id]`         | With folder, tags, and version history        |
| PATCH  | `/api/prompts/[id]`         | Partial update                                |
| DELETE | `/api/prompts/[id]`         |                                               |
| POST   | `/api/prompts/[id]/optimize`| Returns a suggestion; **does not save it**    |
| GET    | `/api/folders`              | Tree with per-folder counts                   |
| POST   | `/api/folders`              | Create, optionally nested                     |
| PATCH  | `/api/folders/[id]`         | Rename or move (rejects cycles)               |
| DELETE | `/api/folders/[id]`         | Prompts inside move to the root               |
| GET    | `/api/categories`           | With usage counts                             |
| POST   | `/api/categories`           | Create                                        |
| PATCH  | `/api/categories/[id]`      | Rename or recolor                             |
| DELETE | `/api/categories/[id]`      | Unlinks from every prompt                     |

Filtering by several tags at once narrows to prompts carrying **all** of them.

## Optimize with AI

`POST /api/prompts/[id]/optimize` sends the prompt to OpenAI's Chat Completions
endpoint and returns `{ original, optimized, changes[], model }`. It deliberately
does **not** write anything — the UI shows the current and suggested text side by
side, and only an explicit "Accept and save" records an `optimized` version.
An unwanted rewrite can never silently replace what you wrote.

The request uses [strict structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
so the API itself enforces the response schema rather than the app hoping the
model returns valid JSON. The defensive parser in `src/lib/optimize-parse.ts`
remains as a second line of defence, and is what the unit tests exercise.

Because it speaks the Chat Completions shape, `OPENAI_BASE_URL` can point at
Azure OpenAI, OpenRouter, or a local server without code changes.

## Notes on this environment

Two hosts are blocked by this sandbox's egress policy, which shaped two choices:

- `binaries.prisma.sh` — Prisma cannot download its engine binaries here, so the
  project uses **Drizzle ORM** (pure TypeScript, no binaries).
- `fonts.googleapis.com` — `next/font/google` cannot fetch fonts, so the app uses
  a **system font stack** defined in `src/app/globals.css`. To use a custom face,
  self-host it with `next/font/local`.
