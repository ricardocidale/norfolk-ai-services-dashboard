import type { BillingAccount } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { SyncWriteBatch } from "@/lib/integrations/sync-prisma-batch";
import {
  defaultSyncRangeEnd,
  defaultSyncRangeStart,
} from "@/lib/integrations/sync-range";
import type { SyncResult } from "./types";

/**
 * Pulls organization cost buckets and completions token usage from OpenAI.
 * Prefer OPENAI_ADMIN_KEY (organization admin); OPENAI_API_KEY works if it has usage scope.
 * Optional OPENAI_ORG_ID header when the key belongs to multiple orgs.
 * @see https://platform.openai.com/docs/api-reference/usage/costs
 * @see https://platform.openai.com/docs/api-reference/usage/completions
 */

type CostBucket = {
  start_time?: number;
  end_time?: number;
  results?: Array<{ amount?: { value?: number; currency?: string } }>;
};

type CompletionsResult = {
  input_tokens?: number;
  output_tokens?: number;
  num_model_requests?: number;
  input_cached_tokens?: number;
  input_audio_tokens?: number;
  output_audio_tokens?: number;
};

type UsageAgg = {
  input_tokens: number;
  output_tokens: number;
  num_model_requests: number;
  input_cached_tokens: number;
  input_audio_tokens: number;
  output_audio_tokens: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_COST_BUCKETS = 31;

function orgHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const org = process.env.OPENAI_ORG_ID;
  if (org) headers["OpenAI-Organization"] = org;
  return headers;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyAgg(): UsageAgg {
  return {
    input_tokens: 0,
    output_tokens: 0,
    num_model_requests: 0,
    input_cached_tokens: 0,
    input_audio_tokens: 0,
    output_audio_tokens: 0,
  };
}

function addAgg(a: UsageAgg, r: CompletionsResult): void {
  a.input_tokens += r.input_tokens ?? 0;
  a.output_tokens += r.output_tokens ?? 0;
  a.num_model_requests += r.num_model_requests ?? 0;
  a.input_cached_tokens += r.input_cached_tokens ?? 0;
  a.input_audio_tokens += r.input_audio_tokens ?? 0;
  a.output_audio_tokens += r.output_audio_tokens ?? 0;
}

function usageNotes(agg: UsageAgg): string {
  return JSON.stringify({
    source: "openai_completions_usage",
    ...agg,
  });
}

function* timeChunks(
  start: Date,
  end: Date,
  maxSpanMs: number,
): Generator<{ chunkStart: Date; chunkEnd: Date }> {
  let cur = new Date(start.getTime());
  while (cur.getTime() < end.getTime()) {
    const chunkEnd = new Date(
      Math.min(cur.getTime() + maxSpanMs, end.getTime()),
    );
    yield { chunkStart: cur, chunkEnd };
    cur = chunkEnd;
  }
}

/**
 * OpenAI organization costs are paginated (`next_page` → `page`), same as completions usage.
 * Without paging, only the first `limit` buckets per window are returned — incomplete spend.
 */
async function fetchCostBucketsChunk(
  headers: Record<string, string>,
  startSec: number,
  endSec: number,
): Promise<CostBucket[]> {
  const out: CostBucket[] = [];
  let page: string | null | undefined;

  do {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(startSec));
    url.searchParams.set("end_time", String(endSec));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", String(MAX_COST_BUCKETS));
    if (page) url.searchParams.set("page", page);

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`OpenAI costs API ${res.status}: ${raw.slice(0, 400)}`);
    }
    const parsed = JSON.parse(raw) as {
      data?: CostBucket[];
      next_page?: string | null;
    };
    out.push(...(Array.isArray(parsed.data) ? parsed.data : []));
    page = parsed.next_page ?? null;
  } while (page);

  return mergeCostBucketsByDay(out);
}

/** If the API returns multiple rows for the same UTC day across pages, merge line items. */
function mergeCostBucketsByDay(buckets: CostBucket[]): CostBucket[] {
  const map = new Map<string, CostBucket>();
  for (const b of buckets) {
    const st = b.start_time;
    if (st == null) continue;
    const key = utcDayKey(new Date(st * 1000));
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        start_time: b.start_time,
        end_time: b.end_time,
        results: [...(b.results ?? [])],
      });
      continue;
    }
    prev.results = [...(prev.results ?? []), ...(b.results ?? [])];
    if (b.end_time != null) {
      prev.end_time = Math.max(prev.end_time ?? 0, b.end_time);
    }
  }
  return [...map.values()];
}

async function fetchAllCompletionsUsage(
  headers: Record<string, string>,
  startSec: number,
  endSec: number,
): Promise<Map<string, UsageAgg>> {
  const byDay = new Map<string, UsageAgg>();

  for (const { chunkStart, chunkEnd } of timeChunks(
    new Date(startSec * 1000),
    new Date(endSec * 1000),
    MAX_COST_BUCKETS * DAY_MS,
  )) {
    const c0 = Math.floor(chunkStart.getTime() / 1000);
    const c1 = Math.floor(chunkEnd.getTime() / 1000);
    let page: string | null | undefined;

    do {
      const url = new URL(
        "https://api.openai.com/v1/organization/usage/completions",
      );
      url.searchParams.set("start_time", String(c0));
      url.searchParams.set("end_time", String(c1));
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", String(MAX_COST_BUCKETS));
      if (page) url.searchParams.set("page", page);

      const res = await fetch(url.toString(), { headers, cache: "no-store" });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(
          `OpenAI completions usage API ${res.status}: ${raw.slice(0, 400)}`,
        );
      }
      const parsed = JSON.parse(raw) as {
        data?: Array<{
          start_time?: number;
          results?: CompletionsResult[];
        }>;
        next_page?: string | null;
      };

      for (const bucket of parsed.data ?? []) {
        const bucketStart = bucket.start_time
          ? new Date(bucket.start_time * 1000)
          : null;
        if (!bucketStart) continue;
        const key = utcDayKey(bucketStart);
        let agg = byDay.get(key);
        if (!agg) {
          agg = emptyAgg();
          byDay.set(key, agg);
        }
        for (const r of bucket.results ?? []) addAgg(agg, r);
      }

      page = parsed.next_page ?? null;
    } while (page);
  }

  return byDay;
}

