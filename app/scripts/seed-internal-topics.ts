import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { createId } from "@paralleldrive/cuid2";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const INTERNAL_TOPICS = [
  "Holiday",
  "Sick Leave",
  "KYC",
  "Leads",
  "Knowhow",
  "Marketing",
  "Misc",
];

const MANAGEMENT_TOPICS = ["Strategy", "Billing", "Admin", "Networking"];

async function main() {
  console.log("Seeding internal and management topics...\n");

  const now = new Date().toISOString();
  let displayOrder = 1000;

  // Seed INTERNAL topics
  console.log("Internal topics:");
  for (const topicName of INTERNAL_TOPICS) {
    const existing = await db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.name, topicName))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  [SKIPPED] ${topicName} - already exists`);
      continue;
    }

    await db.insert(schema.topics).values({
      id: createId(),
      name: topicName,
      displayOrder: displayOrder++,
      status: "ACTIVE",
      topicType: "INTERNAL",
      createdAt: now,
      updatedAt: now,
    });

    console.log(`  [CREATED] ${topicName}`);
  }

  // Seed MANAGEMENT topics
  console.log("\nManagement topics:");
  for (const topicName of MANAGEMENT_TOPICS) {
    const existing = await db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.name, topicName))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  [SKIPPED] ${topicName} - already exists`);
      continue;
    }

    await db.insert(schema.topics).values({
      id: createId(),
      name: topicName,
      displayOrder: displayOrder++,
      status: "ACTIVE",
      topicType: "MANAGEMENT",
      createdAt: now,
      updatedAt: now,
    });

    console.log(`  [CREATED] ${topicName}`);
  }

  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
