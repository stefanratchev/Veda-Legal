import { vi } from "vitest";

/**
 * Creates a mock database object for Drizzle ORM tests.
 * Use with vi.mock('@/lib/db', () => ({ db: createMockDb() }))
 */
export function createMockDb() {
  return {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      clients: { findFirst: vi.fn(), findMany: vi.fn() },
      timeEntries: { findFirst: vi.fn(), findMany: vi.fn() },
      topics: { findFirst: vi.fn(), findMany: vi.fn() },
      subtopics: { findFirst: vi.fn(), findMany: vi.fn() },
      billing: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Helper to create chainable mock for insert().values().returning()
 */
export function mockInsertReturning<T>(data: T) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([data]),
    }),
  };
}

/**
 * Helper to create chainable mock for update().set().where().returning()
 */
export function mockUpdateReturning<T>(data: T | null) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(data ? [data] : []),
      }),
    }),
  };
}

/**
 * Helper to create chainable mock for delete().where()
 */
export function mockDeleteWhere() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Legacy stateful mocking API (kept for backward compatibility)
// Consider using createMockDb() and the chainable helpers above instead
// ============================================================================

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

/**
 * @deprecated Use createMockDb() instead
 * Legacy stateful mock - creates a db mock that reads from module-level state
 */
export function createStatefulDbMock() {
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
