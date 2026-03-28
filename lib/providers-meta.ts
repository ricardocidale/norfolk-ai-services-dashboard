import type { AiProvider } from "@prisma/client";

export type ProviderMeta = {
  id: AiProvider;
  label: string;
  description: string;
  sync: "openai" | "anthropic" | "chatgpt" | "perplexity" | "manual";
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
    label: "Anthropic (Claude API)",
    description:
      "Claude API usage and USD cost via Admin API (cost_report + usage_report/messages). Claude.ai subscriptions: enter separately or use manual rows.",
    sync: "anthropic",
    docsUrl: "https://docs.anthropic.com/en/api/usage-cost-api",
  },
  {
    id: "OPENAI",
    label: "OpenAI API",
    description: "Chat Completions, embeddings, and org usage when admin key is available.",
    sync: "openai",
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "CHATGPT",
    label: "ChatGPT",
    description:
      "ChatGPT product billing (Plus, Team, Business). Not the same as API usage — set CHATGPT_MONTHLY_USD or enter invoices manually.",
    sync: "chatgpt",
    docsUrl: "https://help.openai.com/en/collections/3943089-chatgpt",
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
    description:
      "Agent / automation platform — usually a top line item. Record monthly from invoices or billing emails; no public API here yet.",
    sync: "manual",
  },
  {
    id: "REPLIT",
    label: "Replit",
    description:
      "Core, Deployments, and add-ons — often a top line item. Enter from Replit account billing or statements; export/API when available.",
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
    description:
      "API credits and/or Pro — no public cost API. Set PERPLEXITY_MONTHLY_USD from console billing / invoices, or manual entry.",
    sync: "perplexity",
    docsUrl: "https://docs.perplexity.ai/docs/getting-started/api-groups",
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
