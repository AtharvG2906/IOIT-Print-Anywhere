import { describe, expect, it } from "vitest";
import { DEV_DEFAULT_PASSWORD, fillTestDefaults } from "@/lib/devSignup";
import { signupSchema } from "@/lib/validation";

const empty = {
  fullName: "", email: "a@b.com", password: "", confirmPassword: "", academicYear: "", department: "",
  className: "", batch: "", prn: "", address: "", phone: "",
};

describe("fillTestDefaults (localhost only)", () => {
  it("turns an empty form into a valid sign-up", () => {
    const filled = fillTestDefaults(empty, () => 7);
    expect(signupSchema.safeParse(filled).success).toBe(true);
    expect(filled.password).toBe(DEV_DEFAULT_PASSWORD);
    expect(filled.phone).toBe("9777777777");
  });

  it("keeps values the tester did type", () => {
    const filled = fillTestDefaults({ ...empty, fullName: "Asha Patil", prn: "PRN123", phone: "9876543210", password: "mypassword" });
    expect(filled.fullName).toBe("Asha Patil");
    expect(filled.prn).toBe("PRN123");
    expect(filled.phone).toBe("9876543210");
    expect(filled.password).toBe("mypassword");
    expect(filled.confirmPassword).toBe("mypassword");
  });
});

describe("relaxedSignup", () => {
  it("is on only for next dev, never in production builds", async () => {
    const { relaxedSignup } = await import("@/lib/devSignup");
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    env.NODE_ENV = "development";
    expect(relaxedSignup()).toBe(true);
    env.NODE_ENV = "production";
    expect(relaxedSignup()).toBe(false);
    env.NODE_ENV = "test";
    expect(relaxedSignup()).toBe(false);
    env.NODE_ENV = original;
  });
});
