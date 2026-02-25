import { type Page, expect } from "@playwright/test";
import { CLIENTS, TOPICS, SUBTOPICS } from "./seed-data";

/**
 * Options for creating a time entry via the API.
 */
interface CreateEntryOptions {
  date: string; // YYYY-MM-DD
  clientId: string;
  subtopicId?: string | null;
  topicId?: string | null;
  hours: number;
  description: string;
}

/**
 * Create a time entry by calling POST /api/timesheets directly.
 * Uses `page.request` which inherits auth cookies from storageState automatically.
 *
 * Throws if the API returns an error response.
 */
export async function createEntryViaAPI(
  page: Page,
  options: CreateEntryOptions
): Promise<{ id: string; hours: number; description: string }> {
  const response = await page.request.post("/api/timesheets", {
    data: {
      date: options.date,
      clientId: options.clientId,
      subtopicId: options.subtopicId ?? null,
      topicId: options.topicId ?? null,
      hours: options.hours,
      description: options.description,
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/**
 * Convenience: create a REGULAR client entry with the "Client correspondence:" subtopic.
 */
export async function createRegularEntry(
  page: Page,
  date: string,
  hours: number = 1,
  description: string = "Test regular entry for e2e"
) {
  return createEntryViaAPI(page, {
    date,
    clientId: CLIENTS.regular.id,
    subtopicId: SUBTOPICS.correspondence.id,
    topicId: TOPICS.corporate.id,
    hours,
    description,
  });
}

/**
 * Convenience: create an INTERNAL client entry with topic-only (no subtopic).
 */
export async function createInternalEntry(
  page: Page,
  date: string,
  hours: number = 1,
  description: string = "Internal admin work for e2e"
) {
  return createEntryViaAPI(page, {
    date,
    clientId: CLIENTS.internal.id,
    topicId: TOPICS.firmAdmin.id,
    subtopicId: null,
    hours,
    description,
  });
}

/**
 * Returns today's date as a YYYY-MM-DD string.
 */
export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}
