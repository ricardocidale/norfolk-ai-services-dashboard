import type { BillingAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SyncResult } from "./types";

/**
 * Pulls organization cost buckets from OpenAI when the key has admin/usage access.
 * Uses OPENAI_API_KEY (or OPENAI_ADMIN_KEY if set). Optional OPENAI_ORG_ID.
 * @see https://platform.openai.com/docs/api-reference/usage/costs
 */
export async function syncOpenAIUsage(options: {
  billingAccount: BillingAccount;
  startTime?: Date;
  endTime?: Date;
}): Promise<SyncResult> {
  const apiKey = process.env.OPENAI_ADMIN_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message:
        "Set OPENAI_API_KEY or OPENAI_ADMIN_KEY with organization usage access.",
      imported: 0,
      provider: "OPENAI",
    };
  }

  const end = options.endTime ?? new Date();
  const start =
    options.startTime ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startSec = Math.floor(start.getTime() / 1000);
  const endSec = Math.floor(end.getTime() / 1000);

  const url = new URL("https://api.openai.com/v1/organization/costs");
  url.searchParams.set("start_time", String(startSec));
  url.searchParams.set("end_time", String(endSec));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const org = process.env.OPENAI_ORG_ID;
  if (org) headers["OpenAI-Organization"] = org;

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  const raw = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      message: `OpenAI costs API ${res.status}: ${raw.slice(0, 400)}`,
      imported: 0,
      provider: "OPENAI",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      message: "OpenAI returned non-JSON response.",
      imported: 0,
      provider: "OPENAI",
    };
  }

  const data = parsed as {
    data?: Array<{
      start_time?: number;
      end_time?: number;
      results?: Array<{ amount?: { value?: number; currency?: string } }>;
    }>;
  };

  const buckets = Array.isArray(data.data) ? data.data : [];
  let imported = 0;

  for (const bucket of buckets) {
    const bucketStart = bucket.start_time
      ? new Date(bucket.start_time * 1000)
      : start;
    const bucketEnd = bucket.end_time
      ? new Date(bucket.end_time * 1000)
      : end;
    const results = bucket.results ?? [];
    let dayTotal = 0;
    let currency = "USD";
    for (const r of results) {
      const v = r.amount?.value;
      if (typeof v === "number") dayTotal += v;
      if (r.amount?.currency) currency = r.amount.currency;
    }
    if (dayTotal === 0) continue;

    const externalRef = `openai-cost-${bucketStart.toISOString().slice(0, 10)}`;
    await prisma.expense.upsert({
      where: {
        provider_externalRef: { provider: "OPENAI", externalRef },
      },
      create: {
        provider: "OPENAI",
        billingAccount: options.billingAccount,
        amount: String(dayTotal.toFixed(4)),
        currency,
        incurredAt: bucketStart,
        periodStart: bucketStart,
        periodEnd: bucketEnd,
        label: "OpenAI organization costs (API sync)",
        source: "openai_api",
        externalRef,
      },
      update: {
        amount: String(dayTotal.toFixed(4)),
        currency,
        periodStart: bucketStart,
        periodEnd: bucketEnd,
        billingAccount: options.billingAccount,
      },
    });
    imported += 1;
  }

  await prisma.syncRun.create({
    data: {
      provider: "OPENAI",
      ok: true,
      message: `Imported ${imported} day bucket(s).`,
      imported,
      finishedAt: new Date(),
    },
  });

  return {
    ok: true,
    message:
      imported > 0
        ? `Upserted ${imported} daily cost row(s) from OpenAI.`
        : "No cost buckets returned for range (check org key permissions).",
    imported,
    provider: "OPENAI",
  };
}
