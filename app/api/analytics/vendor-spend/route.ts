import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { getVendorSpendAnalytics } from "@/lib/analytics/vendor-spend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getVendorSpendAnalytics();
    return jsonOk(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analytics failed";
    return jsonErr(msg, 500, { code: "ANALYTICS_FAILED" });
  }
}
