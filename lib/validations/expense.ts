import { AiProvider, BillingAccount } from "@prisma/client";
import { z } from "zod";

const providerEnum = z.nativeEnum(AiProvider);
const billingEnum = z.nativeEnum(BillingAccount);

export const expenseCreateSchema = z.object({
  provider: providerEnum,
  billingAccount: billingEnum,
  amount: z.union([z.number(), z.string()]).transform((v) => String(v)),
  currency: z
    .string()
    .min(1)
    .max(8)
    .default("USD")
    .transform((c) => c.trim().toUpperCase()),
  incurredAt: z.string().datetime().or(z.coerce.date()),
  periodStart: z.string().datetime().optional().nullable(),
  periodEnd: z.string().datetime().optional().nullable(),
  label: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  source: z.string().max(64).default("manual"),
  externalRef: z.string().max(512).optional().nullable(),
});

export const expenseUpdateSchema = expenseCreateSchema.partial();

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

/** Shared contract for `GET /api/expenses?provider=` and similar query params. */
export function parseAiProviderQueryParam(
  v: string | null,
): AiProvider | undefined {
  if (!v) return undefined;
  return (Object.values(AiProvider) as string[]).includes(v)
    ? (v as AiProvider)
    : undefined;
}
