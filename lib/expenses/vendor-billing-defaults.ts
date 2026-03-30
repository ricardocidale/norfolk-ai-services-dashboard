import type { AiProvider, BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_EMAIL } from "./billing-accounts";

/**
 * Which billing email each vendor's account / API key is registered under.
 * Vendors not listed here fall back to NORFOLK_GROUP.
 */
const VENDOR_BILLING_DEFAULTS: Partial<Record<AiProvider, BillingAccount>> = {
  ANTHROPIC: "NORFOLK_GROUP",
  OPENAI: "NORFOLK_GROUP",
  CURSOR: "NORFOLK_GROUP",
  /** CRM / marketing stack — override if a different org pays the invoice */
  HUBSPOT: "NORFOLK_GROUP",
  CHATGPT: "CIDALE",
  /** Often same billing identity as ChatGPT; override in Admin sync body if needed */
  PERPLEXITY: "CIDALE",
  /** Large platform spend — adjust if billed under norfolk.ai */
  REPLIT: "NORFOLK_GROUP",
  MANUS: "NORFOLK_GROUP",
  /** Google AI / consumer Gemini flows often tied to Norfolk AI account */
  GEMINI: "NORFOLK_AI",
  GEMINI_NANO_BANANA: "NORFOLK_AI",
};

const FALLBACK: BillingAccount = "NORFOLK_GROUP";

export function vendorBillingAccount(provider: AiProvider): BillingAccount {
  return VENDOR_BILLING_DEFAULTS[provider] ?? FALLBACK;
}

export function vendorBillingEmail(provider: AiProvider): string {
  return BILLING_ACCOUNT_EMAIL[vendorBillingAccount(provider)];
}
