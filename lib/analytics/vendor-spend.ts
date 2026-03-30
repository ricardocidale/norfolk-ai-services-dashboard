import type { AiProvider } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db";
import { compareProviderSpendDesc } from "@/lib/vendors/sort-vendors";
import {
  PROVIDER_META,
  providerCategory,
  providerMeta,
} from "@/lib/vendors/providers-meta";
import type { VendorCategory } from "@/lib/vendors/vendor-categories";
import { VENDOR_CATEGORY_LABEL } from "@/lib/vendors/vendor-categories";

const PROVIDER_ORDER: AiProvider[] = PROVIDER_META.map((p) => p.id);

export type MonthColumn = { key: string; label: string };

export type VendorRankRow = {
  rank: number;
  provider: AiProvider;
  label: string;
  category: VendorCategory;
  categoryLabel: string;
  total: string;
  /** Number of expense line items (usage proxy) */
  count: number;
};

export type CategorySpendRank = {
  rank: number;
  category: VendorCategory;
  categoryLabel: string;
  total: string;
  lineItemCount: number;
  vendorCount: number;
};

export type VendorSpendAnalytics = {
  asOf: string;
  timezoneNote: string;
  currentMonthLabel: string;
  currentMonthKey: string;
  /** M-1 (left) through M-11 (right), UTC calendar months — excludes current month */
  priorMonthColumns: MonthColumn[];
  /** First instant of the oldest month in the rolling 12 window (M-11) */
  windowStart: string;
  /** `asOf` — current month-to-date boundary */
  windowEnd: string;
  currentMonthByVendor: {
    provider: AiProvider;
    total: string;
    count: number;
  }[];
  /** True rolling 12: current month MTD + 11 prior completed months */
  rolling12ByVendor: {
    provider: AiProvider;
    total: string;
    count: number;
  }[];
  /** Per-vendor month grid: current month + 11 prior months */
  monthlyMatrix: {
    provider: AiProvider;
    byMonth: Record<string, { total: string; count: number }>;
    rowTotal: string;
    rowCount: number;
  }[];
  /** All month columns in display order: current month first, then M-1 … M-11 */
  allMonthColumns: MonthColumn[];
  /** Vendors with spend, ordered by rolling-12 cost (highest first) */
  costRankingRolling12: VendorRankRow[];
  /** Same window, ordered by line-item count (usage volume) */
  usageRankingRolling12: VendorRankRow[];
  /** Current UTC month MTD, cost order */
  costRankingCurrentMonth: VendorRankRow[];
  /** Current UTC month MTD, usage order */
  usageRankingCurrentMonth: VendorRankRow[];
  /** Rolling-12 spend rolled up by vendor category, cost order */
  categoryRankingRolling12: CategorySpendRank[];
};

function monthKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildVendorRankRows(
  rows: { provider: AiProvider; total: string; count: number }[],
  sortFn: (
    a: { provider: AiProvider; total: string; count: number },
    b: { provider: AiProvider; total: string; count: number },
  ) => number,
): VendorRankRow[] {
  const sorted = [...rows].sort(sortFn);
  return sorted.map((r, i) => {
    const cat = providerCategory(r.provider);
    return {
      rank: i + 1,
      provider: r.provider,
      label: providerMeta(r.provider)?.label ?? r.provider,
      category: cat,
      categoryLabel: VENDOR_CATEGORY_LABEL[cat],
      total: r.total,
      count: r.count,
    };
  });
}

