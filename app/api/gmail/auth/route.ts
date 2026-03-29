import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import {
  getGmailAuthUrl,
  exchangeCodeForTokens,
} from "@/lib/integrations/gmail-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/auth?email=xxx
 * Returns the Google OAuth consent URL for connecting a Gmail account.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "email query param required" },
      { status: 400 },
    );
  }

  try {
    const url = getGmailAuthUrl(email);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/gmail/auth
 * Body: { code, email }
 * Exchanges the OAuth authorization code for tokens and saves them.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { code?: string; email?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { code, email } = body;
  if (!code || !email) {
    return NextResponse.json(
      { error: "code and email are required" },
      { status: 400 },
    );
  }

  try {
    const result = await exchangeCodeForTokens(code, email);
    return NextResponse.json({
      ok: true,
      email,
      tokenExpiry: result.expiry.toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
