"use client";

import { useState } from "react";
import type { BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_ORDER } from "@/lib/billing-accounts";
import type { ExpenseSourceStatus } from "@/lib/admin/expense-sources";
import { PROVIDER_META } from "@/lib/providers-meta";
import { IntegrationPanel } from "@/components/dashboard/integration-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function ExpenseSourcesClient({
  initialStatuses,
}: {
  initialStatuses: ExpenseSourceStatus[];
}) {
  const [syncBilling, setSyncBilling] = useState<BillingAccount>("NORFOLK_GROUP");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [probeBusy, setProbeBusy] = useState<string | null>(null);
  const [probeHint, setProbeHint] = useState<Record<string, string>>({});

  const runSync = async (
    provider: "openai" | "anthropic" | "chatgpt" | "perplexity",
  ) => {
    setBusy(provider);
    setToast(null);
    try {
      const q = new URLSearchParams({ billingAccount: syncBilling });
      const res = await fetch(`/api/sync/${provider}?${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as { message?: string };
      setToast(j.message ?? (res.ok ? "Done." : "Sync failed."));
    } finally {
      setBusy(null);
    }
  };

  const runProbe = async (probeKey: "openai" | "anthropic" | "perplexity") => {
    setProbeBusy(probeKey);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/probe/${probeKey}`, {
        method: "POST",
      });
      const j = (await res.json()) as { ok?: boolean; message?: string };
      setProbeHint((prev) => ({
        ...prev,
        [probeKey]: j.message ?? (j.ok ? "OK" : "Failed"),
      }));
      if (j.message) setToast(j.message);
    } finally {
      setProbeBusy(null);
    }
  };

  return (
    <div className="space-y-10">
      {toast ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {toast}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Source registry</CardTitle>
          <CardDescription>
            Each vendor maps to how spend enters the dashboard: automated API
            sync, or manual entry and import. Variables in{" "}
            <code className="text-xs">.env</code> apply locally; for production,
            copy the same names into your host (e.g. Vercel) — GitHub Actions
            secrets alone are not visible to the deployed app.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          <div className="overflow-x-auto rounded-xl border sm:rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead className="text-right">Verify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialStatuses.map((row) => (
                  <TableRow key={row.providerId}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.syncType === "manual" ? "outline" : "secondary"
                        }
                        className="text-[10px] uppercase tracking-wide"
                      >
                        {row.syncType === "manual"
                          ? "Manual / import"
                          : row.syncType === "chatgpt" ||
                              row.syncType === "perplexity"
                            ? "Env monthly"
                            : `${row.syncType} API`}
                      </Badge>
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">
                        {row.description}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                      {row.requiredEnvSummary}
                      <div className="mt-1">
                        <Badge
                          variant={
                            row.envSatisfied ? "secondary" : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {row.envSatisfied ? "Configured" : "Missing env"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.syncType === "openai" ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={probeBusy === "openai"}
                            onClick={() => runProbe("openai")}
                          >
                            {probeBusy === "openai"
                              ? "Testing…"
                              : "Test OpenAI API"}
                          </Button>
                          {probeHint.openai ? (
                            <span className="max-w-[200px] text-[10px] text-muted-foreground">
                              {probeHint.openai}
                            </span>
                          ) : null}
                        </div>
                      ) : row.syncType === "anthropic" ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={probeBusy === "anthropic"}
                            onClick={() => runProbe("anthropic")}
                          >
                            {probeBusy === "anthropic"
                              ? "Testing…"
                              : "Test Anthropic API"}
                          </Button>
                          {probeHint.anthropic ? (
                            <span className="max-w-[200px] text-[10px] text-muted-foreground">
                              {probeHint.anthropic}
                            </span>
                          ) : null}
                        </div>
                      ) : row.syncType === "perplexity" ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={probeBusy === "perplexity"}
                            onClick={() => runProbe("perplexity")}
                          >
                            {probeBusy === "perplexity"
                              ? "Testing…"
                              : "Test Perplexity API key"}
                          </Button>
                          {probeHint.perplexity ? (
                            <span className="max-w-[200px] text-[10px] text-muted-foreground">
                              {probeHint.perplexity}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Sync from APIs</h2>
          <p className="text-sm text-muted-foreground">
            Pull usage into expenses when keys have the right scopes. Same
            controls as before, now under Admin.
          </p>
        </div>
        <IntegrationPanel
          meta={PROVIDER_META}
          billingAccounts={BILLING_ACCOUNT_ORDER}
          syncBilling={syncBilling}
          onSyncBillingChange={setSyncBilling}
          onSyncOpenAI={() => runSync("openai")}
          onSyncAnthropic={() => runSync("anthropic")}
          onSyncChatGPT={() => runSync("chatgpt")}
          onSyncPerplexity={() => runSync("perplexity")}
          busy={busy}
        />
      </section>
    </div>
  );
}
