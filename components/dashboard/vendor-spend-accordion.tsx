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
