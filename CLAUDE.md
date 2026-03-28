# Norfolk AI services spend dashboard — agent & collaborator guide

Use this file with **`README.md`**. README = product, stack, and onboarding. This file = **constraints, layout, and contracts** so humans and AI tools stay aligned.

---

## Purpose

Internal dashboard for **AI vendor spend**: ingest line items, aggregate by provider and billing account, optional sync from vendors that expose APIs.

**Billing identity mapping (domain rule):**

- `ricardo.cidale@norfolkgroup.ai` → `BillingAccount.NORFOLK_GROUP`
- `ricardo.cidale@norfolk.ai` → `BillingAccount.NORFOLK_AI`
- `ricardo@cidale.com` → `BillingAccount.CIDALE`

---

## Working copy: local disk vs Google Drive

| Use | Path pattern (examples) |
| --- | --- |
| **Develop here** | Local / external disk, e.g. `F:\Cursor Project\norfolk-ai-services-dashboard` |
| **Sync / backup** | Google Drive, e.g. `X:\My Drive\Cidale Interests\AI\Cursor\Projects\norfolk-ai-services-dashboard` |

**Do:** `npm install`, `next dev`, `prisma migrate`, builds on **local disk**.  
**Avoid:** Heavy churn inside synced `node_modules` / `.next` on Drive (locks, slow sync, corrupted npm cache).

If instructions reference “the repo,” assume the **local** clone unless explicitly about backup.

---

## Tech stack (authoritative list)

Reference `package.json` for exact versions.

- **Next.js 16** App Router, **React 19**, **TypeScript 5**
- **Tailwind 4** + **shadcn/ui** + **Radix** + **Recharts**
- **Prisma 6** + **PostgreSQL** (Docker locally; Neon/Supabase in prod)
- **Zod** for request validation
- **SDKs:** `openai`, `@anthropic-ai/sdk` (see `lib/sdk-clients.ts`)

---

## Folder schema — responsibilities

| Path | Responsibility |
| --- | --- |
| `app/api/**` | Route Handlers: parse request → validate (Zod) → call `lib` / Prisma → JSON response. Keep thin. |
| `app/*.tsx` | Pages and layouts; fetch server-side or call internal APIs as the app already does. |
| `components/dashboard/**` | Feature UI only; no direct Prisma. |
| `components/ui/**` | shadcn primitives; do not embed business rules. |
| `lib/db.ts` | Prisma client export — use this, do not instantiate new clients ad hoc. |
| `lib/validations/**` | Zod schemas — **contract** for JSON bodies; import from routes. |
| `lib/integrations/**` | External APIs, response mapping, `SyncRun` / expense writes. Document unstable vendor shapes in comments. |
| `lib/sdk-clients.ts` | **Single place** to construct OpenAI / Anthropic clients from `process.env`. |
| `lib/billing-accounts.ts`, `lib/providers-meta.ts` | Domain constants / metadata for UI and imports. |
| `prisma/schema.prisma` | **Single source of truth** for DB enums and models. |
| `prisma/migrations/**` | Immutable history after merge; add new migration for schema changes. |

---

## Contracts

### Database (Prisma)

- **Models:** `Expense`, `SyncRun`
- **Enums:** `BillingAccount`, `AiProvider` — referenced by Zod via `@prisma/client` enums
- **Uniqueness:** `@@unique([provider, externalRef])` on `Expense` — duplicates fail create/import
- **Env:** `DATABASE_URL` only in `.env` / host secrets; see `.env.example`

### HTTP API (machine-facing)

Implementations: `app/api/**/route.ts`. Validation: `lib/validations/expense.ts`.

- `GET /api/expenses` — `take`, optional `provider`
- `POST /api/expenses` — one expense; `400` validation, `409` constraint
- `PATCH|DELETE /api/expenses/[id]`
- `POST /api/import` — `{ expenses: [...] }` → `{ created, errors }`
- `GET /api/summary` — aggregates + recent syncs
- `POST /api/sync/[provider]` — `openai` \| `anthropic`; query `billingAccount`; body optional `{ start, end }`

**Rule:** New public JSON fields → extend Zod schema + Prisma (if persisted) + migration + README/CLAUDE if behavior is user-visible.

### SDKs and vendor APIs

- **OpenAI:** `getOpenAIClient()` — `OPENAI_ADMIN_KEY` or `OPENAI_API_KEY`, optional `OPENAI_ORG_ID`. Usage billing shape may change; isolate mapping in `lib/integrations/openai-sync.ts`.
- **Anthropic:** `getAnthropicClient()` — `ANTHROPIC_API_KEY`. Current sync may be stub; extend `anthropic-sync.ts` when a stable billing/export API is available.

Never hardcode keys. Never commit credentials.

### Infrastructure (local)

- `docker-compose.yml` — Postgres service and credentials must stay aligned with `.env.example` defaults for local dev.

---

## Skills and research (AI assistants)

- Prefer **official docs** or **Context7 MCP** (when available in Cursor) for Next.js, Prisma, shadcn, and SDK APIs before inventing APIs.
- After editing **Prisma schema:** `npx prisma migrate dev` (or `db push` only if the team explicitly allows non-migration workflows).
- After **dependency** changes: run installs on **local disk**; if `npm` tarball errors appear, clear npm cache or retry from local path.

---

## Checklist before merging

- [ ] Schema changes include a **migration** and updated seed if enums/models require it.
- [ ] New env vars documented in **`.env.example`** and README/CLAUDE.
- [ ] API changes documented in **README** (HTTP table) if routes or payloads change.
- [ ] No secrets in repo; `.env` untracked.

---

## Deploy notes (Vercel)

Set `DATABASE_URL` and run migrations against production DB. Optional: sync-related env vars. See `README.md` Deploy section.
