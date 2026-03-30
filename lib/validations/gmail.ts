import { z } from "zod";

export const gmailAuthGetSchema = z.object({
  email: z.string().email("Valid email required"),
});

export const gmailAuthPostSchema = z.object({
  code: z.string().min(1, "OAuth code is required"),
  email: z.string().email("Valid email required"),
});

export const gmailScanPostSchema = z.object({
  emails: z.array(z.string().email()).optional(),
  /** standard = core AI/vendor domains; extended = more SaaS + broader subject keywords */
  scope: z
    .enum(["standard", "extended", "discover"])
    .optional()
    .default("standard"),
});

export const gmailResultsGetSchema = z.object({
  status: z.enum(["PENDING", "IMPORTED", "REJECTED"]).optional(),
});

export const gmailResultsPatchSchema = z.object({
  id: z.string().min(1, "id is required"),
  action: z.enum(["approve", "reject"]),
  /** Set true to import a card-issuer email line despite an amount/date overlap (risk double-count). */
  acknowledgeCardDuplicateRisk: z.boolean().optional(),
});

const trimmedNonEmpty = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1));

export const googleOAuthEnvSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: trimmedNonEmpty,
  GOOGLE_OAUTH_CLIENT_SECRET: trimmedNonEmpty,
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().url()),
});

export type GmailAuthGetInput = z.infer<typeof gmailAuthGetSchema>;
export type GmailAuthPostInput = z.infer<typeof gmailAuthPostSchema>;
export type GmailScanPostInput = z.infer<typeof gmailScanPostSchema>;
export type GmailResultsGetInput = z.infer<typeof gmailResultsGetSchema>;
export type GmailResultsPatchInput = z.infer<typeof gmailResultsPatchSchema>;
