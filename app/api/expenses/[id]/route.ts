import { jsonErr, jsonOk } from "@/lib/http/api-response";
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
    return jsonErr("Invalid JSON", 400, { code: "INVALID_JSON" });
  }

  const parsed = expenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION", details: parsed.error.flatten() },
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
    return jsonOk({
      expense: { ...expense, amount: expense.amount.toString() },
    });
  } catch {
    return jsonErr("Not found", 404, { code: "NOT_FOUND" });
  }
}

export async function DELETE(_request: Request, ctx: Params) {
  const { id } = await ctx.params;
  try {
    await prisma.expense.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch {
    return jsonErr("Not found", 404, { code: "NOT_FOUND" });
  }
}
