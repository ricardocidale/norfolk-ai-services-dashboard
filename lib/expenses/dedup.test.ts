import { describe, expect, it } from "vitest";
import {
  emailInvoiceFingerprint,
  isApiSyncSource,
  sourcePriority,
} from "@/lib/expenses/dedup";

describe("emailInvoiceFingerprint", () => {
  it("normalizes Fwd/Re subject prefixes and day", () => {
    const d = new Date("2026-03-15T14:00:00.000Z");
    const a = emailInvoiceFingerprint(
      "billing@openai.com",
      "Fwd: Your March invoice",
      d,
    );
    const b = emailInvoiceFingerprint(
      "billing@openai.com",
      "RE: Your March invoice",
      d,
    );
    expect(a).toBe(b);
    expect(a).toContain("billing@openai.com");
    expect(a.endsWith("|2026-03-15")).toBe(true);
  });
});

describe("sourcePriority", () => {
  it("ranks API sources above gmail and manual", () => {
    expect(sourcePriority("openai_api")).toBeGreaterThan(
      sourcePriority("gmail_scan"),
    );
    expect(sourcePriority("gmail_scan")).toBeGreaterThan(
      sourcePriority("manual"),
    );
  });

  it("defaults unknown sources to medium tier", () => {
    expect(sourcePriority("custom_xyz")).toBe(20);
  });
});

describe("isApiSyncSource", () => {
  it("recognizes configured API sources", () => {
    expect(isApiSyncSource("openai_api")).toBe(true);
    expect(isApiSyncSource("gmail_scan")).toBe(false);
  });
});
