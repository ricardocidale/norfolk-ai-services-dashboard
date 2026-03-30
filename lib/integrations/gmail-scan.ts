import { gmail, type gmail_v1 } from "@googleapis/gmail";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";
import { getAuthenticatedClient } from "@/lib/integrations/gmail-client";
import { parseInvoiceWithAI } from "@/lib/integrations/invoice-parser";

const VENDOR_DOMAINS: readonly string[] = [
  "anthropic.com",
  "openai.com",
  "cursor.sh",
  "cursor.com",
  "replit.com",
  "elevenlabs.io",
  "google.com",
  "gemini.google.com",
  "github.com",
  "vercel.com",
  "netlify.com",
  "aws.amazon.com",
  "azure.microsoft.com",
  "mistral.ai",
  "perplexity.ai",
  "midjourney.com",
  "stripe.com",
];

const SUBJECT_KEYWORDS: readonly string[] = [
  "invoice",
  "receipt",
  "payment",
  "subscription",
  "billing",
  "order",
  "charge",
];

function buildSearchQuery(): string {
  const fromPart = `from:(${VENDOR_DOMAINS.join(" OR ")})`;
  const subjectPart = `subject:(${SUBJECT_KEYWORDS.join(" OR ")})`;
  return `${fromPart} ${subjectPart}`;
}

const SNIPPET_MAX = 500;

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

async function fetchMessages(
  gmailClient: gmail_v1.Gmail,
  _email: string,
  maxResults = 50,
): Promise<ScannedEmail[]> {
  const query = buildSearchQuery();
  const listRes = await gmailClient.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messageIds = listRes.data.messages ?? [];
  const results: ScannedEmail[] = [];

  for (const msg of messageIds) {
    if (!msg.id) continue;

    const existing = await prisma.emailScanResult.findUnique({
      where: { gmailMessageId: msg.id },
      select: { id: true },
    });
    if (existing) continue;

    const detail = await gmailClient.users.messages.get({
      userId: "me",
      id: msg.id,
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
      messageId: msg.id,
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
};

export async function scanGmailForInvoices(
  email: string,
): Promise<ScanSummary> {
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
    };
  }

  const gmailClient = gmail({ version: "v1", auth: authClient });

  let messages: ScannedEmail[];
  try {
    messages = await fetchMessages(gmailClient, email);
  } catch (e) {
    return {
      email,
      scanned: 0,
      newResults: 0,
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }

  let newResults = 0;

  for (const msg of messages) {
    try {
      const parsed = await parseInvoiceWithAI(
        msg.subject,
        msg.bodyText,
        extractEmailAddress(msg.from),
      );

      await prisma.emailScanResult.create({
        data: {
          gmailEmail: email,
          gmailMessageId: msg.messageId,
          subject: msg.subject,
          fromEmail: extractEmailAddress(msg.from),
          receivedAt: new Date(msg.date),
          parsedVendor: parsed?.vendor ?? null,
          parsedAmount: parsed?.amount ?? null,
          parsedCurrency: parsed?.currency ?? null,
          parsedDate: parsed?.date ? new Date(parsed.date) : null,
          confidence: parsed?.confidence ?? null,
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

  return { email, scanned: messages.length, newResults, errors };
}
