import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/db";
import { googleOAuthEnvSchema } from "@/lib/validations/gmail";

/**
 * OAuth contract: `GOOGLE_OAUTH_REDIRECT_URI` must match the Google Cloud client
 * (e.g. https://spend.norfolk.ai/api/gmail/auth/callback). `state` is the target
 * mailbox email. The callback route runs under the same Clerk session as the admin
 * who started the flow (`middleware` protects `/api/*`). Scopes are read-only Gmail.
 */
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"] as const;

export function getOAuth2Client(): OAuth2Client {
  const result = googleOAuthEnvSchema.safeParse({
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  });
  if (!result.success) {
    throw new Error(
      `Missing or invalid Google OAuth env vars: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return new OAuth2Client(
    result.data.GOOGLE_OAUTH_CLIENT_ID,
    result.data.GOOGLE_OAUTH_CLIENT_SECRET,
    result.data.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

/**
 * Generate an OAuth consent URL. `login_hint` pre-fills the Google account
 * picker with the target email so the admin connects the correct mailbox.
 */
export function getGmailAuthUrl(email: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...SCOPES],
    login_hint: email,
    state: email,
  });
}

export async function exchangeCodeForTokens(
  code: string,
  email: string,
): Promise<{ accessToken: string; refreshToken: string; expiry: Date }> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google did not return both access and refresh tokens. Re-authorize with prompt=consent.",
    );
  }
  const expiry = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3_600_000);

  try {
    await prisma.gmailConnection.upsert({
      where: { email },
      create: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: expiry,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: expiry,
      },
    });
  } catch (dbError) {
    const msg =
      dbError instanceof Error ? dbError.message : String(dbError);
    throw new Error(`Failed to persist Gmail tokens: ${msg}`);
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiry,
  };
}

/**
 * Build an authenticated OAuth2 client for a stored GmailConnection.
 * Auto-refreshes if the token is expired and persists the new token.
 */
export async function getAuthenticatedClient(
  email: string,
): Promise<OAuth2Client> {
  const conn = await prisma.gmailConnection.findUnique({
    where: { email },
    select: {
      accessToken: true,
      refreshToken: true,
      tokenExpiry: true,
    },
  });
  if (!conn) throw new Error(`No Gmail connection for ${email}`);

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken,
    expiry_date: conn.tokenExpiry.getTime(),
  });

  if (conn.tokenExpiry.getTime() < Date.now() + 60_000) {
    const { credentials } = await client.refreshAccessToken();
    const newExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3_600_000);

    try {
      await prisma.gmailConnection.update({
        where: { email },
        data: {
          accessToken: credentials.access_token ?? conn.accessToken,
          refreshToken: credentials.refresh_token ?? conn.refreshToken,
          tokenExpiry: newExpiry,
        },
      });
    } catch {
      // Token refresh succeeded but DB persistence failed — proceed with in-memory credentials
    }
    client.setCredentials(credentials);
  }

  return client;
}
