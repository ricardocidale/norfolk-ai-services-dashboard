import type { AiProvider, BillingAccount } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BILLING_ACCOUNT_ORDER } from "@/lib/expenses/billing-accounts";
import { compareProviderSpendDesc } from "@/lib/vendors/sort-vendors";
import { providerMeta } from "@/lib/vendors/providers-meta";
import {
  getVendorSpendAnalytics,
  type VendorSpendAnalytics,
} from "@/lib/analytics/vendor-spend";

export type MonthSeriesPoint = {
  monthKey: string;
  label: string;
  total: number;
  lineCount: number;
};

export type TopVendorRow = {
  provider: AiProvider;
  label: string;
  total: number;
  count: number;
  pctOfRolling12: number;
};

export type AdminConsumptionReport = {
  vendorSpend: VendorSpendAnalytics;
  allTimeTotal: number;
  allTimeExpenseCount: number;
  byBillingAccount: {
    billingAccount: BillingAccount;
    sum: number;
    count: number;
    pctOfAllTime: number;
  }[];
  rolling12Total: number;
  rolling12LineCount: number;
  mtdTotal: number;
  mtdLineCount: number;
  priorFullMonthTotal: number;
  priorFullMonthKey: string | null;
  priorFullMonthLabel: string;
  monthSeriesChronological: MonthSeriesPoint[];
  topVendorsRolling12: TopVendorRow[];
};

function fullMonthLabelUtc(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sumMonthAcrossVendors(
  data: VendorSpendAnalytics,
  monthKey: string,
): { total: number; lineCount: number } {
  let total = 0;
  let lineCount = 0;
  for (const row of data.monthlyMatrix) {
    const cell = row.byMonth[monthKey];
    if (cell) {
      total += Number(cell.total);
      lineCount += cell.count;
    }
  }
  return { total, lineCount };
}

export async function getAdminConsumptionReport(): Promise<AdminConsumptionReport> {
  const [vendorSpend, totals, byAccount] = await Promise.all([
    getVendorSpendAnalytics(),
    prisma.expense.aggregate({
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ["billingAccount"],
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const allTimeTotal = Number(totals._sum.amount ?? 0);
  const allTimeExpenseCount = totals._count;

  const accountMap = new Map(
    byAccount.map((r) => [
      r.billingAccount,
      {
        sum: Number(r._sum.amount ?? 0),
        count: r._count,
      },
    ]),
  );

  const byBillingAccount = BILLING_ACCOUNT_ORDER.map((billingAccount) => {
    const row = accountMap.get(billingAccount) ?? { sum: 0, count: 0 };
    return {
      billingAccount,
      sum: row.sum,
      count: row.count,
      pctOfAllTime:
        allTimeTotal > 0 ? (row.sum / allTimeTotal) * 100 : 0,
    };
  });

  const rolling12Total = vendorSpend.rolling12ByVendor.reduce(
    (acc, r) => acc + Number(r.total),
    0,
  );
  const rolling12LineCount = vendorSpend.rolling12ByVendor.reduce(
    (acc, r) => acc + r.count,
    0,
  );

  const mtdTotal = vendorSpend.currentMonthByVendor.reduce(
    (acc, r) => acc + Number(r.total),
    0,
  );
  const mtdLineCount = vendorSpend.currentMonthByVendor.reduce(
    (acc, r) => acc + r.count,
    0,
  );

  const m1 = vendorSpend.priorMonthColumns[0];
  const priorFullMonthKey = m1?.key ?? null;
  const priorSlice = priorFullMonthKey
    ? sumMonthAcrossVendors(vendorSpend, priorFullMonthKey)
    : { total: 0, lineCount: 0 };
  const priorFullMonthLabel = m1 ? fullMonthLabelUtc(m1.key) : "—";

  const chronological = [...vendorSpend.allMonthColumns].reverse();
  const monthSeriesChronological: MonthSeriesPoint[] = chronological.map(
    (col) => {
      const { total, lineCount } = sumMonthAcrossVendors(
        vendorSpend,
        col.key,
      );
      return {
        monthKey: col.key,
        label: col.label,
        total,
        lineCount,
      };
    },
  );

  const topVendorsRolling12: TopVendorRow[] = vendorSpend.rolling12ByVendor
    .filter((r) => Number(r.total) > 0)
    .map((r) => ({
      provider: r.provider,
      label:
        providerMeta(r.provider)?.label ??
        r.provider.replaceAll("_", " "),
      total: Number(r.total),
      count: r.count,
      pctOfRolling12:
        rolling12Total > 0
          ? (Number(r.total) / rolling12Total) * 100
          : 0,
    }))
    .sort((a, b) =>
      compareProviderSpendDesc(
        { provider: a.provider, amount: a.total },
        { provider: b.provider, amount: b.total },
      ),
    );

  return {
    vendorSpend,
    allTimeTotal,
    allTimeExpenseCount,
    byBillingAccount,
    rolling12Total,
    rolling12LineCount,
    mtdTotal,
    mtdLineCount,
    priorFullMonthTotal: priorSlice.total,
    priorFullMonthKey,
    priorFullMonthLabel,
    monthSeriesChronological,
    topVendorsRolling12,
  };
}
