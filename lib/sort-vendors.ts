import type { AiProvider } from "@prisma/client";

/** Highest spend first; tie-break by provider id for stable UI. */
export function compareProviderSpendDesc(
  a: { provider: AiProvider; amount: number },
  b: { provider: AiProvider; amount: number },
): number {
  if (b.amount !== a.amount) return b.amount - a.amount;
  return a.provider.localeCompare(b.provider);
}
