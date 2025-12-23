import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // For production/actual database connection
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,                      // Maximum connections in pool
      idleTimeoutMillis: 30000,     // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Fail fast if can't connect in 5s
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  // For development without database (schema-only mode)
  return new PrismaClient();
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

// Always store globally to prevent connection exhaustion
globalForPrisma.prisma = db;
