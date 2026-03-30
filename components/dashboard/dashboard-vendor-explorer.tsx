"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AiProvider, BillingAccount } from "@prisma/client";
import type { VendorSpendAnalytics } from "@/lib/analytics/vendor-spend";
import {
  rangeCurrentMonthMtd,
  rangeRolling12,
  rangeUtcMonthKey,
} from "@/lib/analytics/vendor-spend-ranges";
import { providerMeta } from "@/lib/vendors/providers-meta";
import { BILLING_ACCOUNT_LABEL } from "@/lib/expenses/billing-accounts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VendorSpendAccordion } from "@/components/dashboard/vendor-spend-accordion";
import {
  fullMonthYearLabel,
  MonthBreakdownMini,
  rowsForPriorMonth,
  type MatrixRow,
} from "@/components/dashboard/vendor-spend-tables";
import { unwrapApiSuccessData } from "@/lib/http/api-response";

type ExpenseLine = {
  id: string;
  provider: AiProvider;
  billingAccount: BillingAccount;
  amount: string;
  currency: string;
  incurredAt: string;
  label: string | null;
  notes: string | null;
  source: string;
};

function formatUsd(s: string): string {
  const n = Number(s);
  if (n === 0) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function providerLabel(p: AiProvider): string {
  return providerMeta(p)?.label ?? p.replaceAll("_", " ");
}

function monthKeyUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type PeriodValue = "rolling12" | "currentMtd" | string;

function periodLabel(data: VendorSpendAnalytics, value: PeriodValue): string {
  if (value === "rolling12") return "Rolling 12 months";
  if (value === "currentMtd") return data.currentMonthLabel;
  return fullMonthYearLabel(value);
}

export function DashboardVendorExplorer({
  data,
}: {
  data: VendorSpendAnalytics;
}) {
  const priorOptions = data.priorMonthColumns.slice(0, 3);
  const defaultPeriod: PeriodValue = "rolling12";
  const [period, setPeriod] = useState<PeriodValue>(defaultPeriod);

  const { from, to, rows, showMatrixPrefix } = useMemo(() => {
    if (period === "rolling12") {
      const r = rangeRolling12(data);
      return {
        from: r.from,
        to: r.to,
        rows: (data.rolling12ByVendor ?? [])
          .filter((x) => Number(x.total) > 0)
          .map((x) => ({
            provider: x.provider,
            total: x.total,
            count: x.count,
          })),
        showMatrixPrefix: true,
      };
    }
    if (period === "currentMtd") {
      const r = rangeCurrentMonthMtd(data.asOf);
      return {
        from: r.from,
        to: r.to,
        rows: data.currentMonthByVendor
          .filter((x) => Number(x.total) > 0)
          .map((x) => ({
            provider: x.provider,
            total: x.total,
            count: x.count,
          })),
        showMatrixPrefix: false,
      };
    }
    const r = rangeUtcMonthKey(period);
    return {
      from: r.from,
      to: r.to,
      rows: rowsForPriorMonth(data, period),
      showMatrixPrefix: false,
    };
  }, [data, period]);

  const matrixByProvider = useMemo(() => {
    const withSpend = data.monthlyMatrix.filter((r) => Number(r.rowTotal) > 0);
    return new Map<AiProvider, MatrixRow>(withSpend.map((r) => [r.provider, r]));
  }, [data.monthlyMatrix]);

  const [timeline, setTimeline] = useState<
    ExpenseLine[] | "idle" | "loading" | "error"
  >("idle");

  const loadTimeline = useCallback(async () => {
    setTimeline("loading");
    const params = new URLSearchParams({
      from,
      to,
      take: "500",
    });
    try {
      const res = await fetch(`/api/expenses?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setTimeline("error");
        return;
      }
      const data = unwrapApiSuccessData<{ expenses: ExpenseLine[] }>(json);
      setTimeline(data?.expenses ?? []);
    } catch {
      setTimeline("error");
    }
  }, [from, to]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const sortedTimeline = useMemo(() => {
    if (!Array.isArray(timeline)) return [];
    return [...timeline].sort(
      (a, b) =>
        new Date(b.incurredAt).getTime() - new Date(a.incurredAt).getTime(),
    );
  }, [timeline]);

  const timelineByMonth = useMemo(() => {
    const groups: { monthKey: string; items: ExpenseLine[] }[] = [];
    for (const e of sortedTimeline) {
      const mk = monthKeyUtc(e.incurredAt);
      const last = groups[groups.length - 1];
      if (last?.monthKey === mk) last.items.push(e);
      else groups.push({ monthKey: mk, items: [e] });
    }
    return groups;
  }, [sortedTimeline]);

  const capped =
    Array.isArray(timeline) && timeline.length >= 500;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Vendor lines & timeline</CardTitle>
          <CardDescription>
            Pick a period, then expand a vendor for transaction detail. The
            timeline lists every loaded expense in date order (newest first).
            <span className="text-muted-foreground"> {data.timezoneNote}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-medium" htmlFor="explorer-period">
              Period
            </label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as PeriodValue)}
            >
              <SelectTrigger
                id="explorer-period"
                className="w-full sm:w-[min(100%,320px)]"
              >
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rolling12">Rolling 12 months</SelectItem>
                <SelectItem value="currentMtd">
                  {data.currentMonthLabel} (MTD)
                </SelectItem>
                {priorOptions.map((col) => (
                  <SelectItem key={col.key} value={col.key}>
                    {fullMonthYearLabel(col.key)} (full month)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Window: {new Date(from).toLocaleDateString()} →{" "}
            {new Date(to).toLocaleDateString()} ·{" "}
            <span className="text-foreground">{periodLabel(data, period)}</span>
          </p>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Timeline</h3>
              {timeline === "loading" || timeline === "idle" ? (
                <p className="text-sm text-muted-foreground">
                  Loading timeline…
                </p>
              ) : timeline === "error" ? (
                <p className="text-sm text-destructive">
                  Could not load expenses for this window.
                </p>
              ) : sortedTimeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No expenses in this period.
                </p>
              ) : (
                <>
                  {capped ? (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      Showing the 500 most recent lines in this window; totals
                      may include more.
                    </p>
                  ) : null}
                  <ul className="relative space-y-0 border-l-2 border-primary/25 pl-4">
                    {timelineByMonth.map((group) => (
                      <li key={group.monthKey} className="list-none">
                        <div className="-ml-4 mb-2 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {fullMonthYearLabel(group.monthKey)}
                        </div>
                        <ul className="list-none space-y-0 p-0">
                          {group.items.map((e) => (
                            <li
                              key={e.id}
                              className="relative pb-4 last:pb-0"
                            >
                              <span
                                className="absolute top-1.5 -left-[calc(0.5rem+5px)] size-2 rounded-full bg-primary"
                                aria-hidden
                              />
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                      {new Date(
                                        e.incurredAt,
                                      ).toLocaleDateString(undefined, {
                                        dateStyle: "medium",
                                      })}
                                    </span>
                                    <span className="text-sm font-medium">
                                      {providerLabel(e.provider)}
                                    </span>
                                  </div>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {e.label ?? "—"}{" "}
                                    <span className="opacity-70">
                                      ({e.source})
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {BILLING_ACCOUNT_LABEL[e.billingAccount]}
                                  </p>
                                </div>
                                <span className="shrink-0 tabular-nums text-sm font-semibold text-primary">
                                  {formatUsd(e.amount)} {e.currency}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">By vendor</h3>
              <VendorSpendAccordion
                rows={rows}
                from={from}
                to={to}
                emptyMessage="No expenses in this period."
                panelPrefix={
                  showMatrixPrefix
                    ? (provider) => {
                        const row = matrixByProvider.get(provider);
                        if (!row) return null;
                        return (
                          <MonthBreakdownMini
                            row={row}
                            columns={data.allMonthColumns}
                          />
                        );
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
