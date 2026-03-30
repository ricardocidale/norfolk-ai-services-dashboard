/**
 * Single source for Anthropic HTTP headers and invoice-parse model selection.
 * Sync (`anthropic-sync.ts`) uses the same API version as Messages + admin probe.
 *
 * @see https://docs.anthropic.com/en/api/versioning
 */
export const ANTHROPIC_API_VERSION = "2023-06-01" as const;

/** Identifies this app on direct `fetch` calls to Anthropic (sync/probe). */
export const ANTHROPIC_OUTBOUND_USER_AGENT = "NorfolkAISpendDashboard/1.0";

/**
 * Model for Gmail invoice JSON extraction (`invoice-parser.ts`).
 * Set `ANTHROPIC_INVOICE_MODEL` in Vercel when upgrading without a deploy of defaults.
 */
export function anthropicInvoiceParseModel(): string {
  const fromEnv = process.env.ANTHROPIC_INVOICE_MODEL?.trim();
  return fromEnv || "claude-sonnet-4-20250514";
}
