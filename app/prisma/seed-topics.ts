import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SubtopicData {
  name: string;
}

interface TopicData {
  name: string;
  subtopics: SubtopicData[];
}

const TOPICS: TopicData[] = [
  {
    name: "Internal",
    subtopics: [
      { name: "Onboarding" },
      { name: "AML/ KYC" },
      { name: "Admin:" },
      { name: "Meeting:" },
      { name: "Marketing:" },
      { name: "Research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Company Incorporation",
    subtopics: [
      { name: "Drafting incorporation documents" },
      { name: "Revising incorporation documents" },
      { name: "Modifications to standard documents" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Commercial Register filing: preparation for filing" },
      { name: "Commercial Register filing: submission of application" },
      { name: "Commercial Register filing: additional requests" },
      { name: "VAT registration: document preparation" },
      { name: "VAT registration: NRA correspondence" },
      { name: "Other:" },
    ],
  },
  {
    name: "UBO Disclosure",
    subtopics: [
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Drafting UBO declaration" },
      { name: "Revising UBO declaration" },
      { name: "Commercial Register filing: preparation for filing" },
      { name: "Commercial Register filing: submission of application" },
      { name: "Commercial Register filing: additional requests" },
    ],
  },
  {
    name: "Corporate Changes",
    subtopics: [
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Drafting documents:" },
      { name: "Revising documents:" },
      { name: "Strategic consideration:" },
      { name: "Legal Research:" },
      { name: "Commercial Register filing: preparation for filing" },
      { name: "Commercial Register filing: submission of application" },
      { name: "Commercial Register filing: additional requests" },
      { name: "Other:" },
    ],
  },
  {
    name: "Bank Account",
    subtopics: [
      { name: "Correspondence with the bank" },
      { name: "Research and summary of bank requirements" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Drafting documents:" },
      { name: "Revising documents:" },
      { name: "Bank visit: opening account" },
      { name: "Internal: Case Management" },
    ],
  },
  {
    name: "Employment Agreement",
    subtopics: [
      { name: "Drafting employment agreement" },
      { name: "Revising employment agreement" },
      { name: "Reflecting client comments in employment agreement" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Employment Internal Rules",
    subtopics: [
      { name: "Drafting Internal Labour Rules" },
      { name: "Revising Internal Labour Rules" },
      { name: "Drafting Internal Remuneration Rules" },
      { name: "Revising Internal Remuneration Rules" },
      { name: "Reflecting client comments in Internal Rules" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Employment Advisory",
    subtopics: [
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Drafting documents:" },
      { name: "Revising documents:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Intercompany Agreement",
    subtopics: [
      { name: "Drafting Intercompany Agreement" },
      { name: "Revising Intercompany Agreement" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Contracts",
    subtopics: [
      { name: "Drafting contract:" },
      { name: "Revising contract:" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Terms & Conditions",
    subtopics: [
      { name: "Drafting T&C:" },
      { name: "Revising T&C:" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Data Protection",
    subtopics: [
      { name: "Drafting a Privacy Policy" },
      { name: "Revising a Privacy Policy" },
      { name: "Drafting Data Protection Instruction" },
      { name: "Revising Data Protection Instruction" },
      { name: "Drafting Cookies Policy" },
      { name: "Revising Cookies Policy" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Legal Advisory",
    subtopics: [
      { name: "Drafting:" },
      { name: "Revising:" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
];

async function main() {
  console.log("Deleting existing topics and subtopics...");
  await prisma.subtopic.deleteMany();
  await prisma.topic.deleteMany();

  console.log("Seeding topics and subtopics...");

  for (let topicOrder = 0; topicOrder < TOPICS.length; topicOrder++) {
    const topicData = TOPICS[topicOrder];

    const topic = await prisma.topic.create({
      data: {
        name: topicData.name,
        displayOrder: topicOrder,
        status: "ACTIVE",
      },
    });

    console.log(`Created topic: ${topic.name}`);

    for (let subtopicOrder = 0; subtopicOrder < topicData.subtopics.length; subtopicOrder++) {
      const subtopicData = topicData.subtopics[subtopicOrder];
      const isPrefix = subtopicData.name.endsWith(":");

      await prisma.subtopic.create({
        data: {
          topicId: topic.id,
          name: subtopicData.name,
          isPrefix,
          displayOrder: subtopicOrder,
          status: "ACTIVE",
        },
      });
    }

    console.log(`  Created ${topicData.subtopics.length} subtopics`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
