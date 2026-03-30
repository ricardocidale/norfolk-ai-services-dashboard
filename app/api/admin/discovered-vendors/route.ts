import { auth } from "@clerk/nextjs/server";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { isAppAdmin } from "@/lib/admin/is-app-admin";
import { getDiscoveredVendorsFromScans } from "@/lib/admin/discovered-vendors";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/discovered-vendors
 * Names seen in Gmail scans that are not AiProvider enum ids (for catalog expansion).
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  if (!(await isAppAdmin())) {
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  const vendors = await getDiscoveredVendorsFromScans(120);
  return jsonOk({ vendors });
}
