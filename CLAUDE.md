---
description: 
alwaysApply: true
---

# Norfolk AI Expense Pulse — Project Context for Cursor/Claude

> Last updated: March 30, 2026
> READ THIS BEFORE MAKING ANY CHANGES.

---

## LIVE APP
- **URL:** https://spend.norfolk.ai
- **GitHub:** https://github.com/ricardocidale/norfolk-ai-services-dashboard
- **Vercel:** nai_spend_dashboard
- **Owner:** ricardo.cidale@norfolkgroup.io

---

## WHAT THIS APP DOES
Tracks AI service spending across Norfolk Group accounts.

**Billing accounts (BillingAccount enum):**
- `NORFOLK_GROUP` → ricardo.cidale@norfolkgroup.io
- `NORFOLK_AI` → ricardo.cidale@norfolk.ai
- `CIDALE` → ricardo@cidale.com

**Vendors (AiProvider enum in schema.prisma):**
REPLIT, MANUS, GEMINI, GEMINI_NANO_BANANA (Nano Banana / Gemini image SKUs),
ANTHROPIC, OPENAI, CHATGPT, PERPLEXITY (monthly env sync + manual), CURSOR, GOOGLE_API, HUBSPOT, VERCEL,
ELEVENLABS, RETELL_AI, MIDJOURNEY, AWS_BEDROCK, MISTRAL, COHERE, FIGMA, TWILIO, VONAGE, OTHER

Dashboard **vendor order** follows `lib/vendors/providers-meta.ts` (high manual spend first: Replit, Manus, Gemini family, then API vendors and **Perplexity** with env-based monthly sync via `PERPLEXITY_MONTHLY_USD`).

---

## TECH STACK

### Active in the app
- **Framework:** Next.js 16.2.1, React 19, TypeScript 5
- **Styling:** Tailwind CSS v4, shadcn/ui, tw-animate-css, Radix UI primitives (via shadcn)
- **Database:** Neon PostgreSQL (prod) / Docker Postgres (local) via Prisma ORM 6.19
- **Auth:** Clerk v7 (@clerk/nextjs)
- **AI:** @anthropic-ai/sdk, openai
- **Charts:** Recharts
- **Forms:** react-hook-form + @hookform/resolvers + zod
- **Icons:** Lucide (primary)
- **Finance:** decimal.js, date-fns
- **Bundler:** Turbopack (next dev --turbopack)
- **Node:** 20.x (`package.json` `engines.node`, `.nvmrc`; Vercel follows `engines` — @types/node is ^20)

### Installed but not yet wired into UI
These are installed as dependencies for future use — do NOT assume they are active:
- Zustand (state management)
- Resend (email)
- @react-pdf/renderer (PDF export)
- xlsx (Excel export)
- @phosphor-icons/react (icons)
- @google/genai (Gemini SDK)
- @elevenlabs/elevenlabs-js (voice)
- Vitest (testing)
- Sonner (toast notifications)
- shadcn (CLI/registry tooling — no runtime imports, used via npx shadcn add)

---

## FILE STRUCTURE

```
app/
  (app)/                          ← authenticated route group
    layout.tsx                    ← renders <AppChrome>
    page.tsx                      ← dashboard home
    admin/                        ← admin pages
    expenses/                     ← expense pages
  api/                            ← API routes (contracts: section HTTP API below + README)
  sign-in/[[...sign-in]]/page.tsx ← Clerk custom sign-in
  sign-up/[[...sign-up]]/page.tsx ← Clerk custom sign-up
  globals.css                     ← Tailwind v4 imports
  layout.tsx                      ← ROOT layout with <ClerkProvider>
components/
  layout/
    app-chrome.tsx                ← sidebar + header + UserButton + logo
  ui/                             ← shadcn components
lib/
  nav-config.ts                   ← MAIN_NAV, ADMIN_NAV, BREADCRUMB_LABELS
  utils.ts                        ← cn() utility
  db.ts                           ← Prisma client singleton
  expenses/                       ← dedup vs API/email, billing labels, vendor→BillingAccount defaults
  dashboard/                      ← client-only dashboard prefs (e.g. show charts)
  vendors/                        ← PROVIDER_META, provider sort helpers
  integrations/                   ← sdk-clients, OAuth, vendor sync, Gmail/invoice parsing
  analytics/                      ← analytics helpers
  validations/                    ← Zod schemas for API inputs and forms
  admin/                          ← expense source registry helpers (admin UI/API)
prisma/
  schema.prisma                   ← database schema
  seed.ts                         ← seed data (5 records)
  migrations/                     ← applied migrations (see folder; includes enum extensions)
public/
  logo-icone-azul.svg             ← Norfolk AI blue icon (PRIMARY, dark bg)
  logo-icone-branco.svg           ← Norfolk AI white icon (light bg)
  logo-icone-wireframe.svg
  logo-icone-gradiente.svg
  logo-horizontal-azul.svg
  logo-horizontal-branco.svg
  logo-horizontal-gradiente.svg
  logo-horizontal-wireframe.svg
middleware.ts                     ← ROOT level Clerk middleware
prisma.config.ts                  ← ROOT level Prisma config
next.config.ts                    ← ROOT level Next.js config
docker-compose.yml                ← Local Postgres for dev
.env.example                      ← Full env var template
.agents/
  skills/neon-postgres/SKILL.md   ← Cursor/workspace agent skill (compact; link-out to Neon docs)
.claude/
  skills/neon-postgres/SKILL.md   ← Claude Code project skill — **keep identical** to `.agents/...` copy
```

