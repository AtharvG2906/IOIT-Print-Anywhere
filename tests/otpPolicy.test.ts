import { describe, expect, it } from "vitest";
import {
  OTP_COOLDOWN_MS,
  OTP_WINDOW_MS,
  emailDomainAllowed,
  maskEmail,
  parseAllowedDomains,
  sendBlockReason,
} from "@/lib/otpPolicy";

const at = (ms: number) => new Date(ms);
const NOW = 1_000_000_000;

describe("sendBlockReason", () => {
  it("allows the first send", () => {
    expect(sendBlockReason([], NOW)).toBeNull();
  });

  it("enforces a 60 s cooldown between sends", () => {
    const r = sendBlockReason([at(NOW - 20_000)], NOW);
    expect(r?.retryAfterSeconds).toBe(40);
    expect(r?.error).toContain("40s");
    expect(sendBlockReason([at(NOW - OTP_COOLDOWN_MS)], NOW)).toBeNull();
  });

  it("allows at most 3 sends per 10 minutes", () => {
    const two = [at(NOW - 5 * 60_000), at(NOW - 2 * 60_000)];
    expect(sendBlockReason(two, NOW)).toBeNull();
    const three = [...two, at(NOW - 9 * 60_000)];
    const r = sendBlockReason(three, NOW);
    expect(r).not.toBeNull();
    // The oldest (9 min ago) leaves the window in 1 minute.
    expect(r?.retryAfterSeconds).toBe(60);
    expect(r?.error).toContain("1 minute");
  });

  it("ignores sends older than the window", () => {
    const old = [at(NOW - OTP_WINDOW_MS - 1), at(NOW - OTP_WINDOW_MS - 2), at(NOW - OTP_WINDOW_MS - 3)];
    expect(sendBlockReason(old, NOW)).toBeNull();
  });
});

describe("allowed email domains", () => {
  it("parses one or many domains, with or without @", () => {
    expect(parseAllowedDomains(undefined)).toEqual([]);
    expect(parseAllowedDomains("")).toEqual([]);
    expect(parseAllowedDomains(" @College.EDU , aissmsioit.org ")).toEqual(["college.edu", "aissmsioit.org"]);
  });

  it("allows everyone when unset, otherwise exact domain matches only", () => {
    expect(emailDomainAllowed("a@gmail.com", [])).toBe(true);
    expect(emailDomainAllowed("A@College.edu", ["college.edu"])).toBe(true);
    expect(emailDomainAllowed("a@gmail.com", ["college.edu"])).toBe(false);
    expect(emailDomainAllowed("a@evilcollege.edu", ["college.edu"])).toBe(false);
    expect(emailDomainAllowed("a@college.edu.evil.com", ["college.edu"])).toBe(false);
  });
});

describe("maskEmail", () => {
  it("hides most of the local part", () => {
    expect(maskEmail("asha.patil@college.edu")).toBe("as••••••@college.edu");
    expect(maskEmail("ab@x.com")).toBe("ab•@x.com");
  });
});
