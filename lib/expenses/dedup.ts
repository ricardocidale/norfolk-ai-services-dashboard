import { prisma } from "@/lib/db";
import type { AiProvider } from "@prisma/client";
import Decimal from "decimal.js";

/**
 * Source priority — higher number = more authoritative.
 * API-synced data is canonical; email scan data is supplementary.
 */
const SOURCE_PRIORITY: Record<string, number> = {
  anthropic_admin_api: 100,
  openai_api: 100,
  chatgpt_env_sync: 90,
  perplexity_env_sync: 90,
  gmail_scan: 50,
  import: 30,
  manual: 10,
  seed: 0,
};

export function sourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 20;
}

/** API-based sync sources that are always canonical. */
const API_SOURCES = new Set([
  "anthropic_admin_api",
  "openai_api",
  "chatgpt_env_sync",
  "perplexity_env_sync",
]);

export function isApiSyncSource(source: string): boolean {
  return API_SOURCES.has(source);
}

/**
 * Check if an API-synced expense already covers a given vendor + date + amount.
 * Used at Gmail scan approve time to prevent double-counting.
 *
 * Returns the matching expense if found, null otherwise.
 * Match criteria (all must hold):
 *   - Same provider (or both map to the same AiProvider)
 *   - Date falls within ±1 day of the existing expense's incurredAt
 *   - Amount within 5% tolerance (invoices may round differently than API)
 *   - Source is an API sync source (not gmail_scan, manual, etc.)
 */
export async function findOverlappingApiExpense(opts: {
  provider: AiProvider;
  date: Date;
  amount: string;
  currency: string;
}): Promise<{
  id: string;
  source: string;
  amount: string;
  incurredAt: Date;
  externalRef: string | null;
  label: string | null;
} | null> {
  const dayMs = 24 * 60 * 60 * 1000;
  const dateStart = new Date(opts.date.getTime() - dayMs);
  const dateEnd = new Date(opts.date.getTime() + dayMs);
  const targetAmount = new Decimal(opts.amount || "0");
  const currency = opts.currency.trim().toUpperCase() || "USD";

  if (targetAmount.isZero()) return null;

  const candidates = await prisma.expense.findMany({
    where: {
      provider: opts.provider,
      currency,
      incurredAt: { gte: dateStart, lte: dateEnd },
      source: { in: [...API_SOURCES] },
    },
    select: {
      id: true,
      source: true,
      amount: true,
      incurredAt: true,
      externalRef: true,
      label: true,
    },
    take: 20,
  });

  for (const c of candidates) {
    const existingAmount = new Decimal(c.amount.toString());
    if (existingAmount.isZero()) continue;

    const diff = targetAmount.minus(existingAmount).abs();
    const tolerance = Decimal.max(existingAmount, targetAmount).times(0.05);

    if (diff.lte(tolerance)) {
      return {
        ...c,
        amount: existingAmount.toString(),
      };
    }
  }

  return null;
}

/**
 * For **card-issuer** emails (Citi, Chase, Amex, …): detect another expense with
 * the same amount (±5%) in a ±2 day window — any provider, any non-seed source.
 * Merchants are often already recorded via API sync, manual entry, or a prior Gmail
 * import; approving the card line would double-count.
 */
export async function findOverlappingExpenseByAmountForCardIssuer(opts: {
  date: Date;
  amount: string;
  currency: string;
}): Promise<{
  id: string;
  source: string;
  provider: AiProvider;
  label: string | null;
  amount: string;
  incurredAt: Date;
} | null> {
  const dayMs = 24 * 60 * 60 * 1000;
  const dateStart = new Date(opts.date.getTime() - 2 * dayMs);
  const dateEnd = new Date(opts.date.getTime() + 2 * dayMs);
  const targetAmount = new Decimal(opts.amount || "0");
  const currency = opts.currency.trim().toUpperCase() || "USD";

  if (targetAmount.isZero()) return null;

  const candidates = await prisma.expense.findMany({
    where: {
      currency,
      incurredAt: { gte: dateStart, lte: dateEnd },
      source: { not: "seed" },
    },
    select: {
      id: true,
      source: true,
      provider: true,
      label: true,
      amount: true,
      incurredAt: true,
    },
    take: 50,
  });

  for (const c of candidates) {
    const existingAmount = new Decimal(c.amount.toString());
    if (existingAmount.isZero()) continue;

    const diff = targetAmount.minus(existingAmount).abs();
    const tolerance = Decimal.max(existingAmount, targetAmount).times(0.05);

    if (diff.lte(tolerance)) {
      return {
        id: c.id,
        source: c.source,
        provider: c.provider,
        label: c.label,
        amount: existingAmount.toString(),
        incurredAt: c.incurredAt,
      };
    }
  }

  return null;
}

/**
 * Build a deterministic fingerprint for an email invoice to detect
 * forwarded duplicates across different inboxes.
 *
 * Uses: fromEmail (sender) + subject (normalized) + date (day only).
 * If the same invoice is forwarded from cidale.com to norfolkgroup.io,
 * both scans will produce the same fingerprint.
 */
export function emailInvoiceFingerprint(
  fromEmail: string,
  subject: string,
  receivedAt: Date,
): string {
  const normalizedFrom = fromEmail.toLowerCase().trim();
  const normalizedSubject = subject
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(fwd?|re):\s*/gi, "")
    .trim();
  const dayKey = receivedAt.toISOString().slice(0, 10);
  return `${normalizedFrom}|${normalizedSubject}|${dayKey}`;
}

/**
 * Check if a scan result with the same fingerprint already exists
 * (from a different inbox / gmailEmail).
 */
export async function findDuplicateScanResult(opts: {
  fromEmail: string;
  subject: string;
  receivedAt: Date;
  excludeGmailMessageId?: string;
}): Promise<{ id: string; gmailEmail: string; status: string } | null> {
  const fp = emailInvoiceFingerprint(
    opts.fromEmail,
    opts.subject,
    opts.receivedAt,
  );
  const [normalizedFrom, normalizedSubject, dayKey] = fp.split("|");
  const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999Z`);

  const candidates = await prisma.emailScanResult.findMany({
    where: {
      fromEmail: { equals: normalizedFrom, mode: "insensitive" },
      receivedAt: { gte: dayStart, lte: dayEnd },
      ...(opts.excludeGmailMessageId
        ? { gmailMessageId: { not: opts.excludeGmailMessageId } }
        : {}),
    },
    select: { id: true, gmailEmail: true, status: true, subject: true },
    take: 20,
  });

  for (const c of candidates) {
    const cSubject = c.subject
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/^(fwd?|re):\s*/gi, "")
      .trim();
    if (cSubject === normalizedSubject) {
      return { id: c.id, gmailEmail: c.gmailEmail, status: c.status };
    }
  }

  return null;
}
