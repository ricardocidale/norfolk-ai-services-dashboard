import { NextResponse } from "next/server";
import { AiProvider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { expenseCreateSchema } from "@/lib/validations/expense";

export const dynamic = "force-dynamic";

function parseProvider(v: string | null): AiProvider | undefined {
  if (!v) return undefined;
  return (Object.values(AiProvider) as string[]).includes(v)
    ? (v as AiProvider)
    : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? "100"), 500);
  const provider = parseProvider(searchParams.get("provider"));

  const items = await prisma.expense.findMany({
    where: provider ? { provider } : undefined,
    orderBy: { incurredAt: "desc" },
    take,
  });

  return NextResponse.json({
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = expenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const v = parsed.data;
  const incurredAt =
    typeof v.incurredAt === "string" ? new Date(v.incurredAt) : v.incurredAt;

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

    return NextResponse.json({
      expense: { ...expense, amount: expense.amount.toString() },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