function buildCategoryRanking(
  rows: { provider: AiProvider; total: string; count: number }[],
): CategorySpendRank[] {
  const agg = new Map<
    VendorCategory,
    { total: Decimal; lineItemCount: number; vendors: Set<AiProvider> }
  >();
  for (const r of rows) {
    if (Number(r.total) <= 0 && r.count <= 0) continue;
    const cat = providerCategory(r.provider);
    const cur = agg.get(cat) ?? {
      total: new Decimal(0),
      lineItemCount: 0,
      vendors: new Set<AiProvider>(),
    };
    cur.total = cur.total.plus(r.total);
    cur.lineItemCount += r.count;
    cur.vendors.add(r.provider);
    agg.set(cat, cur);
  }
  const list = [...agg.entries()]
    .map(([category, v]) => ({
      category,
      categoryLabel: VENDOR_CATEGORY_LABEL[category],
      total: v.total.toFixed(4),
      lineItemCount: v.lineItemCount,
      vendorCount: v.vendors.size,
    }))
    .sort((a, b) => Number(b.total) - Number(a.total));
  return list.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Eleven full calendar months **before** the current month, newest first.
 * Together with the current month these form the rolling-12 window.
 */
export function priorElevenMonthColumns(now: Date): MonthColumn[] {
  const cols: MonthColumn[] = [];
  for (let i = 1; i <= 11; i++) {
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

export async function getVendorSpendAnalytics(
  nowInput: Date = new Date(),
): Promise<VendorSpendAnalytics> {
  const now = nowInput;
  const cmStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const cmKey = monthKeyUTC(cmStart);

  const priorMonthCols = priorElevenMonthColumns(now);
  const oldestKey = priorMonthCols[priorMonthCols.length - 1]?.key;
  if (!oldestKey) {
    throw new Error("priorElevenMonthColumns must return 11 months");
  }
  const [oy, om] = oldestKey.split("-").map(Number);
  const windowStart = new Date(Date.UTC(oy, om - 1, 1, 0, 0, 0, 0));

  const cmShortLabel = cmStart.toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
  const currentMonthLabel = cmStart.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const allMonthColumns: MonthColumn[] = [
    { key: cmKey, label: cmShortLabel },
    ...priorMonthCols,
  ];

  const [priorExpenses, cmExpenses] = await Promise.all([
    prisma.expense.findMany({
      where: {
        incurredAt: {
          gte: windowStart,
          lt: cmStart,
        },
      },
      select: { provider: true, amount: true, incurredAt: true },
    }),
    prisma.expense.findMany({
      where: { incurredAt: { gte: cmStart, lte: now } },
      select: { provider: true, amount: true, incurredAt: true },
    }),
  ]);

  type Agg = { total: Decimal; count: number };
  const zeroAgg = (): Agg => ({ total: new Decimal(0), count: 0 });

  const cmByProv = new Map<AiProvider, Agg>();
  const matrix = new Map<AiProvider, Map<string, Agg>>();

  for (const p of PROVIDER_ORDER) {
    cmByProv.set(p, zeroAgg());
    const monthMap = new Map<string, Agg>();
    monthMap.set(cmKey, zeroAgg());
    for (const col of priorMonthCols) {
      monthMap.set(col.key, zeroAgg());
    }
    matrix.set(p, monthMap);
  }

  for (const e of priorExpenses) {
    const amt = new Decimal(e.amount.toString());
    const mk = monthKeyUTC(e.incurredAt);
    const cell = matrix.get(e.provider)?.get(mk);
    if (cell) {
      cell.total = cell.total.plus(amt);
      cell.count += 1;
    }
  }

  for (const e of cmExpenses) {
    const amt = new Decimal(e.amount.toString());
    const c = cmByProv.get(e.provider) ?? zeroAgg();
    c.total = c.total.plus(amt);
    c.count += 1;
    cmByProv.set(e.provider, c);

    const cell = matrix.get(e.provider)?.get(cmKey);
    if (cell) {
      cell.total = cell.total.plus(amt);
      cell.count += 1;
    }
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

  const monthlyMatrix = PROVIDER_ORDER.map((provider) => {
    const monthMap = matrix.get(provider)!;
    let rowTotal = new Decimal(0);
    let rowCount = 0;
    const byMonth: Record<string, { total: string; count: number }> = {};
    for (const col of allMonthColumns) {
      const cell = monthMap.get(col.key)!;
      byMonth[col.key] = {
        total: cell.total.toFixed(4),
        count: cell.count,
      };
      rowTotal = rowTotal.plus(cell.total);
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

  const rolling12ByVendor = monthlyMatrix
    .filter((r) => Number(r.rowTotal) > 0)
    .map((r) => ({
      provider: r.provider,
      total: r.rowTotal,
      count: r.rowCount,
    }));

  const currentMonthWithActivity = currentMonthByVendor.filter(
    (r) => Number(r.total) > 0 || r.count > 0,
  );

  const costRankingRolling12 = buildVendorRankRows(rolling12ByVendor, (a, b) =>
    compareProviderSpendDesc(
      { provider: a.provider, amount: Number(a.total) },
      { provider: b.provider, amount: Number(b.total) },
    ),
  );

  const usageRankingRolling12 = buildVendorRankRows(rolling12ByVendor, (a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return Number(b.total) - Number(a.total);
  });

  const costRankingCurrentMonth = buildVendorRankRows(
    currentMonthWithActivity,
    (a, b) =>
      compareProviderSpendDesc(
        { provider: a.provider, amount: Number(a.total) },
        { provider: b.provider, amount: Number(b.total) },
      ),
  );

  const usageRankingCurrentMonth = buildVendorRankRows(
    currentMonthWithActivity,
    (a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return Number(b.total) - Number(a.total);
    },
  );

  const categoryRankingRolling12 = buildCategoryRanking(rolling12ByVendor);

  return {
    asOf: now.toISOString(),
    timezoneNote:
      "Rolling 12 months: current month (MTD) plus 11 completed UTC calendar months.",
    currentMonthLabel,
    currentMonthKey: cmKey,
    priorMonthColumns: priorMonthCols,
    allMonthColumns,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    currentMonthByVendor,
    rolling12ByVendor,
    monthlyMatrix,
    costRankingRolling12,
    usageRankingRolling12,
    costRankingCurrentMonth,
    usageRankingCurrentMonth,
    categoryRankingRolling12,
  };
}
