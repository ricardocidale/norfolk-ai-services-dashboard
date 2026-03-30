import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { AiProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findOverlappingApiExpense } from "@/lib/expenses/dedup";
import {
  expenseCreateSchema,
  parseAiProviderQueryParam,
} from "@/lib/validations/expense";

export const dynamic = "force-dynamic";

function parseIsoBoundary(v: string | null): Date | undefined {
  if (!v?.trim()) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const MAX_RANGE_MS = 400 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? "100"), 500);
  const provider = parseAiProviderQueryParam(searchParams.get("provider"));
  const from = parseIsoBoundary(searchParams.get("from"));
  const to = parseIsoBoundary(searchParams.get("to"));

  if (from && to && from > to) {
    return jsonErr("`from` must be before or equal to `to`.", 400, {
      code: "INVALID_RANGE",
    });
  }
  if (from && to && to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return jsonErr("Date range too large (max ~400 days).", 400, {
      code: "INVALID_RANGE",
    });
  }

  const incurredAt =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const items = await prisma.expense.findMany({
    where: {
      ...(provider ? { provider } : {}),
      ...(incurredAt ? { incurredAt } : {}),
    },
    orderBy: { incurredAt: "desc" },
    take,
  });

  return jsonOk({
    expenses: items.map((e) => ({
      ...e,
      amount: e.amount.toString(),
    })),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400, { code: "INVALID_JSON" });
  }

  const parsed = expenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION", details: parsed.error.flatten() },
    );
  }

  const v = parsed.data;
  const incurredAt =
    typeof v.incurredAt === "string" ? new Date(v.incurredAt) : v.incurredAt;

  const overlap = await findOverlappingApiExpense({
    provider: v.provider as AiProvider,
    date: incurredAt,
    amount: v.amount,
    currency: v.currency,
  });
  if (overlap) {
    return jsonErr(
      `Duplicate blocked: an API-synced expense already covers this charge (${overlap.source}, $${overlap.amount} on ${overlap.incurredAt.toISOString().slice(0, 10)}).`,
      409,
      {
        code: "DUPLICATE_API_EXPENSE",
        details: { existingExpenseId: overlap.id },
      },
    );
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        provider: v.provider,
        billingAccount: v.billingAccount,
        amount: new Prisma.Decimal(v.amount),
        currency: v.currency,
        incurredAt,
        periodStart: v.periodStart ? new Date(v.periodStart) : null,
        periodEnd: v.periodEnd ? new Date(v.periodEnd) : null,
        label: v.label ?? null,
        notes: v.notes ?? null,
        source: v.source,
        externalRef: v.externalRef ?? null,
      },
    });

    return jsonOk({
      expense: { ...expense, amount: expense.amount.toString() },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return jsonErr(msg, 409, { code: "CREATE_FAILED" });
  }
}
