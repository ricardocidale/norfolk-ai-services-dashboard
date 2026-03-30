"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, LayoutDashboard, LineChart } from "lucide-react";
import { BILLING_ACCOUNT_LABEL } from "@/lib/expenses/billing-accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AdminConsumptionReport,
  MonthSeriesPoint,
} from "@/lib/analytics/admin-consumption-report";

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

type Props = Omit<AdminConsumptionReport, "vendorSpend"> & {
  asOf: string;
  timezoneNote: string;
  windowStart: string;
  windowEnd: string;
  currentMonthLabel: string;
};

function BillingMixBar({
  rows,
  allTimeTotal,
}: {
  rows: AdminConsumptionReport["byBillingAccount"];
  allTimeTotal: number;
}) {
  if (allTimeTotal <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No recorded spend yet — mix appears after expenses exist.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.billingAccount}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="font-medium leading-snug">
              {BILLING_ACCOUNT_LABEL[r.billingAccount]}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {fmtUsd(r.sum)} · {fmtPct(r.pctOfAllTime)} · {r.count} lines
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="presentation"
          >
            <div
              className="h-full rounded-full bg-primary/80 transition-[width] duration-500"
              style={{ width: `${Math.min(100, r.pctOfAllTime)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ConcentrationCallout({
  rows,
}: {
  rows: AdminConsumptionReport["topVendorsRolling12"];
}) {
  const top3 = rows.slice(0, 3);
  const share = top3.reduce((a, r) => a + r.pctOfRolling12, 0);
  if (rows.length === 0) return null;
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Concentration</CardTitle>
        <CardDescription>
          Share of rolling 12‑month spend held by the top three vendors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums text-primary">
          {fmtPct(share, 1)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {top3.map((r) => r.label).join(" · ")}
        </p>
      </CardContent>
    </Card>
  );
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MonthSeriesPoint }[];
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
    >
      <p className="font-medium">{p.label}</p>
      <p className="tabular-nums text-primary">{fmtUsd(p.total)}</p>
      <p className="text-xs text-muted-foreground">{p.lineCount} line items</p>
    </div>
  );
}

export function AdminAnalysisView(props: Props): React.JSX.Element {
  const {
    asOf,
    timezoneNote,
    windowStart,
    windowEnd,
    currentMonthLabel,
    allTimeTotal,
    allTimeExpenseCount,
    byBillingAccount,
    rolling12Total,
    rolling12LineCount,
    mtdTotal,
    mtdLineCount,
    priorFullMonthTotal,
    priorFullMonthLabel,
    monthSeriesChronological,
    topVendorsRolling12,
  } = props;

  const barData = topVendorsRolling12.map((r) => ({
    name: r.label,
    total: r.total,
    count: r.count,
    pct: r.pctOfRolling12,
  }));

  const asOfShort = new Date(asOf).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 gap-1" asChild>
              <Link href="/admin">
                <ArrowLeft className="size-4" />
                Admin
              </Link>
            </Button>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Analysis & reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Consumption-oriented view of AI vendor spend: rolling windows,
            billing mix, vendor concentration, and month‑over‑month trend. For
            line‑level detail, use the dashboard{" "}
            <Link
              href="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Vendor lines & timeline
            </Link>{" "}
            tab.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              Snapshot {asOfShort}
            </Badge>
            <span className="hidden sm:inline">·</span>
            <span>
              Rolling window (UTC):{" "}
              {new Date(windowStart).toLocaleDateString()} →{" "}
              {new Date(windowEnd).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
          <Link href="/">
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{timezoneNote}</p>

      <Tabs defaultValue="snapshot" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="snapshot" className="gap-1.5 text-xs sm:text-sm">
            <LayoutDashboard className="size-3.5" />
            Snapshot
          </TabsTrigger>
          <TabsTrigger value="vendors" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="size-3.5" />
            Vendors
          </TabsTrigger>
          <TabsTrigger value="trend" className="gap-1.5 text-xs sm:text-sm">
            <LineChart className="size-3.5" />
            12‑month trend
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapshot" className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rolling 12 months</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {fmtUsd(rolling12Total)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {rolling12LineCount} line items in window
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{currentMonthLabel} (MTD)</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {fmtUsd(mtdTotal)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {mtdLineCount} lines · month in progress (UTC)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last full month</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {fmtUsd(priorFullMonthTotal)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {priorFullMonthLabel} (complete UTC month)
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>All time (database)</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {fmtUsd(allTimeTotal)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {allTimeExpenseCount} line items total
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Billing account mix</CardTitle>
                <CardDescription>
                  All‑time spend share by billing identity (not limited to the
                  rolling 12‑month window).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BillingMixBar
                  rows={byBillingAccount}
                  allTimeTotal={allTimeTotal}
                />
              </CardContent>
            </Card>
            <ConcentrationCallout rows={topVendorsRolling12} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to read this</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Rolling 12</strong> matches
                the dashboard vendor tables: current month to‑date plus eleven
                completed UTC months. Use it for recent run‑rate and budgeting.
              </p>
              <p>
                <strong className="text-foreground">MTD</strong> is incomplete
                until the month closes; compare it to{" "}
                <strong className="text-foreground">last full month</strong> for
                pacing, not as a final monthly total.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">
                  Spend by vendor (rolling 12)
                </CardTitle>
                <CardDescription>
                  Sorted by total; tooltip shows line count.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No vendor spend in the rolling window.
                  </p>
                ) : (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                          tickFormatter={(v) => `$${v}`}
                          stroke="var(--border)"
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={120}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                          stroke="var(--border)"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--popover)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--popover-foreground)",
                          }}
                          formatter={(value: number, _n, item) => {
                            const p = item?.payload as
                              | (typeof barData)[0]
                              | undefined;
                            return [
                              `${fmtUsd(value)} (${p ? fmtPct(p.pct) : ""} of rolling 12)`,
                              "Spend",
                            ];
                          }}
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as
                              | (typeof barData)[0]
                              | undefined;
                            return row ? `${row.name} · ${row.count} lines` : "";
                          }}
                        />
                        <Bar
                          dataKey="total"
                          fill="var(--chart-2)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Vendor table</CardTitle>
                <CardDescription>
                  Percent of rolling 12‑month consumption.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                <div className="max-h-[22rem] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topVendorsRolling12.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            className="text-center text-muted-foreground"
                          >
                            No data
                          </TableCell>
                        </TableRow>
                      ) : (
                        topVendorsRolling12.map((r) => (
                          <TableRow key={r.provider}>
                            <TableCell className="max-w-[140px] truncate font-medium">
                              {r.label}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtUsd(r.total)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmtPct(r.pctOfRolling12)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trend" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Total consumption by UTC month
              </CardTitle>
              <CardDescription>
                Oldest to newest (left to right). The last point is the current
                month and reflects month‑to‑date only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monthSeriesChronological.every((p) => p.total === 0) ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No monthly data in the rolling window.
                </p>
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthSeriesChronological}
                      margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="adminConsumptionFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--chart-2)"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--chart-2)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        stroke="var(--border)"
                      />
                      <YAxis
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        tickFormatter={(v) => `$${v}`}
                        stroke="var(--border)"
                      />
                      <Tooltip content={<TrendTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        fill="url(#adminConsumptionFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />
      <p className="text-center text-xs text-muted-foreground">
        Data matches live expenses in Postgres. Refresh the dashboard after sync
        to align snapshots.
      </p>
    </div>
  );
}
