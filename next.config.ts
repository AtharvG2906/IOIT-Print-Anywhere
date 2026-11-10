import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: almost every page here depends on the logged-in
  // user, so plain request-time rendering is simpler and correct.
  serverExternalPackages: ["argon2", "pg", "@prisma/adapter-pg"],
  experimental: {
    // The sign-up form sends the college ID card (max 4 MB) with the form.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
