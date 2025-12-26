import { vi } from "vitest";

// Store mock query results
let mockQueryResults: {
  timeEntries: {
    findMany: unknown[];
    findFirst: unknown | undefined;
  };
  users: {
    findFirst: unknown | undefined;
  };
  clients: {
    findFirst: unknown | undefined;
  };
  subtopics: {
    findFirst: unknown | undefined;
  };
} = {
  timeEntries: { findMany: [], findFirst: undefined },
  users: { findFirst: undefined },
  clients: { findFirst: undefined },
  subtopics: { findFirst: undefined },
};

let mockInsertResult: unknown = undefined;
let mockSelectResult: unknown[] = [];

// Reset function for beforeEach
export function resetDbMocks() {
  mockQueryResults = {
    timeEntries: { findMany: [], findFirst: undefined },
    users: { findFirst: undefined },
    clients: { findFirst: undefined },
    subtopics: { findFirst: undefined },
  };
  mockInsertResult = undefined;
  mockSelectResult = [];
}

// Configure mock results
export const mockDbQuery = {
  timeEntries: {
    findMany: (entries: unknown[]) => {
      mockQueryResults.timeEntries.findMany = entries;
    },
    findFirst: (entry: unknown | undefined) => {
      mockQueryResults.timeEntries.findFirst = entry;
    },
  },
  users: {
    findFirst: (user: unknown | undefined) => {
      mockQueryResults.users.findFirst = user;
    },
  },
  clients: {
    findFirst: (client: unknown | undefined) => {
      mockQueryResults.clients.findFirst = client;
    },
  },
  subtopics: {
    findFirst: (subtopic: unknown | undefined) => {
      mockQueryResults.subtopics.findFirst = subtopic;
    },
  },
};

export const mockDbInsert = {
  timeEntries: {
    returning: (entry: unknown) => {
      mockInsertResult = entry;
    },
  },
};

export const mockDbSelect = {
  result: (rows: unknown[]) => {
    mockSelectResult = rows;
  },
};

// Create the mock db object
export function createDbMock() {
  return {
    query: {
      timeEntries: {
        findMany: vi.fn().mockImplementation(async () => mockQueryResults.timeEntries.findMany),
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.timeEntries.findFirst),
      },
      users: {
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.users.findFirst),
      },
      clients: {
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.clients.findFirst),
      },
      subtopics: {
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.subtopics.findFirst),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(async () => [mockInsertResult]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(async () => undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              having: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockImplementation(async () => mockSelectResult),
              }),
            }),
          }),
        }),
      }),
    }),
    selectDistinct: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => mockQueryResults.timeEntries.findMany),
      }),
    }),
  };
}
