import { test as base } from "@playwright/test";
import pg from "pg";

// Module-level singleton pool for the test database.
// Shared across all tests in the same worker to avoid connection churn.
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 2,
});

export const test = base.extend<{ db: pg.Pool }>({
  db: async ({}, use) => {
    // TRUNCATE mutable tables before each test (beforeEach pattern).
    // This handles stale state from previous test failures.
    // Reference data (users, clients, topics, subtopics) is NOT truncated —
    // it is seeded once by globalSetup and remains for all tests.
    await pool.query(`
      TRUNCATE
        service_description_line_items,
        service_description_topics,
        service_descriptions,
        time_entries,
        timesheet_submissions
      CASCADE
    `);

    await use(pool);
  },
});
