/**
 * Default date window for OpenAI / Anthropic admin usage sync when the client
 * omits `start` / `end`. Matches the dashboard “prior 12 UTC months + current MTD” grid.
 */
export const DEFAULT_SYNC_LOOKBACK_MONTHS = 12;

export function defaultSyncRangeEnd(): Date {
  return new Date();
}

/** Inclusive lower bound: same day-of-month one year earlier in UTC (approx. 12 months). */
export function defaultSyncRangeStart(end: Date): Date {
  const d = new Date(end.getTime());
  d.setUTCMonth(d.getUTCMonth() - DEFAULT_SYNC_LOOKBACK_MONTHS);
  return d;
}
