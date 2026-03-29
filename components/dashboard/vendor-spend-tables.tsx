"use client";

import type { AiProvider } from "@prisma/client";
import type { MonthColumn, VendorSpendAnalytics } from "@/lib/analytics/vendor-spend";
import {
  rangeCumulativeWindow,
  rangeCurrentMonthMtd,
  rangeUtcMonthKey,
} from "@/lib/analytics/vendor-spend-ranges";
import { VendorSpendAccordion } from "@/components/dashboard/vendor-spend-accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatUsd(s: string): string {
  const n = Number(s);
  if (n === 0) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fullMonthYearLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type MatrixRow = VendorSpendAnalytics["monthlyMatrix"][number];

function MonthBreakdownMini({
  row,
  columns,
}: {
  row: MatrixRow;
  columns: MonthColumn[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border bg-muted/15 text-xs">
      <p className="border-b px-2 py-1.5 font-medium text-muted-foreground">
        Spend by month (UTC, M-1 → M-12)
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className="h-8 min-w-[72px] px-1.5 text-center font-medium"
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            {columns.map((c) => {
              const cell = row.byMonth[c.key];
              const v = cell ? Number(cell.total) : 0;
              return (
                <TableCell
                  key={c.key}
                  className="px-1.5 text-center tabular-nums text-muted-foreground"
                >
                  {v === 0 ? "—" : formatUsd(cell!.total)}
                </TableCell>
              );
            })}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

type MonthRow = { provider: AiProvider; total: string; count: number };

function rowsForPriorMonth(
  data: VendorSpendAnalytics,
  monthKey: string,
): MonthRow[] {
  return data.monthlyMatrix
    .map((row) => {
      const cell = row.byMonth[monthKey];
      return {
        provider: row.provider,
        total: cell?.total ?? "0",
        count: cell?.count ?? 0,
      };
    })
    .filter((r) => Number(r.total) > 0);
}

export function VendorSpendTables({ data }: { data: VendorSpendAnalytics }) {
  const withSpendCurrent = data.currentMonthByVendor.filter(
    (r) => Number(r.total) > 0,
  );
  const withSpendRolling = data.rollingTotalByVendor.filter(
    (r) => Number(r.total) > 0,
  );
  const withSpendMatrix = data.monthlyMatrix.filter(
    (r) => Number(r.rowTotal) > 0,
  );

  const priorThree = data.priorMonthColumns.slice(0, 3);
  const currentRange = rangeCurrentMonthMtd(data.asOf);
  const cumulativeRange = rangeCumulativeWindow(data);

  const matrixByProvider = new Map<AiProvider, MatrixRow>(
    withSpendMatrix.map((r) => [r.provider, r]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend by vendor</CardTitle>
        <CardDescription>
          Each line is a vendor; use the chevron to load and view expense lines
          in that period. <strong>{data.currentMonthLabel}</strong> is
          month-to-date. The next three tabs are completed UTC months.{" "}
          <strong>Prior 12 months</strong> includes a per-vendor month grid when
          expanded. <strong>Cumulative 12 months</strong> matches the rolling
          window.{" "}
          <span className="text-muted-foreground">{data.timezoneNote}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="mb-4 flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="current" className="text-xs sm:text-sm">
              {data.currentMonthLabel}
            </TabsTrigger>
            {priorThree.map((col) => (
              <TabsTrigger
                key={col.key}
                value={col.key}
                className="text-xs sm:text-sm"
              >
                {fullMonthYearLabel(col.key)}
              </TabsTrigger>
            ))}
            <TabsTrigger value="twelve" className="text-xs sm:text-sm">
              Prior 12 months
            </TabsTrigger>
            <TabsTrigger value="cumulative" className="text-xs sm:text-sm">
              Cumulative 12 months
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-0">
            <p className="mb-3 text-sm text-muted-foreground">
              Month-to-date through the latest snapshot (UTC current month).
            </p>
            <VendorSpendAccordion
              rows={withSpendCurrent.map((r) => ({
                provider: r.provider,
                total: r.total,
                count: r.count,
              }))}
              from={currentRange.from}
              to={currentRange.to}
              emptyMessage="No expenses in the current month yet."
            />
          </TabsContent>

          {priorThree.map((col) => {
            const r = rangeUtcMonthKey(col.key);
            return (
              <TabsContent key={col.key} value={col.key} className="mt-0">
                <p className="mb-3 text-sm text-muted-foreground">
                  Full calendar month (UTC):{" "}
                  <strong className="text-foreground">
                    {fullMonthYearLabel(col.key)}
                  </strong>
                  .
                </p>
                <VendorSpendAccordion
                  rows={rowsForPriorMonth(data, col.key)}
                  from={r.from}
                  to={r.to}
                  emptyMessage="No expenses in this month."
                />
              </TabsContent>
            );
          })}

          <TabsContent value="twelve" className="mt-0">
            <p className="mb-3 text-sm text-muted-foreground">
              Row totals are the twelve completed months before the current
              month. Expand a vendor for the month-by-month grid and underlying
              transactions.
            </p>
            <VendorSpendAccordion
              rows={withSpendMatrix.map((r) => ({
                provider: r.provider,
                total: r.rowTotal,
                count: r.rowCount,
              }))}
              from={cumulativeRange.from}
              to={cumulativeRange.to}
              emptyMessage="No expenses in the twelve months before the current month."
              panelPrefix={(provider) => {
                const row = matrixByProvider.get(provider);
                if (!row) return null;
                return (
                  <MonthBreakdownMini
                    row={row}
                    columns={data.priorMonthColumns}
                  />
                );
              }}
            />
          </TabsContent>

          <TabsContent value="cumulative" className="mt-0">
            <p className="mb-3 text-sm text-muted-foreground">
              Same twelve-month window as the rolling total (excludes current
              month).
            </p>
            <VendorSpendAccordion
              rows={withSpendRolling.map((r) => ({
                provider: r.provider,
                total: r.total,
                count: r.count,
              }))}
              from={cumulativeRange.from}
              to={cumulativeRange.to}
              emptyMessage="No expenses in the twelve months before the current month."
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Window (UTC):{" "}
              {new Date(data.windowStart).toLocaleDateString()} →{" "}
              {new Date(data.windowEnd).toLocaleDateString()}.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
