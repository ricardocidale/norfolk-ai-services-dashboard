import Anthropic from "@anthropic-ai/sdk";
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

export type ParsedInvoice = {
  vendor: string | null;
  aiProvider: AiProvider | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
  invoiceNumber: string | null;
  confidence: number;
};

function getClient(): Anthropic | null {
  const key =
    process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

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

export async function parseInvoiceWithAI(
  subject: string,
  bodyText: string,
  fromEmail: string,
): Promise<ParsedInvoice | null> {
  const client = getClient();
  if (!client) return null;

  const trimmedBody = bodyText.slice(0, 4000);

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
    const parsed = JSON.parse(text) as Record<string, unknown>;

    const aiProvider =
      typeof parsed.aiProvider === "string" &&
      AI_PROVIDER_VALUES.includes(parsed.aiProvider as AiProvider)
        ? (parsed.aiProvider as AiProvider)
        : null;

    return {
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      aiProvider,
      amount: typeof parsed.amount === "string" ? parsed.amount : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
      invoiceNumber:
        typeof parsed.invoiceNumber === "string"
          ? parsed.invoiceNumber
          : null,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0,
    };
  } catch {
    return null;
  }
}
