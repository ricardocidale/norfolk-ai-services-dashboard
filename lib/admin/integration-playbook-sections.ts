/**
 * Operator-facing copy for Admin → Integration playbook.
 * Keep env var names aligned with `.env.example` and route handlers.
 */

export type PlaybookLink = { label: string; href: string };

export type PlaybookStep = {
  title: string;
  /** Plain text; double newlines become paragraphs in the UI. */
  body?: string;
};

export type PlaybookVerifyLink = {
  label: string;
  href: string;
};

export type PlaybookSection = {
  id: string;
  title: string;
  summary: string;
  steps: PlaybookStep[];
  envKeys?: string[];
  links?: PlaybookLink[];
  verify?: PlaybookVerifyLink[];
};

export const PLAYBOOK_SECTIONS: PlaybookSection[] = [
  {
    id: "safety",
    title: "Safety: working with AI assistants",
    summary:
      "How to gather credentials without leaking secrets into chat logs or tickets.",
    steps: [
      {
        title: "Never paste live secrets into Cursor, Claude, or Slack",
        body:
          "API keys, client secrets, and database URLs belong only in **Vercel Environment Variables** (production/preview) or your **local `.env`** (never committed). If a key was pasted somewhere unsafe, **rotate it** in the vendor console.",
      },
      {
        title: "What you can share with an AI",
        body:
          "Share **env var names** (e.g. `OPENAI_ADMIN_KEY`), **error messages** (redact tokens), **HTTP status codes**, and **which screen** you are on. For debugging, use **Test API** on Admin → Vendors or Vercel / function logs — not raw key values.",
      },
      {
        title: "Use this page as the checklist",
        body:
          "Work top to bottom. Check off items in your head or keep a private note; the app does not store your playbook progress yet.",
      },
    ],
    verify: [{ label: "Admin home", href: "/admin" }],
  },
  {
    id: "vercel",
    title: "Vercel: where configuration lives",
    summary:
      "Production and preview deployments read secrets from the Vercel project, not from GitHub alone.",
    steps: [
      {
        title: "Open your Vercel project",
        body:
          "Project settings → **Environment Variables**. Set variables for **Production** (and **Preview** if you test integrations on preview URLs). After changing vars, **redeploy** so new serverless instances pick them up.",
      },
      {
        title: "Align URLs with Clerk and Google OAuth",
        body:
          "Your production URL (e.g. `https://spend.norfolk.ai`) must match **Clerk** allowed origins and the **Google OAuth redirect URI** you configure in Google Cloud Console (`/api/gmail/auth/callback` on that host).",
      },
    ],
    links: [
      { label: "Vercel env docs", href: "https://vercel.com/docs/projects/environment-variables" },
    ],
    verify: [{ label: "Vercel Dashboard", href: "https://vercel.com/dashboard" }],
  },
  {
    id: "database",
    title: "Database (Neon / Postgres)",
    summary:
      "The app needs a migrated Postgres schema; pooled `DATABASE_URL` is typical on Vercel.",
    steps: [
      {
        title: "Create or reuse a Postgres database",
        body:
          "Neon, Supabase, or Docker locally. Copy the connection string into `DATABASE_URL` on Vercel and in local `.env`.",
      },
      {
        title: "Run migrations against that database",
        body:
          "From a trusted machine with network access: `npx prisma migrate deploy` (or your CI) using the **same** `DATABASE_URL` as production. If schema lags code, pages that query new columns can error until migrate is applied.",
      },
    ],
    envKeys: ["DATABASE_URL", "DATABASE_URL_UNPOOLED"],
    links: [{ label: "Neon docs", href: "https://neon.tech/docs" }],
  },
  {
    id: "clerk",
    title: "Clerk (authentication)",
    summary:
      "Sign-in, sessions, and who counts as an app admin.",
    steps: [
      {
        title: "Configure Clerk environment variables",
        body:
          "Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and the public URLs for sign-in/sign-up and after-sign-in redirects (see `.env.example` and Clerk Dashboard).",
      },
      {
        title: "Mark admins",
        body:
          "Users who should access `/admin` need `publicMetadata.role === \"admin\"` in Clerk, or match the default owner email in `lib/admin/is-app-admin.ts`.",
      },
    ],
    envKeys: [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
      "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
    ],
    links: [{ label: "Clerk Dashboard", href: "https://dashboard.clerk.com" }],
    verify: [{ label: "Sign in to app", href: "/sign-in" }],
  },
  {
    id: "openai",
    title: "OpenAI (organization costs + usage)",
    summary:
      "Automated sync uses org **Costs** and **Usage** HTTP APIs; the admin probe hits organization costs.",
    steps: [
      {
        title: "Create or locate an API key with the right access",
        body:
          "Prefer **OpenAI Admin** keys from Organization settings when available. The app resolves `OPENAI_ADMIN_KEY` then `OPENAI_API_KEY` (`lib/integrations/openai-env.ts`). **Costs** need appropriate org access; **completions usage** may require scope `api.usage.read` — without it, sync can still import **costs** and warn that usage was omitted.",
      },
      {
        title: "Optional: multiple organizations",
        body:
          "If the key belongs to more than one org, set `OPENAI_ORG_ID` (trimmed) so requests target the correct org.",
      },
      {
        title: "Set env vars on Vercel",
        body:
          "Add keys to Vercel, redeploy, then use **Test API** and **Sync now** for OpenAI on Admin → Vendors.",
      },
    ],
    envKeys: ["OPENAI_ADMIN_KEY", "OPENAI_API_KEY", "OPENAI_ORG_ID", "OPENAI_CHAT_MODEL"],
    links: [
      {
        label: "OpenAI API keys / admin keys",
        href: "https://platform.openai.com/settings/organization/api-keys",
      },
    ],
    verify: [
      { label: "Admin → Vendors (OpenAI)", href: "/admin?tab=vendors" },
    ],
  },
  {
    id: "anthropic",
    title: "Anthropic (Claude API usage & cost)",
    summary:
      "Sync requires an **Admin** API key (`sk-ant-admin…`), not a consumer-only key.",
    steps: [
      {
        title: "Create Admin keys in Anthropic Console",
        body:
          "Console → **Admin keys**. Set `ANTHROPIC_ADMIN_API_KEY` for the primary org. For a second org (e.g. Norfolk AI), set `ANTHROPIC_NORFOLK_AI_ADMIN_KEY` — sync-all uses it when present.",
      },
      {
        title: "Claude.ai consumer billing",
        body:
          "Consumer subscriptions are **not** the same as API Usage & Cost. Enter those as **manual** expenses or email-assisted imports if needed.",
      },
    ],
    envKeys: [
      "ANTHROPIC_ADMIN_API_KEY",
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_NORFOLK_AI_ADMIN_KEY",
      "ANTHROPIC_INVOICE_MODEL",
    ],
    links: [
      {
        label: "Anthropic Console (admin keys)",
        href: "https://console.anthropic.com/settings/admin-keys",
      },
    ],
    verify: [{ label: "Admin → Vendors (Anthropic)", href: "/admin?tab=vendors" }],
  },
  {
    id: "chatgpt-perplexity",
    title: "ChatGPT & Perplexity (monthly env totals)",
    summary:
      "No org-wide invoice API in-app; you maintain a monthly USD total in environment variables.",
    steps: [
      {
        title: "ChatGPT (Plus / Business / etc.)",
        body:
          "Read your monthly charge from OpenAI’s ChatGPT billing or invoices. Set `CHATGPT_MONTHLY_USD` (and optional `CHATGPT_CURRENCY`, label, notes). Run sync from Admin → Vendors or `POST /api/sync/chatgpt`.",
      },
      {
        title: "Perplexity",
        body:
          "Set `PERPLEXITY_MONTHLY_USD` from the Perplexity billing console. `PERPLEXITY_API_KEY` is for the **admin probe only** — it does **not** pull invoice totals.",
      },
    ],
    envKeys: [
      "CHATGPT_MONTHLY_USD",
      "CHATGPT_CURRENCY",
      "CHATGPT_MONTHLY_LABEL",
      "PERPLEXITY_MONTHLY_USD",
      "PERPLEXITY_API_KEY",
      "PERPLEXITY_CURRENCY",
      "PERPLEXITY_MONTHLY_LABEL",
    ],
    links: [
      { label: "Perplexity docs", href: "https://docs.perplexity.ai/docs/getting-started/api-groups" },
    ],
    verify: [{ label: "Admin → Vendors", href: "/admin?tab=vendors" }],
  },
  {
    id: "gmail",
    title: "Gmail invoice scanner (Google OAuth)",
    summary:
      "Connect mailboxes to scan for invoices; OAuth client is configured in Google Cloud.",
    steps: [
      {
        title: "Enable Gmail API and create OAuth credentials",
        body:
          "Google Cloud Console → enable **Gmail API** → **Credentials** → OAuth 2.0 Client (Web). Add authorized redirect URI exactly matching `GOOGLE_OAUTH_REDIRECT_URI` (production: `https://<your-domain>/api/gmail/auth/callback`).",
      },
      {
        title: "Set env vars",
        body:
          "Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` on Vercel (and locally for dev). Values are trimmed per `lib/validations/gmail.ts`.",
      },
      {
        title: "If Google says “hasn't verified this app”",
        body:
          "That screen is normal while the OAuth client is in **Testing** or before Google **verifies** the app. For **internal use**: in Google Cloud, open **Google Auth Platform** → **Audience** (or the classic **APIs & Services** → **OAuth consent screen**) → **Test users** → **Add users** for every Google account that will connect Gmail (same email as the mailbox you link in the app). Those users can click **Continue** on the warning. While status is **Testing**, the user cap is typically 100 test users. For **broader production** beyond test users, use **Publish app**; Gmail scopes are **sensitive** — **Verification Center** may require a review (can take days). Until then, stay on **Testing** and maintain the test-user list.",
      },
      {
        title: "Connect in the app",
        body:
          "Admin → **Email scanner** → connect each mailbox. The OAuth popup must complete while signed in (Clerk session cookies).",
      },
    ],
    envKeys: [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REDIRECT_URI",
    ],
    links: [
      {
        label: "Google Cloud Console — APIs & credentials",
        href: "https://console.cloud.google.com/apis/credentials",
      },
      {
        label: "OAuth consent screen (legacy path)",
        href: "https://console.cloud.google.com/apis/credentials/consent",
      },
      {
        label: "Google Auth Platform (Audience / test users)",
        href: "https://console.cloud.google.com/auth/audience",
      },
    ],
    verify: [{ label: "Admin → Email scanner", href: "/admin?tab=email-scanner" }],
  },
  {
    id: "github",
    title: "GitHub (optional — CI and secrets)",
    summary:
      "If you deploy via GitHub Actions, secrets in the repo do not automatically replace Vercel env vars.",
    steps: [
      {
        title: "Single source of truth",
        body:
          "Prefer **Vercel** for runtime secrets the Next.js app reads. GitHub **Secrets** are for the workflow (e.g. `VERCEL_TOKEN`); they do not inject into the serverless runtime unless your workflow explicitly pushes them to Vercel.",
      },
      {
        title: "Keep `.env.example` updated",
        body:
          "When adding integrations, add placeholder keys to `.env.example` and document them here so operators know what to set.",
      },
    ],
    links: [{ label: "GitHub Actions secrets", href: "https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions" }],
  },
  {
    id: "manual-vendors",
    title: "All other vendors (manual, import, Gmail)",
    summary:
      "Most catalog vendors (Replit, Manus, Gemini, Cursor, Vercel, …) have no org spend API wired in this app yet.",
    steps: [
      {
        title: "Manual entry",
        body:
          "Use **Add expense** with the correct `provider` and **billing account** (Norfolk Group / Norfolk AI / Cidale).",
      },
      {
        title: "CSV import",
        body:
          "Use `POST /api/import` or the in-app import flow where available; dedup rules apply for overlaps with API-synced rows.",
      },
      {
        title: "Gmail-assisted",
        body:
          "Run scans from Admin → Email scanner (standard / extended / discover scopes). **Approve** rows to create expenses; card-issuer and duplicate rules are documented in `README.md` and `CLAUDE.md`.",
      },
    ],
    verify: [
      { label: "Add expense", href: "/expenses/add" },
      { label: "Admin → Email scanner", href: "/admin?tab=email-scanner" },
    ],
  },
  {
    id: "avatar",
    title: "Profile avatar AI (optional)",
    summary:
      "Imagen-style generation uses Google GenAI env vars.",
    steps: [
      {
        title: "Set API key",
        body:
          "Set `GOOGLE_GENAI_API_KEY` or `GEMINI_API_KEY` for `POST /api/profile/avatar/generate`. Optional `IMAGEN_MODEL` override.",
      },
    ],
    envKeys: ["GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY", "IMAGEN_MODEL"],
    links: [{ label: "Google AI Studio", href: "https://aistudio.google.com/apikey" }],
    verify: [{ label: "Profile", href: "/profile" }],
  },
];

