/**
 * Single resolution for OpenAI keys across sync, probes, and optional SDK helpers.
 * Prefer OPENAI_ADMIN_KEY for org usage/cost APIs; fall back to OPENAI_API_KEY.
 */
export function openaiApiKeyFromEnv(): string | undefined {
  const raw =
    process.env.OPENAI_ADMIN_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  return raw || undefined;
}
