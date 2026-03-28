import type { AiProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PROVIDER_META } from "@/lib/providers-meta";
import { compareProviderSpendDesc } from "@/lib/sort-vendors";

const PROVIDER_ORDER: AiProvider[] = PROVIDER_META.map((p) => p.id);

export type MonthColumn = { key: string; label: string };

export type VendorSpendAnalytics = {
  asOf: string;
  timezoneNote: string;
  currentMonthLabel: string;
  /** M-1 (left) through M-12 (right), UTC calendar months — excludes current month */
  priorMonthColumns: MonthColumn[];
  /** First instant of the oldest month in the grid (M-12) */
  windowStart: string;
  /** Last instant of the month before the current month (M-1) */
  windowEnd: string;
  currentMonthByVendor: {
    provider: AiProvider;
    total: string;
    count: number;
  }[];
  /** Cumulative per vendor: sum of the same 12 prior calendar months as the grid (excludes current month) */
  rollingTotalByVendor: {
    provider: AiProvider;
    total: string;
    count: number;
  }[];
  monthlyMatrix: {
    provider: AiProvider;
    byMonth: Record<string, { total: string; count: number }>;
    rowTotal: string;
    rowCount: number;
  }[];
};

function monthKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Twelve full calendar months **before** the current month, newest first.
 * Example: if today is March 2026 → Feb 2026, Jan 2026, Dec 2025, …, Mar 2025.
 */
export function priorTwelveMonthColumns(now: Date): MonthColumn[] {
  const cols: MonthColumn[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0, 0),
    );
    cols.push({
      key: monthKeyUTC(d),
      label: d.toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
    });
  }
  return cols;
}

/** End of the UTC day on the last day of the month *before* `now`'s calendar month */
function endOfMonthBeforeCurrentUTC(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999),
  );
}

export async function getVendorSpendAnalytics(
  nowInput: Date = new Date(),
): Promise<VendorSpendAnalytics> {
  const now = nowInput;
  const cmStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );

  const priorMonthCols = priorTwelveMonthColumns(now);
  const oldestKey = priorMonthCols[11]?.key;
  if (!oldestKey) {
    throw new Error("priorTwelveMonthColumns must return 12 months");
  }
  const [oy, om] = oldestKey.split("-").map(Number);
  const windowStart = new Date(Date.UTC(oy, om - 1, 1, 0, 0, 0, 0));
  const windowEnd = endOfMonthBeforeCurrentUTC(now);

  const currentMonthLabel = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const [priorExpenses, cmExpenses] = await Promise.all([
    prisma.expense.findMany({
      where: {
        incurredAt: { gte: windowStart, lte: windowEnd },
      },
      select: { provider: true, amount: true, incurredAt: true },
    }),
    prisma.expense.findMany({
      where: { incurredAt: { gte: cmStart, lte: now } },
      select: { provider: true, amount: true, incurredAt: true },
    }),
  ]);

  type Agg = { total: number; count: number };
  const zeroAgg = (): Agg => ({ total: 0, count: 0 });

  const cmByProv = new Map<AiProvider, Agg>();
  const rollByProv = new Map<AiProvider, Agg>();
  const matrix = new Map<AiProvider, Map<string, Agg>>();

  for (const p of PROVIDER_ORDER) {
    cmByProv.set(p, zeroAgg());
    rollByProv.set(p, zeroAgg());
    const monthMap = new Map<string, Agg>();
    for (const col of priorMonthCols) {
      monthMap.set(col.key, zeroAgg());
    }
    matrix.set(p, monthMap);
  }

  for (const e of priorExpenses) {
    const amt = Number(e.amount);
    const r = rollByProv.get(e.provider) ?? zeroAgg();
    r.total += amt;
    r.count += 1;
    rollByProv.set(e.provider, r);

    const mk = monthKeyUTC(e.incurredAt);
    const cell = matrix.get(e.provider)?.get(mk);
    if (cell) {
      cell.total += amt;
      cell.count += 1;
    }
  }

  for (const e of cmExpenses) {
    const amt = Number(e.amount);
    const c = cmByProv.get(e.provider) ?? zeroAgg();
    c.total += amt;
    c.count += 1;
    cmByProv.set(e.provider, c);
  }

  const currentMonthByVendor = PROVIDER_ORDER.map((provider) => {
    const a = cmByProv.get(provider)!;
    return {
      provider,
      total: a.total.toFixed(4),
      count: a.count,
    };
  }).sort((x, y) =>
    compareProviderSpendDesc(
      { provider: x.provider, amount: Number(x.total) },
      { provider: y.provider, amount: Number(y.total) },
    ),
  );

  const rollingTotalByVendor = PROVIDER_ORDER.map((provider) => {
    const a = rollByProv.get(provider)!;
    return {
      provider,
      total: a.total.toFixed(4),
      count: a.count,
    };
  }).sort((x, y) =>
    compareProviderSpendDesc(
      { provider: x.provider, amount: Number(x.total) },
      { provider: y.provider, amount: Number(y.total) },
    ),
  );

  const monthlyMatrix = PROVIDER_ORDER.map((provider) => {
    const monthMap = matrix.get(provider)!;
    let rowTotal = 0;
    let rowCount = 0;
    const byMonth: Record<string, { total: string; count: number }> = {};
    for (const col of priorMonthCols) {
      const cell = monthMap.get(col.key)!;
      byMonth[col.key] = {
        total: cell.total.toFixed(4),
        count: cell.count,
      };
      rowTotal += cell.total;
      rowCount += cell.count;
    }
    return {
      provider,
      byMonth,
      rowTotal: rowTotal.toFixed(4),
      rowCount,
    };
  }).sort((x, y) =>
    compareProviderSpendDesc(
      { provider: x.provider, amount: Number(x.rowTotal) },
      { provider: y.provider, amount: Number(y.rowTotal) },
    ),
  );

  return {
    asOf: now.toISOString(),
    timezoneNote:
      "The monthly grid uses twelve full UTC calendar months before the current month (current month is only on the first tab).",
    currentMonthLabel,
    priorMonthColumns: priorMonthCols,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    currentMonthByVendor,
    rollingTotalByVendor,
    monthlyMatrix,
  };
}
