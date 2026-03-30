"use client";

import { useMemo, useState } from "react";
import { DEFAULT_SYNC_LOOKBACK_MONTHS } from "@/lib/integrations/sync-range";
import type { ExpenseSourceStatus } from "@/lib/admin/expense-sources";
import { providerMeta } from "@/lib/vendors/providers-meta";
import { VENDOR_CATEGORY_LABEL } from "@/lib/vendors/vendor-categories";
import type { CertaintyLevel } from "@/lib/admin/expense-source-provenance";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  apiErrorMessageFromBody,
  unwrapApiSuccessData,
} from "@/lib/http/api-response";

type ProbeKey = "openai" | "anthropic" | "perplexity";
type SyncKey = "openai" | "anthropic" | "chatgpt" | "perplexity";

function archetypeTitle(t: ExpenseSourceStatus["provenance"]["archetype"]): string {
  switch (t) {
    case "admin_api":
      return "Vendor admin APIs";
    case "env_monthly":
      return "Environment monthly total";
    default:
      return "Manual & email-assisted";
  }
}

function certaintyStyles(level: CertaintyLevel): {
  badge: string;
  dot: string;
} {
  switch (level) {
    case "high":
      return {
        badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
      };
    case "medium":
      return {
        badge: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400",
        dot: "bg-amber-500",
      };
    default:
      return {
        badge: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
        dot: "bg-muted-foreground/60",
      };
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

  const summary = useMemo(() => {
    let api = 0;
    let env = 0;
    let manual = 0;
    let apiReady = 0;
    let envReady = 0;
    for (const r of initialStatuses) {
      if (r.provenance.archetype === "admin_api") {
        api += 1;
        if (r.envSatisfied) apiReady += 1;
      } else if (r.provenance.archetype === "env_monthly") {
        env += 1;
        if (r.envSatisfied) envReady += 1;
      } else {
        manual += 1;
      }
    }
    return { api, env, manual, apiReady, envReady };
  }, [initialStatuses]);

  const byArchetype = useMemo(() => {
    const m = new Map<
      ExpenseSourceStatus["provenance"]["archetype"],
      ExpenseSourceStatus[]
    >([
      ["admin_api", []],
      ["env_monthly", []],
      ["manual_capture", []],
    ]);
    for (const r of initialStatuses) {
      m.get(r.provenance.archetype)!.push(r);
    }
    return m;
  }, [initialStatuses]);

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
      const j = await res.json();
      if (!res.ok) {
        setToast(apiErrorMessageFromBody(j) ?? "Sync failed.");
        return;
      }
      const d = unwrapApiSuccessData<{ message: string; imported?: number }>(j);
      setToast(d?.message ?? "Done.");
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
      const j = await res.json();
      if (!res.ok) {
        const msg = apiErrorMessageFromBody(j) ?? "Failed";
        setProbeHint((prev) => ({ ...prev, [probeKey]: msg }));
        setToast(msg);
        return;
      }
      const d = unwrapApiSuccessData<{ message: string }>(j);
      const line = d?.message ?? "OK";
      setProbeHint((prev) => ({ ...prev, [probeKey]: line }));
      setToast(line);
    } finally {
      setProbeBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How the app gets numbers</CardTitle>
          <CardDescription className="text-pretty text-foreground/90">
            Each vendor row in the dashboard comes from an <strong>Expense</strong>{" "}
            record. Automated paths write a stable <code className="text-xs">source</code>{" "}
            tag (e.g. OpenAI/Anthropic API sync, ChatGPT/Perplexity env sync). Manual
            rows, CSV import, and approved Gmail scans use lower-priority sources.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Redundancy & double-counting:</strong>{" "}
            When you approve a Gmail scan, the app checks for an{" "}
            <strong className="text-foreground">existing API-synced expense</strong>{" "}
            for the same vendor, nearby date, and similar amount — and warns instead
            of importing a duplicate. API-backed rows are treated as canonical over
            email-derived ones.
          </p>
          <p>
            <strong className="text-foreground">Certainty is not “is the number
            right?”</strong> It summarizes{" "}
            <em>how much automation and structure</em> back the total: API line
            items (high), env monthly rollup (medium), or manual/email (variable).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admin API sync</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary.apiReady}/{summary.api}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            OpenAI & Anthropic with keys configured — itemized usage/cost from vendor
            APIs (~{DEFAULT_SYNC_LOOKBACK_MONTHS}‑month default window).
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Env monthly</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {summary.envReady}/{summary.env}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            ChatGPT & Perplexity: CHATGPT_MONTHLY_USD / PERPLEXITY_MONTHLY_USD drive
            rolled monthly rows (you maintain the figure).
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Manual capture</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{summary.manual}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            No in-app pull; use Add expense, import, or Gmail scan approval. Completeness
            depends on process.
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legend:</span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          High — API line items
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-500" aria-hidden />
          Medium — env monthly rollup
        </span>
        <span className="text-border">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-muted-foreground/60" aria-hidden />
          Low / variable — manual or blocked
        </span>
      </div>

      {toast ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {toast}
        </p>
      ) : null}

      <Accordion
        type="multiple"
        defaultValue={["api", "env", "manual"]}
        className="space-y-3"
      >
        {(
          [
            ["admin_api", "api"],
            ["env_monthly", "env"],
            ["manual_capture", "manual"],
          ] as const
        ).map(([archetype, accId]) => {
          const rows = byArchetype.get(archetype)!;
          if (rows.length === 0) return null;
          return (
            <AccordionItem
              key={accId}
              value={accId}
              className="rounded-xl border bg-card px-4"
            >
              <AccordionTrigger className="py-4 text-left hover:no-underline">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="text-sm font-semibold">
                    {archetypeTitle(archetype)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {rows.length} vendor{rows.length === 1 ? "" : "s"}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4 pt-0">
                {rows.map((row) => {
                  const cs = certaintyStyles(row.provenance.certaintyLevel);
                  const cat = providerMeta(row.providerId)?.category;
                  return (
                    <div
                      key={row.providerId}
                      className="flex flex-col gap-4 rounded-lg border bg-muted/10 p-4 lg:flex-row lg:items-start"
                    >
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold leading-snug">
                            {row.label}
                          </span>
                          {cat ? (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {VENDOR_CATEGORY_LABEL[cat]}
                            </Badge>
                          ) : null}
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase tracking-wide ${cs.badge}`}
                          >
                            {row.provenance.certaintyLabel}
                          </Badge>
                          <span
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                            title={
                              row.envSatisfied
                                ? "Primary automation path configured"
                                : "Primary automation not fully configured"
                            }
                          >
                            <span
                              className={`inline-block size-2 rounded-full ${cs.dot}`}
                              aria-hidden
                            />
                            {row.envSatisfied ? "Ready" : "Action needed"}
                          </span>
                          {row.perplexityProbeOnly ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Test API only — set monthly USD to sync spend
                            </Badge>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-foreground">
                            How we get numbers
                          </p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {row.provenance.howWeGetNumbers}
                          </p>
                        </div>

                        <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                          {row.provenance.coveragePoints.map((pt, i) => (
                            <li key={i} className="leading-relaxed">
                              {pt}
                            </li>
                          ))}
                        </ul>

                        {row.provenance.redundancyNote ? (
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-200/90">
                            <span className="font-medium text-foreground">
                              Overlap / separation:{" "}
                            </span>
                            {row.provenance.redundancyNote}
                          </div>
                        ) : null}

                        {row.provenance.gmailSupplement ? (
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            <strong className="text-foreground">Gmail scan: </strong>
                            Admin email scanner can propose rows for this vendor;
                            approval still runs duplicate checks against API sync
                            where applicable.
                          </p>
                        ) : null}

                        <p className="text-xs text-muted-foreground">
                          Default billing identity:{" "}
                          <span className="font-medium text-foreground">
                            {row.billingEmail}
                          </span>
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground/90">
                          {row.description}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/60 pt-3 lg:flex-col lg:items-stretch lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        {isProbeable(row.syncType) ? (
                          <div className="flex flex-col gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={probeBusy === row.syncType}
                              className="w-full min-w-[7rem] sm:w-auto lg:w-full"
                              onClick={() => runProbe(row.syncType as ProbeKey)}
                              title={
                                row.syncType === "perplexity"
                                  ? "Uses PERPLEXITY_API_KEY on the server when set"
                                  : undefined
                              }
                            >
                              {probeBusy === row.syncType ? "Testing…" : "Test API"}
                            </Button>
                            {probeHint[row.syncType] ? (
                              <span className="max-w-[220px] text-[10px] text-muted-foreground lg:text-right">
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
                            className="w-full min-w-[7rem] sm:w-auto lg:w-full"
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
                            className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline lg:block"
                          >
                            Vendor docs
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
