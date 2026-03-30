import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
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
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", data: null },
      { status: 401 },
    );
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json(
      { success: false, error: "Forbidden", data: null },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = gmailAuthGetSchema.safeParse({
    email: searchParams.get("email") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
        data: null,
      },
      { status: 400 },
    );
  }

  try {
    const url = getGmailAuthUrl(parsed.data.email);
    return NextResponse.json({ success: true, error: null, data: { url } });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        data: null,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/gmail/auth
 * Body: { code, email }
 * Exchanges the OAuth authorization code for tokens and saves them.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", data: null },
      { status: 401 },
    );
  }
  if (!(await isAppAdmin())) {
    return NextResponse.json(
      { success: false, error: "Forbidden", data: null },
      { status: 403 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON", data: null },
      { status: 400 },
    );
  }

  const parsed = gmailAuthPostSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues.map((i) => i.message).join("; "),
        data: null,
      },
      { status: 400 },
    );
  }

  try {
    const result = await exchangeCodeForTokens(
      parsed.data.code,
      parsed.data.email,
    );
    return NextResponse.json({
      success: true,
      error: null,
      data: {
        email: parsed.data.email,
        tokenExpiry: result.expiry.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        data: null,
      },
      { status: 500 },
    );
  }
}