export type PlaybookHints = {
  databaseUrl: boolean;
  clerk: boolean;
  openai: boolean;
  anthropic: boolean;
  chatgptMonthly: boolean;
  perplexityMonthly: boolean;
  googleOAuth: boolean;
  genaiAvatar: boolean;
};

/** Short status line for accordion headers (server env only — not a full audit). */
export function playbookSectionStatusLine(
  sectionId: string,
  hints: PlaybookHints,
): string | null {
  switch (sectionId) {
    case "database":
      return hints.databaseUrl ? "DATABASE_URL detected" : "Set DATABASE_URL";
    case "clerk":
      return hints.clerk ? "Clerk keys detected" : "Set Clerk publishable + secret keys";
    case "openai":
      return hints.openai ? "OpenAI key detected" : "Set OPENAI_ADMIN_KEY or OPENAI_API_KEY";
    case "anthropic":
      return hints.anthropic
        ? "Anthropic key detected"
        : "Set ANTHROPIC_ADMIN_API_KEY (or admin-capable ANTHROPIC_API_KEY)";
    case "chatgpt-perplexity": {
      const c = hints.chatgptMonthly ? "ChatGPT monthly OK" : "ChatGPT monthly missing";
      const p = hints.perplexityMonthly
        ? "Perplexity monthly OK"
        : "Perplexity monthly missing";
      return `${c} · ${p}`;
    }
    case "gmail":
      return hints.googleOAuth
        ? "OAuth client id+secret detected"
        : "Set Google OAuth client env vars";
    case "avatar":
      return hints.genaiAvatar ? "GenAI key detected" : "Optional — set GOOGLE_GENAI_API_KEY or GEMINI_API_KEY";
    default:
      return null;
  }
}

