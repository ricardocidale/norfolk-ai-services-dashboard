import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [totals, byProvider, byAccount, lastSyncs] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      _count: true,
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
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    totalAmount: totals._sum.amount?.toString() ?? "0",
    expenseCount: totals._count,
    byProvider: byProvider.map((r) => ({
      provider: r.provider,
      sum: r._sum.amount?.toString() ?? "0",
      count: r._count,
    })),
    byAccount: byAccount.map((r) => ({
      billingAccount: r.billingAccount,
      sum: r._sum.amount?.toString() ?? "0",
      count: r._count,
    })),
    recentSyncs: lastSyncs,
  });
}
