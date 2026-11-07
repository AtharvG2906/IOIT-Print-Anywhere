import { randomInt } from "node:crypto";

// No 0/O, 1/I/L so codes are easy to read aloud and type at the desk.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Returns a code like "K7Q-4MZ". */
export function generatePrintingCode(): string {
  let raw = "";
  for (let i = 0; i < 6; i++) raw += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

/** Normalizes desk input ("k7q4mz", "K7Q 4MZ") to the stored form "K7Q-4MZ". */
export function normalizePrintingCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 6) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}
