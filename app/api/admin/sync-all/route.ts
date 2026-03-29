import { auth } from "@clerk/nextjs/server";
import { BillingAccount } from "@prisma/client";
import { NextResponse } from "next/server";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { prisma } from "@/lib/db";
import { syncAnthropicUsage } from "@/lib/integrations/anthropic-sync";
import { syncChatGPTSpend } from "@/lib/integrations/chatgpt-sync";
import { syncOpenAIUsage } from "@/lib/integrations/openai-sync";
import { syncPerplexitySpend } from "@/lib/integrations/perplexity-sync";
import {
  defaultSyncRangeEnd,
  defaultSyncRangeStart,
} from "@/lib/integrations/sync-range";

export const dynamic = "force-dynamic";
/** OpenAI + Anthropic 12‑month parallel sync; allow headroom beyond a single-provider route. */
export const maxDuration = 300;
export const runtime = "nodejs";

type StepKey = "openai" | "anthropic" | "chatgpt" | "perplexity";

type StepResult = {
  key: StepKey;
  ok: boolean;
  message: string;
  imported: number;
};

function parseBillingAccount(v: unknown): BillingAccount {
  if (
    typeof v === "string" &&
    (Object.values(BillingAccount) as string[]).includes(v)
  ) {
    return v as BillingAccount;
  }
  return "NORFOLK_GROUP";
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
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

  const billingAccount = parseBillingAccount(body.billingAccount);
  const end = body.end ? new Date(body.end) : defaultSyncRangeEnd();
  const start = body.start
    ? new Date(body.start)
    : defaultSyncRangeStart(end);

  let removedSampleRows = 0;
  if (body.removeSampleRows === true) {
    const del = await prisma.expense.deleteMany({ where: { source: "seed" } });
    removedSampleRows = del.count;
  }

  const rangeOpts = {
    billingAccount,
    startTime: start,
    endTime: end,
  };

  const [openaiR, anthropicR] = await Promise.all([
    syncOpenAIUsage(rangeOpts),
    syncAnthropicUsage(rangeOpts),
  ]);

  const chatgptR = await syncChatGPTSpend({ billingAccount });
  const perplexityR = await syncPerplexitySpend({ billingAccount });

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
  ];

  const apiOk = openaiR.ok || anthropicR.ok;
  const anyOk = steps.some((s) => s.ok);
  const summary = [
    removedSampleRows > 0
      ? `Removed ${removedSampleRows} sample row(s).`
      : null,
    `OpenAI: ${openaiR.ok ? `ok (${openaiR.imported} row(s))` : openaiR.message}`,
    `Anthropic: ${anthropicR.ok ? `ok (${anthropicR.imported} row(s))` : anthropicR.message}`,
    `ChatGPT: ${chatgptR.ok ? `ok (${chatgptR.imported} row(s))` : chatgptR.message}`,
    `Perplexity: ${perplexityR.ok ? `ok (${perplexityR.imported} row(s))` : perplexityR.message}`,
  ]
    .filter(Boolean)
    .join(" ");

  return NextResponse.json({
    ok: anyOk,
    apiSyncOk: apiOk,
    removedSampleRows,
    steps,
    summary,
  });
}
