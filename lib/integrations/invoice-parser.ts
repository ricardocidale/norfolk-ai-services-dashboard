import { z } from "zod";
import { AiProvider } from "@prisma/client";
import { anthropicInvoiceParseModel } from "@/lib/integrations/anthropic-constants";
import { getAnthropicClient } from "@/lib/integrations/sdk-clients";
import type { GmailScanScope } from "@/lib/integrations/gmail-scan-scope";

const AI_PROVIDER_VALUES = Object.values(AiProvider) as AiProvider[];

/** Normalize model output (e.g. "openai", "Open AI") to a valid enum value when possible. */
function coerceAiProvider(raw: unknown): {
  normalized: AiProvider | null;
  rawString: string | null;
} {
  if (raw == null) return { normalized: null, rawString: null };
  const s = String(raw).trim();
  if (!s) return { normalized: null, rawString: null };
  const upper = s.toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (AI_PROVIDER_VALUES.includes(upper as AiProvider)) {
    return { normalized: upper as AiProvider, rawString: s };
  }
  return { normalized: null, rawString: s };
}

function coerceNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, "").replace(/\s/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type ParsedUsageSnapshot = {
  tokensIn: number | null;
  tokensOut: number | null;
  tokensTotal: number | null;
  computeSeconds: number | null;
  seats: number | null;
  credits: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  usageSummary: string | null;
};

const parsedInvoiceSchema = z.object({
  vendor: z.string().nullable().catch(null),
  aiProvider: z.string().nullable().catch(null),
  amount: z.string().nullable().catch(null),
  currency: z.string().nullable().catch(null),
  date: z.string().nullable().catch(null),
  invoiceNumber: z.string().nullable().catch(null),
  confidence: z.number().min(0).max(1).catch(0),
  usageTokensIn: z.unknown().optional(),
  usageTokensOut: z.unknown().optional(),
  usageTokensTotal: z.unknown().optional(),
  usageComputeSeconds: z.unknown().optional(),
  usageSeats: z.unknown().optional(),
  usageCredits: z.unknown().optional(),
  billingPeriodStart: z.string().nullable().optional().catch(null),
  billingPeriodEnd: z.string().nullable().optional().catch(null),
  usageSummary: z.string().nullable().optional().catch(null),
});

export type ParsedInvoice = {
  vendor: string | null;
  aiProvider: AiProvider | null;
  /** Raw model `aiProvider` string when it did not match the enum (for debugging / display). */
  rawAiProvider: string | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
  invoiceNumber: string | null;
  confidence: number;
  usageSnapshot: ParsedUsageSnapshot | null;
};

/**
 * Value stored on EmailScanResult.parsedVendor: known enum id, or human vendor name for imports
 * (approve maps unknown strings to Expense.provider = OTHER with this name in the label).
 */
export function resolvedScanVendor(parsed: ParsedInvoice | null): string | null {
  if (!parsed) return null;
  const vendorName = parsed.vendor?.trim() || null;
  if (parsed.aiProvider != null && parsed.aiProvider !== "OTHER") {
    return parsed.aiProvider;
  }
  if (vendorName) return vendorName;
  if (parsed.aiProvider === "OTHER") return vendorName ?? "OTHER";
  return parsed.rawAiProvider?.trim() || null;
}

function buildSystemPrompt(scope: GmailScanScope): string {
  const scopeHint =
    scope === "extended"
      ? "\nThis email may be from **any SaaS, cloud, or AI vendor** (not only classic AI API providers). Still extract the same JSON shape. Map well-known products to `aiProvider` when they match the enum. Use **GOOGLE_WORKSPACE** for Google Workspace / G Suite / business Gmail-Drive-Meet subscriptions and all Workspace editions — not GCP (use GOOGLE_API), not Gemini API (use GEMINI). Use **GOOGLE_CLOUD_STORAGE** when the bill is clearly for Cloud Storage (GCS) SKUs only; use **GOOGLE_API** for general GCP / Cloud Billing. Examples: LOVABLE, LINEAR, VERCEL, GITHUB, NOTION, FIGMA, RAILWAY, NEON, NETLIFY, AZURE, DROPBOX, DOCSEND, FLIPSNACK, TWILIO, VONAGE, ELEVENLABS, RETELL_AI. Use OTHER only when no listed value fits."
      : scope === "discover"
        ? "\nThis message was found by **subject keywords** only — the sender may be **any company**. Always set **vendor** to the **exact legal or brand name of the company charging or invoicing** (from the email body, PDF text, or footer). Map **aiProvider** to the enum when it clearly matches a listed vendor; otherwise set **aiProvider** to **null** or **OTHER** and rely on a precise **vendor** string so downstream systems can record spend under \"other\" with the correct name."
        : "";

  return `You are an invoice, receipt, and **usage statement** extractor. Given an email subject, body, and sender, extract billing and **usage** details whenever the message includes them.

For **payment confirmations, invoices, receipts, subscriptions, and billing notices**: always fill **vendor** with the company or service name that appears as the merchant or biller (even when **aiProvider** matches a known enum — the vendor field helps disambiguate product lines).

If **From** is a **bank or credit card issuer** (e.g. domains containing citi, chase, amex, capitalone, discover, bankofamerica) and the body is a **multi-line statement**, **account summary**, or lists **many merchants**, set **confidence** below **0.35** — those messages often duplicate spend already tracked from individual vendors. For a **single, clear one-line purchase or payment alert** for one amount, you may use higher confidence.

Return ONLY valid JSON (no markdown, no code fences) with these fields:
- vendor: string — company name (e.g. "OpenAI", "HubSpot", "Slack")
- aiProvider: string — one of: ${AI_PROVIDER_VALUES.join(", ")} — or null if none fits. Use GEMINI_NANO_BANANA for Google "Nano Banana" / Gemini image SKUs when distinct from API usage. Use OTHER for pure SaaS with no matching enum.
- amount: string — total charge as decimal string (e.g. "29.99"), or null
- currency: string — ISO 4217 (e.g. "USD"), or null
- date: string — charge or statement date (YYYY-MM-DD), or null
- invoiceNumber: string — invoice/receipt/statement id, or null
- confidence: number — 0 to 1 (this is a real bill/usage statement worth importing)
- usageTokensIn: number or numeric string or null — input / prompt tokens if stated
- usageTokensOut: number or numeric string or null — output / completion tokens if stated
- usageTokensTotal: number or numeric string or null — total tokens if only one figure is given
- usageComputeSeconds: number or numeric string or null — compute time in **seconds** if given (convert minutes/hours to seconds when you can)
- usageSeats: number or numeric string or null — seat or user count if billed that way
- usageCredits: number or numeric string or null — API credits or units consumed if stated
- billingPeriodStart: string or null — ISO date start of billing/usage period if stated
- billingPeriodEnd: string or null — ISO date end of period if stated
- usageSummary: string or null — one short line capturing any other usage (e.g. "1.2M requests", "840 GPU-hours") if not covered above

If the message is not a billing or usage document, set confidence below 0.3.${scopeHint}`;
}

const MAX_BODY_LENGTH = 6000;

function normalizeUsageFromParsed(
  parsed: z.infer<typeof parsedInvoiceSchema>,
): ParsedUsageSnapshot | null {
  const snap: ParsedUsageSnapshot = {
    tokensIn: coerceNullableNumber(parsed.usageTokensIn),
    tokensOut: coerceNullableNumber(parsed.usageTokensOut),
    tokensTotal: coerceNullableNumber(parsed.usageTokensTotal),
    computeSeconds: coerceNullableNumber(parsed.usageComputeSeconds),
    seats: coerceNullableNumber(parsed.usageSeats),
    credits: coerceNullableNumber(parsed.usageCredits),
    periodStart: parsed.billingPeriodStart ?? null,
    periodEnd: parsed.billingPeriodEnd ?? null,
    usageSummary: parsed.usageSummary ?? null,
  };
  const empty =
    snap.tokensIn == null &&
    snap.tokensOut == null &&
    snap.tokensTotal == null &&
    snap.computeSeconds == null &&
    snap.seats == null &&
    snap.credits == null &&
    !snap.periodStart &&
    !snap.periodEnd &&
    !(snap.usageSummary && snap.usageSummary.trim());
  return empty ? null : snap;
}

export async function parseInvoiceWithAI(
  subject: string,
  bodyText: string,
  fromEmail: string,
  scope: GmailScanScope = "standard",
): Promise<ParsedInvoice | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const trimmedBody = bodyText.slice(0, MAX_BODY_LENGTH);

  const response = await client.messages.create({
    model: anthropicInvoiceParseModel(),
    max_tokens: 1200,
    system: buildSystemPrompt(scope),
    messages: [
      {
        role: "user",
        content: `Subject: ${subject}\nFrom: ${fromEmail}\n\nBody:\n${trimmedBody}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  if (!text) return null;

  try {
    const raw: unknown = JSON.parse(text);
    const parsed = parsedInvoiceSchema.parse(raw);

    const { normalized, rawString } = coerceAiProvider(parsed.aiProvider);

    return {
      vendor: parsed.vendor?.trim() || null,
      aiProvider: normalized,
      rawAiProvider: rawString,
      amount: parsed.amount,
      currency: parsed.currency,
      date: parsed.date,
      invoiceNumber: parsed.invoiceNumber,
      confidence: parsed.confidence,
      usageSnapshot: normalizeUsageFromParsed(parsed),
    };
  } catch {
    return null;
  }
}
