import { prisma } from "@/lib/db";
import { EmailScanClient } from "@/components/admin/email-scan-client";

export const dynamic = "force-dynamic";

const GMAIL_ACCOUNTS = [
  { email: "ricardo.cidale@norfolkgroup.ai", billingAccount: "NORFOLK_GROUP" },
  { email: "ricardo.cidale@norfolk.ai", billingAccount: "NORFOLK_AI" },
] as const;

export default async function EmailScanPage() {
  const connections = await prisma.gmailConnection.findMany({
    select: {
      email: true,
      tokenExpiry: true,
      lastSyncAt: true,
    },
  });

  const connMap = new Map(connections.map((c) => [c.email, c]));

  const accounts = GMAIL_ACCOUNTS.map((a) => {
    const conn = connMap.get(a.email);
    return {
      email: a.email,
      billingAccount: a.billingAccount,
      connected: !!conn,
      tokenExpiry: conn?.tokenExpiry?.toISOString() ?? null,
      lastSyncAt: conn?.lastSyncAt?.toISOString() ?? null,
    };
  });

  const pendingResults = await prisma.emailScanResult.findMany({
    where: { status: "PENDING" },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  const recentResults = await prisma.emailScanResult.findMany({
    where: { status: { in: ["IMPORTED", "REJECTED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const serialized = [...pendingResults, ...recentResults].map((r) => ({
    id: r.id,
    gmailEmail: r.gmailEmail,
    gmailMessageId: r.gmailMessageId,
    subject: r.subject,
    fromEmail: r.fromEmail,
    receivedAt: r.receivedAt.toISOString(),
    parsedVendor: r.parsedVendor,
    parsedAmount: r.parsedAmount?.toString() ?? null,
    parsedCurrency: r.parsedCurrency,
    parsedDate: r.parsedDate?.toISOString() ?? null,
    confidence: r.confidence,
    status: r.status,
    expenseId: r.expenseId,
    rawSnippet: r.rawSnippet,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Gmail invoice scanner
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Connect Gmail accounts to scan for AI vendor invoices and receipts.
          Scanned emails are parsed with Claude AI and presented for approval
          before importing as expense records.
        </p>
      </div>
      <EmailScanClient accounts={accounts} initialResults={serialized} />
    </div>
  );
}
