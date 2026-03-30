import { auth } from "@clerk/nextjs/server";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { ANTHROPIC_API_VERSION } from "@/lib/integrations/anthropic-constants";
import { openaiApiKeyFromEnv } from "@/lib/integrations/openai-env";
import { openaiModelsProbeUrl } from "@/lib/integrations/openai-constants";
import { jsonErr, jsonOk } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ provider: string }> };

/**
 * Lightweight connectivity check (does not import spend).
 * App admins only (same gate as /admin/*).
 */
export async function POST(_request: Request, ctx: Params): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  const { provider } = await ctx.params;

  if (provider === "openai") {
    const apiKey = openaiApiKeyFromEnv() ?? "";
    if (!apiKey) {
      return jsonErr(
        "No OPENAI_API_KEY or OPENAI_ADMIN_KEY in environment.",
        400,
        { code: "MISSING_KEY" },
      );
    }
    const res = await fetch(openaiModelsProbeUrl(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text();
      return jsonErr(
        `OpenAI returned ${res.status}: ${t.slice(0, 280)}`,
        502,
        { code: "UPSTREAM_ERROR" },
      );
    }
    return jsonOk({
      message: "API key accepted (models endpoint reachable).",
    });
  }

  if (provider === "anthropic") {
    const key =
      (process.env.ANTHROPIC_ADMIN_API_KEY ?? "").trim() ||
      (process.env.ANTHROPIC_API_KEY ?? "").trim();
    if (!key) {
      return jsonErr(
        "Set ANTHROPIC_ADMIN_API_KEY (or an Admin key in ANTHROPIC_API_KEY).",
        400,
        { code: "MISSING_KEY" },
      );
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
          "anthropic-version": ANTHROPIC_API_VERSION,
          "user-agent": "NorfolkAISpendDashboard/1.0-probe",
        },
        cache: "no-store",
      },
    );
    const adminText = await adminRes.text();
    if (adminRes.ok) {
      return jsonOk({
        message:
          "Admin API key accepted (cost_report reachable). Sync will pull cost + message usage.",
      });
    }
    if (adminRes.status === 403 || adminRes.status === 404) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "content-type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      const t = await res.text();
      if (res.status === 401) {
        return jsonErr("Anthropic rejected the API key (401).", 502, {
          code: "UPSTREAM_UNAUTHORIZED",
        });
      }
      if (res.status === 400) {
        return jsonErr(
          "Standard API key works for Messages, but Usage & Cost sync needs an Admin key (sk-ant-admin…) from Console → Admin keys.",
          502,
          { code: "WRONG_KEY_TYPE" },
        );
      }
      return jsonErr(
        `Anthropic returned ${res.status}: ${t.slice(0, 280)}`,
        502,
        { code: "UPSTREAM_ERROR" },
      );
    }
    return jsonErr(
      `Anthropic cost_report ${adminRes.status}: ${adminText.slice(0, 280)}`,
      502,
      { code: "UPSTREAM_ERROR" },
    );
  }

  if (provider === "perplexity") {
    const key = (process.env.PERPLEXITY_API_KEY ?? "").trim();
    if (!key) {
      return jsonErr(
        "PERPLEXITY_API_KEY is not set in this app’s environment (GitHub Secrets do not apply here unless your workflow injects them into Vercel/host env).",
        400,
        { code: "MISSING_KEY" },
      );
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
      return jsonOk({
        message:
          "API key accepted (async sonar list reachable). Billing totals still come from PERPLEXITY_MONTHLY_USD or manual entry — no org-wide spend API documented.",
      });
    }
    if (res.status === 401) {
      return jsonErr("Perplexity rejected the API key (401).", 502, {
        code: "UPSTREAM_UNAUTHORIZED",
      });
    }
    return jsonErr(
      `Perplexity returned ${res.status}: ${t.slice(0, 280)}`,
      502,
      { code: "UPSTREAM_ERROR" },
    );
  }

  return jsonErr(`No probe for "${provider}".`, 400, { code: "UNKNOWN_PROVIDER" });
}
