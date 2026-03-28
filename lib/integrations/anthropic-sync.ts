import type { BillingAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SyncResult } from "./types";

/**
 * Anthropic does not expose a single public “billing CSV” HTTP API for all workspaces.
 * This stub records guidance; extend with your workspace’s export or internal tooling.
 */
export async function syncAnthropicUsage(_options: {
  billingAccount: BillingAccount;
}): Promise<SyncResult> {
  await prisma.syncRun.create({
    data: {
      provider: "ANTHROPIC",
      ok: false,
      message:
        "No default public billing sync. Use manual entry, invoice CSV, or wire the Admin API when available for your org.",
      imported: 0,
      finishedAt: new Date(),
    },
  });

  return {
    ok: false,
    message:
      "Anthropic: add expenses via the dashboard or implement org-specific usage export. Optional: ANTHROPIC_API_KEY for future workspace automation.",
    imported: 0,
    provider: "ANTHROPIC",
  };
}
