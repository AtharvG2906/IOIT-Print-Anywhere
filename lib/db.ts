import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // The local `prisma dev` database handles a single connection only; set DATABASE_POOL_MAX=1 for it.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads in development.
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
