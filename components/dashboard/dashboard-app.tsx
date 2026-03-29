"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AiProvider, BillingAccount } from "@prisma/client";
import { RefreshCw } from "lucide-react";
import { getShowCharts } from "@/lib/dashboard-prefs";
import {
  BILLING_ACCOUNT_LABEL,
  BILLING_ACCOUNT_ORDER,
} from "@/lib/billing-accounts";
import { DEFAULT_SYNC_LOOKBACK_MONTHS } from "@/lib/integrations/sync-range";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { VendorSpendAnalytics } from "@/lib/analytics/vendor-spend";
import { providerMeta } from "@/lib/providers-meta";
import { cn } from "@/lib/utils";
import { ExpenseChart } from "./expense-chart";
import { ExpenseList } from "./expense-list";
import { VendorSyncFetchingBanner } from "./vendor-sync-fetching-banner";
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
  const SYNC_AUTO = "__auto__";
  const [syncBillingOverride, setSyncBillingOverride] = useState<
    BillingAccount | typeof SYNC_AUTO
  >(SYNC_AUTO);
  const [removeSampleRows, setRemoveSampleRows] = useState(false);
  const [vendorSyncBusy, setVendorSyncBusy] = useState(false);
  const [showCharts, setShowChartsLocal] = useState(false);
  useEffect(() => {
    setShowChartsLocal(getShowCharts());
  }, []);

  const refresh = async (opts?: { silent?: boolean }) => {
    const [expRes, sumRes, vsRes] = await Promise.all([
      fetch("/api/expenses?take=120"),
      fetch("/api/summary"),
      fetch("/api/analytics/vendor-spend"),
    ]);
    const expJson = await expRes.json();
    const sumJson = await sumRes.json();
    const vsJson = await vsRes.json();
    if (!expRes.ok || !sumRes.ok || !vsRes.ok) {
      if (!opts?.silent) setToast("Could not refresh data.");
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
    if (!opts?.silent) {
      setToast("Updated.");
      setTimeout(() => setToast(null), 2500);
    }
  };

  const syncAllFromVendors = async () => {
    setVendorSyncBusy(true);
    setToast(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById("vendor-sync-fetching-banner");
        if (!el) return;
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        el.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "nearest",
        });
      });
    });
    try {
      const end = new Date();
      const start = new Date(end.getTime());
      start.setUTCMonth(start.getUTCMonth() - DEFAULT_SYNC_LOOKBACK_MONTHS);
      const res = await fetch("/api/admin/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(syncBillingOverride !== SYNC_AUTO
            ? { billingAccount: syncBillingOverride }
            : {}),
          start: start.toISOString(),
          end: end.toISOString(),
          removeSampleRows,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        message?: string;
        summary?: string;
      };
      if (!res.ok) {
        setToast(j.message ?? "Vendor sync failed.");
        return;
      }
      setToast(j.summary ?? "Vendor sync finished.");
      await refresh({ silent: true });
      setTimeout(() => setToast(null), 14000);
    } finally {
      setVendorSyncBusy(false);
    }
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
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

      <VendorSyncFetchingBanner
        active={vendorSyncBusy}
        className="sticky top-2 z-30 backdrop-blur-md"
      />

      <section
        className={cn(
          "grid gap-4 sm:grid-cols-3",
          vendorSyncBusy &&
            "motion-reduce:opacity-100 motion-reduce:blur-none opacity-[0.88] blur-[0.5px] transition-[opacity,filter] duration-300",
        )}
        aria-busy={vendorSyncBusy}
      >
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

      {showAdminSourcesLink ? (
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pull latest vendor data</CardTitle>
            <CardDescription>
              Each vendor uses its default billing email. Runs OpenAI and
              Anthropic API sync (12-month window), then ChatGPT and Perplexity
              env-based monthly rows. Sample &quot;seed&quot; rows can be removed
              first.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="dash-sync-billing">
                Override billing account{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={syncBillingOverride}
                onValueChange={(v) =>
                  setSyncBillingOverride(v as BillingAccount | typeof SYNC_AUTO)
                }
                disabled={vendorSyncBusy}
              >
                <SelectTrigger id="dash-sync-billing" className="w-[min(100%,320px)]">
                  <SelectValue placeholder="Auto (per-vendor defaults)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SYNC_AUTO}>Auto (per-vendor defaults)</SelectItem>
                  {BILLING_ACCOUNT_ORDER.map((a) => (
                    <SelectItem key={a} value={a}>
                      {BILLING_ACCOUNT_LABEL[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={removeSampleRows}
                disabled={vendorSyncBusy}
                onChange={(e) => setRemoveSampleRows(e.target.checked)}
              />
              Remove sample (seed) expenses first
            </label>
            <Button
              type="button"
              disabled={vendorSyncBusy}
              onClick={() => syncAllFromVendors()}
              className="gap-2 sm:ml-auto"
            >
              <RefreshCw
                className={`size-4 ${vendorSyncBusy ? "animate-spin" : ""}`}
              />
              {vendorSyncBusy ? "Syncing…" : "Sync vendors & refresh"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section
        className={cn(
          "space-y-4",
          vendorSyncBusy &&
            "motion-reduce:opacity-100 motion-reduce:blur-none opacity-[0.88] blur-[0.5px] transition-[opacity,filter] duration-300",
        )}
        aria-busy={vendorSyncBusy}
      >
        <h2 className="text-lg font-medium">Vendor tables</h2>
        <VendorSpendTables data={snapshot.vendorSpend} />
      </section>

      {showCharts ? (
        <section
          className={cn(
            "space-y-4",
            vendorSyncBusy &&
              "motion-reduce:opacity-100 motion-reduce:blur-none opacity-[0.88] blur-[0.5px] transition-[opacity,filter] duration-300",
          )}
          aria-busy={vendorSyncBusy}
        >
          <h2 className="text-lg font-medium">Spend by provider</h2>
          <Card>
            <CardContent className="pt-6">
              <ExpenseChart data={chartData} />
            </CardContent>
          </Card>
        </section>
      ) : null}

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
