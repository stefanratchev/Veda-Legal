# API Testing Strategy Design

## Overview

Comprehensive unit and integration testing for Veda Legal Timesheets API routes using Vitest with mocked Drizzle queries.

**Goals:**
- Confidence for refactoring existing code
- Bug prevention through comprehensive coverage
- TDD foundation for new feature development
- Coverage baseline before team expansion

## Testing Approach

### Database Strategy: Mocked Drizzle Queries

- Fast and deterministic tests
- Tests route logic, not PostgreSQL behavior
- Isolated from external dependencies

### Test Organization: Colocated with Source

```
src/app/api/timesheets/
├── route.ts
└── route.test.ts
```

Benefits:
- Easy discoverability
- Tests move with refactored code
- Orphaned code = visible orphaned tests

## Test Infrastructure

### File Structure

```
src/test/
├── setup.ts                  # Existing Vitest setup
├── mocks/
│   ├── db.ts                # Mock db.query and db.insert/delete
│   ├── auth.ts              # Mock requireAuth, getUserFromSession
│   └── factories.ts         # Test data factories
└── helpers/
    └── api.ts               # Mock NextRequest helper
```

### Mock Request Helper

```typescript
// src/test/helpers/api.ts
createMockRequest({
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body?: object,
  headers?: Record<string, string>
}) → NextRequest
```

### Test Data Factories

```typescript
// src/test/mocks/factories.ts
createMockUser({ id?, email?, name?, position? }) → User
createMockClient({ id?, name?, status? }) → Client
createMockTimeEntry({ id?, userId?, clientId?, date?, hours?, ... }) → TimeEntry
createMockSubtopic({ id?, name?, status?, topic? }) → Subtopic
```

### Auth Mock

```typescript
// src/test/mocks/auth.ts
mockAuthenticated(user: User)   // Sets up successful auth
mockUnauthenticated()           // Returns 401
mockUserNotFound()              // Auth passes, user lookup fails
```

### Database Mock

```typescript
// src/test/mocks/db.ts
mockDbQuery.timeEntries.findMany(entries: TimeEntry[])
mockDbQuery.users.findFirst(user: User | undefined)
mockDbInsert.timeEntries.returning(entry: TimeEntry)
mockDbDelete.timeEntries()
```

## Test Cases by Route

### `/api/timesheets` (GET, POST, DELETE)

#### GET /api/timesheets?date=YYYY-MM-DD

**Auth:**
- Returns 401 when not authenticated
- Returns 404 when user not in database

**Validation:**
- Returns 400 when date param missing
- Returns 400 when date format invalid

**Happy Path:**
- Returns user's entries for given date
- Returns entries with client details populated
- Serializes decimal hours to numbers

**Role-Based Behavior:**
- Regular user: returns entries array directly
- ADMIN/PARTNER: returns { entries, teamSummaries }

#### POST /api/timesheets

**Auth:**
- Returns 401 when not authenticated
- Returns 404 when user not in database

**Validation:**
- Returns 400 for invalid JSON body
- Returns 400 when date missing
- Returns 400 when date is invalid format
- Returns 400 when date is in future
- Returns 400 when clientId missing
- Returns 404 when client not found
- Returns 400 when client is inactive
- Returns 400 when subtopicId missing
- Returns 404 when subtopic not found
- Returns 400 when subtopic is inactive
- Returns 400 when topic is inactive
- Returns 400 when hours missing
- Returns 400 when hours out of range (0 or >12)

**Happy Path:**
- Creates entry with valid data
- Returns created entry with client populated
- Stores denormalized topic/subtopic names

#### DELETE /api/timesheets?id=xxx

**Auth:**
- Returns 401 when not authenticated
- Returns 404 when user not in database

**Validation:**
- Returns 400 when id param missing

**Authorization:**
- Returns 404 when entry not found
- Returns 403 when deleting another user's entry

**Happy Path:**
- Deletes entry and returns { success: true }

### `/api/timesheets/dates` (GET)

#### GET /api/timesheets/dates?year=2024&month=12

**Auth:**
- Returns 401 when not authenticated
- Returns 404 when user not in database

**Validation:**
- Returns 400 when year param missing
- Returns 400 when month param missing
- Returns 400 when year is not a number
- Returns 400 when month is not a number
- Returns 400 when month out of range (0, 13)

**Happy Path:**
- Returns array of date strings for month
- Returns empty array when no entries
- Only returns dates for current user

### `/api/timesheets/team/[userId]` (GET)

#### GET /api/timesheets/team/[userId]?date=YYYY-MM-DD

**Auth:**
- Returns 401 when not authenticated
- Returns 404 when user not in database

**Authorization:**
- Returns 403 when user is ASSOCIATE
- Returns 403 when user is SENIOR_ASSOCIATE
- Allows ADMIN to view team entries
- Allows PARTNER to view team entries

**Validation:**
- Returns 400 when date param missing
- Returns 400 when date format invalid

**Happy Path:**
- Returns entries for specified team member
- Returns entries with client details
- Returns empty array when no entries

## Implementation Order

### Phase 1: Test Infrastructure

1. `src/test/mocks/db.ts`
2. `src/test/mocks/auth.ts`
3. `src/test/mocks/factories.ts`
4. `src/test/helpers/api.ts`

### Phase 2: Timesheets Tests (Template)

1. `src/app/api/timesheets/route.test.ts` (~25 tests)
2. `src/app/api/timesheets/dates/route.test.ts` (~10 tests)
3. `src/app/api/timesheets/team/[userId]/route.test.ts` (~8 tests)

### Phase 3: Remaining API Routes

| Route | Unique Considerations | Est. Tests |
|-------|----------------------|------------|
| clients/ | Admin-only write, status transitions | ~20 |
| employees/ | Admin-only, self-view allowed | ~15 |
| topics/ | Nested subtopic creation | ~18 |
| subtopics/ | Parent topic validation | ~12 |
| billing/ | PDF generation | ~10 |
| reports/ | Complex aggregation, date ranges | ~15 |

**Total estimated: ~130 tests**

## Example Test

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createMockRequest } from '@/test/helpers/api';
import { createMockUser, createMockTimeEntry } from '@/test/mocks/factories';
import { mockAuthenticated, mockDbQuery } from '@/test/mocks';

describe('GET /api/timesheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns entries for given date', async () => {
    const user = createMockUser({ position: 'ASSOCIATE' });
    const entries = [createMockTimeEntry({ userId: user.id })];

    mockAuthenticated(user);
    mockDbQuery.timeEntries.findMany(entries);

    const request = createMockRequest({
      method: 'GET',
      url: '/api/timesheets?date=2024-12-20'
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    mockUnauthenticated();

    const request = createMockRequest({
      method: 'GET',
      url: '/api/timesheets?date=2024-12-20'
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
```

## Future Phases (Not in Current Scope)

### Phase 4: Expand Utility Coverage
- `auth-utils.ts`
- `user.ts`

### Phase 5: Critical Component Tests
- `EntryForm`
- Form validation in modals
- `TopicCascadeSelect`

### Phase 6: E2E with Playwright
- Login → Dashboard
- Create timesheet entry → Verify
- Generate billing PDF
