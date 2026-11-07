import { describe, expect, it } from "vitest";
import { calculateAmountPaise, formatRupees } from "@/lib/pricing";

describe("pricing", () => {
  it("charges pages × copies × ₹1", () => {
    expect(calculateAmountPaise({ selectedPages: 3, copies: 2, ratePaise: 100 })).toBe(600);
    expect(calculateAmountPaise({ selectedPages: 300, copies: 10, ratePaise: 100 })).toBe(300000);
  });

  it("caps copies at 10 and rejects invalid input", () => {
    expect(() => calculateAmountPaise({ selectedPages: 1, copies: 11, ratePaise: 100 })).toThrow();
    expect(() => calculateAmountPaise({ selectedPages: 1, copies: 0, ratePaise: 100 })).toThrow();
    expect(() => calculateAmountPaise({ selectedPages: 1, copies: 1.5, ratePaise: 100 })).toThrow();
    expect(() => calculateAmountPaise({ selectedPages: 0, copies: 1, ratePaise: 100 })).toThrow();
  });

  it("formats rupees", () => {
    expect(formatRupees(600)).toBe("₹6");
    expect(formatRupees(150)).toBe("₹1.50");
  });
});
