import { describe, expect, it } from "vitest";
import { buildPrintSettings } from "../agent/printSettings.mjs";

describe("agent print settings", () => {
  it("always forces A4, black & white and fit-to-page", () => {
    expect(buildPrintSettings("all", 1)).toBe("monochrome,paper=A4,fit");
    expect(buildPrintSettings("1-3,5", 2)).toBe("1-3,5,monochrome,paper=A4,fit,2x");
  });

  it("refuses unsafe ranges and copy counts", () => {
    expect(() => buildPrintSettings("1-3;rm", 1)).toThrow();
    expect(() => buildPrintSettings("all", 11)).toThrow();
    expect(() => buildPrintSettings("all", 0)).toThrow();
  });
});
