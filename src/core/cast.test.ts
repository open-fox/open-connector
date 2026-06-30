import { describe, expect, it } from "vitest";
import { optionalRawString, optionalString } from "./cast.ts";

describe("string casts", () => {
  it("trims optional strings and omits empty values by default", () => {
    expect(optionalString(" value ")).toBe("value");
    expect(optionalString(" ")).toBeUndefined();
    expect(optionalString(1)).toBeUndefined();
  });

  it("keeps raw strings exactly as provided", () => {
    expect(optionalRawString(" value ")).toBe(" value ");
    expect(optionalRawString("")).toBe("");
    expect(optionalRawString(1)).toBeUndefined();
  });
});