- Other files under `lib/` may exist — search `lib/` before duplicating logic.

---

## AGENT SKILLS & FILE HYGIENE

- **Where skills live:** `.agents/skills/<name>/SKILL.md` for Cursor-oriented workflows; **mirror** the same file under `.claude/skills/<name>/SKILL.md` so Claude Code loads the same guidance. Do not maintain two different bodies of text.
- **Skill file size:** Keep each `SKILL.md` **short** (rough target **under ~120 lines**). Prefer links to vendor doc indexes (e.g. Neon `https://neon.com/docs/llms.txt`) and `.md` URLs over copying long manuals into the repo.
- **Application source files:** Avoid letting a single module grow without bound. If a `.ts` / `.tsx` file approaches **~500 lines** while you are adding features, **split** by concern (e.g. extract hooks, table subcomponents, or integration helpers) instead of stacking more into one file.
- **Docs in repo:** Reserve `README.md` / `CLAUDE.md` for project-specific truth; defer vendor encyclopedias to official docs or skills that only point there.

---

## HTTP API (contracts)

- **Full table and create-body fields:** `README.md` → **HTTP API (summary)**.
- **JSON envelope:** Success `{ ok: true, data }`, errors `{ ok: false, error: { message, code?, details? } }` — `lib/http/api-response.ts` (`jsonOk` / `jsonErr`). Clients use `unwrapApiSuccessData` / `apiErrorMessageFromBody`.
- **Shapes:** `lib/validations/expense.ts` and each `app/api/**/route.ts` handler (keep Zod, Prisma, and docs aligned).
- **Route map** (handlers live under `app/api/`):
  - Expenses: `GET`/`POST` `/api/expenses` (`GET`: optional `from`/`to` ISO, `provider`, `take`), `PATCH`/`DELETE` `/api/expenses/[id]`
  - Import: `POST` `/api/import`
  - Reporting: `GET` `/api/summary`, `GET` `/api/analytics/vendor-spend`
  - Admin UI: `/admin/*` — signed-in users with `publicMetadata.role === "admin"` or default owner email (`lib/admin/is-app-admin.ts`); **`/admin/playbook`** — operator guide (env vars, OAuth, vendors, safe AI handoff; `lib/admin/integration-playbook-sections.ts`)
  - Admin probe: `POST` `/api/admin/probe/[provider]` — same gate as `/admin/*` (OpenAI checks **organization costs**, not `/models`)
  - Admin dedup audit: `GET` `/api/admin/dedup-audit` — same gate; deterministic duplicate-group report (`lib/expenses/dedup.ts`)
  - Sync: `POST` `/api/sync/[provider]` — `openai`, `anthropic`, `chatgpt`, `perplexity` (query `billingAccount`; optional JSON body `start`/`end` and/or `month` per provider — see route implementation); `POST` `/api/admin/sync-all` runs the multi-provider batch (admin only)
  - Gmail: `POST` `/api/gmail/scan` — optional JSON `{ "scope": "standard" | "extended" | "discover", "emails"?: string[] }`. **Extended** adds SaaS/cloud domains and usage-style subject keywords. **Discover** uses invoice/payment subject lines only (any sender, last ~120 days), **excluding** broad `statement` / `summary` / `report` keywords to reduce card-issuer statement noise. Unknown merchants import as `OTHER` with the parsed company name. **Card-issuer** From domains (Citi, Chase, Amex, etc.): approve is **409-blocked** if another non-seed expense matches the same amount (±5%) within ±2 days — use `PATCH` body `acknowledgeCardDuplicateRisk: true` to force import (`lib/expenses/card-issuer-email.ts`, `dedup.ts`, `app/api/gmail/results/route.ts`). `GET`/`PATCH` `/api/gmail/results` list and approve/reject scans; `GET`/`POST` `/api/gmail/auth` + `GET` `/api/gmail/auth/callback` (redirect) for OAuth. **Schema:** `lib/integrations/gmail-scan.ts` can persist `EmailScanResult.parsedUsage` when the column exists; list/read paths use `lib/prisma/email-scan-result-public.ts` (no `parsedUsage` in `select`) so the app does not crash if the host DB has not migrated that column yet — see file comment for re-enabling `notes.usage` on approve after migrate.
  - Env / SDK contracts: OpenAI key resolution is centralized in `lib/integrations/openai-env.ts` (sync, probe, `getOpenAIClient` in `lib/integrations/sdk-clients.ts`). Google OAuth env vars are trimmed in `lib/validations/gmail.ts` (`googleOAuthEnvSchema`).

