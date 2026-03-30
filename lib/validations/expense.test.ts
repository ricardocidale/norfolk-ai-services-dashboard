import { AiProvider } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseAiProviderQueryParam } from "@/lib/validations/expense";

describe("parseAiProviderQueryParam", () => {
  it("returns undefined for empty", () => {
    expect(parseAiProviderQueryParam(null)).toBeUndefined();
    expect(parseAiProviderQueryParam("")).toBeUndefined();
  });

  it("accepts valid enum ids", () => {
    expect(parseAiProviderQueryParam("OPENAI")).toBe(AiProvider.OPENAI);
  });

  it("rejects unknown strings", () => {
    expect(parseAiProviderQueryParam("not_a_vendor")).toBeUndefined();
  });
});
