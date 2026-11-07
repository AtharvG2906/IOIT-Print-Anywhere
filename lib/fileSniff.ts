/** Identify an uploaded ID file from its first bytes rather than trusting the extension. */
export function sniffIdType(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (Buffer.from(b.subarray(0, 5)).toString("latin1") === "%PDF-") return { ext: "pdf", type: "application/pdf" };
  return null;
}
