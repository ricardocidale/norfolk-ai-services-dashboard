import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure how expenses are sourced and confirm vendor APIs are
          reachable before syncing usage into the dashboard.
        </p>
      </div>
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
    </div>
  );
}
