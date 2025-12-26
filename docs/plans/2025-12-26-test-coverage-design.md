# Test Coverage Design

## Goals

- **Confidence before refactoring** — Safety net for future changes anywhere in the codebase
- **Bug prevention** — Catch regressions early across all areas

## Strategy

- **Target:** ~80% coverage
- **Approach:** Unit tests (isolated, mocked) + Integration tests (API routes with mocked DB)
- **No E2E tests**
- **Database:** Mock at Drizzle layer for fast, infrastructure-free tests
- **Method:** Bottom-up — test dependencies first, then build up

## Current State

- 8 existing test files
- ~8% overall coverage
- 96 source files, 21 API routes, 42 components

## Testing Infrastructure

### Test Utilities (`src/test/utils.tsx`)

Extend the existing setup with:
- `renderWithProviders()` — Wraps components with necessary context (SidebarNav, etc.)
- `createMockSession()` — Returns a typed NextAuth session for auth tests
- `createMockUser()` — Factory for user objects with sensible defaults

### Drizzle Mocking (`src/test/mocks/db.ts`)

```typescript
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: { /* table mocks */ }
  }
}))
```

### Auth Mocking (`src/test/mocks/auth.ts`)

- `requireAuth()` — Return mock session or throw
- `requireWriteAccess()` — Control permission checks
- `getServerSession()` — NextAuth session mock

### Conventions

- Colocate tests with source files (`Component.tsx` → `Component.test.tsx`)
- Use descriptive test names: `"returns 401 when user is not authenticated"`
- Group with `describe()` blocks by method/behavior

## Phase 1: Lib Utilities

### Expand Existing Tests

| File | Current | Target |
|------|---------|--------|
| `date-utils.ts` | 88% | 95% |
| `api-utils.ts` | 43% | 90% |

Add edge cases: year boundaries, DST transitions, invalid inputs, all validation functions.

### New Tests

| File | What to Test |
|------|--------------|
| `auth-utils.ts` | `getUserFromSession()`, `requireRole()`, permission edge cases |
| `user.ts` | User lookup functions, handling of missing users |
| `billing-pdf.tsx` | PDF generation with mock data, formatting of hours/amounts |

### Skip

- `db.ts` — Just creates Drizzle client
- `drizzle.ts` — Configuration only
- `schema.ts` — Type definitions
- `db-types.ts` — Type exports
- `auth.ts` — NextAuth config, tested via integration

**Estimated:** 3 new test files, ~40 test cases

## Phase 2: API Routes

### Already Tested (verify coverage)

- `timesheets/route.ts`
- `timesheets/[id]/route.ts`
- `timesheets/dates/route.ts`
- `timesheets/team/[userId]/route.ts`
- `m365/activity/route.ts`

### New Tests Needed

| Route | Methods | Key Test Cases |
|-------|---------|----------------|
| `clients/route.ts` | GET, POST | List clients, create with validation, duplicate handling |
| `clients/[id]/route.ts` | GET, PATCH, DELETE | Fetch single, update fields, prevent delete with entries |
| `employees/route.ts` | GET, POST | List with role filter, create employee |
| `employees/[id]/route.ts` | GET, PATCH, DELETE | Update role, deactivate vs delete |
| `topics/route.ts` | GET, POST | List hierarchy, create topic |
| `topics/[id]/route.ts` | PATCH, DELETE | Update, cascade behavior |
| `subtopics/route.ts` | GET, POST | List by topic, create with isPrefix |
| `subtopics/[id]/route.ts` | PATCH, DELETE | Update, prevent delete if used |
| `reports/route.ts` | GET | Aggregation logic, date filtering, grouping |

### Test Pattern

```typescript
describe('GET /api/clients', () => {
  it('returns 401 when not authenticated')
  it('returns all clients for authenticated user')
  it('filters by search query when provided')
})

describe('POST /api/clients', () => {
  it('returns 401 when not authenticated')
  it('returns 403 when user lacks write access')
  it('returns 400 for invalid email format')
  it('creates client and returns 201')
})
```

**Estimated:** 10 new test files, ~120 test cases

## Phase 3: Hooks

### `useClickOutside.ts`

```typescript
describe('useClickOutside', () => {
  it('calls handler when clicking outside the referenced element')
  it('does not call handler when clicking inside the referenced element')
  it('does not call handler when ref is null')
  it('removes event listener on unmount')
})
```

**Estimated:** 1 test file, ~5 test cases

## Phase 4: UI Components

### High Priority — Interactive Components

| Component | Key Test Cases |
|-----------|----------------|
| `ui/ClientSelect.tsx` | Opens dropdown, filters clients, selects value, keyboard nav |
| `ui/TopicCascadeSelect.tsx` | Two-level selection, topic→subtopic flow, isPrefix handling |
| `ui/DurationPicker.tsx` | Hour/minute inputs, validation, formatting |
| `ui/DataTable.tsx` | Sorting, pagination, row selection, empty state |
| `ui/TableFilters.tsx` | Filter inputs, clear filters, apply filters |
| `ui/ConfirmModal.tsx` | Opens, confirms, cancels, handles async confirm |
| `timesheets/EntryForm.tsx` | Form submission, validation, edit mode vs create |
| `timesheets/WeekStrip.tsx` | Date navigation, day selection, current day highlight |
| `timesheets/EntriesList.tsx` | Renders entries, edit/delete actions, empty state |
| `clients/ClientModal.tsx` | Create/edit modes, validation, submit |
| `employees/EmployeeModal.tsx` | Create/edit modes, role selection |
| `topics/TopicModal.tsx` | Create/edit topic |
| `topics/SubtopicModal.tsx` | Create/edit subtopic, isPrefix toggle |
| `topics/TopicsContent.tsx` | Full CRUD flow, expand/collapse |

### Medium Priority — Display with Logic

| Component | Key Test Cases |
|-----------|----------------|
| `timesheets/EntryCard.tsx` | Renders entry data correctly |
| `timesheets/EntryRow.tsx` | Displays fields, action buttons |
| `timesheets/TeamMemberRow.tsx` | Shows member stats |
| `dashboard/*` | Summary cards render correct data |
| `reports/SummaryCard.tsx` | Formats numbers correctly |
| `reports/OverviewTab.tsx` | Renders with mock data |

### Low Priority — Mostly Presentational

| Component | Approach |
|-----------|----------|
| `layout/Sidebar.tsx` | Test navigation links render |
| `layout/Header.tsx` | Test user info displays |
| `reports/charts/*` | Snapshot tests or skip |

### Test Pattern

```typescript
describe('ClientSelect', () => {
  it('renders with placeholder when no value')
  it('opens dropdown on click')
  it('filters clients as user types')
  it('selects client and closes dropdown')
  it('calls onChange with selected client')
  it('handles keyboard navigation')
  it('shows empty state when no matches')
})
```

**Estimated:** ~25 new test files, ~200 test cases

## Implementation Order

1. **Infrastructure** — Mocks and utilities
2. **Lib Utilities** — Pure functions, easiest wins
3. **API Routes** — Business logic coverage
4. **Hooks** — Small isolated tests
5. **UI Components** — Interactive first, then display

## Summary

| Category | New Test Files | Estimated Test Cases |
|----------|----------------|---------------------|
| Infrastructure | 3 (utilities) | — |
| Lib Utilities | 3 | ~40 |
| API Routes | 10 | ~120 |
| Hooks | 1 | ~5 |
| UI Components | ~25 | ~200 |
| **Total** | **~42** | **~365** |

**Target Coverage:** 80%+
**Testing Stack:** Vitest + React Testing Library + vi.mock for Drizzle/Auth
