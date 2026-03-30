/**
 * Envelope domains for banks / card issuers. Payment alerts and statements often
 * repeat charges already captured from merchant invoices or API sync.
 */
const CARD_ISSUER_DOMAINS = new Set(
  [
    "citicards.com",
    "citi.com",
    "accountonline.com",
    "citibank.com",
    "chase.com",
    "chase.net",
    "americanexpress.com",
    "amex.com",
    "aexp.com",
    "capitalone.com",
    "capitalone360.com",
    "discover.com",
    "discoverfinancial.com",
    "bankofamerica.com",
    "bofa.com",
    "barclaysus.com",
    "barclaycardus.com",
    "synchronybank.com",
    "synchrony.com",
    "wellsfargo.com",
    "usbank.com",
    "td.com",
    "pnc.com",
  ].map((d) => d.toLowerCase()),
);

function domainFromEmail(fromEmail: string): string | null {
  const at = fromEmail.lastIndexOf("@");
  if (at < 0) return null;
  return fromEmail.slice(at + 1).toLowerCase().trim();
}

/** True when the message is from a known card / bank sender (not the merchant). */
export function isCardIssuerFromEmail(fromEmail: string): boolean {
  const d = domainFromEmail(fromEmail);
  if (!d) return false;
  if (CARD_ISSUER_DOMAINS.has(d)) return true;
  for (const issuer of CARD_ISSUER_DOMAINS) {
    if (d === issuer || d.endsWith(`.${issuer}`)) return true;
  }
  return false;
}

export function cardIssuerScanHint(): string {
  return "Card / bank sender — may duplicate merchant or API line items";
}
