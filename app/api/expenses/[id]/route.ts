import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { expenseUpdateSchema } from "@/lib/validations/expense";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Params) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = expenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const v = parsed.data;
  const data: Record<string, unknown> = {};

  if (v.provider !== undefined) data.provider = v.provider;
  if (v.billingAccount !== undefined) data.billingAccount = v.billingAccount;
  if (v.amount !== undefined) data.amount = new Prisma.Decimal(v.amount);
  if (v.currency !== undefined) data.currency = v.currency;
  if (v.incurredAt !== undefined) {
    data.incurredAt =
      typeof v.incurredAt === "string"
        ? new Date(v.incurredAt)
        : v.incurredAt;
  }
  if (v.periodStart !== undefined) {
    data.periodStart = v.periodStart ? new Date(v.periodStart) : null;
  }
  if (v.periodEnd !== undefined) {
    data.periodEnd = v.periodEnd ? new Date(v.periodEnd) : null;
  }
  if (v.label !== undefined) data.label = v.label;
  if (v.notes !== undefined) data.notes = v.notes;
  if (v.source !== undefined) data.source = v.source;
  if (v.externalRef !== undefined) data.externalRef = v.externalRef;

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data,
    });
    return NextResponse.json({
      expense: { ...expense, amount: expense.amount.toString() },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
