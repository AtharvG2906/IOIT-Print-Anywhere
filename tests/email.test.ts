import { describe, expect, it } from "vitest";
import { buildOtpEmail, buildWelcomeEmail } from "@/lib/email";

describe("emails", () => {
  it("OTP email carries the code in subject, text and HTML", () => {
    const m = buildOtpEmail("a@b.com", "482913", "SIGNUP");
    expect(m.subject).toContain("482913");
    expect(m.text).toContain("482913");
    expect(m.html).toContain("482913");
    expect(m.text).toContain("create your IOIT Print Anywhere account");
    expect(buildOtpEmail("a@b.com", "111111", "RESET").text).toContain("reset your IOIT Print Anywhere password");
  });

  it("welcome email greets the student and escapes HTML", () => {
    const m = buildWelcomeEmail({ to: "a@b.com", name: "Asha <b>Patil</b>", prn: "PRN1", department: "CS", appUrl: "http://x" });
    expect(m.subject).toContain("Welcome");
    expect(m.html).toContain("Asha");
    expect(m.html).not.toContain("<b>Patil</b>");
    expect(m.html).toContain("PRN1");
    expect(m.text).toContain("http://x/login");
  });
});

describe("emailIsSimulated", () => {
  const original = { ...process.env };
  const set = (vars: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
      else (process.env as Record<string, string | undefined>)[k] = v;
    }
  };

  it("is true only for the console provider outside production", async () => {
    const { emailIsSimulated } = await import("@/lib/email");
    set({ EMAIL_PROVIDER: "console", NODE_ENV: "development" });
    expect(emailIsSimulated()).toBe(true);
    set({ EMAIL_PROVIDER: undefined, NODE_ENV: "development" });
    expect(emailIsSimulated()).toBe(true);
    set({ EMAIL_PROVIDER: "console", NODE_ENV: "production" });
    expect(emailIsSimulated()).toBe(false);
    set({ EMAIL_PROVIDER: "resend", NODE_ENV: "development" });
    expect(emailIsSimulated()).toBe(false);
    set({ EMAIL_PROVIDER: original.EMAIL_PROVIDER, NODE_ENV: original.NODE_ENV });
  });
});
