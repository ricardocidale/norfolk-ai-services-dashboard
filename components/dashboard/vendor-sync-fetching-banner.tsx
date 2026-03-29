"use client";

import { Loader2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const VENDOR_STEPS = [
  "OpenAI — organization costs & usage",
  "Anthropic — cost & message usage reports",
  "ChatGPT — monthly env line (if configured)",
  "Perplexity — monthly env line (if configured)",
] as const;

/**
 * Visible, animated feedback while /api/admin/sync-all runs and the dashboard
 * refresh refetches totals and vendor tables from the database.
 */
export function VendorSyncFetchingBanner({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  if (!active) return null;

  return (
    <div
      id="vendor-sync-fetching-banner"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "overflow-hidden rounded-xl border border-primary/35 bg-gradient-to-br from-primary/10 via-background to-cyan-500/10 p-4 shadow-sm sm:p-5",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
          <Loader2
            className="size-6 animate-spin text-primary motion-reduce:animate-none"
            aria-hidden
          />
          <span className="sr-only">Sync in progress</span>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Radio
              className="size-4 shrink-0 animate-pulse text-cyan-600 dark:text-cyan-400 motion-reduce:animate-none"
              aria-hidden
            />
            <p className="text-base font-semibold tracking-tight text-foreground">
              Fetching the latest numbers from each vendor API
            </p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Extending your last confirmed usage and cost series through today
            (UTC), then updating totals and the vendor tables below. This can
            take up to a couple of minutes for OpenAI and Anthropic.
          </p>
          <ul className="grid gap-1.5 pt-1 text-xs text-muted-foreground sm:grid-cols-2">
            {VENDOR_STEPS.map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5 ring-1 ring-border/60"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full bg-[#0097A7] motion-reduce:bg-primary"
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted/80"
        aria-hidden
      >
        <div className="h-full rounded-full bg-gradient-to-r from-[#0097A7]/90 via-[#00BCD4] to-[#0097A7]/90 vendor-sync-progress-fill" />
      </div>
    </div>
  );
}
