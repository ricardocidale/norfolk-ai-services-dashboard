"use client";

import type { BillingAccount } from "@prisma/client";
import { BILLING_ACCOUNT_LABEL } from "@/lib/billing-accounts";
import type { ProviderMeta } from "@/lib/providers-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function IntegrationPanel({
  meta,
  billingAccounts,
  syncBilling,
  onSyncBillingChange,
  onSyncOpenAI,
  onSyncAnthropic,
  busy,
}: {
  meta: ProviderMeta[];
  billingAccounts: BillingAccount[];
  syncBilling: BillingAccount;
  onSyncBillingChange: (a: BillingAccount) => void;
  onSyncOpenAI: () => void;
  onSyncAnthropic: () => void;
  busy: string | null;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="sync-billing">Billing account for API sync</Label>
            <Select
              value={syncBilling}
              onValueChange={(v) => onSyncBillingChange(v as BillingAccount)}
            >
              <SelectTrigger id="sync-billing" className="w-[min(100%,280px)]">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {billingAccounts.map((a) => (
                  <SelectItem key={a} value={a}>
                    {BILLING_ACCOUNT_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            OpenAI sync attributes imported rows to this identity. Keys stay in
            environment variables only.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        {meta.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-base font-medium leading-tight">
                {p.label}
              </CardTitle>
              <Badge
                variant={p.sync === "manual" ? "outline" : "secondary"}
                className="shrink-0 text-[10px] uppercase tracking-wide"
              >
                {p.sync === "manual" ? "Manual" : "API"}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 pb-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30 pt-3">
              {p.docsUrl ? (
                <Button variant="link" size="sm" className="h-auto px-0" asChild>
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Docs
                  </a>
                </Button>
              ) : null}
              {p.sync === "openai" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === "openai"}
                  onClick={onSyncOpenAI}
                >
                  {busy === "openai" ? "Syncing…" : "Sync OpenAI costs"}
                </Button>
              ) : null}
              {p.sync === "anthropic" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy === "anthropic"}
                  onClick={onSyncAnthropic}
                >
                  {busy === "anthropic" ? "Checking…" : "Anthropic status"}
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
