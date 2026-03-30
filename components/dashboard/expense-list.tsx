"use client";

import type { AiProvider, BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_LABEL } from "@/lib/billing-accounts";
import { providerMeta } from "@/lib/providers-meta";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ExpenseRow = {
  id: string;
  provider: AiProvider;
  billingAccount: BillingAccount;
  amount: string;
  currency: string;
  incurredAt: string;
  label: string | null;
  source: string;
};

export function ExpenseList({
  rows,
  onChanged,
}: {
  rows: ExpenseRow[];
  onChanged: () => Promise<void>;
}) {
  async function remove(id: string) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    await onChanged();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        No rows yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="w-[72px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                {new Date(r.incurredAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="font-medium">
                {formatProvider(r.provider)}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                {BILLING_ACCOUNT_LABEL[r.billingAccount]}
              </TableCell>
              <TableCell className="text-right tabular-nums text-primary">
                {r.currency} {Number(r.amount).toFixed(2)}
              </TableCell>
              <TableCell className="text-muted-foreground">{r.source}</TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(r.id)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatProvider(p: AiProvider) {
  return providerMeta(p)?.label ?? p.replaceAll("_", " ");
}
