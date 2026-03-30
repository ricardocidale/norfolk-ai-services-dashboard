"use client";

import type { VendorSpendAnalytics } from "@/lib/analytics/vendor-spend";
import { Badge } from "@/components/ui/badge";
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

function categoryBadgeClass(cat: string): string {
  switch (cat) {
    case "ai_ml":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300";
    case "cloud_hosting":
      return "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-300";
    case "dev_tools":
      return "border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-300";
    case "business_productivity":
      return "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200";
    case "payments_identity":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300";
    case "design_creative":
      return "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-300";
    default:
      return "border-muted-foreground/30 bg-muted/50 text-muted-foreground";
  }
}

export function VendorCategoryRankings({
  data,
}: {
  data: VendorSpendAnalytics;
}): React.JSX.Element {
  const rollingEmpty =
    data.costRankingRolling12.length === 0 &&
    data.categoryRankingRolling12.length === 0;
  const currentEmpty =
    data.costRankingCurrentMonth.length === 0 &&
    data.usageRankingCurrentMonth.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories & rankings</CardTitle>
        <CardDescription>
          Vendors are grouped into service categories (metadata — not stored on each
          expense). <strong>Cost</strong> ranks by USD in the window;{" "}
          <strong>Usage</strong> ranks by number of expense line items in that window
          (proxy for billing-event volume, not API tokens).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="rolling12" className="w-full">
          <TabsList className="mb-4 flex h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="rolling12" className="text-xs sm:text-sm">
              Rolling 12 months
            </TabsTrigger>
            <TabsTrigger value="current" className="text-xs sm:text-sm">
              Current month (MTD)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rolling12" className="mt-0 space-y-6">
            {rollingEmpty ? (
              <p className="text-sm text-muted-foreground">
                No spend in the rolling 12‑month window yet.
              </p>
            ) : (
              <>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-foreground">
                    Spend by category
                  </h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Rolled up from all vendors in the window, ranked by total cost.
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Vendors</TableHead>
                          <TableHead className="text-right">Line items</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.categoryRankingRolling12.map((r) => (
                          <TableRow key={r.category}>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {r.rank}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`font-normal ${categoryBadgeClass(r.category)}`}
                              >
                                {r.categoryLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatUsd(r.total)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.vendorCount}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {r.lineItemCount}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <VendorRankTable
                    title="Vendors by cost"
                    rows={data.costRankingRolling12}
                    valueLabel="Rolling 12 total"
                  />
                  <VendorRankTable
                    title="Vendors by usage"
                    subtitle="Most expense line items"
                    rows={data.usageRankingRolling12}
                    valueLabel="Line items"
                    showCountPrimary
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="current" className="mt-0 space-y-6">
            {currentEmpty ? (
              <p className="text-sm text-muted-foreground">
                No expenses in the current UTC month yet.
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <VendorRankTable
                  title="Vendors by cost"
                  rows={data.costRankingCurrentMonth}
                  valueLabel="MTD total"
                />
                <VendorRankTable
                  title="Vendors by usage"
                  subtitle="Most line items (MTD)"
                  rows={data.usageRankingCurrentMonth}
                  valueLabel="Line items"
                  showCountPrimary
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function VendorRankTable({
  title,
  subtitle,
  rows,
  valueLabel,
  showCountPrimary,
}: {
  title: string;
  subtitle?: string;
  rows: VendorSpendAnalytics["costRankingRolling12"];
  valueLabel: string;
  showCountPrimary?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {subtitle ? (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
      <div className="mt-2 max-h-[min(28rem,55vh)] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">#</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">{valueLabel}</TableHead>
              {!showCountPrimary ? (
                <TableHead className="text-right">Lines</TableHead>
              ) : (
                <TableHead className="text-right">Amount</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.provider}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {r.rank}
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-sm font-medium">
                  {r.label}
                </TableCell>
                <TableCell className="min-w-[8rem]">
                  <span
                    className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${categoryBadgeClass(r.category)}`}
                  >
                    {r.categoryLabel}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {showCountPrimary ? (
                    <span className="font-medium">{r.count}</span>
                  ) : (
                    formatUsd(r.total)
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {showCountPrimary ? formatUsd(r.total) : r.count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