function totalTokens(agg: UsageAgg): number {
  return (
    agg.input_tokens +
    agg.output_tokens +
    agg.input_cached_tokens +
    agg.input_audio_tokens +
    agg.output_audio_tokens
  );
}

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

  const end = options.endTime ?? defaultSyncRangeEnd();
  const start = options.startTime ?? defaultSyncRangeStart(end);
  const startSec = Math.floor(start.getTime() / 1000);
  const endSec = Math.floor(end.getTime() / 1000);
  const headers = orgHeaders(apiKey);

  let usageByDay: Map<string, UsageAgg>;
  try {
    usageByDay = await fetchAllCompletionsUsage(headers, startSec, endSec);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg,
      imported: 0,
      provider: "OPENAI",
    };
  }

  const allBuckets: CostBucket[] = [];
  try {
    for (const { chunkStart, chunkEnd } of timeChunks(
      start,
      end,
      MAX_COST_BUCKETS * DAY_MS,
    )) {
      const s = Math.floor(chunkStart.getTime() / 1000);
      const e2 = Math.floor(chunkEnd.getTime() / 1000);
      const part = await fetchCostBucketsChunk(headers, s, e2);
      allBuckets.push(...part);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg,
      imported: 0,
      provider: "OPENAI",
    };
  }

  let imported = 0;
  const costDaysSeen = new Set<string>();
  const batch = new SyncWriteBatch(prisma);

  for (const bucket of allBuckets) {
    const bucketStart = bucket.start_time
      ? new Date(bucket.start_time * 1000)
      : start;
    const bucketEnd = bucket.end_time
      ? new Date(bucket.end_time * 1000)
      : end;
    const dayKey = utcDayKey(bucketStart);
    const results = bucket.results ?? [];
    let dayTotal = new Decimal(0);
    let currency = "USD";
    for (const r of results) {
      const v = r.amount?.value;
      if (typeof v === "number" && Number.isFinite(v)) dayTotal = dayTotal.plus(v);
      if (r.amount?.currency) currency = r.amount.currency;
    }

    const usage = usageByDay.get(dayKey) ?? emptyAgg();
    const notes =
      totalTokens(usage) > 0 ? usageNotes(usage) : null;

    if (dayTotal.isZero() && totalTokens(usage) === 0) continue;

    costDaysSeen.add(dayKey);
    const externalRef = `openai-cost-${dayKey}`;
    const amountStr = dayTotal.gt(0) ? dayTotal.toFixed(4) : "0";

    await batch.addAndFlush(
      prisma.expense.upsert({
        where: {
          provider_externalRef: { provider: "OPENAI", externalRef },
        },
        create: {
          provider: "OPENAI",
          billingAccount: options.billingAccount,
          amount: amountStr,
          currency,
          incurredAt: bucketStart,
          periodStart: bucketStart,
          periodEnd: bucketEnd,
          label:
            dayTotal.gt(0)
              ? "OpenAI organization costs + completions usage (API sync)"
              : "OpenAI completions usage — no cost bucket (API sync)",
          source: "openai_api",
          externalRef,
          notes,
        },
        update: {
          amount: amountStr,
          currency,
          periodStart: bucketStart,
          periodEnd: bucketEnd,
          billingAccount: options.billingAccount,
          notes,
          label:
            dayTotal.gt(0)
              ? "OpenAI organization costs + completions usage (API sync)"
              : "OpenAI completions usage — no cost bucket (API sync)",
        },
      }),
    );

    await batch.addAndFlush(
      prisma.expense.deleteMany({
        where: {
          provider: "OPENAI",
          externalRef: `openai-usage-${dayKey}`,
        },
      }),
    );

    imported += 1;
  }

  await batch.flush();

  for (const [dayKey, usage] of usageByDay) {
    if (costDaysSeen.has(dayKey) || totalTokens(usage) === 0) continue;

    const dayDate = new Date(`${dayKey}T00:00:00.000Z`);
    const nextDay = new Date(dayDate.getTime() + DAY_MS);
    const externalRef = `openai-usage-${dayKey}`;

    await batch.addAndFlush(
      prisma.expense.upsert({
        where: {
          provider_externalRef: { provider: "OPENAI", externalRef },
        },
        create: {
          provider: "OPENAI",
          billingAccount: options.billingAccount,
          amount: "0",
          currency: "USD",
          incurredAt: dayDate,
          periodStart: dayDate,
          periodEnd: nextDay,
          label: "OpenAI completions usage only (API sync)",
          source: "openai_api",
          externalRef,
          notes: usageNotes(usage),
        },
        update: {
          billingAccount: options.billingAccount,
          periodStart: dayDate,
          periodEnd: nextDay,
          notes: usageNotes(usage),
        },
      }),
    );
    imported += 1;
  }

  await batch.flush();

  await prisma.syncRun.create({
    data: {
      provider: "OPENAI",
      ok: true,
      message: `Imported ${imported} row(s) (costs + completions usage).`,
      imported,
      finishedAt: new Date(),
    },
  });

  return {
    ok: true,
    message:
      imported > 0
        ? `Upserted ${imported} row(s) from OpenAI (costs and token usage).`
        : "No cost or completions usage in range (check org key permissions).",
    imported,
    provider: "OPENAI",
  };
}
