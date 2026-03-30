"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import type { AiProvider, BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_LABEL } from "@/lib/billing-accounts";
import { providerMeta } from "@/lib/providers-meta";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type VendorSpendRow = {
  provider: AiProvider;
  total: string;
  count: number;
};

type ExpenseLine = {
  id: string;
  provider: AiProvider;
  billingAccount: BillingAccount;
  amount: string;
  currency: string;
  incurredAt: string;
  label: string | null;
  notes: string | null;
  source: string;
};

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

type ParsedUsageNotes = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  modelsUsed: string[];
  costByModel: Record<string, string>;
};

function parseUsageNotes(notes: string | null): ParsedUsageNotes | null {
  if (!notes) return null;
  try {
    const obj = JSON.parse(notes) as Record<string, unknown>;
    if (obj.source !== "anthropic_messages_usage_report") return null;
    const num = (k: string) => {
      const v = obj[k];
      return typeof v === "number" && Number.isFinite(v) ? v : 0;
    };
    return {
      totalTokens: num("total_tokens"),
      inputTokens: num("input_tokens"),
      outputTokens: num("output_tokens"),
      cacheReadTokens: num("cache_read_input_tokens"),
      cacheCreationTokens: num("cache_creation_input_tokens"),
      modelsUsed: Array.isArray(obj.models_used)
        ? (obj.models_used as string[])
        : [],
      costByModel:
        obj.cost_by_model && typeof obj.cost_by_model === "object"
          ? (obj.cost_by_model as Record<string, string>)
          : {},
    };
  } catch {
    return null;
  }
}

function formatTokenCount(n: number): string {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function UsageDetail({ notes }: { notes: string | null }) {
  const usage = parseUsageNotes(notes);
  if (!usage || usage.totalTokens === 0) return null;

  const parts: string[] = [];
  if (usage.inputTokens > 0)
    parts.push(`${formatTokenCount(usage.inputTokens)} in`);
  if (usage.outputTokens > 0)
    parts.push(`${formatTokenCount(usage.outputTokens)} out`);
  if (usage.cacheReadTokens > 0)
    parts.push(`${formatTokenCount(usage.cacheReadTokens)} cache-read`);

  const modelCosts = Object.entries(usage.costByModel);

  return (
    <span className="flex flex-col gap-0.5">
      <span>{formatTokenCount(usage.totalTokens)} tokens ({parts.join(", ")})</span>
      {usage.modelsUsed.length > 0 && (
        <span className="text-muted-foreground">
          {modelCosts.length > 0
            ? modelCosts.map(([m, c]) => `${m}: ${c}`).join(", ")
            : usage.modelsUsed.join(", ")}
        </span>
      )}
    </span>
  );
}

function cacheKey(
  provider: AiProvider,
  from: string,
  to: string,
): string {
  return `${provider}|${from}|${to}`;
}

export function VendorSpendAccordion(
  props: {
    rows: VendorSpendRow[];
    from: string;
    to: string;
    emptyMessage: string;
    /** Shown above the transaction list when a row is expanded (e.g. month breakdown). */
    panelPrefix?: (provider: AiProvider) => ReactNode;
  },
) {
  return (
    <VendorSpendAccordionInner
      key={`${props.from}|${props.to}`}
      {...props}
    />
  );
}

function VendorSpendAccordionInner({
  rows,
  from,
  to,
  emptyMessage,
  panelPrefix,
}: {
  rows: VendorSpendRow[];
  from: string;
  to: string;
  emptyMessage: string;
  panelPrefix?: (provider: AiProvider) => ReactNode;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const [cache, setCache] = useState<
    Record<string, ExpenseLine[] | "loading" | "error">
  >({});

  const fetchLines = useCallback(
    async (provider: AiProvider) => {
      const key = cacheKey(provider, from, to);
      setCache((c) => {
        if (Array.isArray(c[key])) return c;
        return { ...c, [key]: "loading" };
      });
      const params = new URLSearchParams({
        provider,
        from,
        to,
        take: "500",
      });
      try {
        const res = await fetch(`/api/expenses?${params.toString()}`);
        const json = (await res.json()) as {
          expenses?: ExpenseLine[];
          error?: unknown;
        };
        if (!res.ok) {
          setCache((c) => ({ ...c, [key]: "error" }));
          return;
        }
        const list = json.expenses ?? [];
        setCache((c) => ({ ...c, [key]: list }));
      } catch {
        setCache((c) => ({ ...c, [key]: "error" }));
      }
    },
    [from, to],
  );

  const onOpenChange = useCallback(
    (next: string[]) => {
      const added = next.filter((p) => !open.includes(p));
      setOpen(next);
      for (const prov of added) {
        void fetchLines(prov as AiProvider);
      }
    },
    [open, fetchLines],
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => Number(b.total) - Number(a.total)),
    [rows],
  );

  if (sortedRows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Accordion
      type="multiple"
      className="rounded-xl border px-3"
      value={open}
      onValueChange={onOpenChange}
    >
      {sortedRows.map((row) => {
        const key = cacheKey(row.provider, from, to);
        const bucket = cache[key];
        const expanded = open.includes(row.provider);
        return (
          <AccordionItem key={row.provider} value={row.provider}>
            <AccordionTrigger className="hover:no-underline">
              <span className="min-w-0 flex-1 font-medium">
                {providerLabel(row.provider)}
              </span>
              <span className="shrink-0 tabular-nums text-primary">
                {formatUsd(row.total)}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {row.count} lines
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {!expanded ? null : (
                <>
                  {panelPrefix ? (
                    <div className="mb-3">{panelPrefix(row.provider)}</div>
                  ) : null}
                  {bucket === undefined || bucket === "loading" ? (
                    <p className="text-sm text-muted-foreground">
                      Loading transactions…
                    </p>
                  ) : bucket === "error" ? (
                    <p className="text-sm text-destructive">
                      Could not load transactions.
                    </p>
                  ) : bucket.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No line items in this range (totals may come from rolled-up
                      sync rows).
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border bg-muted/20">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Billing</TableHead>
                            <TableHead className="text-xs">Amount</TableHead>
                            <TableHead className="text-xs">Usage</TableHead>
                            <TableHead className="text-xs">
                              Label / source
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bucket.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="whitespace-nowrap text-xs tabular-nums">
                                {new Date(e.incurredAt).toLocaleDateString(
                                  undefined,
                                  { dateStyle: "medium" },
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {BILLING_ACCOUNT_LABEL[e.billingAccount]}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums font-medium">
                                {formatUsd(e.amount)} {e.currency}
                              </TableCell>
                              <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                                <UsageDetail notes={e.notes} />
                              </TableCell>
                              <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                                {e.label ?? "—"}{" "}
                                <span className="opacity-70">({e.source})</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
