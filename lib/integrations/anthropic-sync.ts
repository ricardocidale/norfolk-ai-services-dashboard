import type { BillingAccount } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { SyncWriteBatch } from "@/lib/integrations/sync-prisma-batch";
import {
  defaultSyncRangeEnd,
  defaultSyncRangeStart,
} from "@/lib/integrations/sync-range";
import type { SyncResult } from "./types";
import {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_OUTBOUND_USER_AGENT,
} from "@/lib/integrations/anthropic-constants";

/**
 * Anthropic organization Usage & Cost Admin API (Claude API spend).
 * Requires an Admin API key (sk-ant-admin…) from Console → Admin keys.
 * Standard API keys cannot call these endpoints.
 *
 * Supports syncing multiple Anthropic organizations by passing different
 * `apiKey` values and `orgLabel` strings (used in externalRef to avoid
 * collisions between orgs).
 *
 * @see https://docs.anthropic.com/en/api/usage-cost-api
 */

const BASE = "https://api.anthropic.com";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_1D_BUCKETS = 31;

type UsageAgg = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  server_tool_use: number;
};

type ModelCostEntry = {
  model: string;
  costType: string;
  tokenType: string | null;
  amountCents: number;
};

function adminKey(): string | undefined {
  const a = process.env.ANTHROPIC_ADMIN_API_KEY?.trim();
  const b = process.env.ANTHROPIC_API_KEY?.trim();
  return a || b || undefined;
}

/** Admin key for the NORFOLK_AI organization (ricardo.cidale@norfolk.ai). */
export function norfolkAiAdminKey(): string | undefined {
  return process.env.ANTHROPIC_NORFOLK_AI_ADMIN_KEY?.trim() || undefined;
}

function headers(apiKey: string): Record<string, string> {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_API_VERSION,
    "content-type": "application/json",
    "user-agent": ANTHROPIC_OUTBOUND_USER_AGENT,
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

function usageNotes(
  agg: UsageAgg,
  modelBreakdown?: ModelCostEntry[],
): string {
  const obj: Record<string, unknown> = {
    source: "anthropic_messages_usage_report",
    ...agg,
    total_tokens: totalTokens(agg),
  };
  if (modelBreakdown && modelBreakdown.length > 0) {
    const byModel: Record<string, number> = {};
    for (const e of modelBreakdown) {
      byModel[e.model] = (byModel[e.model] ?? 0) + e.amountCents;
    }
    obj.models_used = Object.keys(byModel);
    obj.cost_by_model = Object.fromEntries(
      Object.entries(byModel).map(([m, cents]) => [
        m,
        `$${(cents / 100).toFixed(4)}`,
      ]),
    );
  }
  return JSON.stringify(obj);
}

function extractModelCostEntries(
  results: Record<string, unknown>[],
): ModelCostEntry[] {
  const entries: ModelCostEntry[] = [];
  for (const r of results) {
    const model =
      typeof r.model === "string" ? r.model : "unknown";
    const costType =
      typeof r.cost_type === "string" ? r.cost_type : "tokens";
    const tokenType =
      typeof r.token_type === "string" ? r.token_type : null;
    const amountCents = readCentsFromResult(r);
    if (amountCents !== 0) {
      entries.push({ model, costType, tokenType, amountCents });
    }
  }
  return entries;
}

function readCentsFromResult(r: Record<string, unknown>): number {
  const readCents = (v: unknown): number | null => {
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  };

  return readCents(r.amount) ?? readCents(r.cost) ?? readCents(r.total_cost) ?? 0;
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
  url.searchParams.append("group_by[]", "description");
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
  /** Pass an explicit admin key to sync a specific org (multi-org support). */
  apiKey?: string;
  /** Short label appended to externalRef to avoid collisions between orgs (e.g. "nai"). */
  orgLabel?: string;
}): Promise<SyncResult> {
  const apiKey = options.apiKey ?? adminKey();
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

  const orgSuffix = options.orgLabel ? `-${options.orgLabel}` : "";
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

    const modelEntries = extractModelCostEntries(list);
    const modelsUsed = [...new Set(modelEntries.map((e) => e.model))].filter(
      (m) => m !== "unknown",
    );

    const usage = usageMap.get(dayKey) ?? emptyAgg();
    const notes =
      totalTokens(usage) > 0 || modelEntries.length > 0
        ? usageNotes(usage, modelEntries)
        : null;

    if (dayUsd.isZero() && totalTokens(usage) === 0) continue;

    costDaysSeen.add(dayKey);
    const externalRef = `anthropic-cost-${dayKey}${orgSuffix}`;
    const amountStr = dayUsd.gt(0) ? dayUsd.toFixed(4) : "0";

    const modelLabel =
      modelsUsed.length > 0 ? ` [${modelsUsed.join(", ")}]` : "";
    const costLabel = dayUsd.gt(0)
      ? `Anthropic API${modelLabel} — $${dayUsd.toFixed(2)} cost + usage`
      : `Anthropic API${modelLabel} — usage only (no cost)`;

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
          label: costLabel,
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
          label: costLabel,
        },
      }),
    );

    const legacyRef = `anthropic-usage-${dayKey}${orgSuffix}`;
    await batch.addAndFlush(
      prisma.expense.deleteMany({
        where: {
          provider: "ANTHROPIC",
          externalRef: legacyRef,
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
    const externalRef = `anthropic-usage-${dayKey}${orgSuffix}`;

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
          label: "Anthropic message usage only",
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

  const orgNote = options.orgLabel ? ` (org: ${options.orgLabel})` : "";
  await prisma.syncRun.create({
    data: {
      provider: "ANTHROPIC",
      ok: true,
      message: `Imported ${imported} row(s) (cost_report + usage_report/messages)${orgNote}.`,
      imported,
      finishedAt: new Date(),
    },
  });

  return {
    ok: true,
    message:
      imported > 0
        ? `Upserted ${imported} row(s) from Anthropic${orgNote} (cost and token usage).`
        : `No cost or usage in range${orgNote} (check Admin API key and organization).`,
    imported,
    provider: "ANTHROPIC",
  };
}
