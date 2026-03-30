import type { AiProvider } from "@prisma/client";
import { DEFAULT_SYNC_LOOKBACK_MONTHS } from "@/lib/integrations/sync-range";

export type CertaintyLevel = "high" | "medium" | "low";

/** How this vendor’s rows typically enter the database */
export type IngestionArchetype =
  | "admin_api"
  | "env_monthly"
  | "manual_capture";

export type SourceProvenance = {
  archetype: IngestionArchetype;
  /** Static baseline; may be adjusted at runtime if env is missing */
  certaintyLevel: CertaintyLevel;
  certaintyLabel: string;
  /** Short lines for the card */
  howWeGetNumbers: string;
  coveragePoints: string[];
  /** Double-counting or product-line separation */
  redundancyNote?: string;
  /** Gmail invoice scan can propose rows (approve flow) */
  gmailSupplement: boolean;
};

const API_WINDOW = `${DEFAULT_SYNC_LOOKBACK_MONTHS} UTC months through current month (MTD), matching the dashboard rolling window when you use default sync.`;

function apiProvenance(
  providerId: AiProvider,
  vendorLabel: string,
): SourceProvenance {
  const redundancy =
    providerId === "OPENAI"
      ? "ChatGPT (Plus / Team / Business) is billed separately from the OpenAI API. This app tracks API usage here and ChatGPT product spend under the ChatGPT provider via CHATGPT_MONTHLY_USD — not the same line items."
      : providerId === "ANTHROPIC"
        ? "Claude.ai consumer or Team subscriptions (if any) are separate from Claude API usage; those are usually manual or email-captured unless you map them explicitly."
        : undefined;

  return {
    archetype: "admin_api",
    certaintyLevel: "high",
    certaintyLabel: "High — vendor API line items",
    howWeGetNumbers: `The app calls ${vendorLabel}’s organization admin/usage APIs, normalizes cost rows, and upserts Expense records (source tagged as API sync). Re-running sync refreshes the same logical periods.`,
    coveragePoints: [
      `Default sync range: about ${API_WINDOW}`,
      "Totals should align closely with the vendor console; PDF invoices may differ slightly on tax, FX, or invoice cut-off dates.",
      "What the API exposes is what we store — any SKU the API omits will not appear until you add it manually or via Gmail approval.",
    ],
    redundancyNote: redundancy,
    gmailSupplement: true,
  };
}

function envMonthlyProvenance(
  providerId: AiProvider,
  envVarName: string,
): SourceProvenance {
  const probeNote =
    providerId === "PERPLEXITY"
      ? "PERPLEXITY_API_KEY only powers Admin “Test API” — it does not download billing totals. Spend sync requires PERPLEXITY_MONTHLY_USD."
      : undefined;

  return {
    archetype: "env_monthly",
    certaintyLevel: "medium",
    certaintyLabel: "Medium — you set the monthly figure",
    howWeGetNumbers: `There is no live billing pull for this product in-app. You configure ${envVarName} in Vercel; sync upserts a rolled monthly expense. Accuracy depends on keeping that value aligned with real invoices.`,
    coveragePoints: [
      "One aggregate row per month (not itemized API line items from the vendor in this app).",
      "Backfill specific months by passing month in the sync API body (see README).",
    ],
    redundancyNote: probeNote,
    gmailSupplement: true,
  };
}

function manualProvenance(): SourceProvenance {
  return {
    archetype: "manual_capture",
    certaintyLevel: "low",
    certaintyLabel: "Variable — no in-app automation",
    howWeGetNumbers:
      "Expenses appear when someone adds them on the Add expense page, CSV import, or approves a Gmail scan result. There is no scheduled pull for this vendor.",
    coveragePoints: [
      "Completeness depends on your operational discipline and email scan coverage.",
      "Use the dashboard Vendor lines & timeline tab to audit gaps by period.",
    ],
    gmailSupplement: true,
  };
}

export function baseProvenanceForProvider(
  providerId: AiProvider,
  label: string,
  syncType: "openai" | "anthropic" | "chatgpt" | "perplexity" | "manual",
): SourceProvenance {
  switch (syncType) {
    case "openai":
      return apiProvenance(providerId, label);
    case "anthropic":
      return apiProvenance(providerId, label);
    case "chatgpt":
      return envMonthlyProvenance(providerId, "CHATGPT_MONTHLY_USD");
    case "perplexity":
      return envMonthlyProvenance(providerId, "PERPLEXITY_MONTHLY_USD");
    default:
      return manualProvenance();
  }
}

/**
 * Adjust certainty copy when credentials or env are missing.
 */
export function applyEnvToProvenance(
  provenance: SourceProvenance,
  syncType: ExpenseSourceProvenanceInput["syncType"],
  opts: {
    envSatisfied: boolean;
    /** Perplexity: API key set but monthly USD missing */
    perplexityProbeOnly?: boolean;
  },
): SourceProvenance {
  const next = { ...provenance, coveragePoints: [...provenance.coveragePoints] };

  if (syncType === "openai" || syncType === "anthropic") {
    if (!opts.envSatisfied) {
      next.certaintyLevel = "low";
      next.certaintyLabel = "Blocked — API keys missing";
      next.howWeGetNumbers =
        "Sync is implemented, but no admin/API key is configured in Vercel. Until keys are set, numbers only appear from manual entry, import, or Gmail approval.";
      next.coveragePoints = [
        "Configure OPENAI_ADMIN_KEY or OPENAI_API_KEY (OpenAI) or ANTHROPIC_* keys (Anthropic) in environment variables.",
        ...provenance.coveragePoints.slice(0, 1),
      ];
    }
    return next;
  }

  if (syncType === "chatgpt") {
    if (!opts.envSatisfied) {
      next.certaintyLevel = "low";
      next.certaintyLabel = "Low — monthly env not set";
      next.coveragePoints.unshift(
        "Set CHATGPT_MONTHLY_USD to enable one-click monthly upsert.",
      );
    }
    return next;
  }

  if (syncType === "perplexity") {
    if (opts.perplexityProbeOnly) {
      next.certaintyLevel = "low";
      next.certaintyLabel = "Low — probe only until monthly is set";
      next.coveragePoints.unshift(
        "PERPLEXITY_MONTHLY_USD is missing — “Sync now” will fail until you set it from console billing.",
      );
    } else if (!opts.envSatisfied) {
      next.certaintyLevel = "low";
      next.certaintyLabel = "Low — not configured";
      next.coveragePoints.unshift(
        "Set PERPLEXITY_MONTHLY_USD (and optionally use Test API with PERPLEXITY_API_KEY).",
      );
    }
    return next;
  }

  return next;
}

export type ExpenseSourceProvenanceInput = {
  syncType: "openai" | "anthropic" | "chatgpt" | "perplexity" | "manual";
};
