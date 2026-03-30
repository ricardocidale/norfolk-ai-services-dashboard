/**
 * Lazy SDK clients for Claude Code / agents to extend sync and tooling.
 * Secrets must remain in environment variables only.
 *
 * | Integration        | Env / module |
 * |--------------------|--------------|
 * | OpenAI SDK         | `openaiApiKeyFromEnv()` → `OPENAI_ADMIN_KEY` then `OPENAI_API_KEY`; optional `OPENAI_ORG_ID` |
 * | OpenAI REST URLs   | `OPENAI_API_BASE` and helpers in `openai-constants.ts` (sync + probe) |
 * | OpenAI chat default| `OPENAI_CHAT_MODEL` or `openaiDefaultChatModel()` — for future text features, not sync |
 * | OpenAI sync/probe  | `lib/integrations/openai-env.ts`, `openai-sync.ts`, admin probe |
 * | Anthropic Messages | `getAnthropicClient()` → `ANTHROPIC_API_KEY` or `ANTHROPIC_ADMIN_API_KEY` (invoice parse, etc.) |
 * | Anthropic Usage $  | **Direct `fetch` only** — `anthropic-sync.ts` (Admin key); not this SDK |
 * | Invoice model id   | `ANTHROPIC_INVOICE_MODEL` or default — `anthropic-constants.ts` |
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { openaiApiKeyFromEnv } from "./openai-env";

export function getOpenAIClient(): OpenAI | null {
  const key = openaiApiKeyFromEnv();
  if (!key) return null;
  const org = process.env.OPENAI_ORG_ID?.trim();
  return new OpenAI({
    apiKey: key,
    organization: org || undefined,
  });
}

export function getAnthropicClient(): Anthropic | null {
  const key =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.ANTHROPIC_ADMIN_API_KEY?.trim() ||
    "";
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}
