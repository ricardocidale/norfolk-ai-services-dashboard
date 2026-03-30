import { auth } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
import Decimal from "decimal.js";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import {
  findOverlappingApiExpense,
  findOverlappingExpenseByAmountForCardIssuer,
  findDuplicateScanResult,
} from "@/lib/expenses/dedup";
import { isCardIssuerFromEmail } from "@/lib/expenses/card-issuer-email";
import { vendorBillingAccount } from "@/lib/expenses/vendor-billing-defaults";
import { AiProvider } from "@prisma/client";
import {
  gmailResultsGetSchema,
  gmailResultsPatchSchema,
} from "@/lib/validations/gmail";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = new Set<string>(Object.values(AiProvider));

/**
 * GET /api/gmail/results?status=PENDING
 * Returns email scan results filtered by status.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  const { searchParams } = new URL(request.url);
  const parsed = gmailResultsGetSchema.safeParse({
    status: searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION" },
    );
  }

  const results = await prisma.emailScanResult.findMany({
    where: parsed.data.status ? { status: parsed.data.status } : undefined,
    orderBy: { receivedAt: "desc" },
    take: 200,
  });

  return jsonOk({ results });
}

/**
 * PATCH /api/gmail/results
 * Body: { id, action: "approve" | "reject" }
 * Approve: creates an Expense row and links it; Reject: marks as REJECTED.
 */
export async function PATCH(request: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400, { code: "INVALID_JSON" });
  }

  const parsed = gmailResultsPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION" },
    );
  }

  const { id, action, acknowledgeCardDuplicateRisk } = parsed.data;

  const result = await prisma.emailScanResult.findUnique({ where: { id } });
  if (!result) {
    return jsonErr("Not found", 404, { code: "NOT_FOUND" });
  }

  if (action === "reject") {
    try {
      await prisma.emailScanResult.update({
        where: { id },
        data: { status: "REJECTED" },
      });
    } catch (e) {
      return jsonErr(e instanceof Error ? e.message : String(e), 500, {
        code: "UPDATE_FAILED",
      });
    }
    return jsonOk({ status: "REJECTED" });
  }

  const provider: AiProvider =
    result.parsedVendor && VALID_PROVIDERS.has(result.parsedVendor)
      ? (result.parsedVendor as AiProvider)
      : "OTHER";

  const billingAccount = vendorBillingAccount(provider);
  const amount = result.parsedAmount
    ? new Decimal(result.parsedAmount.toString()).toFixed(4)
    : "0.0000";
  const expenseDate = result.parsedDate ?? result.receivedAt;
  const currency = (result.parsedCurrency ?? "USD").trim().toUpperCase() || "USD";

  const overlap = await findOverlappingApiExpense({
    provider,
    date: expenseDate,
    amount,
    currency,
  });

  if (overlap) {
    try {
      await prisma.emailScanResult.update({
        where: { id },
        data: { status: "REJECTED", expenseId: overlap.id },
      });
    } catch {
      // best-effort status update
    }
    return jsonErr(
      `Blocked: API-synced expense already covers this charge (${overlap.source}, $${new Decimal(overlap.amount).toFixed(2)} on ${overlap.incurredAt.toISOString().slice(0, 10)}). Auto-rejected to prevent double-counting.`,
      409,
      {
        code: "DUPLICATE_API_EXPENSE",
        details: {
          status: "REJECTED",
          reason: "duplicate_api_expense",
          existingExpenseId: overlap.id,
          existingSource: overlap.source,
        },
      },
    );
  }

  if (
    action === "approve" &&
    isCardIssuerFromEmail(result.fromEmail) &&
    new Decimal(amount).gt(0) &&
    !acknowledgeCardDuplicateRisk
  ) {
    const cardDup = await findOverlappingExpenseByAmountForCardIssuer({
      date: expenseDate,
      amount,
      currency,
    });
    if (cardDup) {
      return jsonErr(
        `Blocked: A non-seed expense already exists with about the same amount (${new Decimal(cardDup.amount).toFixed(2)} ${currency}, ${cardDup.source}, ${cardDup.provider}) on ${cardDup.incurredAt.toISOString().slice(0, 10)}. Card-issuer emails often repeat charges already imported from merchants or APIs — reject this scan unless it is a genuinely separate charge. To import anyway, confirm duplicate risk in the UI.`,
        409,
        {
          code: "CARD_ISSUER_OVERLAP",
          details: {
            status: "PENDING",
            reason: "card_issuer_amount_overlap",
            existingExpenseId: cardDup.id,
            existingSource: cardDup.source,
            existingLabel: cardDup.label,
          },
        },
      );
    }
  }

  const dupScan = await findDuplicateScanResult({
    fromEmail: result.fromEmail,
    subject: result.subject,
    receivedAt: result.receivedAt,
    excludeGmailMessageId: result.gmailMessageId,
  });

  if (dupScan && dupScan.status === "IMPORTED") {
    try {
      await prisma.emailScanResult.update({
        where: { id },
        data: { status: "REJECTED" },
      });
    } catch {
      // best-effort status update
    }
    return jsonErr(
      `Blocked: This invoice was already imported from a forwarded copy in ${dupScan.gmailEmail}. Auto-rejected to prevent double-counting.`,
      409,
      {
        code: "DUPLICATE_FORWARDED_EMAIL",
        details: {
          status: "REJECTED",
          reason: "duplicate_forwarded_email",
          existingScanId: dupScan.id,
        },
      },
    );
  }

  try {
    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          provider,
          billingAccount,
          amount,
          currency,
          incurredAt: expenseDate,
          label: `${result.parsedVendor ?? "Unknown"} — ${result.subject}`,
          source: "gmail_scan",
          externalRef: `gmail-${result.gmailMessageId}`,
          notes: JSON.stringify({
            source: "gmail_invoice_scan",
            fromEmail: result.fromEmail,
            confidence: result.confidence,
            gmailMessageId: result.gmailMessageId,
            ...(result.parsedUsage != null && typeof result.parsedUsage === "object"
              ? { usage: result.parsedUsage }
              : {}),
          }),
        },
      });

      await tx.emailScanResult.update({
        where: { id },
        data: { status: "IMPORTED", expenseId: created.id },
      });

      return created;
    });

    return jsonOk({ status: "IMPORTED", expenseId: expense.id });
  } catch (e) {
    return jsonErr(e instanceof Error ? e.message : String(e), 500, {
      code: "TRANSACTION_FAILED",
    });
  }
}
