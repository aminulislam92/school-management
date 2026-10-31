import "server-only";
import { PrismaClient } from "@prisma/client";

// One PrismaClient for the whole app. In development, Next.js reloads modules
// on every change, so we keep the client on globalThis to avoid opening a new
// MySQL connection pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