---

## AUTHENTICATION — DO NOT MODIFY

- `middleware.ts` at PROJECT ROOT (not inside app/)
- Uses `clerkMiddleware` + `createRouteMatcher`
- Public routes: `/sign-in`, `/sign-up`, `/sso-callback`
- `ClerkProvider` wraps app in `app/layout.tsx`
- `UserButton` in `components/layout/app-chrome.tsx` header
- Google OAuth live (Dashboard config — not in repo)
- Facebook and Microsoft SSO disabled (Dashboard config)
- Clerk production instance: spend.norfolk.ai

### Correct middleware.ts:
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

---

## DATABASE — DO NOT MODIFY CONNECTION

- **Production:** Neon PostgreSQL (hostname in Vercel env vars — do not hardcode)
- **Local dev:** Docker Postgres — see `docker-compose.yml` and `.env.example`
- In the maintainer's setup, `DATABASE_URL` points to Neon. New contributors may use Docker only.
- Migrations under `prisma/migrations/` (init, provider enum extensions, Gmail scanner tables, etc.) — run `npm run db:migrate` after pull when new folders appear
- Seed: 5 expense records
- `prisma.config.ts` at root replaces deprecated `package.json#prisma`
- Prisma Client is generated to `lib/generated/prisma` (gitignored); `tsconfig.json` maps `@prisma/client` to that folder. `postinstall` runs `prisma generate`. This avoids Windows EPERM when replacing `node_modules/.prisma/client/query_engine-*.node` under AV or a running Node process.
- Run seed: `npx dotenv -e .env -- npx tsx prisma/seed.ts`

---

## ENVIRONMENT VARIABLES

Set in `.env` (local) and Vercel (all environments).
See `.env.example` for the full list. Key vars:

```
# Database
DATABASE_URL
DATABASE_URL_UNPOOLED

# Clerk Auth
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# AI APIs
OPENAI_API_KEY
ANTHROPIC_API_KEY
ANTHROPIC_NORFOLK_AI_ADMIN_KEY  # second org (ricardo.cidale@norfolk.ai)

# See .env.example for ChatGPT monthly vars, Perplexity, Google creds, admin keys
```

---

## DEPLOYMENT

- Push to `main` → Vercel auto-deploys (two paths: Vercel GitHub integration AND `.github/workflows/vercel-deploy.yml` CLI deploy — both may trigger)
- Custom domain `spend.norfolk.ai` verified on Vercel and Clerk
- DNS on GoDaddy (norfolk.ai)

---

## BRAND

- **Colors:** Navy `#1E2D45`, Teal `#0097A7`, Cyan `#00BCD4`, Gold `#FFC107`
- **App name:** Norfolk AI Expense Pulse
- **Theme:** Dark mode by default
- **Logo:** `/public/logo-icone-azul.svg` (dark bg) or `logo-icone-branco.svg` (light bg)
- **Icons:** Lucide primary; Phosphor installed for future use

---

## SCRIPTS

```bash
npm run dev          # Local dev (Turbopack)
npm run build        # Production build
npm run db:migrate   # Run Prisma migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

---

## RULES FOR AI ASSISTANTS

1. **NEVER** change `middleware.ts` without explicit permission
2. **NEVER** change `DATABASE_URL` or run migrations without permission
3. **NEVER** modify `app/layout.tsx` ClerkProvider wrapper
4. **NEVER** hardcode secrets or API keys in any file committed to Git
5. **ALWAYS** use `next/image` with `unoptimized` for SVG files
6. **ASK** before installing new packages
7. **ASK** before changing auth, database, or deployment config
8. **COMMIT** only when the user explicitly asks — offer the commit message, push only when requested
9. Local dev uses Docker Postgres — do not assume localhost means broken
10. Installed-but-unused packages (full list under "Installed but not yet wired" section) are intentional — do not remove them
11. **Skills:** When updating Neon guidance, edit **both** `.agents/skills/neon-postgres/SKILL.md` and `.claude/skills/neon-postgres/SKILL.md` to the same content; keep skills compact and link-heavy per **AGENT SKILLS & FILE HYGIENE** above
