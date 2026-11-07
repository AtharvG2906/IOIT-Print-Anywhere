import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "@/lib/rateLimit";

describe("SlidingWindowLimiter", () => {
  it("allows up to max hits per window, per key", () => {
    const l = new SlidingWindowLimiter(3, 1000);
    expect([l.hit("a", 0), l.hit("a", 10), l.hit("a", 20), l.hit("a", 30)]).toEqual([true, true, true, false]);
    expect(l.hit("b", 30)).toBe(true);
  });

  it("frees up again once old hits leave the window", () => {
    const l = new SlidingWindowLimiter(2, 1000);
    l.hit("a", 0);
    l.hit("a", 500);
    expect(l.hit("a", 900)).toBe(false);
    expect(l.hit("a", 1001)).toBe(true);
  });
});
