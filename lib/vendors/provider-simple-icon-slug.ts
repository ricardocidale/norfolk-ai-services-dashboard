import type { AiProvider } from "@prisma/client";

/**
 * Slugs for https://cdn.simpleicons.org/{slug} (Simple Icons).
 * Omitted keys use a text/initial fallback in {@link ProviderLogo}.
 */
export const PROVIDER_SIMPLE_ICON_SLUG: Partial<Record<AiProvider, string>> = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  CHATGPT: "openai",
  PERPLEXITY: "perplexity",
  GOOGLE_API: "googlecloud",
  GOOGLE_WORKSPACE: "google",
  GEMINI: "googlegemini",
  GEMINI_NANO_BANANA: "googlegemini",
  HUBSPOT: "hubspot",
  VERCEL: "vercel",
  LINEAR: "linear",
  RAILWAY: "railway",
  NETLIFY: "netlify",
  GITHUB: "github",
  NOTION: "notion",
  FIGMA: "figma",
  ELEVENLABS: "elevenlabs",
  MIDJOURNEY: "midjourney",
  AWS_BEDROCK: "amazonaws",
  AZURE: "microsoftazure",
  MISTRAL: "mistral",
  COHERE: "cohere",
  REPLIT: "replit",
  DROPBOX: "dropbox",
  GOOGLE_CLOUD_STORAGE: "googlecloud",
  TWILIO: "twilio",
  VONAGE: "vonage",
};
