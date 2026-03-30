import type { AiProvider } from "@prisma/client";
import type { VendorCategory } from "@/lib/vendors/vendor-categories";

export type ProviderMeta = {
  id: AiProvider;
  label: string;
  /** Dashboard grouping: AI, cloud, devtools, etc. */
  category: VendorCategory;
  description: string;
  sync: "openai" | "anthropic" | "chatgpt" | "perplexity" | "manual";
  docsUrl?: string;
};

/**
 * Ordered list for dashboard and integrations UI.
 * High-spend manual vendors (Replit, Manus), Google AI (Gemini + Nano Banana),
 * API + subscription AI, then dev platforms (Vercel, Lovable, Linear, hosting, design).
 */
export const PROVIDER_META: ProviderMeta[] = [
  {
    id: "REPLIT",
    label: "Replit",
    category: "ai_ml",
    description:
      "Core, Deployments, AI, and add-ons — often one of the largest line items. Enter from Replit billing / invoices; no org spend API in-app yet.",
    sync: "manual",
    docsUrl: "https://docs.replit.com",
  },
  {
    id: "MANUS",
    label: "Manus",
    category: "ai_ml",
    description:
      "Agent / automation platform — often a top spend category. Record from Manus invoices or billing emails; no public API here yet.",
    sync: "manual",
    docsUrl: "https://manus.im",
  },
  {
    id: "GEMINI",
    label: "Gemini (API & Studio)",
    category: "ai_ml",
    description:
      "Google Gemini API, AI Studio usage, and related text/multimodal billing (often overlaps GCP). Track via AI Studio invoices, GCP billing export, or manual rows.",
    sync: "manual",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },
  {
    id: "GEMINI_NANO_BANANA",
    label: "Gemini — Nano Banana (images)",
    category: "ai_ml",
    description:
      "Google’s Nano Banana image-generation SKUs (Gemini app / consumer image flows). Separate line items from API usage when possible — enter from Google invoices, Play/subscription, or AI Studio receipts.",
    sync: "manual",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },
  {
    id: "ANTHROPIC",
    label: "Anthropic (Claude API)",
    category: "ai_ml",
    description:
      "Claude API usage and USD cost via Admin API (cost_report + usage_report/messages). Sync defaults to the last 12 UTC months through now (aligns with dashboard tabs). Claude.ai consumer subscriptions are separate — manual rows.",
    sync: "anthropic",
    docsUrl: "https://docs.anthropic.com/en/api/usage-cost-api",
  },
  {
    id: "OPENAI",
    label: "OpenAI API",
    category: "ai_ml",
    description:
      "Org costs + completions usage when an admin-capable key is set. Sync defaults to the last 12 UTC months through now.",
    sync: "openai",
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "CHATGPT",
    label: "ChatGPT",
    category: "ai_ml",
    description:
      "ChatGPT product billing (Plus, Team, Business). Not the same as API usage — set CHATGPT_MONTHLY_USD or enter invoices manually.",
    sync: "chatgpt",
    docsUrl: "https://help.openai.com/en/collections/3943089-chatgpt",
  },
  {
    id: "PERPLEXITY",
    label: "Perplexity",
    category: "ai_ml",
    description:
      "Pro / Max / Business and API spend. Set PERPLEXITY_MONTHLY_USD (and optional PERPLEXITY_* label/notes) for a monthly upsert, use POST /api/sync/perplexity or Regenerate on the dashboard, or enter line items manually. PERPLEXITY_API_KEY enables the admin probe only — it does not pull invoice totals.",
    sync: "perplexity",
    docsUrl: "https://docs.perplexity.ai/docs/getting-started/api-groups",
  },
  {
    id: "CURSOR",
    label: "Cursor",
    category: "ai_ml",
    description: "IDE subscription and usage (typically manual or invoice import).",
    sync: "manual",
    docsUrl: "https://cursor.com/docs",
  },
  {
    id: "GOOGLE_API",
    label: "Google Cloud APIs",
    category: "cloud_hosting",
    description: "Cloud Billing export or Billing API (service account).",
    sync: "manual",
    docsUrl: "https://cloud.google.com/billing/docs",
  },
  {
    id: "GOOGLE_WORKSPACE",
    label: "Google Workspace",
    category: "business_productivity",
    description:
      "Organization subscriptions for the full Workspace suite — all editions (Starter, Standard, Plus, Enterprise variants, Frontline, Essentials) and bundled apps: Gmail, Calendar, Drive, Meet, Chat, Docs/Sheets/Slides/Forms, Keep, Sites, Currents replacement (Spaces), Voice for Google Workspace, Vault, Endpoint, DLP add-ons, and Workspace add-on SKUs. Not GCP/API usage (use Google Cloud APIs) or Gemini API (use Gemini).",
    sync: "manual",
    docsUrl: "https://support.google.com/a/answer/7587183",
  },
  {
    id: "HUBSPOT",
    label: "HubSpot",
    category: "business_productivity",
    description:
      "CRM, Marketing Hub, Sales Hub, CMS, and add-ons — enter from HubSpot billing / invoices or receipt emails. No spend sync in-app yet.",
    sync: "manual",
    docsUrl: "https://knowledge.hubspot.com/billing",
  },
  {
    id: "VERCEL",
    label: "Vercel",
    category: "cloud_hosting",
    description:
      "Hosting, serverless, and platform usage — Vercel invoices and billing emails.",
    sync: "manual",
    docsUrl: "https://vercel.com/docs",
  },
  {
    id: "LOVABLE",
    label: "Lovable",
    category: "dev_tools",
    description:
      "AI app builder — plans and usage from Lovable invoices or billing notifications.",
    sync: "manual",
    docsUrl: "https://lovable.dev",
  },
  {
    id: "LINEAR",
    label: "Linear",
    category: "dev_tools",
    description:
      "Product engineering — Linear subscriptions, seats, and plan billing.",
    sync: "manual",
    docsUrl: "https://linear.app/docs",
  },
  {
    id: "RAILWAY",
    label: "Railway",
    category: "cloud_hosting",
    description:
      "Cloud hosting, databases, and usage-based charges — Railway invoices.",
    sync: "manual",
    docsUrl: "https://docs.railway.app",
  },
  {
    id: "NEON",
    label: "Neon",
    category: "cloud_hosting",
    description:
      "Serverless Postgres — compute, storage, and branch usage from Neon billing.",
    sync: "manual",
    docsUrl: "https://neon.tech/docs",
  },
  {
    id: "NETLIFY",
    label: "Netlify",
    category: "cloud_hosting",
    description:
      "Static sites, edge, bandwidth, and add-ons — Netlify billing.",
    sync: "manual",
    docsUrl: "https://docs.netlify.com",
  },
  {
    id: "GITHUB",
    label: "GitHub",
    category: "dev_tools",
    description:
      "Copilot, Actions overages, team and enterprise plans — GitHub billing.",
    sync: "manual",
    docsUrl: "https://docs.github.com/billing",
  },
  {
    id: "NOTION",
    label: "Notion",
    category: "business_productivity",
    description:
      "Workspace plans and Notion AI add-ons — Notion invoices.",
    sync: "manual",
    docsUrl: "https://www.notion.so/help",
  },
  {
    id: "FIGMA",
    label: "Figma",
    category: "design_creative",
    description:
      "Design, FigJam, and org plans — Figma billing.",
    sync: "manual",
    docsUrl: "https://help.figma.com",
  },
  {
    id: "ELEVENLABS",
    label: "ElevenLabs",
    category: "ai_ml",
    description: "Voice / TTS usage.",
    sync: "manual",
    docsUrl: "https://elevenlabs.io/docs",
  },
  {
    id: "MIDJOURNEY",
    label: "Midjourney",
    category: "ai_ml",
    description: "Subscription billing.",
    sync: "manual",
  },
  {
    id: "AWS_BEDROCK",
    label: "AWS Bedrock",
    category: "ai_ml",
    description: "Managed model usage via AWS Cost Explorer or CUR.",
    sync: "manual",
    docsUrl: "https://docs.aws.amazon.com/bedrock/",
  },
  {
    id: "AZURE",
    label: "Microsoft Azure",
    category: "cloud_hosting",
    description:
      "Azure OpenAI, VMs, databases, and other Microsoft cloud charges — Cost Management, invoices, or billing exports.",
    sync: "manual",
    docsUrl: "https://learn.microsoft.com/azure/cost-management-billing/",
  },
  {
    id: "CLERK",
    label: "Clerk",
    category: "payments_identity",
    description:
      "Authentication for this app (and related Clerk products). Record from the Clerk Dashboard billing / invoices — no spend API wired here yet.",
    sync: "manual",
    docsUrl: "https://clerk.com/docs",
  },
  {
    id: "STRIPE",
    label: "Stripe",
    category: "payments_identity",
    description:
      "Payment processing fees, Radar, Billing, Connect, and payouts. Admin → Test connection verifies STRIPE_SECRET_KEY only; expense rows stay manual, import, or Gmail approval until a future sync.",
    sync: "manual",
    docsUrl: "https://docs.stripe.com/api",
  },
  {
    id: "PLAID",
    label: "Plaid",
    category: "payments_identity",
    description:
      "Bank linking and data products (Link, Transactions, etc.). Admin → Test connection verifies PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV only; no transaction import into Expenses yet.",
    sync: "manual",
    docsUrl: "https://plaid.com/docs/api",
  },
  {
    id: "DROPBOX",
    label: "Dropbox",
    category: "business_productivity",
    description:
      "Team plans, storage, and Dropbox Business — enter from billing emails or the admin console; no org spend API in-app yet.",
    sync: "manual",
    docsUrl: "https://help.dropbox.com/billing",
  },
  {
    id: "GOOGLE_CLOUD_STORAGE",
    label: "Google Cloud Storage",
    category: "cloud_hosting",
    description:
      "GCS bucket storage, egress, and operations — separate from broad GCP console totals (use GOOGLE_API) when you want storage-only line items from invoices or billing export.",
    sync: "manual",
    docsUrl: "https://cloud.google.com/storage/pricing",
  },
  {
    id: "DOCSEND",
    label: "DocSend",
    category: "business_productivity",
    description:
      "Document analytics and sharing (Dropbox DocSend) — subscriptions and overages from DocSend / Dropbox billing.",
    sync: "manual",
    docsUrl: "https://help.docsend.com",
  },
  {
    id: "FLIPSNACK",
    label: "Flipsnack",
    category: "business_productivity",
    description:
      "Digital flipbooks and publishing plans — record from Flipsnack invoices or receipts.",
    sync: "manual",
    docsUrl: "https://www.flipsnack.com",
  },
  {
    id: "TWILIO",
    label: "Twilio",
    category: "business_productivity",
    description:
      "SMS, voice, Verify, Conversations, and related usage — enter from Twilio Console billing or invoice emails; no org spend sync in-app yet.",
    sync: "manual",
    docsUrl: "https://www.twilio.com/docs/usage/billing",
  },
  {
    id: "RETELL_AI",
    label: "Retell AI",
    category: "ai_ml",
    description:
      "AI voice agents and phone automation — usage-based minutes, LLM, and TTS from Retell billing / invoices; no spend sync in-app yet.",
    sync: "manual",
    docsUrl: "https://docs.retellai.com/accounts/billing",
  },
  {
    id: "VONAGE",
    label: "Vonage",
    category: "business_productivity",
    description:
      "SMS, voice, Video API, and Vonage Communications APIs (including legacy Nexmo) — enter from Vonage billing or invoice emails; no org spend sync in-app yet.",
    sync: "manual",
    docsUrl: "https://api.support.vonage.com/hc/en-us/categories/4403288685842-Billing",
  },
  {
    id: "MISTRAL",
    label: "Mistral AI",
    category: "ai_ml",
    description: "API usage from Mistral console.",
    sync: "manual",
    docsUrl: "https://docs.mistral.ai",
  },
  {
    id: "COHERE",
    label: "Cohere",
    category: "ai_ml",
    description: "API usage.",
    sync: "manual",
    docsUrl: "https://docs.cohere.com",
  },
  {
    id: "OTHER",
    label: "Other",
    category: "general",
    description:
      "Catch-all for vendors not listed above (e.g. niche SaaS, regional tools).",
    sync: "manual",
  },
];

export function providerMeta(id: AiProvider): ProviderMeta | undefined {
  return PROVIDER_META.find((p) => p.id === id);
}

export function providerCategory(id: AiProvider): VendorCategory {
  return providerMeta(id)?.category ?? "general";
}
