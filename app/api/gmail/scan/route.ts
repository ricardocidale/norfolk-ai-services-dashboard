import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import { scanGmailForInvoices } from "@/lib/integrations/gmail-scan";
import { gmailScanPostSchema } from "@/lib/validations/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const runtime = "nodejs";

/**
 * POST /api/gmail/scan
 * Body (optional): { emails: string[] }
 * Scans all connected Gmail accounts (or specified emails) for vendor invoices.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", data: null },
      { status: 401 },
    );
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json(
      { success: false, error: "Forbidden", data: null },
      { status: 403 },
    );
  }

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    // Body is optional for this endpoint
  }

  const parsed = gmailScanPostSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
        data: null,
      },
      { status: 400 },
    );
  }

  let emails = parsed.data.emails;
  if (!emails || emails.length === 0) {
    const connections = await prisma.gmailConnection.findMany({
      select: { email: true },
    });
    emails = connections.map((c) => c.email);
  }

  if (emails.length === 0) {
    return NextResponse.json(
      { success: false, error: "No Gmail accounts connected.", data: null },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    emails.map((email) => scanGmailForInvoices(email)),
  );

  const totalNew = results.reduce((s, r) => s + r.newResults, 0);
  const totalScanned = results.reduce((s, r) => s + r.scanned, 0);
  const allErrors = results.flatMap((r) => r.errors);

  return NextResponse.json({
    success: allErrors.length === 0,
    error: allErrors.length > 0 ? allErrors.join("; ") : null,
    data: {
      message: `Scanned ${totalScanned} emails, found ${totalNew} new invoice(s).${
        allErrors.length > 0 ? ` ${allErrors.length} error(s).` : ""
      }`,
      results,
    },
  });
}
