import { currentUser } from "@clerk/nextjs/server";

/** Bootstrap admin (Norfolk Group) — always allowed; grant others via Clerk `publicMetadata.role`. */
export const DEFAULT_ADMIN_EMAIL = "ricardo.cidale@norfolkgroup.io";

function hasAdminRole(user: {
  publicMetadata: Record<string, unknown>;
}): boolean {
  const raw = user.publicMetadata?.role;
  if (raw === undefined || raw === null) return false;
  return String(raw).trim().toLowerCase() === "admin";
}

function matchesDefaultAdminEmail(user: {
  emailAddresses: { id: string; emailAddress: string }[];
  primaryEmailAddressId: string | null;
}): boolean {
  const norm = DEFAULT_ADMIN_EMAIL.toLowerCase();
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;
  if (primary?.toLowerCase() === norm) return true;
  return user.emailAddresses.some(
    (e) => e.emailAddress?.toLowerCase() === norm,
  );
}

/**
 * Who may use /admin/* and /api/admin/* (except nothing — all gated).
 * Uses `currentUser()` (session + Clerk user record); API routes should call this
 * after `auth()` has already ensured a signed-in user via middleware on `/api/*`.
 * - `publicMetadata.role === "admin"` (set in Clerk Dashboard → User → Public metadata)
 * - or primary/verified email `ricardo.cidale@norfolkgroup.io` (default owner)
 */
export async function isAppAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  if (hasAdminRole(user)) return true;
  if (matchesDefaultAdminEmail(user)) return true;
  return false;
}
