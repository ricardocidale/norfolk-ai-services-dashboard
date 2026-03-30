"use client";

import { useState } from "react";
import { DEFAULT_SYNC_LOOKBACK_MONTHS } from "@/lib/integrations/sync-range";
import type { ExpenseSourceStatus } from "@/lib/admin/expense-sources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProbeKey = "openai" | "anthropic" | "perplexity";
type SyncKey = "openai" | "anthropic" | "chatgpt" | "perplexity";

function syncLabel(t: ExpenseSourceStatus["syncType"]): string {
  switch (t) {
    case "openai":
      return "API sync";
    case "anthropic":
      return "API sync";
    case "chatgpt":
      return "Env monthly";
    case "perplexity":
      return "Env monthly";
    default:
      return "Manual / import";
  }
}

function isSyncable(t: ExpenseSourceStatus["syncType"]): t is SyncKey {
  return t !== "manual";
}

function isProbeable(t: ExpenseSourceStatus["syncType"]): t is ProbeKey {
  return t === "openai" || t === "anthropic" || t === "perplexity";
}

export function ExpenseSourcesClient({
  initialStatuses,
}: {
  initialStatuses: ExpenseSourceStatus[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [probeBusy, setProbeBusy] = useState<string | null>(null);
  const [probeHint, setProbeHint] = useState<Record<string, string>>({});

  const runSync = async (provider: SyncKey) => {
    setBusy(provider);
    setToast(null);
    try {
      const end = new Date();
      const start = new Date(end.getTime());
      start.setUTCMonth(start.getUTCMonth() - DEFAULT_SYNC_LOOKBACK_MONTHS);
      const body =
        provider === "openai" || provider === "anthropic"
          ? { start: start.toISOString(), end: end.toISOString() }
          : {};
      const res = await fetch(`/api/sync/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { message?: string };
      setToast(j.message ?? (res.ok ? "Done." : "Sync failed."));
    } finally {
      setBusy(null);
    }
  };

  const runProbe = async (probeKey: ProbeKey) => {
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
    <div className="space-y-4">
      {toast ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {toast}
        </p>
      ) : null}

      <div className="space-y-3">
        {initialStatuses.map((row) => (
            <div
              key={row.providerId}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold leading-snug">
                    {row.label}
                  </span>
                  <Badge
                    variant={
                      row.syncType === "manual" ? "outline" : "secondary"
                    }
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {syncLabel(row.syncType)}
                  </Badge>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs"
                    title={
                      row.envSatisfied
                        ? "API credentials detected in Vercel env"
                        : "Missing credentials — set in Vercel Environment Variables"
                    }
                  >
                    <span
                      className={`inline-block size-2 rounded-full ${
                        row.envSatisfied
                          ? "bg-emerald-500"
                          : "bg-destructive"
                      }`}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">
                      {row.envSatisfied ? "Connected" : "Not configured"}
                    </span>
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {row.description}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Billing account:{" "}
                  <span className="font-medium text-foreground">
                    {row.billingEmail}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {isProbeable(row.syncType) ? (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={probeBusy === row.syncType}
                      onClick={() => runProbe(row.syncType as ProbeKey)}
                    >
                      {probeBusy === row.syncType ? "Testing…" : "Test API"}
                    </Button>
                    {probeHint[row.syncType] ? (
                      <span className="max-w-[200px] text-right text-[10px] text-muted-foreground">
                        {probeHint[row.syncType]}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {isSyncable(row.syncType) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === row.syncType || !row.envSatisfied}
                    onClick={() => runSync(row.syncType as SyncKey)}
                  >
                    {busy === row.syncType ? "Syncing…" : "Sync now"}
                  </Button>
                ) : null}
                {row.docsUrl ? (
                  <a
                    href={row.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Docs
                  </a>
                ) : null}
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}
