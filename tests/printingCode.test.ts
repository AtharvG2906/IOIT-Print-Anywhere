import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, generatePrintingCode, normalizePrintingCode } from "@/lib/printingCode";

describe("printing codes", () => {
  it("look like ABC-123 and avoid confusing characters", () => {
    for (let i = 0; i < 500; i++) {
      const code = generatePrintingCode();
      expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("are effectively unique", () => {
    const codes = new Set(Array.from({ length: 5000 }, generatePrintingCode));
    expect(codes.size).toBeGreaterThan(4990);
    expect(CODE_ALPHABET.length ** 6).toBeGreaterThan(800_000_000);
  });

  it("normalizes desk input", () => {
    expect(normalizePrintingCode("k7q4mz")).toBe("K7Q-4MZ");
    expect(normalizePrintingCode(" K7Q 4MZ ")).toBe("K7Q-4MZ");
    expect(normalizePrintingCode("K7Q-4M")).toBeNull();
    expect(normalizePrintingCode("O0Q-4MZ")).toBeNull();
  });
});
