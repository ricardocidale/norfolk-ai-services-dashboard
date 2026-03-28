/** UTC calendar month for env-based monthly expense sync. */

export function parseMonthKey(v: string | undefined): {
  year: number;
  month0: number;
  key: string;
} {
  const now = new Date();
  if (v && /^\d{4}-\d{2}$/.test(v)) {
    const [ys, ms] = v.split("-");
    const year = Number(ys);
    const month0 = Number(ms) - 1;
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month0) ||
      month0 < 0 ||
      month0 > 11
    ) {
      return {
        year: now.getUTCFullYear(),
        month0: now.getUTCMonth(),
        key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
      };
    }
    return {
      year,
      month0,
      key: `${year}-${String(month0 + 1).padStart(2, "0")}`,
    };
  }
  return {
    year: now.getUTCFullYear(),
    month0: now.getUTCMonth(),
    key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}
