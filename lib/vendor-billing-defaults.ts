import type { AiProvider, BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_LABEL } from "@/lib/billing-accounts";

/**
 * Which billing email each vendor's account / API key is registered under.
 * Vendors not listed here fall back to NORFOLK_GROUP.
 */
const VENDOR_BILLING_DEFAULTS: Partial<Record<AiProvider, BillingAccount>> = {
  ANTHROPIC: "NORFOLK_GROUP",
  OPENAI: "NORFOLK_GROUP",
  CURSOR: "NORFOLK_GROUP",
  CHATGPT: "CIDALE",
};

const FALLBACK: BillingAccount = "NORFOLK_GROUP";

export function vendorBillingAccount(provider: AiProvider): BillingAccount {
  return VENDOR_BILLING_DEFAULTS[provider] ?? FALLBACK;
}

export function vendorBillingEmail(provider: AiProvider): string {
  return BILLING_ACCOUNT_LABEL[vendorBillingAccount(provider)];
}
