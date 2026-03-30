import { auth } from "@clerk/nextjs/server";
import { BillingAccount } from "@prisma/client";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import {
  syncAnthropicUsage,
  norfolkAiAdminKey,
} from "@/lib/integrations/anthropic-sync";
import { syncChatGPTSpend } from "@/lib/integrations/chatgpt-sync";
import { syncOpenAIUsage } from "@/lib/integrations/openai-sync";
import { syncPerplexitySpend } from "@/lib/integrations/perplexity-sync";
import type { SyncResult } from "@/lib/integrations/types";
import {
  defaultSyncRangeEnd,
  defaultSyncRangeStart,
} from "@/lib/integrations/sync-range";
import { vendorBillingAccount } from "@/lib/expenses/vendor-billing-defaults";

export const dynamic = "force-dynamic";
/** OpenAI + Anthropic 12‑month parallel sync; allow headroom beyond a single-provider route. */
export const maxDuration = 300;
export const runtime = "nodejs";

type StepKey =
  | "openai"
  | "anthropic"
  | "anthropic_norfolk_ai"
  | "chatgpt"
  | "perplexity";

type StepResult = {
  key: StepKey;
  ok: boolean;
  message: string;
  imported: number;
};

function parseBillingAccountOverride(v: unknown): BillingAccount | null {
  if (
    typeof v === "string" &&
    (Object.values(BillingAccount) as string[]).includes(v)
  ) {
    return v as BillingAccount;
  }
  return null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  let body: {
    billingAccount?: string;
    start?: string;
    end?: string;
    removeSampleRows?: boolean;
  } = {};
  try {
    const j = await request.json();
    if (j && typeof j === "object") body = j;
  } catch {
    /* optional body */
  }

  const override = parseBillingAccountOverride(body.billingAccount);
  const ba = (provider: Parameters<typeof vendorBillingAccount>[0]) =>
    override ?? vendorBillingAccount(provider);

  const end = body.end ? new Date(body.end) : defaultSyncRangeEnd();
  const start = body.start
    ? new Date(body.start)
    : defaultSyncRangeStart(end);

  let removedSampleRows = 0;
  if (body.removeSampleRows === true) {
    const del = await prisma.expense.deleteMany({ where: { source: "seed" } });
    removedSampleRows = del.count;
  }

  const naiKey = norfolkAiAdminKey();

  const apiSyncs: Promise<SyncResult>[] = [
    syncOpenAIUsage({
      billingAccount: ba("OPENAI"),
      startTime: start,
      endTime: end,
    }),
    syncAnthropicUsage({
      billingAccount: ba("ANTHROPIC"),
      startTime: start,
      endTime: end,
    }),
  ];

  if (naiKey) {
    apiSyncs.push(
      syncAnthropicUsage({
        billingAccount: override ?? "NORFOLK_AI",
        startTime: start,
        endTime: end,
        apiKey: naiKey,
        orgLabel: "nai",
      }),
    );
  }

  const [openaiR, anthropicR, anthropicNaiR] = await Promise.all(apiSyncs);

  const chatgptR = await syncChatGPTSpend({ billingAccount: ba("CHATGPT") });
  const perplexityR = await syncPerplexitySpend({ billingAccount: ba("PERPLEXITY") });

  const steps: StepResult[] = [
    {
      key: "openai",
      ok: openaiR.ok,
      message: openaiR.message,
      imported: openaiR.imported,
    },
    {
      key: "anthropic",
      ok: anthropicR.ok,
      message: anthropicR.message,
      imported: anthropicR.imported,
    },
  ];

  if (anthropicNaiR) {
    steps.push({
      key: "anthropic_norfolk_ai",
      ok: anthropicNaiR.ok,
      message: anthropicNaiR.message,
      imported: anthropicNaiR.imported,
    });
  } else {
    steps.push({
      key: "anthropic_norfolk_ai",
      ok: false,
      message: "ANTHROPIC_NORFOLK_AI_ADMIN_KEY not set — skipped.",
      imported: 0,
    });
  }

  steps.push(
    {
      key: "chatgpt",
      ok: chatgptR.ok,
      message: chatgptR.message,
      imported: chatgptR.imported,
    },
    {
      key: "perplexity",
      ok: perplexityR.ok,
      message: perplexityR.message,
      imported: perplexityR.imported,
    },
  );

  const apiOk = openaiR.ok || anthropicR.ok || (anthropicNaiR?.ok ?? false);
  const anyOk = steps.some((s) => s.ok);
  const summary = [
    removedSampleRows > 0
      ? `Removed ${removedSampleRows} sample row(s).`
      : null,
    `OpenAI: ${openaiR.ok ? `ok (${openaiR.imported} row(s))` : openaiR.message}`,
    `Anthropic: ${anthropicR.ok ? `ok (${anthropicR.imported} row(s))` : anthropicR.message}`,
    anthropicNaiR
      ? `Anthropic (norfolk.ai): ${anthropicNaiR.ok ? `ok (${anthropicNaiR.imported} row(s))` : anthropicNaiR.message}`
      : "Anthropic (norfolk.ai): key not set — skipped.",
    `ChatGPT: ${chatgptR.ok ? `ok (${chatgptR.imported} row(s))` : chatgptR.message}`,
    `Perplexity: ${perplexityR.ok ? `ok (${perplexityR.imported} row(s))` : perplexityR.message}`,
  ]
    .filter(Boolean)
    .join(" ");

  return jsonOk({
    anyOk,
    apiSyncOk: apiOk,
    removedSampleRows,
    steps,
    summary,
  });
}
