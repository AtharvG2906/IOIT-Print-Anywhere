export const MAX_COPIES = 10;

export type PriceInput = { selectedPages: number; copies: number; ratePaise: number; maxCopies?: number };

/** Amount in paise. Black & white only, priced per printed page. The cover page is free. */
export function calculateAmountPaise({ selectedPages, copies, ratePaise, maxCopies = MAX_COPIES }: PriceInput): number {
  if (!Number.isInteger(copies) || copies < 1 || copies > maxCopies) {
    throw new Error(`Copies must be between 1 and ${maxCopies}.`);
  }
  if (!Number.isInteger(selectedPages) || selectedPages < 1) {
    throw new Error("At least one page must be selected.");
  }
  return selectedPages * copies * ratePaise;
}

export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`;
}
