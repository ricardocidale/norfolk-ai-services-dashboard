import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/gmail-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/auth/callback?code=xxx&state=email
 * Google OAuth redirect — exchanges the auth code for tokens, then redirects
 * the user back to the admin email-scan page.
 *
 * Auth note: this runs inside the admin's already-authenticated browser session
 * (the OAuth popup). Clerk middleware protects all /api/* routes so the Clerk
 * session cookie must be present for this to succeed.
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
