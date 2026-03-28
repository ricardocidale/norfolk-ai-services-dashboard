import type { BillingAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SyncResult } from "./types";
import { parseMonthKey } from "./env-month-helpers";

/**
 * ChatGPT product spend (Plus, Team, Business, Enterprise) is not returned by the
 * OpenAI Platform organization **API usage** endpoints. This sync records a
 * monthly expense from environment variables so subscription-style spend still
 * appears alongside API rows (provider OPENAI).
 *
 * Set CHATGPT_MONTHLY_USD to your recurring charge (or prorated total for the org).
 * Optional: CHATGPT_MONTHLY_LABEL, CHATGPT_CURRENCY.
 * POST body may include `{ "month": "2026-03" }` (UTC calendar month) to backfill.
 */

export async function syncChatGPTSpend(options: {
  billingAccount: BillingAccount;
  month?: string;
}): Promise<SyncResult> {
  const raw = process.env.CHATGPT_MONTHLY_USD?.trim();
  if (!raw) {
    return {
      ok: false,
      message:
        "Set CHATGPT_MONTHLY_USD in .env to your monthly ChatGPT product charge (Plus, Business, etc.), or add expenses manually under provider ChatGPT.",
      imported: 0,
      provider: "CHATGPT",
    };
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      ok: false,
      message: "CHATGPT_MONTHLY_USD must be a non-negative number.",
      imported: 0,
      provider: "CHATGPT",
    };
  }

  const currency = (process.env.CHATGPT_CURRENCY ?? "USD").trim() || "USD";
  const label =
    (process.env.CHATGPT_MONTHLY_LABEL ?? "").trim() ||
    "ChatGPT — monthly subscription (env sync)";
  const extraNotes = (process.env.CHATGPT_MONTHLY_NOTES ?? "").trim();

  const { year, month0, key } = parseMonthKey(options.month);
  const periodStart = new Date(Date.UTC(year, month0, 1));
  const periodEnd = new Date(Date.UTC(year, month0 + 1, 1));
  const externalRef = `chatgpt-month-${key}`;

  const notesPayload = {
    source: "chatgpt_env_sync",
    month: key,
    ...(extraNotes ? { detail: extraNotes } : {}),
  };

  await prisma.expense.upsert({
    where: {
      provider_externalRef: { provider: "CHATGPT", externalRef },
    },
    create: {
      provider: "CHATGPT",
      billingAccount: options.billingAccount,
      amount: String(amount.toFixed(4)),
      currency,
      incurredAt: periodStart,
      periodStart,
      periodEnd,
      label,
      notes: JSON.stringify(notesPayload),
      source: "chatgpt_env_sync",
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
      provider: "CHATGPT",
      ok: true,
      message: `Upserted ChatGPT monthly row for ${key}.`,
      imported: 1,
      finishedAt: new Date(),
    },
  });

  return {
    ok: true,
    message: `ChatGPT: saved monthly amount for ${key} (${currency} ${amount}).`,
    imported: 1,
    provider: "CHATGPT",
  };
}
