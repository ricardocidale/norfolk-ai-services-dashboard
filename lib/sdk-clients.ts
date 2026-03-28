/**
 * Lazy SDK clients for Claude Code / agents to extend sync and tooling.
 * Secrets must remain in environment variables only.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_ADMIN_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    organization: process.env.OPENAI_ORG_ID ?? undefined,
  });
}

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}
