import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/gmail-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/auth/callback?code=xxx&state=email
 * Google OAuth redirect — exchanges the auth code for tokens, then redirects
 * to `/admin/email-scan`. Query `state` is the Gmail address (must match the
 * mailbox being linked). `error` from Google is forwarded as `?error=` on redirect.
 *
 * Clerk: `middleware` requires a session for `/api/*`, so the popup must complete
 * while the admin is signed in (same-site cookies). This handler does not call
 * Clerk APIs; it only persists tokens via `exchangeCodeForTokens`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const email = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = new URL("/admin/email-scan", request.url);

  if (error) {
    baseUrl.searchParams.set("error", error);
    return NextResponse.redirect(baseUrl);
  }

  if (!code || !email) {
    baseUrl.searchParams.set(
      "error",
      "Missing code or email from Google callback",
    );
    return NextResponse.redirect(baseUrl);
  }

  try {
    await exchangeCodeForTokens(code, email);
    baseUrl.searchParams.set("connected", email);
    return NextResponse.redirect(baseUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    baseUrl.searchParams.set("error", msg);
    return NextResponse.redirect(baseUrl);
  }
}
