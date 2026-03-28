import { NextResponse } from "next/server";
import { getVendorSpendAnalytics } from "@/lib/analytics/vendor-spend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getVendorSpendAnalytics();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analytics failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
