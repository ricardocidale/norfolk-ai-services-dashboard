import type { BillingAccount } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { SyncWriteBatch } from "@/lib/integrations/sync-prisma-batch";
import {
  defaultSyncRangeEnd,
  defaultSyncRangeStart,
} from "@/lib/integrations/sync-range";
import { openaiApiKeyFromEnv } from "@/lib/integrations/openai-env";
import {
  openaiOrganizationCostsUrl,
  openaiOrganizationUsageUrl,
} from "@/lib/integrations/openai-constants";
import type { SyncResult } from "./types";

/**
 * Organization costs + usage breakdowns: completions, embeddings, images.
 * Prefer OPENAI_ADMIN_KEY; OPENAI_API_KEY works if scopes allow.
 * Optional OPENAI_ORG_ID when the key belongs to multiple orgs.
 * @see https://platform.openai.com/docs/api-reference/usage/costs
 * @see https://platform.openai.com/docs/api-reference/usage/completions
 * @see https://platform.openai.com/docs/api-reference/usage/embeddings
 * @see https://platform.openai.com/docs/api-reference/usage/images
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

type EmbeddingsAgg = {
  input_tokens: number;
  num_model_requests: number;
};

type ImagesAgg = {
  num_model_requests: number;
};

type OpenAiUsageNotes = {
  source: "openai_org_usage";
  completions: UsageAgg;
  embeddings: EmbeddingsAgg;
  images: ImagesAgg;
};

type UsageBucket = {
  start_time?: number;
  results?: unknown;
  result?: unknown;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_COST_BUCKETS = 31;

function orgHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const org = process.env.OPENAI_ORG_ID?.trim();
  if (org) headers["OpenAI-Organization"] = org;
  return headers;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pickNum(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
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

function emptyEmbeddingsAgg(): EmbeddingsAgg {
  return { input_tokens: 0, num_model_requests: 0 };
}

function emptyImagesAgg(): ImagesAgg {
  return { num_model_requests: 0 };
}

function addAgg(a: UsageAgg, r: CompletionsResult): void {
  a.input_tokens += r.input_tokens ?? 0;
  a.output_tokens += r.output_tokens ?? 0;
  a.num_model_requests += r.num_model_requests ?? 0;
  a.input_cached_tokens += r.input_cached_tokens ?? 0;
  a.input_audio_tokens += r.input_audio_tokens ?? 0;
  a.output_audio_tokens += r.output_audio_tokens ?? 0;
}

function addEmbeddingsAgg(a: EmbeddingsAgg, r: Record<string, unknown>): void {
  a.input_tokens += pickNum(r, "input_tokens");
  a.num_model_requests += pickNum(r, "num_model_requests");
}

function addImagesAgg(a: ImagesAgg, r: Record<string, unknown>): void {
  a.num_model_requests += pickNum(r, "num_model_requests");
}

function bucketResultRows(bucket: UsageBucket): Record<string, unknown>[] {
  const r = bucket.results ?? bucket.result;
  if (!Array.isArray(r)) return [];
  return r.filter(
    (x): x is Record<string, unknown> =>
      x != null && typeof x === "object" && !Array.isArray(x),
  );
}

function usageNotesPayload(
  completions: UsageAgg,
  embeddings: EmbeddingsAgg,
  images: ImagesAgg,
): string {
  const payload: OpenAiUsageNotes = {
    source: "openai_org_usage",
    completions,
    embeddings,
    images,
  };
  return JSON.stringify(payload);
}

function hasAnyOrgUsage(
  c: UsageAgg,
  e: EmbeddingsAgg,
  i: ImagesAgg,
): boolean {
  return (
    totalCompletionTokens(c) > 0 ||
    e.input_tokens > 0 ||
    e.num_model_requests > 0 ||
    i.num_model_requests > 0
  );
}

function totalCompletionTokens(agg: UsageAgg): number {
  return (
    agg.input_tokens +
    agg.output_tokens +
    agg.input_cached_tokens +
    agg.input_audio_tokens +
    agg.output_audio_tokens
  );
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

async function fetchCostBucketsChunk(
  headers: Record<string, string>,
  startSec: number,
  endSec: number,
): Promise<CostBucket[]> {
  const out: CostBucket[] = [];
  let page: string | null | undefined;

  do {
    const url = new URL(openaiOrganizationCostsUrl());
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

async function fetchOrganizationUsageIntoMap<T>(
  headers: Record<string, string>,
  endpoint: "completions" | "embeddings" | "images",
  startSec: number,
  endSec: number,
  empty: () => T,
  addRow: (agg: T, row: Record<string, unknown>) => void,
): Promise<Map<string, T>> {
  const byDay = new Map<string, T>();

  for (const { chunkStart, chunkEnd } of timeChunks(
    new Date(startSec * 1000),
    new Date(endSec * 1000),
    MAX_COST_BUCKETS * DAY_MS,
  )) {
    const c0 = Math.floor(chunkStart.getTime() / 1000);
    const c1 = Math.floor(chunkEnd.getTime() / 1000);
    let page: string | null | undefined;

    do {
      const url = new URL(openaiOrganizationUsageUrl(endpoint));
      url.searchParams.set("start_time", String(c0));
      url.searchParams.set("end_time", String(c1));
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", String(MAX_COST_BUCKETS));
      if (page) url.searchParams.set("page", page);

      const res = await fetch(url.toString(), { headers, cache: "no-store" });
      const raw = await res.text();
      if (!res.ok) {
        throw new Error(
          `OpenAI ${endpoint} usage API ${res.status}: ${raw.slice(0, 400)}`,
        );
      }
      const parsed = JSON.parse(raw) as {
        data?: UsageBucket[];
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
          agg = empty();
          byDay.set(key, agg);
        }
        for (const row of bucketResultRows(bucket)) addRow(agg, row);
      }

      page = parsed.next_page ?? null;
    } while (page);
  }

  return byDay;
}

function getUsageTriplet(
  dayKey: string,
  completionsByDay: Map<string, UsageAgg>,
  embeddingsByDay: Map<string, EmbeddingsAgg>,
  imagesByDay: Map<string, ImagesAgg>,
): { c: UsageAgg; e: EmbeddingsAgg; i: ImagesAgg } {
  return {
    c: completionsByDay.get(dayKey) ?? emptyAgg(),
    e: embeddingsByDay.get(dayKey) ?? emptyEmbeddingsAgg(),
    i: imagesByDay.get(dayKey) ?? emptyImagesAgg(),
  };
}

function isLikelyMissingUsageScope(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("openai completions usage api 403") ||
    m.includes("insufficient permissions") ||
    m.includes("missing scopes") ||
    m.includes("api.usage.read")
  );
}

export async function syncOpenAIUsage(options: {
  billingAccount: BillingAccount;
  startTime?: Date;
  endTime?: Date;
}): Promise<SyncResult> {
  const apiKey = openaiApiKeyFromEnv();
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
  const usageWarnings: string[] = [];

  let completionsByDay = new Map<string, UsageAgg>();
  try {
    completionsByDay = await fetchOrganizationUsageIntoMap(
      headers,
      "completions",
      startSec,
      endSec,
      emptyAgg,
      (agg, row) => addAgg(agg, row as CompletionsResult),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isLikelyMissingUsageScope(msg)) {
      usageWarnings.push(
        "completions usage omitted: key missing api.usage.read scope",
      );
    } else {
      return {
        ok: false,
        message: msg,
        imported: 0,
        provider: "OPENAI",
      };
    }
  }

  let embeddingsByDay = new Map<string, EmbeddingsAgg>();
  try {
    embeddingsByDay = await fetchOrganizationUsageIntoMap(
      headers,
      "embeddings",
      startSec,
      endSec,
      emptyEmbeddingsAgg,
      addEmbeddingsAgg,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    usageWarnings.push(`embeddings omitted: ${msg.slice(0, 200)}`);
  }

  let imagesByDay = new Map<string, ImagesAgg>();
  try {
    imagesByDay = await fetchOrganizationUsageIntoMap(
      headers,
      "images",
      startSec,
      endSec,
      emptyImagesAgg,
      addImagesAgg,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    usageWarnings.push(`images omitted: ${msg.slice(0, 200)}`);
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

    const { c, e, i } = getUsageTriplet(
      dayKey,
      completionsByDay,
      embeddingsByDay,
      imagesByDay,
    );
    const notes = hasAnyOrgUsage(c, e, i)
      ? usageNotesPayload(c, e, i)
      : null;

    if (dayTotal.isZero() && !hasAnyOrgUsage(c, e, i)) continue;

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
              ? "OpenAI org cost + usage (completions / embeddings / images)"
              : "OpenAI org usage — no cost bucket (API sync)",
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
              ? "OpenAI org cost + usage (completions / embeddings / images)"
              : "OpenAI org usage — no cost bucket (API sync)",
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

  const usageDayKeys = new Set<string>([
    ...completionsByDay.keys(),
    ...embeddingsByDay.keys(),
    ...imagesByDay.keys(),
  ]);

  for (const dayKey of usageDayKeys) {
    if (costDaysSeen.has(dayKey)) continue;
    const { c, e, i } = getUsageTriplet(
      dayKey,
      completionsByDay,
      embeddingsByDay,
      imagesByDay,
    );
    if (!hasAnyOrgUsage(c, e, i)) continue;

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
          label: "OpenAI org usage only (API sync)",
          source: "openai_api",
          externalRef,
          notes: usageNotesPayload(c, e, i),
        },
        update: {
          billingAccount: options.billingAccount,
          periodStart: dayDate,
          periodEnd: nextDay,
          notes: usageNotesPayload(c, e, i),
        },
      }),
    );
    imported += 1;
  }

  await batch.flush();

  const warnSuffix =
    usageWarnings.length > 0 ? ` Warnings: ${usageWarnings.join(" ")}` : "";

  await prisma.syncRun.create({
    data: {
      provider: "OPENAI",
      ok: true,
      message: `Imported ${imported} row(s) (costs + completions/embeddings/images usage).${warnSuffix}`,
      imported,
      finishedAt: new Date(),
    },
  });

  return {
    ok: true,
    message:
      imported > 0
        ? `Upserted ${imported} row(s) from OpenAI (costs + org usage).${warnSuffix}`
        : `No cost or org usage in range (check org key permissions).${warnSuffix}`,
    imported,
    provider: "OPENAI",
  };
}
