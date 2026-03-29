import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import { scanGmailForInvoices } from "@/lib/integrations/gmail-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const runtime = "nodejs";

/**
 * POST /api/gmail/scan
 * Body (optional): { emails: string[] }
 * Scans all connected Gmail accounts (or specified emails) for vendor invoices.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { emails?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* optional body */
  }

  let emails = body.emails;
  if (!emails || emails.length === 0) {
    const connections = await prisma.gmailConnection.findMany({
      select: { email: true },
    });
    emails = connections.map((c) => c.email);
  }

  if (emails.length === 0) {
    return NextResponse.json(
      { ok: false, message: "No Gmail accounts connected." },
      { status: 400 },
    );
  }

  const results = [];
  for (const email of emails) {
    const summary = await scanGmailForInvoices(email);
    results.push(summary);
  }

  const totalNew = results.reduce((s, r) => s + r.newResults, 0);
  const totalScanned = results.reduce((s, r) => s + r.scanned, 0);
  const allErrors = results.flatMap((r) => r.errors);

  return NextResponse.json({
    ok: allErrors.length === 0,
    message: `Scanned ${totalScanned} emails, found ${totalNew} new invoice(s).${
      allErrors.length > 0 ? ` ${allErrors.length} error(s).` : ""
    }`,
    results,
  });
}
