import { describe, expect, it } from "vitest";
import { normalizePhone, signupSchema } from "@/lib/validation";
import { sniffIdType } from "@/lib/fileSniff";

const valid = {
  fullName: "Asha Patil",
  email: "Asha@Example.com ",
  password: "supersecret",
  confirmPassword: "supersecret",
  academicYear: "SY",
  department: "AIDS",
  className: "SY-B",
  batch: "B2",
  prn: " prn 2024 001",
  address: "12 MG Road, Pune",
  phone: "+91 98765 43210",
};

describe("signup validation", () => {
  it("accepts any email domain and normalizes fields", () => {
    const r = signupSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("asha@example.com");
      expect(r.data.prn).toBe("PRN2024001");
      expect(r.data.phone).toBe("9876543210");
    }
  });

  it("rejects mismatched passwords, bad phones and unknown years", () => {
    expect(signupSchema.safeParse({ ...valid, confirmPassword: "nope" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, academicYear: "PhD" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, academicYear: "Final Year" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, department: "Mechanical" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, department: "" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success).toBe(false);
  });

  it("normalizes Indian phone numbers", () => {
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("919876543210")).toBe("9876543210");
    expect(normalizePhone("5876543210")).toBeNull();
  });
});

describe("college ID file sniffing", () => {
  it("detects JPG, PNG and PDF by content", () => {
    expect(sniffIdType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffIdType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))?.ext).toBe("png");
    expect(sniffIdType(new TextEncoder().encode("%PDF-1.4"))?.ext).toBe("pdf");
    expect(sniffIdType(new TextEncoder().encode("<html>"))).toBeNull();
  });
});
