/**
 * High-level groupings for vendors (derived from provider metadata, not stored on Expense).
 * Used for dashboards, rankings, and rollups.
 */
export type VendorCategory =
  | "ai_ml"
  | "cloud_hosting"
  | "dev_tools"
  | "business_productivity"
  | "payments_identity"
  | "design_creative"
  | "general";

export const VENDOR_CATEGORY_LABEL: Record<VendorCategory, string> = {
  ai_ml: "AI & ML",
  cloud_hosting: "Cloud & hosting",
  dev_tools: "Developer tools",
  business_productivity: "Business & productivity",
  payments_identity: "Payments & identity",
  design_creative: "Design & creative",
  general: "General / other",
};

/** Stable order for legend and filters; category spend ranking uses actual totals. */
export const VENDOR_CATEGORY_ORDER: VendorCategory[] = [
  "ai_ml",
  "cloud_hosting",
  "dev_tools",
  "business_productivity",
  "payments_identity",
  "design_creative",
  "general",
];
