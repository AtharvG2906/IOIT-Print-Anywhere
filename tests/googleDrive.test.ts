import { describe, expect, it } from "vitest";
import { buildMultipartBody } from "@/lib/googleDrive";

describe("buildMultipartBody", () => {
  it("wraps metadata and file bytes in a multipart/related body", () => {
    const body = buildMultipartBody({ name: "x.jpg", parents: ["F"] }, new Uint8Array([1, 2, 3]), "image/jpeg", "B").toString("latin1");
    expect(body.startsWith("--B\r\nContent-Type: application/json")).toBe(true);
    expect(body).toContain('"parents":["F"]');
    expect(body).toContain("--B\r\nContent-Type: image/jpeg\r\n\r\n\u0001\u0002\u0003\r\n--B--");
  });
});
