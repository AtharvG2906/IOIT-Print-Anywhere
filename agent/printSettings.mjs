// Kept separate from agent.mjs so it can be unit-tested without a config file.

/** SumatraPDF settings: page range, black & white, A4 paper, scale to fit, copies. */
export function buildPrintSettings(pageRange, copies) {
  const parts = [];
  if (pageRange && pageRange !== "all") {
    if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(pageRange)) throw new Error(`invalid page range "${pageRange}"`);
    parts.push(pageRange);
  }
  parts.push("monochrome", "paper=A4", "fit");
  const n = Number(copies);
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error(`invalid copies "${copies}"`);
  if (n > 1) parts.push(`${n}x`);
  return parts.join(",");
}
