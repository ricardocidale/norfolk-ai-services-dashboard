/**
 * Standard = core AI/vendor domains.
 * Extended = additional SaaS + software domains + richer subject keywords.
 * Discover = subject-only (invoice/payment keywords, any sender) to surface unknown vendors.
 */
export type GmailScanScope = "standard" | "extended" | "discover";
