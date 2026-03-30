import type { BillingAccount } from "@prisma/client";

/** Compact UI labels (dashboard, tables, admin). */
export const BILLING_ACCOUNT_LABEL: Record<BillingAccount, string> = {
  NORFOLK_GROUP: "Norfolk Group",
  NORFOLK_AI: "Norfolk AI",
  CIDALE: "Cidale",
};

/** Full billing identities — tooltips, exports, or support reference. */
export const BILLING_ACCOUNT_EMAIL: Record<BillingAccount, string> = {
  NORFOLK_GROUP: "ricardo.cidale@norfolkgroup.io",
  NORFOLK_AI: "ricardo.cidale@norfolk.ai",
  CIDALE: "ricardo@cidale.com",
};

export const BILLING_ACCOUNT_ORDER: BillingAccount[] = [
  "NORFOLK_GROUP",
  "NORFOLK_AI",
  "CIDALE",
];
