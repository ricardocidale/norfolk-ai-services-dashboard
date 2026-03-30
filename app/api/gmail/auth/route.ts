import { auth } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import {
  getGmailAuthUrl,
  exchangeCodeForTokens,
} from "@/lib/integrations/gmail-client";
import {
  gmailAuthGetSchema,
  gmailAuthPostSchema,
} from "@/lib/validations/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/auth?email=xxx
 * Returns the Google OAuth consent URL for connecting a Gmail account.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  const { searchParams } = new URL(request.url);
  const parsed = gmailAuthGetSchema.safeParse({
    email: searchParams.get("email") ?? undefined,
  });
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION" },
    );
  }

  try {
    const url = getGmailAuthUrl(parsed.data.email);
    return jsonOk({ url });
  } catch (e) {
    return jsonErr(e instanceof Error ? e.message : String(e), 500, {
      code: "OAUTH_URL_FAILED",
    });
  }
}

/**
 * POST /api/gmail/auth
 * Body: { code, email }
 * Exchanges the OAuth authorization code for tokens and saves them.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400, { code: "INVALID_JSON" });
  }

  const parsed = gmailAuthPostSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues.map((i) => i.message).join("; "),
      400,
      { code: "VALIDATION" },
    );
  }

  try {
    const result = await exchangeCodeForTokens(
      parsed.data.code,
      parsed.data.email,
    );
    return jsonOk({
      email: parsed.data.email,
      tokenExpiry: result.expiry.toISOString(),
    });
  } catch (e) {
    return jsonErr(e instanceof Error ? e.message : String(e), 500, {
      code: "TOKEN_EXCHANGE_FAILED",
    });
  }
}
