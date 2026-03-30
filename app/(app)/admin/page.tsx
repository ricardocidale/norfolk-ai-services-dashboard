import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getExpenseSourceStatuses } from "@/lib/admin/expense-sources";
import { toAdminUserRow } from "@/lib/admin/clerk-user-dto";
import { AdminHub, type AdminHubProps } from "@/components/admin/admin-hub";
import {
  emailScanResultPublicSelect,
  withParsedUsagePlaceholder,
} from "@/lib/prisma/email-scan-result-public";

export const dynamic = "force-dynamic";

const GMAIL_ACCOUNTS = [
  { email: "ricardo.cidale@norfolkgroup.io", billingAccount: "NORFOLK_GROUP" },
  { email: "ricardo.cidale@norfolk.ai", billingAccount: "NORFOLK_AI" },
] as const;

const USER_LIMIT = 20;

export default async function AdminPage(): Promise<React.JSX.Element> {
  const [
    expenseSources,
    gmailConnections,
    pendingResults,
    recentResults,
    clerkUsers,
  ] = await Promise.all([
    getExpenseSourceStatuses(),
    prisma.gmailConnection.findMany({
      select: { email: true, tokenExpiry: true, lastSyncAt: true },
    }),
    prisma.emailScanResult.findMany({
      where: { status: "PENDING" },
      select: emailScanResultPublicSelect,
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
    prisma.emailScanResult.findMany({
      where: { status: { in: ["IMPORTED", "REJECTED"] } },
      select: emailScanResultPublicSelect,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    (async () => {
      const client = await clerkClient();
      return client.users.getUserList({
        limit: USER_LIMIT,
        offset: 0,
        orderBy: "-created_at",
      });
    })(),
  ]);

  const connMap = new Map(gmailConnections.map((c) => [c.email, c]));
  const gmailAccounts = GMAIL_ACCOUNTS.map((a) => {
    const conn = connMap.get(a.email);
    return {
      email: a.email,
      billingAccount: a.billingAccount,
      connected: !!conn,
      tokenExpiry: conn?.tokenExpiry?.toISOString() ?? null,
      lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
    };
  });

  const scanResults = [...pendingResults, ...recentResults].map((r) => {
    const u = withParsedUsagePlaceholder(r);
    return {
      id: u.id,
      gmailEmail: u.gmailEmail,
      gmailMessageId: u.gmailMessageId,
      subject: u.subject,
      fromEmail: u.fromEmail,
      receivedAt: u.receivedAt.toISOString(),
      parsedVendor: u.parsedVendor,
      parsedAmount: u.parsedAmount?.toString() ?? null,
      parsedCurrency: u.parsedCurrency,
      parsedDate: u.parsedDate?.toISOString() ?? null,
      confidence: u.confidence,
      parsedUsage: u.parsedUsage,
      status: u.status,
      expenseId: u.expenseId,
      rawSnippet: u.rawSnippet,
    };
  });

  const props: AdminHubProps = {
    expenseSources,
    gmailAccounts,
    scanResults,
    userRows: clerkUsers.data.map((u) => toAdminUserRow(u)),
    userTotalCount: clerkUsers.totalCount,
    userOffset: 0,
    userLimit: USER_LIMIT,
  };

  return <AdminHub {...props} />;
}
