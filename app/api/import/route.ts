import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { Prisma } from "@prisma/client";
import type { AiProvider } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findOverlappingApiExpense } from "@/lib/expenses/dedup";
import { expenseCreateSchema } from "@/lib/validations/expense";

export const dynamic = "force-dynamic";

const batchSchema = z.object({
  expenses: z.array(expenseCreateSchema),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400, { code: "INVALID_JSON" });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION", details: parsed.error.flatten() },
    );
  }

  let created = 0;
  const errors: string[] = [];

  for (const row of parsed.data.expenses) {
    const incurredAt =
      typeof row.incurredAt === "string"
        ? new Date(row.incurredAt)
        : row.incurredAt;

    const overlap = await findOverlappingApiExpense({
      provider: row.provider as AiProvider,
      date: incurredAt,
      amount: row.amount,
      currency: row.currency,
    });
    if (overlap) {
      errors.push(
        `Duplicate blocked for ${row.provider} on ${incurredAt.toISOString().slice(0, 10)}: API-synced expense already exists ($${overlap.amount}, source: ${overlap.source})`,
      );
      continue;
    }

    try {
      await prisma.expense.create({
        data: {
          provider: row.provider,
          billingAccount: row.billingAccount,
          amount: new Prisma.Decimal(row.amount),
          currency: row.currency,
          incurredAt,
          periodStart: row.periodStart ? new Date(row.periodStart) : null,
          periodEnd: row.periodEnd ? new Date(row.periodEnd) : null,
          label: row.label ?? null,
          notes: row.notes ?? null,
          source: row.source ?? "import",
          externalRef: row.externalRef ?? null,
        },
      });
      created += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "row failed");
    }
  }

  return jsonOk({ created, errors });
}
