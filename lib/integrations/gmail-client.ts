import { google } from "googleapis";
import { prisma } from "@/lib/db";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, or GOOGLE_OAUTH_REDIRECT_URI",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
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
    scope: SCOPES,
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
    : new Date(Date.now() + 3600_000);

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
export async function getAuthenticatedClient(email: string) {
  const conn = await prisma.gmailConnection.findUnique({ where: { email } });
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
      : new Date(Date.now() + 3600_000);
    await prisma.gmailConnection.update({
      where: { email },
      data: {
        accessToken: credentials.access_token ?? conn.accessToken,
        refreshToken: credentials.refresh_token ?? conn.refreshToken,
        tokenExpiry: newExpiry,
      },
    });
    client.setCredentials(credentials);
  }

  return client;
}
