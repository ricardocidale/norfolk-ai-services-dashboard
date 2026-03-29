import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DEFAULT_ADMIN_EMAIL } from "@/lib/admin/is-app-admin";

export function AdminOverviewCards() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expense sources</CardTitle>
          <CardDescription>
            Registry of vendors (API vs manual), required environment variables,
            connectivity checks, and OpenAI / Anthropic sync actions.
          </CardDescription>
          <Button asChild className="mt-4 w-fit" variant="secondary">
            <Link href="/admin/sources">Open expense sources</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users (Clerk)</CardTitle>
          <CardDescription>
            List users, ban or lock accounts, clear profile photos, or delete
            users. Password changes use Clerk&apos;s account settings or
            Dashboard. Grant admin access with{" "}
            <code className="rounded bg-muted px-1 text-xs">
              publicMetadata.role = &quot;admin&quot;
            </code>{" "}
            in Clerk, or use the default owner email{" "}
            <code className="rounded bg-muted px-1 text-xs">
              {DEFAULT_ADMIN_EMAIL}
            </code>
            .
          </CardDescription>
          <Button asChild className="mt-4 w-fit" variant="secondary">
            <Link href="/admin/users">Open user management</Link>
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
