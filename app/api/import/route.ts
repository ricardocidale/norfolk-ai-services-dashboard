import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let created = 0;
  const errors: string[] = [];

  for (const row of parsed.data.expenses) {
    const incurredAt =
      typeof row.incurredAt === "string"
        ? new Date(row.incurredAt)
        : row.incurredAt;
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

  return NextResponse.json({ created, errors });
}
