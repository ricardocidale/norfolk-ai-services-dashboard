"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AiProvider, BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_LABEL } from "@/lib/billing-accounts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { VendorSpendAnalytics } from "@/lib/analytics/vendor-spend";
import { providerMeta } from "@/lib/providers-meta";
import { ExpenseChart } from "./expense-chart";
import { ExpenseList } from "./expense-list";
import { VendorSpendTables } from "./vendor-spend-tables";

export type DashboardExpenseRow = {
  id: string;
  provider: AiProvider;
  billingAccount: BillingAccount;
  amount: string;
  currency: string;
  incurredAt: string;
  label: string | null;
  source: string;
};

export type DashboardSnapshot = {
  expenses: DashboardExpenseRow[];
  byProvider: { provider: AiProvider; sum: string; count: number }[];
  byAccount: { billingAccount: BillingAccount; sum: string; count: number }[];
  totalAmount: string;
  expenseCount: number;
  vendorSpend: VendorSpendAnalytics;
};

export function DashboardApp({
  initial,
  showAdminSourcesLink = false,
}: {
  initial: DashboardSnapshot;
  /** Only true for app admins — /admin/sources is not reachable otherwise. */
  showAdminSourcesLink?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = async () => {
    const [expRes, sumRes, vsRes] = await Promise.all([
      fetch("/api/expenses?take=120"),
      fetch("/api/summary"),
      fetch("/api/analytics/vendor-spend"),
    ]);
    const expJson = await expRes.json();
    const sumJson = await sumRes.json();
    const vsJson = await vsRes.json();
    if (!expRes.ok || !sumRes.ok || !vsRes.ok) {
      setToast("Could not refresh data.");
      return;
    }
    setSnapshot({
      expenses: (expJson.expenses as DashboardExpenseRow[]).map((e) => ({
        ...e,
        incurredAt:
          typeof e.incurredAt === "string"
            ? e.incurredAt
            : new Date(e.incurredAt as unknown as Date).toISOString(),
      })),
      byProvider: sumJson.byProvider,
      byAccount: sumJson.byAccount,
      totalAmount: sumJson.totalAmount,
      expenseCount: sumJson.expenseCount,
      vendorSpend: vsJson as VendorSpendAnalytics,
    });
    setToast("Updated.");
    setTimeout(() => setToast(null), 2000);
  };

  const chartData = useMemo(
    () =>
      snapshot.byProvider.map((r) => ({
        name: providerMeta(r.provider)?.label ?? r.provider.replaceAll("_", " "),
        total: Number(r.sum),
        count: r.count,
      })),
    [snapshot.byProvider],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="uppercase tracking-widest">
            Norfolk AI
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          AI services spend
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Consolidated view of AI-related expenses across Cursor, Anthropic,
          OpenAI, Google / Gemini, Manus, Replit, and other vendors. Billing
          identities:{" "}
          {Object.values(BILLING_ACCOUNT_LABEL).join(" · ")}.
        </p>
        {toast ? (
          <Alert className="border-primary/30 bg-primary/5">
            <AlertTitle className="text-primary">Status</AlertTitle>
            <AlertDescription className="text-foreground">{toast}</AlertDescription>
          </Alert>
        ) : null}
        <Separator />
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total recorded</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              ${Number(snapshot.totalAmount).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {snapshot.expenseCount} line items
            </p>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>By billing account</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-0 divide-y divide-border/70">
              {snapshot.byAccount.map((a) => (
                <li
                  key={a.billingAccount}
                  className="flex items-baseline justify-between gap-4 py-3 first:pt-0"
                >
                  <span className="text-sm font-medium leading-snug">
                    {BILLING_ACCOUNT_LABEL[a.billingAccount]}
                  </span>
                  <span className="shrink-0 tabular-nums text-base font-semibold text-primary">
                    $
                    {Number(a.sum).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Vendor tables</h2>
        <VendorSpendTables data={snapshot.vendorSpend} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Spend by provider</h2>
        <Card>
          <CardContent className="pt-6">
            <ExpenseChart data={chartData} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Data sources</h2>
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vendor APIs and imports</CardTitle>
            <CardDescription>
              {showAdminSourcesLink ? (
                <>
                  Configure environment variables, test OpenAI / Anthropic
                  connectivity, and run usage sync from{" "}
                  <Link
                    href="/admin/sources"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Admin → Expense sources
                  </Link>
                  .
                </>
              ) : (
                <>
                  Vendor API keys, probes, and sync are configured by app admins
                  (sidebar <span className="font-medium">Admin</span> → Expense
                  sources).
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showAdminSourcesLink ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/sources">Open expense sources</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Recent expenses</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/expenses/add">Add manually</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>
              Refresh
            </Button>
          </div>
        </div>
        <ExpenseList rows={snapshot.expenses} onChanged={refresh} />
      </section>
    </div>
  );
}
