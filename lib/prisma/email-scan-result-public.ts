import type { Prisma } from "@prisma/client";

/**
 * Columns used by admin UI and `GET /api/gmail/results` for listing scans.
 * Excludes `parsedUsage` so Prisma never selects a column that may be missing
 * on databases that have not applied the migration adding `EmailScanResult.parsedUsage`.
 *
 * **After production has that column:** you can extend the PATCH approve path in
 * `app/api/gmail/results/route.ts` with a `findUnique` select that includes
 * `parsedUsage: true` and merge `notes.usage` again from the row (list endpoints
 * can keep using this object to avoid shipping large JSON in admin hub).
 */
export const emailScanResultPublicSelect = {
  id: true,
  gmailEmail: true,
  gmailMessageId: true,
  subject: true,
  fromEmail: true,
  receivedAt: true,
  parsedVendor: true,
  parsedAmount: true,
  parsedCurrency: true,
  parsedDate: true,
  confidence: true,
  status: true,
  expenseId: true,
  rawSnippet: true,
} satisfies Prisma.EmailScanResultSelect;

export type EmailScanResultPublic = Prisma.EmailScanResultGetPayload<{
  select: typeof emailScanResultPublicSelect;
}>;

/** API/UI shape: same row plus optional usage JSON (null when not loaded). */
export type EmailScanResultPublicWithUsage = EmailScanResultPublic & {
  parsedUsage: unknown | null;
};

export function withParsedUsagePlaceholder(
  row: EmailScanResultPublic,
): EmailScanResultPublicWithUsage {
  return { ...row, parsedUsage: null };
}
