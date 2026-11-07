import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: almost every page here depends on the logged-in
  // user, so plain request-time rendering is simpler and correct.
  serverExternalPackages: ["argon2", "pg", "@prisma/adapter-pg"],
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
