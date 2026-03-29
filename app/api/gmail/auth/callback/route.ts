import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/gmail-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/auth/callback?code=xxx&state=email
 * Google OAuth redirect — exchanges the auth code for tokens, then redirects
 * the user back to the admin email-scan page.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const email = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/email-scan?error=${encodeURIComponent(error)}`,
        request.url,
      ),
    );
  }

  if (!code || !email) {
    return NextResponse.redirect(
      new URL(
        "/admin/email-scan?error=Missing+code+or+email+from+Google+callback",
        request.url,
      ),
    );
  }

  try {
    await exchangeCodeForTokens(code, email);
    return NextResponse.redirect(
      new URL(
        `/admin/email-scan?connected=${encodeURIComponent(email)}`,
        request.url,
      ),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(
      new URL(
        `/admin/email-scan?error=${encodeURIComponent(msg)}`,
        request.url,
      ),
    );
  }
}
