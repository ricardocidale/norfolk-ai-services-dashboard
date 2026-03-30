import { describe, expect, it } from "vitest";
import {
  apiErrorMessageFromBody,
  unwrapApiSuccessData,
} from "@/lib/http/api-response";

describe("api-response helpers", () => {
  it("reads error message from failure envelope", () => {
    expect(
      apiErrorMessageFromBody({
        ok: false,
        error: { message: "nope", code: "X" },
      }),
    ).toBe("nope");
  });

  it("unwraps success data", () => {
    expect(
      unwrapApiSuccessData<{ x: number }>({ ok: true, data: { x: 1 } }),
    ).toEqual({ x: 1 });
  });

  it("returns undefined when not a success envelope", () => {
    expect(unwrapApiSuccessData({ ok: false, error: { message: "a" } })).toBe(
      undefined,
    );
  });
});
