import { AdminOverviewCards } from "@/components/admin/admin-overview-cards";
import { DisplayPrefsCard } from "@/components/admin/display-prefs-card";

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
      <AdminOverviewCards />
      <DisplayPrefsCard />
    </div>
  );
}
