/** Shape returned by `clerkClient.users.getUserList` entries */
export type ClerkUserListEntry = {
  id: string;
  emailAddresses: { id: string; emailAddress: string }[];
  primaryEmailAddressId: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  banned: boolean;
  locked: boolean;
  createdAt: Date | number | null;
  lastSignInAt: Date | number | null;
};

/** Serializable row for client admin table */
export type AdminUserRow = {
  id: string;
  primaryEmail: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  banned: boolean;
  locked: boolean;
  createdAt: number | null;
  lastSignInAt: number | null;
};

export function toAdminUserRow(user: ClerkUserListEntry): AdminUserRow {
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";

  return {
    id: user.id,
    primaryEmail: primary,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    banned: user.banned,
    locked: user.locked,
    createdAt: user.createdAt != null ? new Date(user.createdAt).getTime() : null,
    lastSignInAt:
      user.lastSignInAt != null ? new Date(user.lastSignInAt).getTime() : null,
  };
}
