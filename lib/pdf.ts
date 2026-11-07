import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// A4 in PDF points (1/72 inch).
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
const A4_TOLERANCE = 0.02; // 2%

export type PdfInspection =
  | { ok: true; pageCount: number; nonA4Pages: number }
  | { ok: false; error: string };

export function looksLikePdf(bytes: Uint8Array): boolean {
  // "%PDF-" may be preceded by a little junk; the spec allows it within the first 1 KB.
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  return head.includes("%PDF-");
}

function isA4(width: number, height: number): boolean {
  const [short, long] = width < height ? [width, height] : [height, width];
  return (
    Math.abs(short - A4_WIDTH) / A4_WIDTH <= A4_TOLERANCE &&
    Math.abs(long - A4_HEIGHT) / A4_HEIGHT <= A4_TOLERANCE
  );
}

/** Validates a PDF, counts pages and counts pages that are not A4-sized. */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  if (!looksLikePdf(bytes)) return { ok: false, error: "This file is not a valid PDF." };

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : "";
    if (name === "EncryptedPDFError" || String(err).includes("encrypted")) {
      return { ok: false, error: "This PDF is password-protected. Please upload an unlocked copy." };
    }
    return { ok: false, error: "This PDF is damaged or can't be read." };
  }

  // pdf-lib parses leniently, so a broken page tree only shows up here.
  try {
    const pages = doc.getPages();
    if (pages.length === 0) return { ok: false, error: "This PDF has no pages." };

    let nonA4Pages = 0;
    for (const page of pages) {
      const { width, height } = page.getSize();
      if (!isA4(width, height)) nonA4Pages++;
    }
    return { ok: true, pageCount: pages.length, nonA4Pages };
  } catch {
    return { ok: false, error: "This PDF is damaged or can't be read." };
  }
}

export type CoverDetails = {
  printingCode: string;
  fullName: string;
  prn: string;
  department: string;
  academicYear: string;
  className: string;
  batch: string;
  phoneLast4: string;
  fileName: string;
  pageRange: string;
  selectedPages: number;
  copies: number;
  amount: string; // e.g. "₹6"
  paidAt: Date;
};

// Standard PDF fonts only cover WinAnsi; strip characters they can't draw.
function winAnsi(text: string): string {
  return text.replace(/₹/g, "Rs. ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/** Builds the A4 cover sheet printed in front of every order. */
export async function buildCoverPage(d: CoverDetails): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`IOIT Print Anywhere ${d.printingCode}`);
  const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.35, 0.35, 0.35);
  const margin = 56;

  const center = (p: PDFPage, text: string, font: PDFFont, size: number, y: number, color = black) => {
    const t = winAnsi(text);
    const w = font.widthOfTextAtSize(t, size);
    p.drawText(t, { x: (A4_WIDTH - w) / 2, y, size, font, color });
  };

  center(page, "IOIT PRINT ANYWHERE", bold, 16, A4_HEIGHT - 80, grey);
  center(page, "Printing code", regular, 14, A4_HEIGHT - 150, grey);

  // Big boxed code
  const codeSize = 64;
  const codeWidth = bold.widthOfTextAtSize(d.printingCode, codeSize);
  const boxY = A4_HEIGHT - 260;
  page.drawRectangle({
    x: (A4_WIDTH - codeWidth) / 2 - 24,
    y: boxY - 22,
    width: codeWidth + 48,
    height: codeSize + 36,
    borderColor: black,
    borderWidth: 3,
  });
  center(page, d.printingCode, bold, codeSize, boxY);

  center(page, "Desk: match the name and PRN below with the student's college ID card.", regular, 11, boxY - 60, grey);

  const rows: [string, string][] = [
    ["Name", d.fullName],
    ["PRN", d.prn],
    ["Dept / Year / Class / Batch", `${d.department} / ${d.academicYear} / ${d.className} / ${d.batch}`],
    ["Phone", `xxxxxx${d.phoneLast4}`],
    ["File", d.fileName],
    ["Pages", d.pageRange === "all" ? `All (${d.selectedPages})` : `${d.pageRange} (${d.selectedPages})`],
    ["Copies", String(d.copies)],
    ["Amount paid", d.amount],
    [
      "Paid at",
      d.paidAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
    ],
  ];

  let y = boxY - 130;
  const labelX = margin + 20;
  const valueX = margin + 190;
  const maxValueWidth = A4_WIDTH - valueX - margin;
  for (const [label, value] of rows) {
    page.drawText(winAnsi(label), { x: labelX, y, size: 13, font: regular, color: grey });
    page.drawText(fit(winAnsi(value), label === "Name" || label === "PRN" ? bold : regular, 15, maxValueWidth), {
      x: valueX,
      y,
      size: 15,
      font: label === "Name" || label === "PRN" ? bold : regular,
      color: black,
    });
    page.drawLine({
      start: { x: labelX, y: y - 10 },
      end: { x: A4_WIDTH - margin - 20, y: y - 10 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 36;
  }

  center(page, "This cover page is free and is not counted in the price.", regular, 10, 60, grey);
  return doc.save();
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}...`;
}
