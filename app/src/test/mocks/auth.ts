import { vi } from "vitest";
import type { MockUser } from "./factories";

// Store mock state
let mockAuthState: {
  authenticated: boolean;
  user: MockUser | null;
  userInDb: boolean;
} = {
  authenticated: false,
  user: null,
  userInDb: true,
};

// Reset function for beforeEach
export function resetAuthMocks() {
  mockAuthState = {
    authenticated: false,
    user: null,
    userInDb: true,
  };
}

// Configure authenticated state
export function mockAuthenticated(user: MockUser) {
  mockAuthState = {
    authenticated: true,
    user,
    userInDb: true,
  };
}

// Configure unauthenticated state
export function mockUnauthenticated() {
  mockAuthState = {
    authenticated: false,
    user: null,
    userInDb: true,
  };
}

// Configure auth passes but user not in database
export function mockUserNotInDb(user: MockUser) {
  mockAuthState = {
    authenticated: true,
    user,
    userInDb: false,
  };
}

// Mock implementation for requireAuth
export function createRequireAuthMock() {
  return vi.fn().mockImplementation(async () => {
    if (!mockAuthState.authenticated || !mockAuthState.user) {
      return { error: "Unauthorized", status: 401 };
    }
    return {
      session: {
        user: {
          name: mockAuthState.user.name,
          email: mockAuthState.user.email,
        },
      },
    };
  });
}

// Mock implementation for getUserFromSession
export function createGetUserFromSessionMock() {
  return vi.fn().mockImplementation(async (email: string | null | undefined) => {
    if (!email || !mockAuthState.userInDb || !mockAuthState.user) {
      return null;
    }
    return {
      id: mockAuthState.user.id,
      email: mockAuthState.user.email,
      name: mockAuthState.user.name,
      position: mockAuthState.user.position,
    };
  });
}

// Mock implementation for canViewTeamTimesheets
export function createCanViewTeamTimesheetsMock() {
  return vi.fn().mockImplementation((position: string) => {
    return ["ADMIN", "PARTNER"].includes(position);
  });
}
