import { describe, expect, it } from "vitest";
import { buildOtpEmail, buildWelcomeEmail } from "@/lib/email";

describe("emails", () => {
  it("OTP email carries the code in subject, text and HTML", () => {
    const m = buildOtpEmail("a@b.com", "482913", "SIGNUP");
    expect(m.subject).toContain("482913");
    expect(m.text).toContain("482913");
    expect(m.html).toContain("482913");
    expect(m.text).toContain("create your Print Anywhere account");
    expect(buildOtpEmail("a@b.com", "111111", "RESET").text).toContain("reset your Print Anywhere password");
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
