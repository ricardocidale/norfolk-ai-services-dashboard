import { gmail, type gmail_v1 } from "@googleapis/gmail";
import type { OAuth2Client } from "google-auth-library";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emailInvoiceFingerprint, findDuplicateScanResult } from "@/lib/expenses/dedup";
import {
  CORE_INVOICE_DOMAINS,
  EXTRA_SOFTWARE_AI_DOMAINS,
} from "@/lib/integrations/gmail-scan-domains";
import { getAuthenticatedClient } from "@/lib/integrations/gmail-client";
import {
  parseInvoiceWithAI,
  resolvedScanVendor,
  type ParsedUsageSnapshot,
} from "@/lib/integrations/invoice-parser";

import type { GmailScanScope } from "@/lib/integrations/gmail-scan-scope";

export type { GmailScanScope } from "@/lib/integrations/gmail-scan-scope";

const SUBJECT_KEYWORDS_STANDARD: readonly string[] = [
  "invoice",
  "receipt",
  "payment",
  "subscription",
  "billing",
  "order",
  "charge",
];

const SUBJECT_KEYWORDS_EXTENDED: readonly string[] = [
  ...SUBJECT_KEYWORDS_STANDARD,
  "usage",
  "statement",
  "summary",
  "report",
  "renewal",
  "seats",
  "credits",
  "quota",
  "activity",
  "tokens",
];

/** Discover scope: omit statement/summary/report to reduce card issuer multi-line statements. */
const SUBJECT_KEYWORDS_DISCOVER: readonly string[] = [
  ...SUBJECT_KEYWORDS_STANDARD,
  "usage",
  "renewal",
  "seats",
  "credits",
  "quota",
  "activity",
  "tokens",
];

const SNIPPET_MAX = 500;

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function listQueriesForScope(scope: GmailScanScope): string[] {
  if (scope === "discover") {
    const keywords = SUBJECT_KEYWORDS_DISCOVER.join(" OR ");
    return [
      `subject:(${keywords}) newer_than:120d`,
      `(subject:invoice OR subject:receipt OR subject:payment OR subject:billing OR subject:subscription OR subject:charge OR subject:renewal) newer_than:120d`,
    ];
  }

  const keywords =
    scope === "extended"
      ? SUBJECT_KEYWORDS_EXTENDED
      : SUBJECT_KEYWORDS_STANDARD;
  const subjectPart = `subject:(${keywords.join(" OR ")})`;

  if (scope === "standard") {
    const fromPart = `from:(${CORE_INVOICE_DOMAINS.join(" OR ")})`;
    return [`${fromPart} ${subjectPart}`];
  }

  const allDomains = [
    ...new Set([...CORE_INVOICE_DOMAINS, ...EXTRA_SOFTWARE_AI_DOMAINS]),
  ];
  const chunks = chunkArray(allDomains, 14);
  return chunks.map(
    (domains) => `from:(${domains.join(" OR ")}) ${subjectPart}`,
  );
}

function extractTextFromParts(
  parts: gmail_v1.Schema$MessagePart[] | undefined,
): string {
  if (!parts) return "";
  let text = "";
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64url").toString("utf-8");
    }
    if (part.parts) {
      text += extractTextFromParts(part.parts);
    }
  }
  return text;
}

export type ScannedEmail = {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  bodyText: string;
};

async function listMessageIdsForScope(
  gmailClient: gmail_v1.Gmail,
  scope: GmailScanScope,
): Promise<string[]> {
  const queries = listQueriesForScope(scope);
  const perQueryLimit =
    scope === "standard" ? 48 : scope === "discover" ? 32 : 24;
  const maxTotal = scope === "standard" ? 52 : scope === "discover" ? 48 : 88;

  const idLists = await Promise.all(
    queries.map(async (q) => {
      const listRes = await gmailClient.users.messages.list({
        userId: "me",
        q,
        maxResults: perQueryLimit,
      });
      return (listRes.data.messages ?? [])
        .map((m) => m.id)
        .filter((id): id is string => !!id);
    }),
  );

  return dedupePreserveOrder(idLists.flat()).slice(0, maxTotal);
}