export function buildAiAssistantBrief(hints: PlaybookHints): string {
  const yn = (b: boolean) => (b ? "yes (env present on server)" : "no / not detected");
  return `Norfolk AI Expense Pulse — context for an AI assistant (NO SECRETS — do not paste keys into chat)

Production app: https://spend.norfolk.ai
Stack: Next.js on Vercel, Postgres (Prisma), Clerk auth.

Environment detection (this deploy only, inferred from presence of vars — not a guarantee of correctness):
- DATABASE_URL: ${yn(hints.databaseUrl)}
- Clerk (publishable + secret): ${yn(hints.clerk)}
- OpenAI (admin or API key): ${yn(hints.openai)}
- Anthropic (admin or API key): ${yn(hints.anthropic)}
- CHATGPT_MONTHLY_USD: ${yn(hints.chatgptMonthly)}
- PERPLEXITY_MONTHLY_USD: ${yn(hints.perplexityMonthly)}
- Google OAuth (Gmail scan client id+secret): ${yn(hints.googleOAuth)}
- GenAI avatar key: ${yn(hints.genaiAvatar)}

Operator playbook in-app: /admin/playbook

What I need help with:
(write your question here — e.g. "OpenAI sync returns 403", "where do I find Anthropic admin keys")

Rules:
- Never put API keys or database URLs in this message; configure them in Vercel or local .env only.
`;
}
