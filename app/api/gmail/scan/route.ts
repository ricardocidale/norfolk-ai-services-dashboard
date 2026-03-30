import { auth } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import { scanGmailForInvoices } from "@/lib/integrations/gmail-scan";
import { gmailScanPostSchema } from "@/lib/validations/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const runtime = "nodejs";

/**
 * POST /api/gmail/scan
 * Body (optional): { emails: string[] }
 * Scans all connected Gmail accounts (or specified emails) for vendor invoices.
 * Body: optional { emails?, scope? } — `extended` = more SaaS domains; `discover` = subject-only (invoice/payment keywords, any sender).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    // Body is optional for this endpoint
  }

  const parsed = gmailScanPostSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION" },
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
    return jsonErr("No Gmail accounts connected.", 400, {
      code: "NO_GMAIL_CONNECTIONS",
    });
  }

  const scope = parsed.data.scope;

  const results = await Promise.all(
    emails.map((email) => scanGmailForInvoices(email, { scope })),
  );

  const totalNew = results.reduce((s, r) => s + r.newResults, 0);
  const totalScanned = results.reduce((s, r) => s + r.scanned, 0);
  const allErrors = results.flatMap((r) => r.errors);

  return jsonOk({
    scanSucceeded: allErrors.length === 0,
    warnings: allErrors,
    message: `Scanned ${totalScanned} emails (${scope}), found ${totalNew} new candidate(s).${
      allErrors.length > 0 ? ` ${allErrors.length} note(s)/error(s).` : ""
    }`,
    results,
  });
}
