import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import { vendorBillingAccount } from "@/lib/vendor-billing-defaults";
import type { AiProvider } from "@prisma/client";

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
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const results = await prisma.emailScanResult.findMany({
    where: status ? { status } : undefined,
    orderBy: { receivedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ results });
}

/**
 * PATCH /api/gmail/results
 * Body: { id, action: "approve" | "reject" }
 * Approve: creates an Expense row and links it; Reject: marks as REJECTED.
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, action } = body;
  if (!id || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: "id and action (approve|reject) required" },
      { status: 400 },
    );
  }

  const result = await prisma.emailScanResult.findUnique({ where: { id } });
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "reject") {
    await prisma.emailScanResult.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const provider: AiProvider =
    result.parsedVendor && VALID_PROVIDERS.has(result.parsedVendor)
      ? (result.parsedVendor as AiProvider)
      : "OTHER";

  const billingAccount = vendorBillingAccount(provider);

  const expense = await prisma.expense.create({
    data: {
      provider,
      billingAccount,
      amount: result.parsedAmount?.toString() ?? "0",
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

  await prisma.emailScanResult.update({
    where: { id },
    data: { status: "IMPORTED", expenseId: expense.id },
  });

  return NextResponse.json({ ok: true, status: "IMPORTED", expenseId: expense.id });
}
