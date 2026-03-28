import type { BillingAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SyncResult } from "./types";
import { parseMonthKey } from "./env-month-helpers";

/**
 * Perplexity does not publish a Usage/Cost HTTP API like OpenAI/Anthropic.
 * API spend is credit-based; console shows usage and invoices. This sync
 * records one monthly total from env (API credits used, Pro subscription, or combined).
 *
 * Set PERPLEXITY_MONTHLY_USD. Optional: PERPLEXITY_CURRENCY, PERPLEXITY_MONTHLY_LABEL, PERPLEXITY_MONTHLY_NOTES.
 * POST body: `{ "month": "2026-03" }` for backfill.
 *
 * @see https://docs.perplexity.ai/docs/getting-started/api-groups
 */

export async function syncPerplexitySpend(options: {
  billingAccount: BillingAccount;
  month?: string;
}): Promise<SyncResult> {
  const raw = process.env.PERPLEXITY_MONTHLY_USD?.trim();
  if (!raw) {
    return {
      ok: false,
      message:
        "Set PERPLEXITY_MONTHLY_USD from console.perplexity.ai billing / invoices, or add expenses manually under provider Perplexity.",
      imported: 0,
      provider: "PERPLEXITY",
    };
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      ok: false,
      message: "PERPLEXITY_MONTHLY_USD must be a non-negative number.",
      imported: 0,
      provider: "PERPLEXITY",
    };
  }

  const currency = (process.env.PERPLEXITY_CURRENCY ?? "USD").trim() || "USD";
  const label =
    (process.env.PERPLEXITY_MONTHLY_LABEL ?? "").trim() ||
    "Perplexity — monthly total (env sync)";
  const extraNotes = (process.env.PERPLEXITY_MONTHLY_NOTES ?? "").trim();

  const { year, month0, key } = parseMonthKey(options.month);
  const periodStart = new Date(Date.UTC(year, month0, 1));
  const periodEnd = new Date(Date.UTC(year, month0 + 1, 1));
  const externalRef = `perplexity-month-${key}`;

  const notesPayload = {
    source: "perplexity_env_sync",
    month: key,
    ...(extraNotes ? { detail: extraNotes } : {}),
  };

  await prisma.expense.upsert({
    where: {
      provider_externalRef: { provider: "PERPLEXITY", externalRef },
    },
    create: {
      provider: "PERPLEXITY",
      billingAccount: options.billingAccount,
      amount: String(amount.toFixed(4)),
      currency,
      incurredAt: periodStart,
      periodStart,
      periodEnd,
      label,
      notes: JSON.stringify(notesPayload),
      source: "perplexity_env_sync",
      externalRef,
    },
    update: {
      amount: String(amount.toFixed(4)),
      currency,
      incurredAt: periodStart,
      periodStart,
      periodEnd,
      label,
      notes: JSON.stringify(notesPayload),
      billingAccount: options.billingAccount,
    },
  });

  await prisma.syncRun.create({
    data: {
      provider: "PERPLEXITY",
      ok: true,
      message: `Upserted Perplexity monthly row for ${key}.`,
      imported: 1,
      finishedAt: new Date(),
    },
  });

  return {
    ok: true,
    message: `Perplexity: saved monthly amount for ${key} (${currency} ${amount}).`,
    imported: 1,
    provider: "PERPLEXITY",
  };
}
