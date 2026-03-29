import type { AiProvider } from "@prisma/client";
import { PROVIDER_META } from "@/lib/providers-meta";
import { vendorBillingEmail } from "@/lib/vendor-billing-defaults";

export type ExpenseSourceStatus = {
  providerId: AiProvider;
  label: string;
  syncType: "openai" | "anthropic" | "chatgpt" | "perplexity" | "manual";
  description: string;
  docsUrl?: string;
  /** Human-readable billing email for this vendor (from vendor-billing-defaults) */
  billingEmail: string;
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
    const base = {
      providerId: p.id,
      label: p.label,
      description: p.description,
      docsUrl: p.docsUrl,
      billingEmail: vendorBillingEmail(p.id),
    };

    if (p.sync === "openai") {
      return { ...base, syncType: "openai" as const, envSatisfied: openaiKey };
    }
    if (p.sync === "anthropic") {
      return { ...base, syncType: "anthropic" as const, envSatisfied: anthropicKey };
    }
    if (p.sync === "chatgpt") {
      return { ...base, syncType: "chatgpt" as const, envSatisfied: chatgptConfigured };
    }
    if (p.sync === "perplexity") {
      return {
        ...base,
        syncType: "perplexity" as const,
        envSatisfied: perplexityMonthly || perplexityApiKey,
      };
    }
    return { ...base, syncType: "manual" as const, envSatisfied: true };
  });
}
