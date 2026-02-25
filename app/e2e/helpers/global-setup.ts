import dotenv from "dotenv";
import path from "path";
import pg from "pg";

import { TEST_USER, CLIENTS, TOPICS, SUBTOPICS } from "./seed-data";

dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

async function globalSetup() {
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    max: 2,
  });

  try {
    const now = new Date().toISOString();

    // 1. Seed user (UPSERT by email unique constraint)
    await pool.query(
      `INSERT INTO users (id, email, name, position, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"Position", $5::"UserStatus", $6, $6)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         position = EXCLUDED.position::"Position",
         status = EXCLUDED.status::"UserStatus",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [TEST_USER.id, TEST_USER.email, TEST_USER.name, TEST_USER.position, TEST_USER.status, now]
    );

    // 2. Seed clients (UPSERT by id)
    for (const client of [CLIENTS.regular, CLIENTS.internal]) {
      await pool.query(
        `INSERT INTO clients (id, name, "clientType", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3::"ClientType", $4::"ClientStatus", $5, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           "clientType" = EXCLUDED."clientType"::"ClientType",
           status = EXCLUDED.status::"ClientStatus",
           "updatedAt" = EXCLUDED."updatedAt"`,
        [client.id, client.name, client.clientType, client.status, now]
      );
    }

    // 3. Seed topics (UPSERT by id)
    for (const topic of [TOPICS.corporate, TOPICS.firmAdmin]) {
      await pool.query(
        `INSERT INTO topics (id, name, "topicType", status, "displayOrder", "createdAt", "updatedAt")
         VALUES ($1, $2, $3::"TopicType", $4::"TopicStatus", $5, $6, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           "topicType" = EXCLUDED."topicType"::"TopicType",
           status = EXCLUDED.status::"TopicStatus",
           "displayOrder" = EXCLUDED."displayOrder",
           "updatedAt" = EXCLUDED."updatedAt"`,
        [topic.id, topic.name, topic.topicType, topic.status, topic.displayOrder, now]
      );
    }

    // 4. Seed subtopics (UPSERT by id)
    for (const sub of [SUBTOPICS.correspondence, SUBTOPICS.draftingShareholder, SUBTOPICS.legalResearch]) {
      await pool.query(
        `INSERT INTO subtopics (id, "topicId", name, "isPrefix", "displayOrder", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6::"SubtopicStatus", $7, $7)
         ON CONFLICT (id) DO UPDATE SET
           "topicId" = EXCLUDED."topicId",
           name = EXCLUDED.name,
           "isPrefix" = EXCLUDED."isPrefix",
           "displayOrder" = EXCLUDED."displayOrder",
           status = EXCLUDED.status::"SubtopicStatus",
           "updatedAt" = EXCLUDED."updatedAt"`,
        [sub.id, sub.topicId, sub.name, sub.isPrefix, sub.displayOrder, sub.status, now]
      );
    }

    console.log("Global setup: seeded test data into veda_legal_test");
  } finally {
    await pool.end();
  }
}

export default globalSetup;
