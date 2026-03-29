import { clerkClient } from "@clerk/nextjs/server";
import Link from "next/link";
import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { DEFAULT_ADMIN_EMAIL } from "@/lib/admin/is-app-admin";
import { toAdminUserRow } from "@/lib/admin/clerk-user-dto";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ offset?: string }>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const offset = Math.max(0, parseInt(sp.offset ?? "0", 10) || 0);
  const limit = 20;

  const client = await clerkClient();
  const { data, totalCount } = await client.users.getUserList({
    limit,
    offset,
    orderBy: "-created_at",
  });

  const rows = data.map((u) => toAdminUserRow(u));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/admin"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Admin
          </Link>
          <span className="mx-1 text-border">/</span>
          Users
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Clerk-backed user list. Access to this area requires{" "}
          <code className="rounded bg-muted px-1 text-xs">
            publicMetadata.role = &quot;admin&quot;
          </code>{" "}
          or the default owner{" "}
          <code className="rounded bg-muted px-1 text-xs">
            {DEFAULT_ADMIN_EMAIL}
          </code>
          .
        </p>
      </div>
      <AdminUsersClient
        rows={rows}
        totalCount={totalCount}
        offset={offset}
        limit={limit}
      />
    </div>
  );
}
