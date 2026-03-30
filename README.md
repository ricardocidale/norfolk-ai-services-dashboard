# Norfolk AI services spend dashboard

Internal web app to **record, import, and visualize** AI vendor spend (Cursor, Anthropic, OpenAI, Google / Gemini, Manus, Replit, Vercel, and others) tied to billing identities.

### Billing identities

Spend is attributed to three **billing accounts**, which map to the primary login emails in use:

| Billing account | Email (typical) |
| --- | --- |
| `NORFOLK_GROUP` | ricardo.cidale@norfolkgroup.io |
| `NORFOLK_AI` | ricardo.cidale@norfolk.ai |
| `CIDALE` | ricardo@cidale.com |

Labels in the UI come from `lib/expenses/billing-accounts.ts`.

### Documentation and review (start here)

| File | Who it is for | What it covers |
| --- | --- | --- |
| **[README.md](README.md)** (this file) | Everyone onboarding or reviewing scope | Stack, local vs Drive workflow, folder layout, HTTP API summary, env and deploy |
| **[CLAUDE.md](CLAUDE.md)** | Developers and AI-assisted workflows | Stricter repo rules: contracts (DB, HTTP, SDKs), where code must live, pre-merge checklist |

**Pull requests:** Opening a PR on GitHub loads a short template (`.github/pull_request_template.md`) so authors and reviewers align on migrations, secrets, and doc updates. If a PR changes `README.md` or `CLAUDE.md`, read those diffs first so shared guidance stays accurate.

---

## Tech stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Runtime | **Node.js** **20.x** (via Next.js) | `package.json` `engines.node`; Vercel follows `engines` |
| Framework | **Next.js 16** (App Router) | Route Handlers under `app/api/`; `next dev --turbopack` |
| Language | **TypeScript 5** | Strict typing; Prisma generates types |
| UI | **React 19** | Server and client components as needed |
| Styling | **Tailwind CSS 4** + **shadcn/ui** (new-york) + **Radix** primitives | Theme in `app/globals.css`; `cn()` from `lib/utils.ts` |
| Charts | **Recharts** | Dashboard visualizations |
| Validation | **Zod** | API payloads; schemas in `lib/validations/` |
| ORM / DB | **Prisma 6** + **PostgreSQL 16** | Schema in `prisma/schema.prisma`; migrations in `prisma/migrations/` |
| AI SDKs (server) | **`openai`** (REST), **`@anthropic-ai/sdk`** | Wrapped in `lib/integrations/sdk-clients.ts`; sync logic in `lib/integrations/` |
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
app/
  (app)/                # Logged-in style shell: sidebar + breadcrumbs (see layout.tsx)
    admin/              # Administration (expense sources, probes, API sync)
    expenses/add/       # Manual expense entry (sidebar: Add expense)
    page.tsx            # Dashboard home (/)
  api/                  # HTTP API (Route Handlers only — no business logic dumps)
    expenses/           # CRUD for line items
    import/             # Batch JSON import
    summary/            # Aggregates for dashboard
    analytics/          # Read-only reporting (e.g. vendor spend windows)
    sync/[provider]/    # Provider sync triggers (openai, anthropic, …)
components/
  layout/               # App chrome (sidebar, breadcrumbs, mobile nav)
  expenses/             # Manual entry wrapper (uses dashboard ExpenseForm)
  admin/                # Admin-only client sections
  dashboard/            # Feature UI (charts, forms, lists)
  ui/                   # shadcn primitives — thin wrappers only
lib/
  nav-config.ts         # Sidebar labels and route → breadcrumb titles
  admin/                # Admin helpers (e.g. expense source env status)
  db.ts                 # Prisma client singleton
  analytics/            # Server-side spend rollups (used by API + SSR)
  dashboard/            # Client prefs for dashboard UI (e.g. chart visibility)
  expenses/             # Expense domain: dedup guards, billing labels, vendor→account defaults
  vendors/              # Provider catalog metadata + sort helpers for UI/API
  integrations/         # External APIs: sdk-clients, OAuth, per-vendor sync, Gmail scan
  validations/          # Zod schemas shared by API routes
prisma/
  schema.prisma         # Source of truth for DB + enums
  migrations/           # Applied in order; never hand-edit applied migrations
  seed.ts               # Dev seed data
