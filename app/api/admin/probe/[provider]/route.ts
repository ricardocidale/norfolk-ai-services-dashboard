import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ provider: string }> };

/**
 * Lightweight connectivity check (does not import spend).
 * Internal tool — protect this route if the app is ever exposed publicly.
 */
export async function POST(_request: Request, ctx: Params) {
  const { provider } = await ctx.params;

  if (provider === "openai") {
    const apiKey =
      process.env.OPENAI_ADMIN_KEY ?? process.env.OPENAI_API_KEY ?? "";
    if (!apiKey.trim()) {
      return NextResponse.json({
        ok: false,
        message: "No OPENAI_API_KEY or OPENAI_ADMIN_KEY in environment.",
      });
    }
    const res = await fetch("https://api.openai.com/v1/models?limit=1", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({
        ok: false,
        message: `OpenAI returned ${res.status}: ${t.slice(0, 280)}`,
      });
    }
    return NextResponse.json({
      ok: true,
      message: "API key accepted (models endpoint reachable).",
    });
  }

  if (provider === "anthropic") {
    const key =
      (process.env.ANTHROPIC_ADMIN_API_KEY ?? "").trim() ||
      (process.env.ANTHROPIC_API_KEY ?? "").trim();
    if (!key) {
      return NextResponse.json({
        ok: false,
        message:
          "Set ANTHROPIC_ADMIN_API_KEY (or an Admin key in ANTHROPIC_API_KEY).",
      });
    }

    const end = new Date();
    const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);
    const qs = new URLSearchParams({
      starting_at: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
      ending_at: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
      bucket_width: "1d",
      limit: "7",
    });
    const adminRes = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?${qs}`,
      {
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "user-agent": "NorfolkAISpendDashboard/1.0-probe",
        },
        cache: "no-store",
      },
    );
    const adminText = await adminRes.text();
    if (adminRes.ok) {
      return NextResponse.json({
        ok: true,
        message:
          "Admin API key accepted (cost_report reachable). Sync will pull cost + message usage.",
      });
    }
    if (adminRes.status === 403 || adminRes.status === 404) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      const t = await res.text();
      if (res.status === 401) {
        return NextResponse.json({
          ok: false,
          message: "Anthropic rejected the API key (401).",
        });
      }
      if (res.status === 400) {
        return NextResponse.json({
          ok: false,
          message:
            "Standard API key works for Messages, but Usage & Cost sync needs an Admin key (sk-ant-admin…) from Console → Admin keys.",
        });
      }
      return NextResponse.json({
        ok: false,
        message: `Anthropic returned ${res.status}: ${t.slice(0, 280)}`,
      });
    }
    return NextResponse.json({
      ok: false,
      message: `Anthropic cost_report ${adminRes.status}: ${adminText.slice(0, 280)}`,
    });
  }

  if (provider === "perplexity") {
    const key = (process.env.PERPLEXITY_API_KEY ?? "").trim();
    if (!key) {
      return NextResponse.json({
        ok: false,
        message:
          "PERPLEXITY_API_KEY is not set in this app’s environment (GitHub Secrets do not apply here unless your workflow injects them into Vercel/host env).",
      });
    }
    const res = await fetch("https://api.perplexity.ai/v1/async/sonar", {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const t = await res.text();
    if (res.ok) {
      return NextResponse.json({
        ok: true,
        message:
          "API key accepted (async sonar list reachable). Billing totals still come from PERPLEXITY_MONTHLY_USD or manual entry — no org-wide spend API documented.",
      });
    }
    if (res.status === 401) {
      return NextResponse.json({
        ok: false,
        message: "Perplexity rejected the API key (401).",
      });
    }
    return NextResponse.json({
      ok: false,
      message: `Perplexity returned ${res.status}: ${t.slice(0, 280)}`,
    });
  }

  return NextResponse.json(
    { ok: false, message: `No probe for "${provider}".` },
    { status: 400 },
  );
}
