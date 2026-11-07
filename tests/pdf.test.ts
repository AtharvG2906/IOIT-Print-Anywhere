import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { A4_HEIGHT, A4_WIDTH, buildCoverPage, inspectPdf } from "@/lib/pdf";

async function makePdf(sizes: [number, number][]) {
  const doc = await PDFDocument.create();
  for (const s of sizes) doc.addPage(s);
  return doc.save();
}

describe("inspectPdf", () => {
  it("counts pages and non-A4 pages (landscape A4 counts as A4)", async () => {
    const bytes = await makePdf([
      [A4_WIDTH, A4_HEIGHT],
      [A4_HEIGHT, A4_WIDTH],
      [612, 792], // US Letter
      [960, 540], // 16:9 slide
    ]);
    expect(await inspectPdf(bytes)).toEqual({ ok: true, pageCount: 4, nonA4Pages: 2 });
  });

  it("rejects files that aren't PDFs", async () => {
    const r = await inspectPdf(new TextEncoder().encode("hello, this is a renamed text file"));
    expect(r).toMatchObject({ ok: false });
  });

  it("rejects damaged PDFs", async () => {
    const r = await inspectPdf(new TextEncoder().encode("%PDF-1.7\nthis is not really a pdf"));
    expect(r.ok).toBe(false);
  });
});

describe("buildCoverPage", () => {
  it("produces a single A4 page", async () => {
    const bytes = await buildCoverPage({
      printingCode: "K7Q-4MZ",
      fullName: "Asha Patil",
      prn: "PRN2024001",
      department: "CS",
      academicYear: "SY",
      className: "SY-B",
      batch: "B2",
      phoneLast4: "3210",
      fileName: "Physics Lab Manual — ₹ edition.pdf",
      pageRange: "1-3,5",
      selectedPages: 4,
      copies: 2,
      amount: "₹8",
      paidAt: new Date(),
    });
    const info = await inspectPdf(bytes);
    expect(info).toEqual({ ok: true, pageCount: 1, nonA4Pages: 0 });
  });
});
