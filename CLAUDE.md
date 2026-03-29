# Norfolk AI Expense Pulse — Project Context for Cursor/Claude

> Last updated: March 29, 2026
> READ THIS BEFORE MAKING ANY CHANGES.

## LIVE APP
- URL: https://spend.norfolk.ai
- GitHub: https://github.com/ricardocidale/norfolk-ai-services-dashboard
- Vercel: nai_spend_dashboard
- Owner: Ricardo Cidale — ricardo.cidale@norfolkgroup.io

## WHAT THIS APP DOES
Tracks AI service spending across Norfolk Group accounts.
Vendors: Anthropic, OpenAI, Cursor, Gemini, Replit, ElevenLabs.
Billing accounts: NORFOLK_GROUP, NORFOLK_AI, CIDALE

## TECH STACK
- Framework: Next.js 16.2.1, React 19, TypeScript 5
- Styling: Tailwind CSS v4, shadcn/ui
- Database: Neon PostgreSQL via Prisma ORM 6.19
- Auth: Clerk v7 (@clerk/nextjs)
- AI: Anthropic SDK, OpenAI SDK, Google Gemini, ElevenLabs
- Charts: Recharts
- Forms: react-hook-form + zod
- State: Zustand
- Export: @react-pdf/renderer, xlsx
- Email: Resend
- Icons: Lucide + Phosphor
- Finance: decimal.js, date-fns
- Testing: Vitest
- Bundler: Turbopack

## AUTHENTICATION — DO NOT MODIFY
- middleware.ts at PROJECT ROOT
- Uses clerkMiddleware + createRouteMatcher
- Public routes: /sign-in, /sign-up, /sso-callback
- ClerkProvider in app/layout.tsx
- UserButton in components/layout/app-chrome.tsx
- Google OAuth live, Facebook/Microsoft disabled

## DATABASE — DO NOT MODIFY
- Neon PostgreSQL (NOT localhost)
- 2 migrations applied
- prisma.config.ts at root

## ENV VARS — ALL SET IN .ENV AND VERCEL
DATABASE_URL, DATABASE_URL_UNPOOLED,
CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL,
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL, NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
OPENAI_API_KEY, ANTHROPIC_API_KEY

## BRAND
- Colors: Navy #1E2D45, Teal #0097A7, Gold #FFC107
- App name: Norfolk AI Expense Pulse
- Theme: Dark mode default
- Logo: /public/logo-icone-azul.svg (primary)

## SCRIPTS
npm run dev        — local dev
npm run build      — production build
npm run db:migrate — run migrations
npm run db:seed    — seed database

## RULES FOR AI ASSISTANTS
1. NEVER change middleware.ts without permission
2. NEVER change DATABASE_URL or run migrations without permission
3. NEVER modify app/layout.tsx ClerkProvider
4. NEVER hardcode secrets or API keys in any file
5. ALWAYS use next/image with unoptimized for SVGs
6. ALWAYS commit and push after fixes
7. ASK before installing new packages
8. ASK before changing auth, database, or deployment