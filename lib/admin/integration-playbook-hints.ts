import type { PlaybookHints } from "@/lib/admin/integration-playbook-sections";

function envPresent(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

/** Presence-only hints for this server runtime (Vercel / local). Not a correctness audit. */
export function getPlaybookHints(): PlaybookHints {
  return {
    databaseUrl: envPresent("DATABASE_URL"),
    clerk:
      envPresent("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") &&
      envPresent("CLERK_SECRET_KEY"),
    openai: envPresent("OPENAI_ADMIN_KEY") || envPresent("OPENAI_API_KEY"),
    anthropic:
      envPresent("ANTHROPIC_ADMIN_API_KEY") || envPresent("ANTHROPIC_API_KEY"),
    chatgptMonthly: envPresent("CHATGPT_MONTHLY_USD"),
    perplexityMonthly: envPresent("PERPLEXITY_MONTHLY_USD"),
    googleOAuth:
      envPresent("GOOGLE_OAUTH_CLIENT_ID") &&
      envPresent("GOOGLE_OAUTH_CLIENT_SECRET"),
    genaiAvatar:
      envPresent("GOOGLE_GENAI_API_KEY") || envPresent("GEMINI_API_KEY"),
  };
}
