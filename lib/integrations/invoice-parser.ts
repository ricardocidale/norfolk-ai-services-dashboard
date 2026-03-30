import { z } from "zod";
import { getAnthropicClient } from "@/lib/sdk-clients";
import type { AiProvider } from "@prisma/client";

const AI_PROVIDER_VALUES: AiProvider[] = [
  "CURSOR",
  "ANTHROPIC",
  "OPENAI",
  "CHATGPT",
  "GOOGLE_API",
  "GEMINI",
  "MANUS",
  "REPLIT",
  "VERCEL",
  "ELEVENLABS",
  "PERPLEXITY",
  "MIDJOURNEY",
  "AWS_BEDROCK",
  "MISTRAL",
  "COHERE",
  "OTHER",
];

const parsedInvoiceSchema = z.object({
  vendor: z.string().nullable().catch(null),
  aiProvider: z.string().nullable().catch(null),
  amount: z.string().nullable().catch(null),
  currency: z.string().nullable().catch(null),
  date: z.string().nullable().catch(null),
  invoiceNumber: z.string().nullable().catch(null),
  confidence: z.number().min(0).max(1).catch(0),
});

export type ParsedInvoice = {
  vendor: string | null;
  aiProvider: AiProvider | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
  invoiceNumber: string | null;
  confidence: number;
};

const SYSTEM_PROMPT = `You are an invoice/receipt data extractor. Given an email subject line, body text, and sender email, extract billing information.

Return ONLY valid JSON (no markdown, no code fences) with these fields:
- vendor: string — the company name (e.g. "OpenAI", "Anthropic", "Cursor")
- aiProvider: string — one of: ${AI_PROVIDER_VALUES.join(", ")} — or null if unsure
- amount: string — numeric amount as a decimal string (e.g. "29.99"), or null
- currency: string — ISO 4217 code (e.g. "USD"), or null
- date: string — ISO date of the charge (YYYY-MM-DD), or null
- invoiceNumber: string — invoice/receipt number, or null
- confidence: number — 0 to 1, how confident you are this is a real AI vendor invoice

If the email is not actually an invoice/receipt for an AI service, set confidence below 0.3.`;

const MAX_BODY_LENGTH = 4000;

export async function parseInvoiceWithAI(
  subject: string,
  bodyText: string,
  fromEmail: string,
): Promise<ParsedInvoice | null> {
  const client = getAnthropicClient();
  if (!client) return null;

  const trimmedBody = bodyText.slice(0, MAX_BODY_LENGTH);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
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

    const aiProvider =
      typeof parsed.aiProvider === "string" &&
      AI_PROVIDER_VALUES.includes(parsed.aiProvider as AiProvider)
        ? (parsed.aiProvider as AiProvider)
        : null;

    return {
      vendor: parsed.vendor,
      aiProvider,
      amount: parsed.amount,
      currency: parsed.currency,
      date: parsed.date,
      invoiceNumber: parsed.invoiceNumber,
      confidence: parsed.confidence,
    };
  } catch {
    return null;
  }
}
