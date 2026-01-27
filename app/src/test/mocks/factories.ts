import { createId } from "@paralleldrive/cuid2";

export interface MockUser {
  id: string;
  email: string;
  name: string;
  position: "ADMIN" | "PARTNER" | "SENIOR_ASSOCIATE" | "ASSOCIATE" | "CONSULTANT";
  status: "ACTIVE" | "INACTIVE";
}

export interface MockClient {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface MockTimeEntry {
  id: string;
  userId: string;
  clientId: string;
  date: string;
  hours: string;
  description: string;
  topicId: string | null;
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
}

export interface MockSubtopic {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  topic: {
    name: string;
    status: "ACTIVE" | "INACTIVE";
  };
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: createId(),
    email: "test@example.com",
    name: "Test User",
    position: "ASSOCIATE",
    status: "ACTIVE",
    ...overrides,
  };
}

export function createMockClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    id: createId(),
    name: "Test Client Ltd",
    status: "ACTIVE",
    ...overrides,
  };
}

export function createMockTimeEntry(overrides: Partial<MockTimeEntry> = {}): MockTimeEntry {
  const clientId = overrides.clientId || createId();
  return {
    id: createId(),
    userId: createId(),
    clientId,
    date: "2024-12-20",
    hours: "2.5",
    description: "Test time entry description",
    topicId: createId(),
    subtopicId: createId(),
    topicName: "General Advisory",
    subtopicName: "Client correspondence:",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: { id: clientId, name: "Test Client Ltd" },
    ...overrides,
  };
}

export function createMockSubtopic(overrides: Partial<MockSubtopic> = {}): MockSubtopic {
  return {
    id: createId(),
    name: "Client correspondence:",
    status: "ACTIVE",
    topic: {
      name: "General Advisory",
      status: "ACTIVE",
    },
    ...overrides,
  };
}