public/                 # Static assets
```

**Operator guide:** Admins can open **`/admin/playbook`** for step-by-step integration setup (env vars, OAuth, vendor APIs, safe handoff to AI assistants). Content lives in `lib/admin/integration-playbook-sections.ts`.

**Contracts:** HTTP request/response shapes are implied by Zod in `lib/validations/expense.ts` and route handlers. DB shape is **`prisma/schema.prisma`**. If you change one, update the other and add a migration.

**JSON envelope (app API routes):** Success responses are `{ "ok": true, "data": … }`. Errors are `{ "ok": false, "error": { "message": string, "code"?: string, "details"?: unknown } }` with an appropriate HTTP status. Helpers live in `lib/http/api-response.ts`.

---

## HTTP API (summary)

All JSON APIs use `Content-Type: application/json` unless noted. Amounts in JSON are strings in responses (Decimal serialization). Successful bodies use the `{ ok, data }` envelope described above unless a route explicitly documents otherwise.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/expenses` | Query: `take` (max 500), optional `provider` (`AiProvider` enum), optional `from` / `to` (ISO datetimes, `incurredAt` filter; max range ~400 days). `data`: `{ expenses }` (newest first). |
| `POST` | `/api/expenses` | Body: expense create object (see schema below). `data`: `{ expense }`. `409` on unique `(provider, externalRef)` violation **or** when a row would duplicate an existing **API-synced** expense (same provider, date ±1d, amount within 5%, same currency) — see `lib/expenses/dedup.ts`. |
| `PATCH` | `/api/expenses/[id]` | Partial update; same fields as create. `data`: `{ expense }`. `404` if missing. |
| `DELETE` | `/api/expenses/[id]` | `data`: `{ deleted: true }`. `404` if missing. |
| `POST` | `/api/import` | Body: `{ "expenses": [ … ] }` — each item matches create schema. `data`: `{ created, errors }`. Skipped rows (API overlap) append human-readable messages to `errors`. |
| `GET` | `/api/summary` | Totals and groupings + recent `SyncRun` rows (in `data`). |
| `GET` | `/api/analytics/vendor-spend` | Vendor breakdown in `data`: current UTC month (MTD), per-vendor amounts for each of **M-1 … M-12**, and **cumulative** totals over those twelve months. The dashboard uses tabs: current month (name + year), three prior months, the full **Prior 12 months** grid, then **Cumulative 12 months** (see `components/dashboard/vendor-spend-tables.tsx`). |
| `POST` | `/api/admin/probe/openai` | **App admins only.** Checks `OPENAI_ADMIN_KEY` / `OPENAI_API_KEY` against **organization costs** (`GET /v1/organization/costs`, narrow window) so the probe matches sync requirements (no spend import). `data`: `{ message }`. |
| `POST` | `/api/admin/probe/anthropic` | **App admins only.** Tries Admin **cost_report** first; if unavailable, probes Messages API and explains whether Usage & Cost sync can run. |
| `POST` | `/api/admin/probe/perplexity` | **App admins only.** Checks `PERPLEXITY_API_KEY` against the Perplexity API (no spend import). |
| `POST` | `/api/sync/[provider]` | `provider`: `openai` \| `anthropic` \| `chatgpt` \| `perplexity`. Query: `billingAccount` (`BillingAccount` enum, default `NORFOLK_GROUP`). For **openai** / **anthropic**, optional body `{ start?, end? }` (ISO datetimes); if omitted, defaults to **now** and **12 UTC months** before that (`lib/integrations/sync-range.ts`). `chatgpt` / `perplexity` may use `{ month? }`. On success `data`: `{ message, imported }`; `422` + error envelope when sync reports failure. |
| `POST` | `/api/admin/sync-all` | **App admins only.** Runs OpenAI + Anthropic (+ optional second Anthropic org) + ChatGPT + Perplexity in one request; `data`: `{ steps, summary, anyOk, apiSyncOk, … }` (see `app/api/admin/sync-all/route.ts`). |
| `GET` | `/api/gmail/results` | **App admins only.** Query: optional `status` (`PENDING` \| `IMPORTED` \| `REJECTED`). `data`: `{ results }` — scan rows (amounts as Prisma `Decimal` JSON). |
| `PATCH` | `/api/gmail/results` | **App admins only.** Body: `{ id, action: "approve" \| "reject", acknowledgeCardDuplicateRisk?: boolean }`. Approve creates an expense; see `lib/validations/gmail.ts`. |
| `POST` | `/api/gmail/scan` | **App admins only.** Optional body: scope and mailbox list — see `lib/validations/gmail.ts` and `CLAUDE.md`. |
| `GET` | `/api/gmail/auth` | **App admins only.** Query: `email` (mailbox to link). `data`: `{ url }` — Google OAuth consent URL. |
| `POST` | `/api/gmail/auth` | **App admins only.** Body: `{ code, email }` — exchanges code for tokens (see `gmailAuthPostSchema` in `lib/validations/gmail.ts`). |
| `GET` | `/api/gmail/auth/callback` | **OAuth redirect only** (not JSON): Google returns here; handler redirects to `/admin/email-scan` with `connected` or `error` query params. |
| `POST` | `/api/profile/avatar/generate` | Signed-in user only. Body: `{ "prompt": string }` (4–500 chars). Uses `GOOGLE_GENAI_API_KEY` / `GEMINI_API_KEY` and Imagen; `data`: `{ imageBase64, mimeType }` for the client to apply via Clerk `setProfileImage`. |
| `POST` | `/api/admin/users/[userId]` | **App admins only** (`publicMetadata.role === "admin"` or default owner email in code). Body: `{ "action": "ban" \| "unban" \| "lock" \| "unlock" \| "removeAvatar" }` or `{ "action": "delete", "confirmUserId": "<same as path>" }`. Wraps Clerk Backend SDK. Success: `data` (e.g. `{}` or `{ message }` on delete). |
| `GET` | `/api/admin/dedup-audit` | **App admins only.** Deterministic scan for same-day, same-provider, near-duplicate amounts; `data` includes `groups`, counts, and `keep_api`-style hints. |

