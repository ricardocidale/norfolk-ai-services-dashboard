"use client";

import { useEffect, useState } from "react";
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
import type { GmailScanScope } from "@/lib/integrations/gmail-scan-scope";
import {
  formatScanVendorDisplay,
  isKnownAiProviderString,
} from "@/lib/vendors/scan-vendor-display";
import {
  cardIssuerScanHint,
  isCardIssuerFromEmail,
} from "@/lib/expenses/card-issuer-email";
import {
  apiErrorMessageFromBody,
  unwrapApiSuccessData,
} from "@/lib/http/api-response";

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
  parsedUsage: unknown;
  status: string;
  expenseId: string | null;
  rawSnippet: string | null;
};

function formatUsageFromScan(u: unknown): string {
  if (u == null || typeof u !== "object") return "—";
  const o = u as Record<string, unknown>;
  const fmtNum = (v: unknown): string | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v.toLocaleString();
    if (typeof v === "string") {
      const n = parseFloat(v.replace(/,/g, ""));
      return Number.isFinite(n) ? n.toLocaleString() : null;
    }
    return null;
  };
  const bits: string[] = [];
  const total = fmtNum(o.tokensTotal);
  if (total) bits.push(`${total} tokens`);
  else {
    const ti = fmtNum(o.tokensIn);
    const to = fmtNum(o.tokensOut);
    if (ti || to) bits.push(`${ti ?? "—"} in / ${to ?? "—"} out`);
  }
  const sec = fmtNum(o.computeSeconds);
  if (sec) bits.push(`${sec}s compute`);
  const seats = fmtNum(o.seats);
  if (seats) bits.push(`${seats} seats`);
  const credits = fmtNum(o.credits);
  if (credits) bits.push(`${credits} credits`);
  if (typeof o.usageSummary === "string" && o.usageSummary.trim()) {
    bits.push(o.usageSummary.trim());
  }
  if (
    typeof o.periodStart === "string" &&
    o.periodStart &&
    typeof o.periodEnd === "string" &&
    o.periodEnd
  ) {
    bits.push(`${o.periodStart} → ${o.periodEnd}`);
  }
  return bits.length ? bits.slice(0, 4).join(" · ") : "—";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(
  amount: string | null,
  currency: string | null,
): string {
  if (!amount) return "—";
  const num = Number(amount);
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency ?? "USD"} ${num.toFixed(2)}`;
  }
}

function confidenceBadge(c: number | null) {
  if (c == null) return <Badge variant="outline">N/A</Badge>;
  if (c >= 0.8)
    return <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">{(c * 100).toFixed(0)}%</Badge>;
  if (c >= 0.5)
    return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">{(c * 100).toFixed(0)}%</Badge>;
  return <Badge variant="destructive">{(c * 100).toFixed(0)}%</Badge>;
}

function ScanVendorCell({ parsedVendor }: { parsedVendor: string | null }) {
  return (
    <TableCell className="text-sm font-medium">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {formatScanVendorDisplay(parsedVendor)}
        {parsedVendor && !isKnownAiProviderString(parsedVendor) ? (
          <Badge variant="secondary" className="text-[9px]">
            New / other
          </Badge>
        ) : null}
      </span>
    </TableCell>
  );
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
  const [scanning, setScanning] = useState<false | GmailScanScope>(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [discovered, setDiscovered] = useState<
    { displayName: string; hitCount: number; lastSeenAt: string }[]
  >([]);
  const [discoveredLoading, setDiscoveredLoading] = useState(true);
  const [cardOverlapById, setCardOverlapById] = useState<
    Record<string, { existingExpenseId: string; existingLabel: string | null }>
  >({});

  const refreshDiscovered = async (): Promise<void> => {
    setDiscoveredLoading(true);
    try {
      const res = await fetch("/api/admin/discovered-vendors");
      const j = await res.json();
      const d = unwrapApiSuccessData<{
        vendors: { displayName: string; hitCount: number; lastSeenAt: string }[];
      }>(j);
      if (Array.isArray(d?.vendors)) setDiscovered(d.vendors);
    } catch {
      setDiscovered([]);
    } finally {
      setDiscoveredLoading(false);
    }
  };

  useEffect(() => {
    void refreshDiscovered();
  }, []);

  const connectGmail = async (email: string): Promise<void> => {
    setToast(null);
    try {
      const res = await fetch(
        `/api/gmail/auth?email=${encodeURIComponent(email)}`,
      );
      const json = await res.json();
      const d = unwrapApiSuccessData<{ url: string }>(json);
      if (d?.url) {
        window.location.href = d.url;
      } else {
        setToast(apiErrorMessageFromBody(json) ?? "Failed to get auth URL.");
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  };

  const scanNow = async (scope: GmailScanScope): Promise<void> => {
    setScanning(scope);
    setToast(null);
    try {
      const res = await fetch("/api/gmail/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = await res.json();
      const scanData = unwrapApiSuccessData<{
        message: string;
        results: unknown;
      }>(json);
      setToast(
        scanData?.message ??
          apiErrorMessageFromBody(json) ??
          "Scan complete.",
      );

      const resultRes = await fetch("/api/gmail/results?status=PENDING");
      const resultJson = await resultRes.json();
      const pendingData = unwrapApiSuccessData<{ results: ScanResult[] }>(
        resultJson,
      );
      if (pendingData?.results) {
        setResults((prev) => {
          const ids = new Set(pendingData.results.map((r: ScanResult) => r.id));
          const kept = prev.filter((r) => !ids.has(r.id));
          return [...pendingData.results, ...kept];
        });
      }
      void refreshDiscovered();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (
    id: string,
    action: "approve" | "reject",
    options?: { acknowledgeCardDuplicateRisk?: boolean },
  ): Promise<void> => {
    setActionBusy(id);
    try {
      const res = await fetch("/api/gmail/results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          ...(options?.acknowledgeCardDuplicateRisk
            ? { acknowledgeCardDuplicateRisk: true }
            : {}),
        }),
      });
      const json = await res.json();
      const errBody = json as {
        ok?: boolean;
        error?: { code?: string; details?: Record<string, unknown> };
      };
      const overlapDetails =
        res.status === 409 &&
        errBody.ok === false &&
        errBody.error?.code === "CARD_ISSUER_OVERLAP"
          ? (errBody.error.details as {
              reason?: string;
              existingExpenseId?: string;
              existingLabel?: string | null;
            })
          : null;
      if (overlapDetails?.reason === "card_issuer_amount_overlap") {
        setCardOverlapById((prev) => ({
          ...prev,
          [id]: {
            existingExpenseId: overlapDetails.existingExpenseId ?? "",
            existingLabel: overlapDetails.existingLabel ?? null,
          },
        }));
        setToast(
          apiErrorMessageFromBody(json) ??
            "Possible duplicate of an existing expense.",
        );
        return;
      }
      const okData = unwrapApiSuccessData<{
        status: string;
        expenseId?: string;
      }>(json);
      if (okData) {
        setCardOverlapById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setResults((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: action === "approve" ? "IMPORTED" : "REJECTED",
                  expenseId: okData.expenseId ?? r.expenseId,
                }
              : r,
          ),
        );
        void refreshDiscovered();
      } else {
        setToast(apiErrorMessageFromBody(json) ?? "Action failed.");
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
            Connect Gmail to find billing and usage emails. Use{" "}
            <strong>Core scan</strong> for known AI and key vendor domains,{" "}
            <strong>Extended scan</strong> for more SaaS / cloud domains, or{" "}
            <strong>Discover scan</strong> for <em>any sender</em> whose subject
            looks like invoice, payment, receipt, or billing (finds new vendors not
            in the domain lists). <strong>Card issuers</strong> (Citi, Chase, Amex,
            …) are flagged: approving may be blocked if the same amount already
            exists from a merchant or API — use{" "}
            <em>Import anyway</em> only for a genuinely separate charge. Discover
            omits broad &quot;statement&quot; subject matches to reduce statement
            spam. Unknown merchants import as <strong>Other</strong> with the parsed
            name. Parsed <strong>usage</strong> fields flow into notes when you
            approve.
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

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              onClick={() => scanNow("standard")}
              disabled={!!scanning || accounts.every((a) => !a.connected)}
              className="gap-2"
            >
              {scanning === "standard" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {scanning === "standard" ? "Scanning…" : "Core scan"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => scanNow("extended")}
              disabled={!!scanning || accounts.every((a) => !a.connected)}
              className="gap-2"
            >
              {scanning === "extended" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {scanning === "extended"
                ? "Extended scan…"
                : "Extended scan (SaaS + AI)"}
            </Button>
            <Button
              variant="outline"
              onClick={() => scanNow("discover")}
              disabled={!!scanning || accounts.every((a) => !a.connected)}
              className="gap-2 border-primary/40"
            >
              {scanning === "discover" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {scanning === "discover"
                ? "Discover scan…"
                : "Discover (any sender, invoice subjects)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendors from email (not in catalog)</CardTitle>
          <CardDescription>
            Company names the model extracted that do not match a dashboard{" "}
            <code className="text-xs">AiProvider</code> id — candidates to add to
            the vendor list. Approve those rows to record spend under{" "}
            <strong>Other</strong> with this name on the expense.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {discoveredLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : discovered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No free-text vendor names yet. Run a scan (especially Discover) to
              populate this list.
            </p>
          ) : (
            <div className="max-h-56 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Scans</TableHead>
                    <TableHead className="text-right">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discovered.slice(0, 40).map((d) => (
                    <TableRow key={d.displayName}>
                      <TableCell className="text-sm font-medium">
                        {d.displayName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {d.hitCount}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(d.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Pending review ({pending.length})
            </CardTitle>
            <CardDescription>
              Billing or usage emails pending review. Approve to import as
              expenses (usage metadata is stored in expense notes when present).
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
                    <TableHead>Usage</TableHead>
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
                      <ScanVendorCell parsedVendor={r.parsedVendor} />
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatMoney(r.parsedAmount, r.parsedCurrency)}
                      </TableCell>
                      <TableCell
                        className="max-w-[160px] text-xs text-muted-foreground"
                        title={formatUsageFromScan(r.parsedUsage)}
                      >
                        {formatUsageFromScan(r.parsedUsage)}
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate text-xs text-muted-foreground"
                        title={r.subject}
                      >
                        {r.subject}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                        <span className="break-all">{r.fromEmail}</span>
                        {isCardIssuerFromEmail(r.fromEmail) ? (
                          <Badge
                            variant="outline"
                            className="mt-1 block w-fit border-amber-500/50 text-[9px] text-amber-800 dark:text-amber-200"
                            title={cardIssuerScanHint()}
                          >
                            Card / bank sender
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{confidenceBadge(r.confidence)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-2">
                          {cardOverlapById[r.id] ? (
                            <div className="max-w-[220px] space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-left text-[10px] text-amber-950 dark:text-amber-100">
                              <p>
                                Overlaps expense{" "}
                                <code className="text-[9px]">
                                  {cardOverlapById[r.id].existingExpenseId.slice(
                                    0,
                                    8,
                                  )}
                                  …
                                </code>
                                {cardOverlapById[r.id].existingLabel
                                  ? ` — ${cardOverlapById[r.id].existingLabel}`
                                  : ""}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 w-full text-[10px]"
                                disabled={actionBusy === r.id}
                                onClick={() =>
                                  handleAction(r.id, "approve", {
                                    acknowledgeCardDuplicateRisk: true,
                                  })
                                }
                              >
                                Import anyway (double-count risk)
                              </Button>
                            </div>
                          ) : null}
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
                    <TableHead>Usage</TableHead>
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
                      <ScanVendorCell parsedVendor={r.parsedVendor} />
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatMoney(r.parsedAmount, r.parsedCurrency)}
                      </TableCell>
                      <TableCell
                        className="max-w-[160px] text-xs text-muted-foreground"
                        title={formatUsageFromScan(r.parsedUsage)}
                      >
                        {formatUsageFromScan(r.parsedUsage)}
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate text-xs text-muted-foreground"
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
