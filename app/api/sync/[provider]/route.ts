import { NextResponse } from "next/server";
import { BillingAccount } from "@prisma/client";
import { syncAnthropicUsage } from "@/lib/integrations/anthropic-sync";
import { syncChatGPTSpend } from "@/lib/integrations/chatgpt-sync";
import { syncOpenAIUsage } from "@/lib/integrations/openai-sync";
import { syncPerplexitySpend } from "@/lib/integrations/perplexity-sync";

export const dynamic = "force-dynamic";
/** OpenAI / Anthropic 12‑month sync issues many paginated HTTP calls + DB upserts; allow headroom on Vercel (plan max still applies). */
export const maxDuration = 120;
export const runtime = "nodejs";

type Params = { params: Promise<{ provider: string }> };

function parseBillingAccount(v: string | null): BillingAccount {
  if (v && (Object.values(BillingAccount) as string[]).includes(v)) {
    return v as BillingAccount;
  }
  return "NORFOLK_GROUP";
}

export async function POST(request: Request, ctx: Params) {
  const { provider } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const billingAccount = parseBillingAccount(searchParams.get("billingAccount"));

  let body: { start?: string; end?: string; month?: string } = {};
  try {
    const j = await request.json();
    if (j && typeof j === "object") body = j as typeof body;
  } catch {
    /* optional body */
  }

  const start = body.start ? new Date(body.start) : undefined;
  const end = body.end ? new Date(body.end) : undefined;

  switch (provider) {
    case "openai": {
      const result = await syncOpenAIUsage({
        billingAccount,
        startTime: start,
        endTime: end,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }
    case "anthropic": {
      const result = await syncAnthropicUsage({
        billingAccount,
        startTime: start,
        endTime: end,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }
    case "chatgpt": {
      const result = await syncChatGPTSpend({
        billingAccount,
        month: body.month,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }
    case "perplexity": {
      const result = await syncPerplexitySpend({
        billingAccount,
        month: body.month,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }
    default:
      return NextResponse.json(
        {
          ok: false,
          message: `Unknown sync target "${provider}". Use openai, anthropic, chatgpt, or perplexity.`,
          imported: 0,
        },
        { status: 400 },
      );
  }
}
