"use client";

import { useState } from "react";
import type { AiProvider, BillingAccount } from "@prisma/client";
import {
  BILLING_ACCOUNT_LABEL,
  BILLING_ACCOUNT_ORDER,
} from "@/lib/billing-accounts";
import { PROVIDER_META } from "@/lib/providers-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ExpenseForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [provider, setProvider] = useState<AiProvider>("OPENAI");
  const [billingAccount, setBillingAccount] = useState<BillingAccount>(
    "NORFOLK_GROUP",
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incurredAt, setIncurredAt] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const d = new Date(incurredAt + "T12:00:00.000Z");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        billingAccount,
        amount,
        currency,
        incurredAt: d.toISOString(),
        label: label || null,
        source: "manual",
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Could not save.");
      return;
    }
    setAmount("");
    setLabel("");
    await onCreated();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="expense-provider">Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as AiProvider)}
            >
              <SelectTrigger id="expense-provider" className="w-full">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_META.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-billing">Billing account</Label>
            <Select
              value={billingAccount}
              onValueChange={(v) => setBillingAccount(v as BillingAccount)}
            >
              <SelectTrigger id="expense-billing" className="w-full">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {BILLING_ACCOUNT_ORDER.map((a) => (
                  <SelectItem key={a} value={a}>
                    {BILLING_ACCOUNT_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-currency">Currency</Label>
              <Input
                id="expense-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-date">Date</Label>
            <Input
              id="expense-date"
              type="date"
              required
              value={incurredAt}
              onChange={(e) => setIncurredAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-label">Label (optional)</Label>
            <Input
              id="expense-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Invoice #, plan name…"
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save expense"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
