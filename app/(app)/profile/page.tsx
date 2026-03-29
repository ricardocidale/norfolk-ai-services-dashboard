import { ProfileAvatarClient } from "@/components/profile/profile-avatar-client";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update your photo here. Account email, password, and SSO are handled
          by Clerk on the account settings page.
        </p>
      </div>
      <ProfileAvatarClient />
    </div>
  );
}
