import { getAdminConsumptionReport } from "@/lib/analytics/admin-consumption-report";
import { AdminAnalysisView } from "@/components/admin/admin-analysis-view";

export const dynamic = "force-dynamic";

export default async function AdminAnalysisPage(): Promise<React.JSX.Element> {
  const report = await getAdminConsumptionReport();
  const { vendorSpend, ...rest } = report;
  return (
    <AdminAnalysisView
      {...rest}
      asOf={vendorSpend.asOf}
      timezoneNote={vendorSpend.timezoneNote}
      windowStart={vendorSpend.windowStart}
      windowEnd={vendorSpend.windowEnd}
      currentMonthLabel={vendorSpend.currentMonthLabel}
    />
  );
}
