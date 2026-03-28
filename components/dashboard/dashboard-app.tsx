"use client";

import { useMemo, useState } from "react";
import type { AiProvider, BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_ORDER } from "@/lib/billing-accounts";
import { BILLING_ACCOUNT_LABEL } from "@/lib/billing-accounts";
import { PROVIDER_META } from "@/lib/providers-meta";
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
import { ExpenseChart } from "./expense-chart";
import { ExpenseForm } from "./expense-form";
import { ExpenseList } from "./expense-list";
import { IntegrationPanel } from "./integration-panel";

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
};

export function DashboardApp({ initial }: { initial: DashboardSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncBilling, setSyncBilling] = useState<BillingAccount>("NORFOLK_GROUP");

  const refresh = async () => {
    const [expRes, sumRes] = await Promise.all([
      fetch("/api/expenses?take=120"),
      fetch("/api/summary"),
    ]);
    const expJson = await expRes.json();
    const sumJson = await sumRes.json();
    if (!expRes.ok || !sumRes.ok) {
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
    });
    setToast("Updated.");
    setTimeout(() => setToast(null), 2000);
  };

  const chartData = useMemo(
    () =>
      snapshot.byProvider.map((r) => ({
        name: r.provider.replaceAll("_", " "),
        total: Number(r.sum),
        count: r.count,
      })),
    [snapshot.byProvider],
  );

  const runSync = async (provider: "openai" | "anthropic") => {
    setBusy(provider);
    setToast(null);
    try {
      const q = new URLSearchParams({ billingAccount: syncBilling });
      const res = await fetch(`/api/sync/${provider}?${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      setToast(j.message ?? (res.ok ? "Done." : "Sync failed."));
      await refresh();
    } finally {
      setBusy(null);
    }
  };

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
            <ul className="flex flex-wrap gap-2">
              {snapshot.byAccount.map((a) => (
                <li key={a.billingAccount}>
                  <Badge variant="outline" className="h-auto max-w-full py-1.5 font-normal">
                    <span className="mr-2 font-medium">
                      {BILLING_ACCOUNT_LABEL[a.billingAccount]}
                    </span>
                    <span className="tabular-nums text-primary">
                      $
                      {Number(a.sum).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-lg font-medium">Spend by provider</h2>
          <Card>
            <CardContent className="pt-6">
              <ExpenseChart data={chartData} />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium">Add expense</h2>
          <ExpenseForm
            onCreated={async () => {
              await refresh();
            }}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Integrations</h2>
        <IntegrationPanel
          meta={PROVIDER_META}
          billingAccounts={BILLING_ACCOUNT_ORDER}
          syncBilling={syncBilling}
          onSyncBillingChange={setSyncBilling}
          onSyncOpenAI={() => runSync("openai")}
          onSyncAnthropic={() => runSync("anthropic")}
          busy={busy}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Recent expenses</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => refresh()}>
            Refresh
          </Button>
        </div>
        <ExpenseList rows={snapshot.expenses} onChanged={refresh} />
      </section>
    </div>
  );
}
