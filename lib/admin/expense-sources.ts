import type { AiProvider } from "@prisma/client";
import { PROVIDER_META } from "@/lib/providers-meta";

export type ExpenseSourceStatus = {
  providerId: AiProvider;
  label: string;
  syncType: "openai" | "anthropic" | "chatgpt" | "perplexity" | "manual";
  description: string;
  docsUrl?: string;
  /** What must be set for API-backed sources */
  requiredEnvSummary: string;
  /** Whether minimum env is present to call vendor APIs */
  envSatisfied: boolean;
};

function envPresent(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

export function getExpenseSourceStatuses(): ExpenseSourceStatus[] {
  const openaiKey =
    envPresent("OPENAI_ADMIN_KEY") || envPresent("OPENAI_API_KEY");
  const anthropicKey =
    envPresent("ANTHROPIC_ADMIN_API_KEY") || envPresent("ANTHROPIC_API_KEY");
  const chatgptConfigured = envPresent("CHATGPT_MONTHLY_USD");
  const perplexityMonthly = envPresent("PERPLEXITY_MONTHLY_USD");
  const perplexityApiKey = envPresent("PERPLEXITY_API_KEY");

  return PROVIDER_META.map((p) => {
    if (p.sync === "openai") {
      return {
        providerId: p.id,
        label: p.label,
        syncType: "openai",
        description: p.description,
        docsUrl: p.docsUrl,
        requiredEnvSummary:
          "OPENAI_API_KEY or OPENAI_ADMIN_KEY; optional OPENAI_ORG_ID",
        envSatisfied: openaiKey,
      };
    }
    if (p.sync === "anthropic") {
      return {
        providerId: p.id,
        label: p.label,
        syncType: "anthropic",
        description: p.description,
        docsUrl: p.docsUrl,
        requiredEnvSummary:
          "ANTHROPIC_ADMIN_API_KEY (sk-ant-admin…); ANTHROPIC_API_KEY only if it is an Admin key",
        envSatisfied: anthropicKey,
      };
    }
    if (p.sync === "chatgpt") {
      return {
        providerId: p.id,
        label: p.label,
        syncType: "chatgpt",
        description: p.description,
        docsUrl: p.docsUrl,
        requiredEnvSummary:
          "CHATGPT_MONTHLY_USD (optional CHATGPT_CURRENCY, CHATGPT_MONTHLY_LABEL)",
        envSatisfied: chatgptConfigured,
      };
    }
    if (p.sync === "perplexity") {
      return {
        providerId: p.id,
        label: p.label,
        syncType: "perplexity",
        description: p.description,
        docsUrl: p.docsUrl,
        requiredEnvSummary:
          "PERPLEXITY_API_KEY (probe; same secret as GitHub → also set on Vercel/host). PERPLEXITY_MONTHLY_USD for monthly sync.",
        envSatisfied: perplexityMonthly || perplexityApiKey,
      };
    }
    return {
      providerId: p.id,
      label: p.label,
      syncType: "manual",
      description: p.description,
      docsUrl: p.docsUrl,
      requiredEnvSummary: "Manual entry, CSV, or POST /api/import",
      envSatisfied: true,
    };
  });
}
