/**
 * Shared OpenAI HTTP and optional model defaults (sync uses Usage/Cost APIs, not chat).
 * @see https://platform.openai.com/docs/api-reference/introduction
 */
export const OPENAI_API_BASE = "https://api.openai.com/v1" as const;

export function openaiOrganizationCostsUrl(): string {
  return `${OPENAI_API_BASE}/organization/costs`;
}

export function openaiOrganizationUsageUrl(segment: string): string {
  return `${OPENAI_API_BASE}/organization/usage/${segment}`;
}

/** Admin probe: list models (validates key + org). */
export function openaiModelsProbeUrl(): string {
  return `${OPENAI_API_BASE}/models?limit=1`;
}

/**
 * Default chat model for any future OpenAI text/JSON features (invoice parse, tools).
 * Sync paths do not call the Chat Completions API today.
 */
export function openaiDefaultChatModel(): string {
  const m = process.env.OPENAI_CHAT_MODEL?.trim();
  return m || "gpt-4.1-mini";
}
