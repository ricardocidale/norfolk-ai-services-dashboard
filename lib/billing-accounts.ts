import type { BillingAccount } from "@prisma/client";

export const BILLING_ACCOUNT_LABEL: Record<BillingAccount, string> = {
  NORFOLK_GROUP: "ricardo.cidale@norfolkgroup.io",
  NORFOLK_AI: "ricardo.cidale@norfolk.ai",
  CIDALE: "ricardo@cidale.com",
};

export const BILLING_ACCOUNT_ORDER: BillingAccount[] = [
  "NORFOLK_GROUP",
  "NORFOLK_AI",
  "CIDALE",
];
