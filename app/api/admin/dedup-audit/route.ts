import { auth } from "@clerk/nextjs/server";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
import Decimal from "decimal.js";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import { isApiSyncSource, sourcePriority } from "@/lib/expenses/dedup";

export const dynamic = "force-dynamic";

type DuplicateGroup = {
  provider: string;
  date: string;
  currency: string;
  expenses: {
    id: string;
    amount: string;
    source: string;
    sourcePriority: number;
    externalRef: string | null;
    label: string | null;
    isApiSync: boolean;
  }[];
  recommendation: "keep_api" | "review" | "safe";
};

/**
 * GET /api/admin/dedup-audit
 *
 * Scans all expenses for potential duplicates: same provider, same day,
 * same currency, amount within 5% tolerance. Fully server-side, deterministic.
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  const allExpenses = await prisma.expense.findMany({
    select: {
      id: true,
      provider: true,
      amount: true,
      currency: true,
      incurredAt: true,
      source: true,
      externalRef: true,
      label: true,
    },
    orderBy: { incurredAt: "asc" },
  });

  const grouped = new Map<string, typeof allExpenses>();
  for (const exp of allExpenses) {
    const dayKey = exp.incurredAt.toISOString().slice(0, 10);
    const key = `${exp.provider}|${dayKey}|${exp.currency}`;
    const arr = grouped.get(key) ?? [];
    arr.push(exp);
    grouped.set(key, arr);
  }

  const duplicates: DuplicateGroup[] = [];

  for (const [key, group] of grouped) {
    if (group.length < 2) continue;

    const matched = new Set<number>();
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (matched.has(j)) continue;

        const a = new Decimal(group[i].amount.toString());
        const b = new Decimal(group[j].amount.toString());
        if (a.isZero() && b.isZero()) continue;

        const diff = a.minus(b).abs();
        const tolerance = Decimal.max(a, b).times(0.05);

        if (diff.lte(tolerance)) {
          matched.add(i);
          matched.add(j);
        }
      }
    }

    if (matched.size > 0) {
      const sortedIdx = [...matched].sort((a, b) => a - b);
      const matchedExpenses = sortedIdx.map((idx) => group[idx]);
      const hasApi = matchedExpenses.some((e) => isApiSyncSource(e.source));
      const hasNonApi = matchedExpenses.some(
        (e) => !isApiSyncSource(e.source),
      );

      const [provider, date] = key.split("|");

      duplicates.push({
        provider,
        date,
        currency: group[0].currency,
        expenses: matchedExpenses.map((e) => ({
          id: e.id,
          amount: e.amount.toString(),
          source: e.source,
          sourcePriority: sourcePriority(e.source),
          externalRef: e.externalRef,
          label: e.label,
          isApiSync: isApiSyncSource(e.source),
        })),
        recommendation:
          hasApi && hasNonApi
            ? "keep_api"
            : hasApi
              ? "safe"
              : "review",
      });
    }
  }

  return jsonOk({
    totalExpenses: allExpenses.length,
    duplicateGroups: duplicates.length,
    groups: duplicates,
  });
}
