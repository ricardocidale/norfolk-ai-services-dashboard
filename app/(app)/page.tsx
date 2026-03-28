import { DashboardApp } from "@/components/dashboard/dashboard-app";
import type { DashboardSnapshot } from "@/components/dashboard/dashboard-app";
import { SetupNotice } from "@/components/setup-notice";
import { getVendorSpendAnalytics } from "@/lib/analytics/vendor-spend";
import { prisma } from "@/lib/db";
import { compareProviderSpendDesc } from "@/lib/sort-vendors";

export const dynamic = "force-dynamic";

async function loadSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const [expenses, byProvider, byAccount, agg, vendorSpend] =
      await Promise.all([
        prisma.expense.findMany({
          orderBy: { incurredAt: "desc" },
          take: 120,
        }),
        prisma.expense.groupBy({
          by: ["provider"],
          _sum: { amount: true },
          _count: true,
        }),
        prisma.expense.groupBy({
          by: ["billingAccount"],
          _sum: { amount: true },
          _count: true,
        }),
        prisma.expense.aggregate({
          _sum: { amount: true },
          _count: true,
        }),
        getVendorSpendAnalytics(),
      ]);

    return {
      expenses: expenses.map((e) => ({
        id: e.id,
        provider: e.provider,
        billingAccount: e.billingAccount,
        amount: e.amount.toString(),
        currency: e.currency,
        incurredAt: e.incurredAt.toISOString(),
        label: e.label,
        source: e.source,
      })),
      byProvider: byProvider
        .map((r) => ({
          provider: r.provider,
          sum: r._sum.amount?.toString() ?? "0",
          count: r._count,
        }))
        .sort((a, b) =>
          compareProviderSpendDesc(
            { provider: a.provider, amount: Number(a.sum) },
            { provider: b.provider, amount: Number(b.sum) },
          ),
        ),
      byAccount: byAccount.map((r) => ({
        billingAccount: r.billingAccount,
        sum: r._sum.amount?.toString() ?? "0",
        count: r._count,
      })),
      totalAmount: agg._sum.amount?.toString() ?? "0",
      expenseCount: agg._count,
      vendorSpend,
    };
  } catch {
    return null;
  }
}

export default async function Home() {
  const initial = await loadSnapshot();

  return (
    <div className="min-h-full">
      {initial ? (
        <DashboardApp initial={initial} />
      ) : (
        <SetupNotice />
      )}
    </div>
  );
}
