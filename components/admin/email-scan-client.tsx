"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Mail,
  Search,
  Check,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
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

type AccountInfo = {
  email: string;
  billingAccount: string;
  connected: boolean;
  tokenExpiry: string | null;
  lastSyncAt: string | null;
};

type ScanResult = {
  id: string;
  gmailEmail: string;
  gmailMessageId: string;
  subject: string;
  fromEmail: string;
  receivedAt: string;
  parsedVendor: string | null;
  parsedAmount: string | null;
  parsedCurrency: string | null;
  parsedDate: string | null;
  confidence: number | null;
  status: string;
  expenseId: string | null;
  rawSnippet: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function confidenceBadge(c: number | null) {
  if (c == null) return <Badge variant="outline">N/A</Badge>;
  if (c >= 0.8)
    return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">{(c * 100).toFixed(0)}%</Badge>;
  if (c >= 0.5)
    return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">{(c * 100).toFixed(0)}%</Badge>;
  return <Badge variant="destructive">{(c * 100).toFixed(0)}%</Badge>;
}

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge variant="outline">Pending</Badge>;
    case "IMPORTED":
      return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">Imported</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function EmailScanClient({
  accounts,
  initialResults,
}: {
  accounts: AccountInfo[];
  initialResults: ScanResult[];
}) {
  const [results, setResults] = useState<ScanResult[]>(initialResults);
  const [scanning, setScanning] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const connectGmail = async (email: string) => {
    setToast(null);
    try {
      const res = await fetch(
        `/api/gmail/auth?email=${encodeURIComponent(email)}`,
      );
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "width=600,height=700");
        setToast(
          `Google consent window opened for ${email}. Complete sign-in, then return here.`,
        );
      } else {
        setToast(data.error ?? "Failed to get auth URL.");
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  };

  const scanNow = async () => {
    setScanning(true);
    setToast(null);
    try {
      const res = await fetch("/api/gmail/scan", { method: "POST" });
      const data = await res.json();
      setToast(data.message ?? "Scan complete.");

      const resultRes = await fetch("/api/gmail/results?status=PENDING");
      const resultData = await resultRes.json();
      if (resultData.results) {
        setResults((prev) => {
          const ids = new Set(resultData.results.map((r: ScanResult) => r.id));
          const kept = prev.filter((r) => !ids.has(r.id));
          return [...resultData.results, ...kept];
        });
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActionBusy(id);
    try {
      const res = await fetch("/api/gmail/results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.ok) {
        setResults((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: action === "approve" ? "IMPORTED" : "REJECTED",
                  expenseId: data.expenseId ?? r.expenseId,
                }
              : r,
          ),
        );
      } else {
        setToast(data.error ?? "Action failed.");
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(null);
    }
  };

  const pending = results.filter((r) => r.status === "PENDING");
  const processed = results.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      {toast ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {toast}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Gmail connections
          </CardTitle>
          <CardDescription>
            Connect Gmail accounts to scan for AI vendor invoices and receipts.
            OAuth tokens are stored per account. API keys are configured in
            Vercel Environment Variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((acc) => (
            <div
              key={acc.email}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  {acc.connected ? (
                    <CheckCircle className="size-4 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 text-destructive" />
                  )}
                  <span className="text-sm font-semibold">{acc.email}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {acc.billingAccount}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {acc.connected
                    ? `Connected — last scan: ${formatDate(acc.lastSyncAt)}, token expires: ${formatDate(acc.tokenExpiry)}`
                    : "Not connected"}
                </p>
              </div>
              <Button
                size="sm"
                variant={acc.connected ? "outline" : "default"}
                onClick={() => connectGmail(acc.email)}
              >
                {acc.connected ? "Reconnect" : "Connect Gmail"}
              </Button>
            </div>
          ))}

          <div className="pt-2">
            <Button
              onClick={scanNow}
              disabled={scanning || accounts.every((a) => !a.connected)}
              className="gap-2"
            >
              {scanning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {scanning ? "Scanning…" : "Scan now"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Pending review ({pending.length})
            </CardTitle>
            <CardDescription>
              Invoices found by the scanner that need your approval before being
              imported as expenses.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-6 sm:pb-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {formatDate(r.parsedDate ?? r.receivedAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.parsedVendor ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {r.parsedAmount
                          ? `${r.parsedCurrency ?? "USD"} ${Number(r.parsedAmount).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-xs text-muted-foreground"
                        title={r.subject}
                      >
                        {r.subject}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.fromEmail}
                      </TableCell>
                      <TableCell>{confidenceBadge(r.confidence)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-500 hover:text-emerald-400"
                            disabled={actionBusy === r.id}
                            onClick={() => handleAction(r.id, "approve")}
                            title="Approve and import"
                          >
                            {actionBusy === r.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive/80"
                            disabled={actionBusy === r.id}
                            onClick={() => handleAction(r.id, "reject")}
                            title="Reject"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {processed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Processed ({processed.length})
            </CardTitle>
            <CardDescription>
              Previously approved or rejected scan results.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-6 sm:pb-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expense</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processed.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">
                        {formatDate(r.parsedDate ?? r.receivedAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.parsedVendor ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {r.parsedAmount
                          ? `${r.parsedCurrency ?? "USD"} ${Number(r.parsedAmount).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-xs text-muted-foreground"
                        title={r.subject}
                      >
                        {r.subject}
                      </TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>
                        {r.expenseId ? (
                          <a
                            href={`/expenses/${r.expenseId}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
