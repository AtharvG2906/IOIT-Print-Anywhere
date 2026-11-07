export type PageRangeResult =
  | { ok: true; pages: number[]; normalized: string; selectedPages: number }
  | { ok: false; error: string };

/**
 * Parses "all" / "" or a list like "1-3,5,8-10" against a document's page count.
 * Returns the sorted, de-duplicated pages and a normalized string such as
 * "1-3,5,8-10" (or "all") that the print agent passes to SumatraPDF.
 */
export function parsePageRange(input: string, pageCount: number): PageRangeResult {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");
  if (pageCount < 1) return { ok: false, error: "The document has no pages." };

  if (raw === "" || raw === "all") {
    return {
      ok: true,
      pages: Array.from({ length: pageCount }, (_, i) => i + 1),
      normalized: "all",
      selectedPages: pageCount,
    };
  }

  if (!/^[0-9,-]+$/.test(raw)) {
    return { ok: false, error: "Use page numbers and ranges only, e.g. 1-3,5,8-10." };
  }

  const set = new Set<number>();
  for (const part of raw.split(",")) {
    if (part === "") continue;
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!match) return { ok: false, error: `"${part}" is not a valid page or range.` };
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < 1 || end < 1) return { ok: false, error: "Page numbers start at 1." };
    if (start > end) {
      return { ok: false, error: `"${part}" is backwards — write it as ${end}-${start}.` };
    }
    if (end > pageCount) {
      return {
        ok: false,
        error: `Page ${end} doesn't exist — this document has ${pageCount} page${pageCount === 1 ? "" : "s"}.`,
      };
    }
    for (let p = start; p <= end; p++) set.add(p);
  }

  if (set.size === 0) return { ok: false, error: "Enter at least one page." };

  const pages = [...set].sort((a, b) => a - b);
  if (pages.length === pageCount) {
    return { ok: true, pages, normalized: "all", selectedPages: pageCount };
  }
  return { ok: true, pages, normalized: compress(pages), selectedPages: pages.length };
}

function compress(pages: number[]): string {
  const parts: string[] = [];
  let start = pages[0];
  let prev = pages[0];
  for (let i = 1; i <= pages.length; i++) {
    const p = pages[i];
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = p;
    prev = p;
  }
  return parts.join(",");
}
