import { DashboardApp } from "@/components/dashboard/dashboard-app";
import type { DashboardSnapshot } from "@/components/dashboard/dashboard-app";
import { SetupNotice } from "@/components/setup-notice";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { getVendorSpendAnalytics } from "@/lib/analytics/vendor-spend";
import { prisma } from "@/lib/db";
import { compareProviderSpendDesc } from "@/lib/vendors/sort-vendors";

export const dynamic = "force-dynamic";

async function loadSnapshot(): Promise<DashboardSnapshot | null> {
  try {
    const [byProvider, byAccount, agg, vendorSpend] = await Promise.all([
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
  const [initial, showAdminSourcesLink] = await Promise.all([
    loadSnapshot(),
    isAppAdmin(),
  ]);

  return (
    <div className="min-h-full">
      {initial ? (
        <DashboardApp
          initial={initial}
          showAdminSourcesLink={showAdminSourcesLink}
        />
      ) : (
        <SetupNotice />
      )}
    </div>
  );
}
