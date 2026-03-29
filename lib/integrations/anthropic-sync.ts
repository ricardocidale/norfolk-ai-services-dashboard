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
 * Anthropic organization Usage & Cost Admin API (Claude API spend).
 * Requires an Admin API key (sk-ant-admin…) from Console → Admin keys.
 * Standard API keys cannot call these endpoints.
 *
 * @see https://docs.anthropic.com/en/api/usage-cost-api
 */

const BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_1D_BUCKETS = 31;

type UsageAgg = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  server_tool_use: number;
};

function adminKey(): string | undefined {
  const a = process.env.ANTHROPIC_ADMIN_API_KEY?.trim();
  const b = process.env.ANTHROPIC_API_KEY?.trim();
  return a || b || undefined;
}

function headers(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
    "user-agent": "NorfolkAISpendDashboard/1.0",
  };
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toIsoUtc(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function emptyAgg(): UsageAgg {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    server_tool_use: 0,
  };
}

function addUsageAgg(a: UsageAgg, r: Record<string, unknown>): void {
  const num = (k: string) => {
    const v = r[k];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  a.input_tokens += num("input_tokens");
  a.output_tokens += num("output_tokens");
  a.cache_creation_input_tokens += num("cache_creation_input_tokens");
  a.cache_read_input_tokens += num("cache_read_input_tokens");
  a.server_tool_use += num("server_tool_use");
}

function totalTokens(a: UsageAgg): number {
  return (
    a.input_tokens +
    a.output_tokens +
    a.cache_creation_input_tokens +
    a.cache_read_input_tokens +
    a.server_tool_use
  );
}

function usageNotes(agg: UsageAgg): string {
  return JSON.stringify({
    source: "anthropic_messages_usage_report",
    ...agg,
  });
}

/** Cost lines are USD in cents (string or number) per Anthropic docs. */
function dollarsFromCostResult(r: Record<string, unknown>): number {
  const fromCents = (c: number) =>
    Number.isFinite(c) ? Math.round(c) / 100 : 0;

  const readCents = (v: unknown): number | null => {
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  };

  const direct =
    readCents(r.cost) ??
    readCents(r.amount) ??
    readCents(r.total_cost) ??
    readCents(r.usd_amount);
  if (direct != null) return fromCents(direct);

  const amt = r.amount;
  if (amt && typeof amt === "object") {
    const o = amt as Record<string, unknown>;
    const c = readCents(o.value) ?? readCents(o.amount);
    if (c != null) return fromCents(c);
  }

  const costObj = r.cost_object;
  if (costObj && typeof costObj === "object") {
    const o = costObj as Record<string, unknown>;
    const c = readCents(o.amount) ?? readCents(o.value);
    if (c != null) return fromCents(c);
  }

  return 0;
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

function parseBucketTimes(bucket: Record<string, unknown>): {
  start: Date;
  end: Date;
} | null {
  const s =
    (typeof bucket.starting_at === "string" && bucket.starting_at) ||
    (typeof bucket.start_time === "string" && bucket.start_time) ||
    (typeof bucket.start === "string" && bucket.start);
  const e =
    (typeof bucket.ending_at === "string" && bucket.ending_at) ||
    (typeof bucket.end_time === "string" && bucket.end_time) ||
    (typeof bucket.end === "string" && bucket.end);
  if (!s) return null;
  const start = new Date(s);
  const end = e ? new Date(e) : new Date(start.getTime() + DAY_MS);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end };
}

async function fetchCostPage(
  apiKey: string,
  startingAt: string,
  endingAt: string,
  page?: string,
): Promise<{
  buckets: Record<string, unknown>[];
  nextPage: string | null;
}> {
  const url = new URL(`${BASE}/v1/organizations/cost_report`);
  url.searchParams.set("starting_at", startingAt);
  url.searchParams.set("ending_at", endingAt);
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", String(MAX_1D_BUCKETS));
  if (page) url.searchParams.set("page", page);

  const res = await fetch(url.toString(), {
    headers: headers(apiKey),
    cache: "no-store",
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic cost_report ${res.status}: ${raw.slice(0, 500)}`);
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const data = parsed.data;
  const buckets = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : [];
  const next =
    (typeof parsed.next_page === "string" && parsed.next_page) ||
    (typeof parsed.nextPage === "string" && parsed.nextPage) ||
    null;
  const hasMore = parsed.has_more === true;
  return {
    buckets,
    nextPage: hasMore && next ? next : null,
  };
}

/** Combine cost buckets that share the same UTC calendar day (pagination / API edge cases). */
function mergeAnthropicCostBucketsByDay(
  buckets: Record<string, unknown>[],
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const bucket of buckets) {
    const times = parseBucketTimes(bucket);
    if (!times) continue;
    const key = utcDayKey(times.start);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, bucket);
      continue;
    }
    const a = existing.results;
    const b = bucket.results;
    existing.results = [
      ...(Array.isArray(a) ? a : []),
      ...(Array.isArray(b) ? b : []),
    ];
  }
  return [...map.values()];
}

async function fetchAllCostBuckets(
  apiKey: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];

  for (const { chunkStart, chunkEnd } of timeChunks(
    rangeStart,
    rangeEnd,
    MAX_1D_BUCKETS * DAY_MS,
  )) {
    const startingAt = toIsoUtc(chunkStart);
    const endingAt = toIsoUtc(chunkEnd);
    let page: string | null | undefined;

    do {
      const { buckets, nextPage } = await fetchCostPage(
        apiKey,
        startingAt,
        endingAt,
        page ?? undefined,
      );
      out.push(...buckets);
      page = nextPage;
    } while (page);
  }

  return mergeAnthropicCostBucketsByDay(out);
}

async function fetchUsagePage(
  apiKey: string,
  startingAt: string,
  endingAt: string,
  page?: string,
): Promise<{
  buckets: Record<string, unknown>[];
  nextPage: string | null;
}> {
  const url = new URL(`${BASE}/v1/organizations/usage_report/messages`);
  url.searchParams.set("starting_at", startingAt);
  url.searchParams.set("ending_at", endingAt);
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", String(MAX_1D_BUCKETS));
  if (page) url.searchParams.set("page", page);

  const res = await fetch(url.toString(), {
    headers: headers(apiKey),
    cache: "no-store",
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(
      `Anthropic usage_report/messages ${res.status}: ${raw.slice(0, 500)}`,
    );
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const data = parsed.data;
  const buckets = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : [];
  const next =
    (typeof parsed.next_page === "string" && parsed.next_page) ||
    (typeof parsed.nextPage === "string" && parsed.nextPage) ||
    null;
  const hasMore = parsed.has_more === true;
  return {
    buckets,
    nextPage: hasMore && next ? next : null,
  };
}

async function usageByDay(
  apiKey: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Map<string, UsageAgg>> {
  const byDay = new Map<string, UsageAgg>();

  for (const { chunkStart, chunkEnd } of timeChunks(
    rangeStart,
    rangeEnd,
    MAX_1D_BUCKETS * DAY_MS,
  )) {
    const startingAt = toIsoUtc(chunkStart);
    const endingAt = toIsoUtc(chunkEnd);
    let page: string | null | undefined;

    do {
      const { buckets, nextPage } = await fetchUsagePage(
        apiKey,
        startingAt,
        endingAt,
        page ?? undefined,
      );

      for (const bucket of buckets) {
        const times = parseBucketTimes(bucket);
        if (!times) continue;
        const key = utcDayKey(times.start);
        let agg = byDay.get(key);
        if (!agg) {
          agg = emptyAgg();
          byDay.set(key, agg);
        }
        const results = bucket.results;
        if (!Array.isArray(results)) continue;
        for (const row of results) {
          if (row && typeof row === "object")
            addUsageAgg(agg, row as Record<string, unknown>);
        }
      }

      page = nextPage;
    } while (page);
  }

  return byDay;
}

export async function syncAnthropicUsage(options: {
  billingAccount: BillingAccount;
  startTime?: Date;
  endTime?: Date;
}): Promise<SyncResult> {
  const apiKey = adminKey();
  if (!apiKey) {
    return {
      ok: false,
      message:
        "Set ANTHROPIC_ADMIN_API_KEY (Console → Admin keys, sk-ant-admin…). Standard API keys cannot access Usage & Cost reports.",
      imported: 0,
      provider: "ANTHROPIC",
    };
  }

  const end = options.endTime ?? defaultSyncRangeEnd();
  const start = options.startTime ?? defaultSyncRangeStart(end);

  let usageMap: Map<string, UsageAgg>;
  let costBuckets: Record<string, unknown>[];

  try {
    usageMap = await usageByDay(apiKey, start, end);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg,
      imported: 0,
      provider: "ANTHROPIC",
    };
  }

  try {
    costBuckets = await fetchAllCostBuckets(apiKey, start, end);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: msg,
      imported: 0,
      provider: "ANTHROPIC",
    };
  }

  let imported = 0;
  const costDaysSeen = new Set<string>();
  const batch = new SyncWriteBatch(prisma);

  for (const bucket of costBuckets) {
    const times = parseBucketTimes(bucket);
    if (!times) continue;

    const dayKey = utcDayKey(times.start);
    const results = bucket.results;
    const list = Array.isArray(results)
      ? (results as Record<string, unknown>[])
      : [];

    let dayUsd = new Decimal(0);
    for (const r of list) {
      dayUsd = dayUsd.plus(dollarsFromCostResult(r));
    }

    const usage = usageMap.get(dayKey) ?? emptyAgg();
    const notes = totalTokens(usage) > 0 ? usageNotes(usage) : null;

    if (dayUsd.isZero() && totalTokens(usage) === 0) continue;

    costDaysSeen.add(dayKey);
    const externalRef = `anthropic-cost-${dayKey}`;
    const amountStr = dayUsd.gt(0) ? dayUsd.toFixed(4) : "0";

    await batch.addAndFlush(
      prisma.expense.upsert({
        where: {
          provider_externalRef: { provider: "ANTHROPIC", externalRef },
        },
        create: {
          provider: "ANTHROPIC",
          billingAccount: options.billingAccount,
          amount: amountStr,
          currency: "USD",
          incurredAt: times.start,
          periodStart: times.start,
          periodEnd: times.end,
          label:
            dayUsd.gt(0)
              ? "Anthropic API cost + message usage (Admin API sync)"
              : "Anthropic message usage — no cost bucket (Admin API sync)",
          source: "anthropic_admin_api",
          externalRef,
          notes,
        },
        update: {
          amount: amountStr,
          currency: "USD",
          periodStart: times.start,
          periodEnd: times.end,
          billingAccount: options.billingAccount,
          notes,
          label:
            dayUsd.gt(0)
              ? "Anthropic API cost + message usage (Admin API sync)"
              : "Anthropic message usage — no cost bucket (Admin API sync)",
        },
      }),
    );

    await batch.addAndFlush(
      prisma.expense.deleteMany({
        where: {
          provider: "ANTHROPIC",
          externalRef: `anthropic-usage-${dayKey}`,
        },
      }),
    );

    imported += 1;
  }

  await batch.flush();

  for (const [dayKey, usage] of usageMap) {
    if (costDaysSeen.has(dayKey) || totalTokens(usage) === 0) continue;

    const dayDate = new Date(`${dayKey}T00:00:00.000Z`);
    const nextDay = new Date(dayDate.getTime() + DAY_MS);
    const externalRef = `anthropic-usage-${dayKey}`;

    await batch.addAndFlush(
      prisma.expense.upsert({
        where: {
          provider_externalRef: { provider: "ANTHROPIC", externalRef },
        },
        create: {
          provider: "ANTHROPIC",
          billingAccount: options.billingAccount,
          amount: "0",
          currency: "USD",
          incurredAt: dayDate,
          periodStart: dayDate,
          periodEnd: nextDay,
          label: "Anthropic message usage only (Admin API sync)",
          source: "anthropic_admin_api",
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
      provider: "ANTHROPIC",
      ok: true,
      message: `Imported ${imported} row(s) (cost_report + usage_report/messages).`,
      imported,
      finishedAt: new Date(),
    },
  });

  return {
    ok: true,
    message:
      imported > 0
        ? `Upserted ${imported} row(s) from Anthropic (cost and token usage).`
        : "No cost or usage in range (check Admin API key and organization).",
    imported,
    provider: "ANTHROPIC",
  };
}
