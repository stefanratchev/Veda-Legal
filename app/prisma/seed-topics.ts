import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const topics = [
  { code: "ONB", name: "Onboarding & Intake", displayOrder: 1 },
  { code: "MTG", name: "Client Meetings/Calls", displayOrder: 2 },
  { code: "COM", name: "Client Emails & Messages", displayOrder: 3 },
  { code: "RES", name: "Legal Research", displayOrder: 4 },
  { code: "EMP", name: "Employment: Advisory & Docs", displayOrder: 5 },
];

async function main() {
  console.log("Seeding topics...");

  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { code: topic.code },
      update: { name: topic.name, displayOrder: topic.displayOrder },
      create: topic,
    });
    console.log(`  ✓ ${topic.code}: ${topic.name}`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
