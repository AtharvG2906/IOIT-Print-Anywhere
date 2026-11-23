import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "@/lib/env";

describe("resolveAppUrl", () => {
  it("uses APP_URL when set, without a trailing slash", () => {
    expect(resolveAppUrl({ APP_URL: "https://driplens.in/", NODE_ENV: "production" })).toBe("https://driplens.in");
  });
  it("defaults to localhost in development", () => {
    expect(resolveAppUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });
  it("falls back to the Vercel production domain when APP_URL is missing", () => {
    expect(resolveAppUrl({ NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "driplens.in" })).toBe("https://driplens.in");
  });
  it("never uses localhost in production on Vercel", () => {
    expect(
      resolveAppUrl({ NODE_ENV: "production", APP_URL: "http://localhost:3000", VERCEL_PROJECT_PRODUCTION_URL: "driplens.in" }),
    ).toBe("https://driplens.in");
  });
});
