import { describe, expect, it } from "vitest";
import { parsePageRange } from "@/lib/pageRange";

describe("parsePageRange", () => {
  it("treats empty and 'all' as every page", () => {
    expect(parsePageRange("", 5)).toMatchObject({ ok: true, normalized: "all", selectedPages: 5 });
    expect(parsePageRange(" ALL ", 3)).toMatchObject({ ok: true, normalized: "all", selectedPages: 3 });
  });

  it("parses ranges and single pages, normalizing order and duplicates", () => {
    const r = parsePageRange("8-10, 1-3,5,2,3", 12);
    expect(r).toMatchObject({ ok: true, normalized: "1-3,5,8-10", selectedPages: 7 });
  });

  it("merges adjacent pages into ranges", () => {
    expect(parsePageRange("1,2,3,5,6", 10)).toMatchObject({ ok: true, normalized: "1-3,5-6", selectedPages: 5 });
  });

  it("collapses a range covering every page to 'all'", () => {
    expect(parsePageRange("1-4", 4)).toMatchObject({ ok: true, normalized: "all", selectedPages: 4 });
  });

  it("rejects backwards ranges", () => {
    const r = parsePageRange("5-3", 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("3-5");
  });

  it("rejects out-of-range pages", () => {
    const r = parsePageRange("1-12", 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("10 pages");
  });

  it("rejects page 0, junk and empty lists", () => {
    expect(parsePageRange("0-2", 10).ok).toBe(false);
    expect(parsePageRange("1;2", 10).ok).toBe(false);
    expect(parsePageRange("abc", 10).ok).toBe(false);
    expect(parsePageRange("1--3", 10).ok).toBe(false);
    expect(parsePageRange(",,", 10).ok).toBe(false);
  });
});
