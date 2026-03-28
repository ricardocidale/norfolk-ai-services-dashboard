import type { AiProvider } from "@prisma/client";

export type ProviderMeta = {
  id: AiProvider;
  label: string;
  description: string;
  sync: "openai" | "anthropic" | "manual";
  docsUrl?: string;
};

/** Ordered list for dashboard and integrations UI */
export const PROVIDER_META: ProviderMeta[] = [
  {
    id: "CURSOR",
    label: "Cursor",
    description: "IDE subscription and usage (typically manual or invoice import).",
    sync: "manual",
    docsUrl: "https://cursor.com/docs",
  },
  {
    id: "ANTHROPIC",
    label: "Anthropic / Claude API",
    description: "Claude API and Console billing.",
    sync: "anthropic",
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: "OPENAI",
    label: "OpenAI API",
    description: "Chat Completions, embeddings, and org usage when admin key is available.",
    sync: "openai",
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "GOOGLE_API",
    label: "Google Cloud APIs",
    description: "Cloud Billing export or Billing API (service account).",
    sync: "manual",
    docsUrl: "https://cloud.google.com/billing/docs",
  },
  {
    id: "GEMINI",
    label: "Gemini API",
    description: "Google AI Studio / Gemini API line items (often under same GCP billing).",
    sync: "manual",
    docsUrl: "https://ai.google.dev/docs",
  },
  {
    id: "MANUS",
    label: "Manus",
    description: "Add expenses manually until a documented billing API is available.",
    sync: "manual",
  },
  {
    id: "REPLIT",
    label: "Replit",
    description: "Deployments and Core; manual or future Replit billing export.",
    sync: "manual",
    docsUrl: "https://docs.replit.com",
  },
  {
    id: "VERCEL",
    label: "Vercel",
    description: "Hosting and AI features on Vercel invoices.",
    sync: "manual",
    docsUrl: "https://vercel.com/docs",
  },
  {
    id: "ELEVENLABS",
    label: "ElevenLabs",
    description: "Voice / TTS usage.",
    sync: "manual",
    docsUrl: "https://elevenlabs.io/docs",
  },
  {
    id: "PERPLEXITY",
    label: "Perplexity",
    description: "API or Pro subscription.",
    sync: "manual",
  },
  {
    id: "MIDJOURNEY",
    label: "Midjourney",
    description: "Subscription billing.",
    sync: "manual",
  },
  {
    id: "AWS_BEDROCK",
    label: "AWS Bedrock",
    description: "Managed model usage via AWS Cost Explorer or CUR.",
    sync: "manual",
    docsUrl: "https://docs.aws.amazon.com/bedrock/",
  },
  {
    id: "MISTRAL",
    label: "Mistral AI",
    description: "API usage from Mistral console.",
    sync: "manual",
    docsUrl: "https://docs.mistral.ai",
  },
  {
    id: "COHERE",
    label: "Cohere",
    description: "API usage.",
    sync: "manual",
    docsUrl: "https://docs.cohere.com",
  },
  {
    id: "OTHER",
    label: "Other",
    description: "Catch-all for vendors not listed above.",
    sync: "manual",
  },
];

export function providerMeta(id: AiProvider): ProviderMeta | undefined {
  return PROVIDER_META.find((p) => p.id === id);
}
