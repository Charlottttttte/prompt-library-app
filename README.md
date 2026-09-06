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
| AI        | Anthropic Messages API (model configurable)  |

Auth is intentionally out of scope — this is a single-user tool.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL
npm run db:migrate           # apply migrations
npm run db:seed              # optional: a few example prompts
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable            | Required | Purpose                                              |
| ------------------- | -------- | ---------------------------------------------------- |
| `DATABASE_URL`      | yes      | Postgres connection string (Supabase, Neon, Vercel…)  |
| `ANTHROPIC_API_KEY` | for AI   | Enables "Optimize with AI". Without it the app works fully; the optimize panel just explains the key is missing. |
| `OPTIMIZER_MODEL`   | no       | Defaults to `claude-sonnet-5`.                        |

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
| `npm run db:generate`    | Generate a migration from the schema           |
| `npm run db:migrate`     | Apply pending migrations                       |
| `npm run db:seed`        | Insert example folders, tags, and prompts      |
| `npm run db:studio`      | Drizzle Studio                                 |

`test:api` and `test:ui` expect an **empty** database and a running dev server.

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

`POST /api/prompts/[id]/optimize` sends the prompt to the Anthropic Messages API
and returns `{ original, optimized, changes[], model }`. It deliberately does
**not** write anything — the UI shows the current and suggested text side by
side, and only an explicit "Accept and save" records an `optimized` version.
An unwanted rewrite can never silently replace what you wrote.

## Notes on this environment

Two hosts are blocked by this sandbox's egress policy, which shaped two choices:

- `binaries.prisma.sh` — Prisma cannot download its engine binaries here, so the
  project uses **Drizzle ORM** (pure TypeScript, no binaries).
- `fonts.googleapis.com` — `next/font/google` cannot fetch fonts, so the app uses
  a **system font stack** defined in `src/app/globals.css`. To use a custom face,
  self-host it with `next/font/local`.