**Create body fields** (see `expenseCreateSchema` in `lib/validations/expense.ts`): `provider`, `billingAccount`, `amount`, optional `currency` (normalized to uppercase), `incurredAt`, `periodStart`, `periodEnd`, `label`, `notes`, `source`, `externalRef`. Enums must match Prisma `AiProvider` and `BillingAccount`.

---

## Infrastructure and environment

- **Postgres:** Local URL in `.env` should match `docker-compose.yml`. Production: set `DATABASE_URL` on the host (e.g. Vercel) to Neon/Supabase.
- **Secrets:** Only via environment variables. See `.env.example`. Never commit `.env` or service account JSON.
- **Clerk app admins:** The whole `/admin` UI and `/api/admin/*` routes require `publicMetadata.role === "admin"` (set in Clerk) or the default owner email `ricardo.cidale@norfolkgroup.io` (see `lib/admin/is-app-admin.ts`). End-user password reset is via Clerk’s sign-in **Forgot password** flow or the [Clerk Dashboard](https://dashboard.clerk.com).
- **Avatar AI:** `GOOGLE_GENAI_API_KEY` (or `GEMINI_API_KEY`) powers optional Imagen generation on `/profile`.
- **OpenAI sync:** Uses `OPENAI_ADMIN_KEY` or `OPENAI_API_KEY` (trimmed; same resolution as admin probe and `getOpenAIClient` in `lib/integrations/openai-env.ts`) and optional trimmed `OPENAI_ORG_ID` — org **costs** (paginated `next_page`) plus **completions**, **embeddings**, and **images** usage (each paginated); merged into `Expense.notes` as JSON. If the key lacks **`api.usage.read`**, completions usage may be omitted and sync continues from **costs** (warning in message). If embeddings/images fail (e.g. scope), sync still succeeds and warnings are appended to the result message.
- **Anthropic sync:** Requires **`ANTHROPIC_ADMIN_API_KEY`** (Console → Admin keys, `sk-ant-admin…`) for [Usage & Cost API](https://docs.anthropic.com/en/api/usage-cost-api). A normal `ANTHROPIC_API_KEY` cannot call `cost_report` / `usage_report`. Consumer **claude.ai** billing is not available via this API — use manual rows for that.
- **Long syncs:** `POST /api/sync/openai` and `…/anthropic` set `maxDuration = 300` (seconds); `POST /api/admin/sync-all` uses `300` as well. Your Vercel plan’s **maximum** still caps these values.
- **DB writes:** OpenAI / Anthropic sync buffer upserts + `deleteMany` into batched `prisma.$transaction` calls (`lib/integrations/sync-prisma-batch.ts`, `SYNC_DB_OPS_PER_TX = 32`) to cut round-trips to Postgres.
- **Schema vs production:** If a migration adding columns (e.g. `EmailScanResult.parsedUsage`) has not been applied to the host database, list reads use a narrowed Prisma `select` (`lib/prisma/email-scan-result-public.ts`) so admin and Gmail APIs do not crash. Run `npm run db:migrate` / `prisma migrate deploy` against production so the full schema matches `schema.prisma`.

---

## Getting started (local disk)

```bash
cp .env.example .env
docker compose up -d
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Production build: `npm run build`. The Prisma client is generated on `npm install` (`postinstall`) into `lib/generated/prisma` (gitignored); run `npm run db:generate` after schema changes if you skip install scripts.

---

## Collaboration (humans + AI assistants)

- **Single source of truth:** `prisma/schema.prisma` for data model; Zod for API input; Route Handlers orchestrate only.
- **Small PRs:** Touch one concern (schema vs UI vs one integration) when possible.
- **Migrations:** After schema changes run `npx prisma migrate dev`, commit the new migration folder; document breaking API changes in the PR.
- **Integrations:** Vendor-specific parsing and external API types live under `lib/integrations/`. Centralize new SDK usage in `lib/integrations/sdk-clients.ts`. Expense-specific rules (dedup, billing defaults) live under `lib/expenses/`.
- **UI:** Prefer existing `components/ui/*` patterns; add shadcn components with `npx shadcn@latest add <name>` from project root on **local disk**.

Project-specific agent guidance lives in **`CLAUDE.md`** (Cursor / Claude Code).

---

## Deploy (Vercel)

1. Create a Postgres instance (Neon or Supabase); set `DATABASE_URL` in the Vercel project.
2. Run migrations against that database (CI or local with the same URL).
3. Set optional sync keys (`OPENAI_API_KEY`, etc.); redeploy.

See [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying).
