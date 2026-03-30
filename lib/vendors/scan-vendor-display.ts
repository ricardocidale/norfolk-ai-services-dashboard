import { AiProvider } from "@prisma/client";
import { providerMeta } from "@/lib/vendors/providers-meta";

const PROVIDER_SET: Set<string> = new Set(Object.values(AiProvider) as string[]);

export function isKnownAiProviderString(v: string): boolean {
  return PROVIDER_SET.has(v);
}

/** Scan table / UI: enum rows show catalog label; free-text shows as-is. */
export function formatScanVendorDisplay(parsedVendor: string | null): string {
  if (!parsedVendor) return "—";
  if (isKnownAiProviderString(parsedVendor)) {
    return providerMeta(parsedVendor as AiProvider)?.label ?? parsedVendor;
  }
  return parsedVendor;
}
