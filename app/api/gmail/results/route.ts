import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import Decimal from "decimal.js";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import { vendorBillingAccount } from "@/lib/vendor-billing-defaults";
import type { AiProvider } from "@prisma/client";
import {
  gmailResultsGetSchema,
  gmailResultsPatchSchema,
} from "@/lib/validations/gmail";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = new Set<string>([
  "CURSOR", "ANTHROPIC", "OPENAI", "CHATGPT", "GOOGLE_API", "GEMINI",
  "MANUS", "REPLIT", "VERCEL", "ELEVENLABS", "PERPLEXITY", "MIDJOURNEY",
  "AWS_BEDROCK", "MISTRAL", "COHERE", "OTHER",
]);

/**
 * GET /api/gmail/results?status=PENDING
 * Returns email scan results filtered by status.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const parsed = gmailResultsGetSchema.safeParse({
    status: searchParams.get("status") ?? undefined,
  });
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

  const results = await prisma.emailScanResult.findMany({
    where: parsed.data.status ? { status: parsed.data.status } : undefined,
    orderBy: { receivedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ success: true, error: null, data: { results } });
}

/**
 * PATCH /api/gmail/results
 * Body: { id, action: "approve" | "reject" }
 * Approve: creates an Expense row and links it; Reject: marks as REJECTED.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON", data: null },
      { status: 400 },
    );
  }

  const parsed = gmailResultsPatchSchema.safeParse(rawBody);
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

  const { id, action } = parsed.data;

  const result = await prisma.emailScanResult.findUnique({ where: { id } });
  if (!result) {
    return NextResponse.json(
      { success: false, error: "Not found", data: null },
      { status: 404 },
    );
  }

  if (action === "reject") {
    try {
      await prisma.emailScanResult.update({
        where: { id },
        data: { status: "REJECTED" },
      });
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error: e instanceof Error ? e.message : String(e),
          data: null,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      error: null,
      data: { status: "REJECTED" },
    });
  }

  const provider: AiProvider =
    result.parsedVendor && VALID_PROVIDERS.has(result.parsedVendor)
      ? (result.parsedVendor as AiProvider)
      : "OTHER";

  const billingAccount = vendorBillingAccount(provider);
  const amount = result.parsedAmount
    ? new Decimal(result.parsedAmount.toString()).toFixed(4)
    : "0.0000";

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          provider,
          billingAccount,
          amount,
          currency: result.parsedCurrency ?? "USD",
          incurredAt: result.parsedDate ?? result.receivedAt,
          label: `${result.parsedVendor ?? "Unknown"} — ${result.subject}`,
          source: "gmail_scan",
          externalRef: `gmail-${result.gmailMessageId}`,
          notes: JSON.stringify({
            source: "gmail_invoice_scan",
            fromEmail: result.fromEmail,
            confidence: result.confidence,
            gmailMessageId: result.gmailMessageId,
          }),
        },
      });

      await tx.emailScanResult.update({
        where: { id },
        data: { status: "IMPORTED", expenseId: created.id },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      error: null,
      data: { status: "IMPORTED", expenseId: expense.id },
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        data: null,
      },
      { status: 500 },
    );
  }
}
