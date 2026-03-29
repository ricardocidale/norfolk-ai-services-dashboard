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

function parseIsoBoundary(v: string | null): Date | undefined {
  if (!v?.trim()) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const MAX_RANGE_MS = 400 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? "100"), 500);
  const provider = parseProvider(searchParams.get("provider"));
  const from = parseIsoBoundary(searchParams.get("from"));
  const to = parseIsoBoundary(searchParams.get("to"));

  if (from && to && from > to) {
    return NextResponse.json(
      { error: "`from` must be before or equal to `to`." },
      { status: 400 },
    );
  }
  if (from && to && to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: "Date range too large (max ~400 days)." },
      { status: 400 },
    );
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
