---
description: 
alwaysApply: true
---

# Norfolk AI Expense Pulse — Project Context for Cursor/Claude

> Last updated: March 29, 2026
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
ANTHROPIC, OPENAI, CHATGPT, CURSOR, GEMINI, GOOGLE_API,
REPLIT, ELEVENLABS, PERPLEXITY, MANUS, VERCEL,
MIDJOURNEY, AWS_BEDROCK, MISTRAL, COHERE, OTHER

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
- **Node:** 20+ (confirm in Vercel project settings — @types/node is ^20)

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
  integrations/                   ← external API clients (OpenAI, Anthropic, etc.)
  analytics/                      ← analytics helpers
  validations/                    ← Zod schemas for API inputs and forms
  admin/                          ← expense source registry helpers (admin UI/API)
  providers-meta.ts               ← vendor labels, sync types, docs links
  sdk-clients.ts                  ← OpenAI/Anthropic client construction from env
  billing-accounts.ts             ← billing account constants and mapping
  sort-vendors.ts                 ← vendor ordering helpers
prisma/
  schema.prisma                   ← database schema
  seed.ts                         ← seed data (5 records)
  migrations/                     ← 2 migrations applied
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
```

- Other files under `lib/` may exist — search `lib/` before duplicating logic.

---

## HTTP API (contracts)

- **Full table and create-body fields:** `README.md` → **HTTP API (summary)**.
- **Shapes:** `lib/validations/expense.ts` and each `app/api/**/route.ts` handler (keep Zod, Prisma, and docs aligned).
- **Route map** (handlers live under `app/api/`):
  - Expenses: `GET`/`POST` `/api/expenses` (`GET`: optional `from`/`to` ISO, `provider`, `take`), `PATCH`/`DELETE` `/api/expenses/[id]`
  - Import: `POST` `/api/import`
  - Reporting: `GET` `/api/summary`, `GET` `/api/analytics/vendor-spend`
  - Admin UI: `/admin/*` — signed-in users with `publicMetadata.role === "admin"` or default owner email (`lib/admin/is-app-admin.ts`)
  - Admin probe: `POST` `/api/admin/probe/[provider]` — same gate as `/admin/*`
  - Sync: `POST` `/api/sync/[provider]` — `openai`, `anthropic`, `chatgpt`, `perplexity` (query `billingAccount`; optional JSON body `start`/`end` and/or `month` per provider — see route implementation)

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
- 2 migrations applied: `20250328180000_init` and `20260328120000_add_chatgpt_provider`
- Seed: 5 expense records
- `prisma.config.ts` at root replaces deprecated `package.json#prisma`
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
