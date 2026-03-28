"use client";

import type { AiProvider } from "@prisma/client";
import { providerMeta } from "@/lib/providers-meta";
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
import type { VendorSpendAnalytics } from "@/lib/analytics/vendor-spend";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend by vendor</CardTitle>
        <CardDescription>
          <strong>Current month</strong> is month-to-date only. The grid is the{" "}
          <strong>twelve calendar months before</strong> it (e.g. in March 2026:
          Feb, Jan, Dec … back to Mar 2025). The{" "}
          <strong>cumulative 12-month</strong> tab matches the right-hand column
          on that grid (sum of those months per vendor).{" "}
          <span className="text-muted-foreground">{data.timezoneNote}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="mb-4 flex h-auto w-full flex-wrap gap-1 sm:w-auto">
            <TabsTrigger value="current" className="text-xs sm:text-sm">
              Current month
            </TabsTrigger>
            <TabsTrigger value="twelve" className="text-xs sm:text-sm">
              Prior 12 months
            </TabsTrigger>
            <TabsTrigger value="cumulative" className="text-xs sm:text-sm">
              Cumulative 12 months
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-0">
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Line items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withSpendCurrent.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No expenses in the current month yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    withSpendCurrent.map((r) => (
                      <TableRow key={r.provider}>
                        <TableCell className="font-medium">
                          {providerLabel(r.provider)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-primary">
                          {formatUsd(r.total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.count}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="twelve" className="mt-0">
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[140px] bg-background">
                      Vendor
                    </TableHead>
                    {data.priorMonthColumns.map((col) => (
                      <TableHead
                        key={col.key}
                        className="min-w-[88px] text-right text-xs font-medium"
                      >
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[100px] text-right text-xs font-semibold">
                      12-mo cumulative
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withSpendMatrix.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={data.priorMonthColumns.length + 2}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No expenses in the twelve months before the current month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    withSpendMatrix.map((row) => (
                      <TableRow key={row.provider}>
                        <TableCell className="sticky left-0 z-10 bg-background font-medium">
                          {providerLabel(row.provider)}
                        </TableCell>
                        {data.priorMonthColumns.map((col) => {
                          const cell = row.byMonth[col.key];
                          const v = cell ? Number(cell.total) : 0;
                          return (
                            <TableCell
                              key={col.key}
                              className="text-right tabular-nums text-xs text-muted-foreground"
                            >
                              {v === 0 ? "—" : formatUsd(cell!.total)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right tabular-nums text-sm font-medium text-primary">
                          {formatUsd(row.rowTotal)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="cumulative" className="mt-0">
            <p className="mb-3 text-sm text-muted-foreground">
              Per vendor: <strong className="text-foreground">cumulative</strong>{" "}
              spend over the same twelve completed months as the grid (sum of
              monthly cells; excludes the current month).
            </p>
            <div className="rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">
                      Cumulative 12-month total
                    </TableHead>
                    <TableHead className="text-right">Line items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withSpendRolling.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No expenses in the twelve months before the current month.
                      </TableCell>
                    </TableRow>
                  ) : (
                    withSpendRolling.map((r) => (
                      <TableRow key={r.provider}>
                        <TableCell className="font-medium">
                          {providerLabel(r.provider)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-primary">
                          {formatUsd(r.total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.count}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Cumulative window (UTC): start of oldest month in the grid{" "}
              {new Date(data.windowStart).toLocaleDateString()} → end of month
              before current{" "}
              {new Date(data.windowEnd).toLocaleDateString()}.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
