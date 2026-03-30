import type { AiProvider } from "@prisma/client";
import {
  applyEnvToProvenance,
  baseProvenanceForProvider,
  type SourceProvenance,
} from "@/lib/admin/expense-source-provenance";
import { vendorBillingEmail } from "@/lib/expenses/vendor-billing-defaults";
import { PROVIDER_META } from "@/lib/vendors/providers-meta";

export type ExpenseSourceStatus = {
  providerId: AiProvider;
  label: string;
  syncType: "openai" | "anthropic" | "chatgpt" | "perplexity" | "manual";
  description: string;
  docsUrl?: string;
  /** Human-readable billing email for this vendor (from vendor-billing-defaults) */
  billingEmail: string;
  /**
   * Primary automation path is configured (API keys or monthly USD env as required).
   * Perplexity: only PERPLEXITY_MONTHLY_USD — API key alone does not satisfy this.
   */
  envSatisfied: boolean;
  /** UX: data path, certainty, redundancy — for Admin Sources reporting */
  provenance: SourceProvenance;
  /** Perplexity: PERPLEXITY_API_KEY set without PERPLEXITY_MONTHLY_USD */
  perplexityProbeOnly?: boolean;
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
      const syncType = "openai" as const;
      const baseProv = baseProvenanceForProvider(p.id, p.label, syncType);
      return {
        ...base,
        syncType,
        envSatisfied: openaiKey,
        provenance: applyEnvToProvenance(baseProv, syncType, {
          envSatisfied: openaiKey,
        }),
      };
    }
    if (p.sync === "anthropic") {
      const syncType = "anthropic" as const;
      const baseProv = baseProvenanceForProvider(p.id, p.label, syncType);
      return {
        ...base,
        syncType,
        envSatisfied: anthropicKey,
        provenance: applyEnvToProvenance(baseProv, syncType, {
          envSatisfied: anthropicKey,
        }),
      };
    }
    if (p.sync === "chatgpt") {
      const syncType = "chatgpt" as const;
      const baseProv = baseProvenanceForProvider(p.id, p.label, syncType);
      return {
        ...base,
        syncType,
        envSatisfied: chatgptConfigured,
        provenance: applyEnvToProvenance(baseProv, syncType, {
          envSatisfied: chatgptConfigured,
        }),
      };
    }
    if (p.sync === "perplexity") {
      const syncType = "perplexity" as const;
      const baseProv = baseProvenanceForProvider(p.id, p.label, syncType);
      const perplexityProbeOnly = perplexityApiKey && !perplexityMonthly;
      return {
        ...base,
        syncType,
        envSatisfied: perplexityMonthly,
        perplexityProbeOnly: perplexityProbeOnly || undefined,
        provenance: applyEnvToProvenance(baseProv, syncType, {
          envSatisfied: perplexityMonthly,
          perplexityProbeOnly,
        }),
      };
    }
    const syncType = "manual" as const;
    const baseProv = baseProvenanceForProvider(p.id, p.label, syncType);
    return {
      ...base,
      syncType,
      envSatisfied: true,
      provenance: applyEnvToProvenance(baseProv, syncType, {
        envSatisfied: true,
      }),
    };
  });
}

export type { SourceProvenance } from "@/lib/admin/expense-source-provenance";
