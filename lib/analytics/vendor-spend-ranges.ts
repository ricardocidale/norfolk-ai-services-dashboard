import type { VendorSpendAnalytics } from "@/lib/analytics/vendor-spend";

/** UTC month-to-date through `asOf` (inclusive). */
export function rangeCurrentMonthMtd(asOfIso: string): {
  from: string;
  to: string;
} {
  const asOf = new Date(asOfIso);
  const from = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return { from: from.toISOString(), to: asOfIso };
}

/** Full UTC calendar month for `YYYY-MM`. */
export function rangeUtcMonthKey(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Twelve completed months before current (matches rolling totals). */
export function rangeCumulativeWindow(data: VendorSpendAnalytics): {
  from: string;
  to: string;
} {
  return { from: data.windowStart, to: data.windowEnd };
}