async function fetchMessages(
  gmailClient: gmail_v1.Gmail,
  scope: GmailScanScope,
): Promise<ScannedEmail[]> {
  const messageIds = await listMessageIdsForScope(gmailClient, scope);
  const results: ScannedEmail[] = [];

  for (const msgId of messageIds) {
    const existing = await prisma.emailScanResult.findUnique({
      where: { gmailMessageId: msgId },
      select: { id: true },
    });
    if (existing) continue;

    const detail = await gmailClient.users.messages.get({
      userId: "me",
      id: msgId,
      format: "full",
    });

    const headers = detail.data.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
    const from =
      headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
    const dateHeader =
      headers.find((h) => h.name?.toLowerCase() === "date")?.value ?? "";

    let bodyText = "";
    if (detail.data.payload?.body?.data) {
      bodyText = Buffer.from(
        detail.data.payload.body.data,
        "base64url",
      ).toString("utf-8");
    }
    if (!bodyText && detail.data.payload?.parts) {
      bodyText = extractTextFromParts(detail.data.payload.parts);
    }

    results.push({
      messageId: msgId,
      subject,
      from,
      date: dateHeader,
      snippet: detail.data.snippet ?? "",
      bodyText,
    });
  }

  return results;
}

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader;
}

export type ScanSummary = {
  email: string;
  scanned: number;
  newResults: number;
  errors: string[];
  scope: GmailScanScope;
};

export async function scanGmailForInvoices(
  email: string,
  options?: { scope?: GmailScanScope },
): Promise<ScanSummary> {
  const scope = options?.scope ?? "standard";
  const errors: string[] = [];
  let authClient: OAuth2Client;
  try {
    authClient = await getAuthenticatedClient(email);
  } catch (e) {
    return {
      email,
      scanned: 0,
      newResults: 0,
      errors: [e instanceof Error ? e.message : String(e)],
      scope,
    };
  }

  const gmailClient = gmail({ version: "v1", auth: authClient });

  let messages: ScannedEmail[];
  try {
    messages = await fetchMessages(gmailClient, scope);
  } catch (e) {
    return {
      email,
      scanned: 0,
      newResults: 0,
      errors: [e instanceof Error ? e.message : String(e)],
      scope,
    };
  }

  let newResults = 0;
  const batchFingerprints = new Set<string>();

  for (const msg of messages) {
    try {
      const senderEmail = extractEmailAddress(msg.from);
      const receivedAt = new Date(msg.date);
      const fp = emailInvoiceFingerprint(senderEmail, msg.subject, receivedAt);
      if (batchFingerprints.has(fp)) {
        errors.push(
          `Message ${msg.messageId}: skipped — duplicate invoice in same mailbox batch`,
        );
        continue;
      }

      const duplicate = await findDuplicateScanResult({
        fromEmail: senderEmail,
        subject: msg.subject,
        receivedAt,
        excludeGmailMessageId: msg.messageId,
      });
      if (duplicate) {
        errors.push(
          `Message ${msg.messageId}: skipped — duplicate of scan in ${duplicate.gmailEmail} (forwarded email)`,
        );
        continue;
      }

      const parsed = await parseInvoiceWithAI(
        msg.subject,
        msg.bodyText,
        senderEmail,
        scope,
      );

      batchFingerprints.add(fp);

      const usageJson: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined =
        parsed?.usageSnapshot && hasUsageData(parsed.usageSnapshot)
          ? (parsed.usageSnapshot as Prisma.InputJsonValue)
          : undefined;

      await prisma.emailScanResult.create({
        data: {
          gmailEmail: email,
          gmailMessageId: msg.messageId,
          subject: msg.subject,
          fromEmail: senderEmail,
          receivedAt,
          parsedVendor: resolvedScanVendor(parsed),
          parsedAmount: parsed?.amount ?? null,
          parsedCurrency: parsed?.currency ?? null,
          parsedDate: parsed?.date ? new Date(parsed.date) : null,
          confidence: parsed?.confidence ?? null,
          ...(usageJson !== undefined ? { parsedUsage: usageJson } : {}),
          status: "PENDING",
          rawSnippet: msg.snippet.slice(0, SNIPPET_MAX),
        },
      });
      newResults++;
    } catch (e) {
      errors.push(
        `Message ${msg.messageId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  try {
    await prisma.gmailConnection.update({
      where: { email },
      data: { lastSyncAt: new Date() },
    });
  } catch {
    errors.push("Failed to update lastSyncAt timestamp");
  }

  return { email, scanned: messages.length, newResults, errors, scope };
}

function hasUsageData(u: ParsedUsageSnapshot): boolean {
  return (
    u.tokensIn != null ||
    u.tokensOut != null ||
    u.tokensTotal != null ||
    u.computeSeconds != null ||
    u.seats != null ||
    u.credits != null ||
    u.periodStart != null ||
    u.periodEnd != null ||
    (u.usageSummary != null && u.usageSummary.trim().length > 0)
  );
}
