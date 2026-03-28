# Norfolk AI services spend dashboard

Internal web app to **record, import, and visualize** AI vendor spend (Cursor, Anthropic, OpenAI, Google / Gemini, Manus, Replit, Vercel, and others) tied to billing identities.

---

## Tech stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Runtime | **Node.js** (via Next.js) | `package.json` engines not pinned; use current LTS locally |
| Framework | **Next.js 16** (App Router) | Route Handlers under `app/api/`; `next dev --turbopack` |
| Language | **TypeScript 5** | Strict typing; Prisma generates types |
| UI | **React 19** | Server and client components as needed |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (new-york) + **Radix** primitives | Theme in `app/globals.css`; `cn()` from `lib/utils.ts` |
| Charts | **Recharts** | Dashboard visualizations |
| Validation | **Zod** | API payloads; schemas in `lib/validations/` |
| ORM / DB | **Prisma 6** + **PostgreSQL 16** | Schema in `prisma/schema.prisma`; migrations in `prisma/migrations/` |
| AI SDKs (server) | **`openai`** (REST), **`@anthropic-ai/sdk`** | Wrapped in `lib/sdk-clients.ts`; sync logic in `lib/integrations/` |
| Local DB | **Docker Compose** | `docker-compose.yml` — Postgres for dev |
| Prod DB | **Neon** or **Supabase** (Postgres) | Pooled `DATABASE_URL` for serverless |

Versions are defined in `package.json`; run `npm install` after pulling.

---

## Why two folders (Google Drive X vs local disk F)

This repo is often present in **two places** on the same machine. That is intentional.

| Location | Role |
| --- | --- |
| **Google Drive (e.g. `X:\My Drive\…`)** | Synced backup, sharing, access from other PCs. Fine for **source files** and Git metadata. |
| **Local disk (e.g. `F:\Cursor Project\…`, LaCie)** | **Primary dev workspace**: `npm install`, `next dev`, Prisma, tests. Avoids Drive sync fighting `node_modules` and `.next`, and reduces npm tarball / file-lock issues. |

**Rule of thumb:** Edit and run commands on **local disk**. Treat Drive as sync/archive unless you accept slower, flakier installs.

Canonical example paths (adjust to your machine):

- Drive: `X:\My Drive\Cidale Interests\AI\Cursor\Projects\norfolk-ai-services-dashboard`
- Local: `F:\Cursor Project\norfolk-ai-services-dashboard`

After copying from Drive to local, run `npm install` on the local copy. Commit `package-lock.json` when the team agrees so installs are reproducible.

---

## Repository layout (folder schema)

```
app/                    # App Router: layouts, pages, global styles
  api/                  # HTTP API (Route Handlers only — no business logic dumps)
    expenses/           # CRUD for line items
    import/             # Batch JSON import
    summary/            # Aggregates for dashboard
    sync/[provider]/    # Provider sync triggers (openai, anthropic, …)
components/
  dashboard/            # Feature UI (charts, forms, lists)
  ui/                   # shadcn primitives — thin wrappers only
lib/
  db.ts                 # Prisma client singleton
  sdk-clients.ts        # OpenAI / Anthropic client factories (env-based)
  integrations/         # Per-vendor sync + types (API shapes live here)
  validations/          # Zod schemas shared by API routes
  billing-accounts.ts   # Domain mapping (emails → BillingAccount)
  providers-meta.ts     # UI / catalog metadata
prisma/
  schema.prisma         # Source of truth for DB + enums
  migrations/           # Applied in order; never hand-edit applied migrations
  seed.ts               # Dev seed data
public/                 # Static assets
```

**Contracts:** HTTP request/response shapes are implied by Zod in `lib/validations/expense.ts` and route handlers. DB shape is **`prisma/schema.prisma`**. If you change one, update the other and add a migration.

---

## HTTP API (summary)

All JSON APIs use `Content-Type: application/json` unless noted. Amounts in JSON are strings in responses (Decimal serialization).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/expenses` | Query: `take` (max 500), optional `provider` (`AiProvider` enum). Returns `{ expenses }`. |
| `POST` | `/api/expenses` | Body: expense create object (see schema below). Returns `{ expense }`. `409` on constraint violation. |
| `PATCH` | `/api/expenses/[id]` | Partial update; same fields as create. `404` if missing. |
| `DELETE` | `/api/expenses/[id]` | Deletes row. `404` if missing. |
| `POST` | `/api/import` | Body: `{ "expenses": [ … ] }` — each item matches create schema. Returns `{ created, errors }`. |
| `GET` | `/api/summary` | Totals and groupings + recent `SyncRun` rows. |
| `POST` | `/api/sync/[provider]` | `provider`: `openai` \| `anthropic`. Query: `billingAccount` (`BillingAccount` enum, default `NORFOLK_GROUP`). Optional JSON body: `{ start?, end? }` (ISO datetimes). Returns sync result; `422` when sync reports failure. |

**Create body fields** (see `expenseCreateSchema` in `lib/validations/expense.ts`): `provider`, `billingAccount`, `amount`, optional `currency`, `incurredAt`, `periodStart`, `periodEnd`, `label`, `notes`, `source`, `externalRef`. Enums must match Prisma `AiProvider` and `BillingAccount`.

---

## Infrastructure and environment

- **Postgres:** Local URL in `.env` should match `docker-compose.yml`. Production: set `DATABASE_URL` on the host (e.g. Vercel) to Neon/Supabase.
- **Secrets:** Only via environment variables. See `.env.example`. Never commit `.env` or service account JSON.
- **OpenAI sync:** Uses `OPENAI_ADMIN_KEY` or `OPENAI_API_KEY` and optional `OPENAI_ORG_ID` — see `lib/integrations/openai-sync.ts` for required API scopes/shape.
- **Anthropic:** Stub / manual path documented in code; extend `lib/integrations/anthropic-sync.ts` as APIs allow.

---

## Getting started (local disk)

```bash
cp .env.example .env
docker compose up -d
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Production build: `npm run build` (runs `prisma generate` first).

---

## Collaboration (humans + AI assistants)

- **Single source of truth:** `prisma/schema.prisma` for data model; Zod for API input; Route Handlers orchestrate only.
- **Small PRs:** Touch one concern (schema vs UI vs one integration) when possible.
- **Migrations:** After schema changes run `npx prisma migrate dev`, commit the new migration folder; document breaking API changes in the PR.
- **Integrations:** Vendor-specific parsing and external API types live under `lib/integrations/`. Centralize new SDK usage in `lib/sdk-clients.ts`.
- **UI:** Prefer existing `components/ui/*` patterns; add shadcn components with `npx shadcn@latest add <name>` from project root on **local disk**.

Project-specific agent guidance lives in **`CLAUDE.md`** (Cursor / Claude Code).

---

## Deploy (Vercel)

1. Create a Postgres instance (Neon or Supabase); set `DATABASE_URL` in the Vercel project.
2. Run migrations against that database (CI or local with the same URL).
3. Set optional sync keys (`OPENAI_API_KEY`, etc.); redeploy.

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying).
