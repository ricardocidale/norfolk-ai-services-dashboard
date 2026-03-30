import { AiProvider } from "@prisma/client";
import { prisma } from "@/lib/db";

const VALID = new Set<string>(Object.values(AiProvider));

export type DiscoveredVendorRow = {
  displayName: string;
  hitCount: number;
  lastSeenAt: string;
};

/**
 * Vendor strings from email scans that are not a known AiProvider enum id
 * (e.g. "Acme Corp", "Slack") — candidates to add to the catalog later.
 */
export async function getDiscoveredVendorsFromScans(
  take = 100,
): Promise<DiscoveredVendorRow[]> {
  const rows = await prisma.emailScanResult.findMany({
    where: { parsedVendor: { not: null } },
    select: { parsedVendor: true, receivedAt: true },
    orderBy: { receivedAt: "desc" },
    take: 8000,
  });

  const agg = new Map<string, { count: number; lastSeen: Date }>();
  for (const r of rows) {
    const v = r.parsedVendor!;
    if (VALID.has(v)) continue;
    const cur = agg.get(v) ?? { count: 0, lastSeen: r.receivedAt };
    cur.count += 1;
    if (r.receivedAt > cur.lastSeen) cur.lastSeen = r.receivedAt;
    agg.set(v, cur);
  }

  return [...agg.entries()]
    .map(([displayName, { count, lastSeen }]) => ({
      displayName,
      hitCount: count,
      lastSeenAt: lastSeen.toISOString(),
    }))
    .sort(
      (a, b) =>
        b.hitCount - a.hitCount ||
        b.lastSeenAt.localeCompare(a.lastSeenAt),
    )
    .slice(0, take);
}
