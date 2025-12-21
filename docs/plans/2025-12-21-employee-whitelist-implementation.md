# Employee Whitelist System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace auto-create on login with a controlled whitelist where only pre-authorized employees can access the system.

**Architecture:** Add `UserStatus` enum (PENDING/ACTIVE/INACTIVE) to User model. Modify auth.ts to check whitelist instead of upsert. Extend employees API with POST (create) and DELETE (deactivate). Update UI with status badges, create modal, and deactivate actions.

**Tech Stack:** Prisma 7, NextAuth.js, Next.js 16 App Router, TypeScript, Tailwind CSS v4

---

## Task 1: Add UserStatus Enum to Schema

**Files:**
- Modify: `app/prisma/schema.prisma`

**Step 1: Add UserStatus enum and status field**

Open `app/prisma/schema.prisma` and add the enum after `UserRole`:

```prisma
enum UserStatus {
  PENDING
  ACTIVE
  INACTIVE
}
```

Then add the status field to the User model (after `role`):

```prisma
  status        UserStatus @default(PENDING)
```

**Step 2: Generate Prisma client**

Run: `cd app && npm run db:generate`
Expected: "Generated Prisma Client"

**Step 3: Commit**

```bash
git add app/prisma/schema.prisma
git commit -m "feat(schema): add UserStatus enum for whitelist system"
```

---

## Task 2: Create Migration with Existing Users as ACTIVE

**Files:**
- Create: `app/prisma/migrations/YYYYMMDD_add_user_status/migration.sql`

**Step 1: Create and run migration**

Run:
```bash
cd app && npx prisma migrate dev --name add_user_status
```

Expected: Migration created and applied successfully.

**Important:** Prisma will add the column with default PENDING, but existing users have already logged in. We need to fix this.

**Step 2: Update existing users to ACTIVE**

Run in terminal:
```bash
cd app && npx prisma db execute --stdin <<EOF
UPDATE "users" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING';
EOF
```

Expected: UPDATE command completed.

**Step 3: Verify migration**

Run: `cd app && npx prisma studio`
Check: All existing users should have status = ACTIVE

**Step 4: Commit**

```bash
git add app/prisma/migrations
git commit -m "feat(db): add user_status migration, set existing users to ACTIVE"
```

---

## Task 3: Update Auth to Check Whitelist

**Files:**
- Modify: `app/src/lib/auth.ts`

**Step 1: Rewrite signIn callback**

Replace the current signIn callback (lines 19-45) with whitelist logic:

```typescript
async signIn({ user, profile }) {
  const azureProfile = profile as { email?: string; preferred_username?: string; name?: string } | undefined;
  const email = user.email || azureProfile?.email || azureProfile?.preferred_username;

  if (!email) {
    return false;
  }

  try {
    // Check if user exists in whitelist
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    // Not in whitelist - block login
    if (!existingUser) {
      return "/login?error=NotAuthorized";
    }

    // Deactivated - block login
    if (existingUser.status === "INACTIVE") {
      return "/login?error=AccountDeactivated";
    }

    // PENDING or ACTIVE - allow login, update info from Azure AD
    await db.user.update({
      where: { id: existingUser.id },
      data: {
        status: "ACTIVE",
        name: user.name || azureProfile?.name,
        image: user.image,
        lastLogin: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.error("Error during sign in check:", error);
    return false;
  }
},
```

**Step 2: Verify the change compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/src/lib/auth.ts
git commit -m "feat(auth): replace auto-create with whitelist check"
```

---

## Task 4: Update Login Page for Error Messages

**Files:**
- Modify: `app/src/app/login/page.tsx`

**Step 1: Read current login page**

Read the file to understand its structure.

**Step 2: Add error message handling**

Add error parameter handling to display appropriate messages:
- `NotAuthorized`: "Your account is not authorized to access this application. Please contact your administrator."
- `AccountDeactivated`: "Your account has been deactivated. Please contact your administrator."

The page should check `searchParams.error` and display the message.

**Step 3: Commit**

```bash
git add app/src/app/login/page.tsx
git commit -m "feat(login): add whitelist error messages"
```

---

## Task 5: Update Employees API - GET with Status Filter

**Files:**
- Modify: `app/src/app/api/employees/route.ts`

**Step 1: Import UserStatus**

Add to imports:
```typescript
import { Prisma, UserRole, UserStatus } from "@prisma/client";
```

**Step 2: Add status to EMPLOYEE_SELECT**

```typescript
const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  lastLogin: true,
} as const;
```

**Step 3: Update GET to filter by status**

```typescript
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const employees = await db.user.findMany({
      where: includeInactive
        ? undefined
        : { status: { in: ["PENDING", "ACTIVE"] } },
      select: EMPLOYEE_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse(employees.map(serializeEmployee));
  } catch (error) {
    console.error("Database error fetching employees:", error);
    return errorResponse("Failed to fetch employees", 500);
  }
}
```

**Step 4: Verify compilation**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/src/app/api/employees/route.ts
git commit -m "feat(api): add status field and filter to GET /api/employees"
```

---

## Task 6: Add POST Endpoint for Creating Employees

**Files:**
- Modify: `app/src/app/api/employees/route.ts`

**Step 1: Add email validation helper**

Add after the imports:
```typescript
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

**Step 2: Add POST handler**

```typescript
// POST /api/employees - Create new employee
// Only ADMIN can create
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { email, name, role } = body;

  // Validate email
  if (!email || typeof email !== "string") {
    return errorResponse("Email is required", 400);
  }
  if (!isValidEmail(email.trim())) {
    return errorResponse("Invalid email format", 400);
  }

  // Validate role
  if (!role || !VALID_ROLES.includes(role)) {
    return errorResponse("Valid role is required (ADMIN or EMPLOYEE)", 400);
  }

  // Validate name if provided
  if (name !== undefined && name !== null) {
    if (typeof name !== "string") {
      return errorResponse("Name must be a string", 400);
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return errorResponse(`Name cannot exceed ${MAX_NAME_LENGTH} characters`, 400);
    }
  }

  try {
    // Check for existing user
    const existing = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return errorResponse("An employee with this email already exists", 409);
    }

    const employee = await db.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        role,
        status: "PENDING",
      },
      select: EMPLOYEE_SELECT,
    });

    return NextResponse.json(serializeEmployee(employee), { status: 201 });
  } catch (error) {
    console.error("Database error creating employee:", error);
    return errorResponse("Failed to create employee", 500);
  }
}
```

**Step 3: Verify compilation**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/src/app/api/employees/route.ts
git commit -m "feat(api): add POST /api/employees for creating employees"
```

---

## Task 7: Add DELETE Endpoint for Deactivating Employees

**Files:**
- Modify: `app/src/app/api/employees/route.ts`

**Step 1: Add DELETE handler**

```typescript
// DELETE /api/employees - Deactivate employee (soft delete)
// Only ADMIN can deactivate
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { id } = body;

  if (!id || typeof id !== "string") {
    return errorResponse("Employee ID is required", 400);
  }

  // Prevent self-deactivation
  if (id === auth.user.id) {
    return errorResponse("You cannot deactivate yourself", 400);
  }

  try {
    const employee = await db.user.update({
      where: { id },
      data: { status: "INACTIVE" },
      select: EMPLOYEE_SELECT,
    });

    return successResponse(serializeEmployee(employee));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return errorResponse("Employee not found", 404);
    }
    console.error("Database error deactivating employee:", error);
    return errorResponse("Failed to deactivate employee", 500);
  }
}
```

**Step 2: Verify compilation**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/src/app/api/employees/route.ts
git commit -m "feat(api): add DELETE /api/employees for deactivation"
```

---

## Task 8: Update PATCH to Allow Status Changes

**Files:**
- Modify: `app/src/app/api/employees/route.ts`

**Step 1: Add VALID_STATUSES constant**

After VALID_ROLES:
```typescript
const VALID_STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE"];
```

**Step 2: Update PATCH handler to accept status**

Update the PATCH function to include status validation and update:

After role validation, add:
```typescript
if (status !== undefined && !VALID_STATUSES.includes(status)) {
  return errorResponse("Invalid status value", 400);
}
```

Update the updateData building:
```typescript
if (status !== undefined) updateData.status = status;
```

**Step 3: Verify compilation**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/src/app/api/employees/route.ts
git commit -m "feat(api): allow status updates in PATCH /api/employees"
```

---

## Task 9: Update Employee Type with Status

**Files:**
- Modify: `app/src/components/employees/EmployeesContent.tsx`

**Step 1: Import UserStatus**

Add to imports:
```typescript
import { UserRole, UserStatus } from "@prisma/client";
```

**Step 2: Update Employee interface**

Add status field:
```typescript
interface Employee {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin: string | null;
}
```

**Step 3: Commit**

```bash
git add app/src/components/employees/EmployeesContent.tsx
git commit -m "feat(types): add status to Employee interface"
```

---

## Task 10: Add Status Styles and Status Column

**Files:**
- Modify: `app/src/components/employees/EmployeesContent.tsx`

**Step 1: Add statusStyles constant**

After roleStyles:
```typescript
const statusStyles: Record<
  UserStatus,
  { bgColor: string; textColor: string; label: string }
> = {
  PENDING: {
    bgColor: "rgba(234, 179, 8, 0.15)",
    textColor: "#eab308",
    label: "Invited",
  },
  ACTIVE: {
    bgColor: "rgba(34, 197, 94, 0.15)",
    textColor: "#22c55e",
    label: "Active",
  },
  INACTIVE: {
    bgColor: "rgba(107, 114, 128, 0.15)",
    textColor: "#6b7280",
    label: "Deactivated",
  },
};
```

**Step 2: Add Status column to baseColumns**

After the role column, add:
```typescript
{
  id: "status",
  header: "Status",
  accessor: (employee) => employee.status,
  cell: (employee) => {
    const style = statusStyles[employee.status];
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
        style={{ backgroundColor: style.bgColor, color: style.textColor }}
      >
        {style.label}
      </span>
    );
  },
},
```

**Step 3: Update Last Login column to show "Never" for PENDING**

Already handled - `formatRelativeTime` returns "Never" for null lastLogin.

**Step 4: Commit**

```bash
git add app/src/components/employees/EmployeesContent.tsx
git commit -m "feat(ui): add status column with badges"
```

---

## Task 11: Add Status Filter Dropdown

**Files:**
- Modify: `app/src/components/employees/EmployeesContent.tsx`

**Step 1: Update filter state type**

Change:
```typescript
const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
```

To:
```typescript
const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
const [statusFilter, setStatusFilter] = useState<"ALL_ACTIVE" | "PENDING" | "INCLUDE_INACTIVE">("ALL_ACTIVE");
```

**Step 2: Update filteredEmployees logic**

```typescript
const filteredEmployees = useMemo(() => {
  return employees.filter((employee) => {
    // Status filter
    if (statusFilter === "ALL_ACTIVE" && employee.status === "INACTIVE") {
      return false;
    }
    if (statusFilter === "PENDING" && employee.status !== "PENDING") {
      return false;
    }
    // Role filter
    if (roleFilter !== "ALL" && employee.role !== roleFilter) {
      return false;
    }
    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = employee.name?.toLowerCase().includes(query) ?? false;
      const matchesEmail = employee.email.toLowerCase().includes(query);
      return matchesName || matchesEmail;
    }
    return true;
  });
}, [employees, searchQuery, roleFilter, statusFilter]);
```

**Step 3: Add status filter dropdown**

This requires modifying the TableFilters component or adding a second filter. For simplicity, add a second dropdown after TableFilters:

```tsx
{/* Status Filter */}
<div className="flex items-center gap-2">
  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
    className="px-3 py-1.5 rounded text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
  >
    <option value="ALL_ACTIVE">All Active</option>
    <option value="PENDING">Pending Only</option>
    <option value="INCLUDE_INACTIVE">Include Deactivated</option>
  </select>
</div>
```

**Step 4: Commit**

```bash
git add app/src/components/employees/EmployeesContent.tsx
git commit -m "feat(ui): add status filter dropdown"
```

---

## Task 12: Update EmployeeModal for Create Mode

**Files:**
- Modify: `app/src/components/employees/EmployeeModal.tsx`

**Step 1: Update interface for create mode**

```typescript
interface FormData {
  email: string;
  name: string;
  role: UserRole;
}

interface EmployeeModalProps {
  mode: "create" | "edit";
  formData: FormData;
  selectedEmployeeName?: string;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
  onClose: () => void;
}
```

**Step 2: Update component to handle both modes**

- Show email field in create mode (required, editable)
- Hide email field in edit mode
- Change title: "Add Employee" for create, "Edit Employee" for edit
- Change button text: "Add Employee" for create, "Save Changes" for edit

**Step 3: Add email field (shown only in create mode)**

```tsx
{mode === "create" && (
  <div>
    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
      Email <span className="text-[var(--danger)]">*</span>
    </label>
    <input
      type="email"
      value={formData.email}
      onChange={(e) => onFormChange({ email: e.target.value })}
      className="w-full px-3 py-2 rounded text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)] focus:outline-none transition-all duration-200"
      placeholder="employee@company.com"
      autoFocus
    />
  </div>
)}
```

**Step 4: Update canSubmit logic**

```typescript
const canSubmit = mode === "create"
  ? formData.email.trim().length > 0 && formData.role
  : formData.name.trim().length > 0;
```

**Step 5: Commit**

```bash
git add app/src/components/employees/EmployeeModal.tsx
git commit -m "feat(ui): update EmployeeModal for create mode"
```

---

## Task 13: Add "Add Employee" Button and Create Handler

**Files:**
- Modify: `app/src/components/employees/EmployeesContent.tsx`

**Step 1: Update ModalMode type**

```typescript
type ModalMode = "create" | "edit" | null;
```

**Step 2: Update FormData interface**

```typescript
interface FormData {
  email: string;
  name: string;
  role: UserRole;
}
```

**Step 3: Update initial formData state**

```typescript
const [formData, setFormData] = useState<FormData>({
  email: "",
  name: "",
  role: "EMPLOYEE",
});
```

**Step 4: Add openCreateModal handler**

```typescript
const openCreateModal = useCallback(() => {
  setFormData({
    email: "",
    name: "",
    role: "EMPLOYEE",
  });
  setSelectedEmployee(null);
  setError(null);
  setModalMode("create");
}, []);
```

**Step 5: Add handleCreate handler**

```typescript
const handleCreate = useCallback(async () => {
  setIsLoading(true);
  setError(null);

  try {
    const response = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.email,
        name: formData.name || undefined,
        role: formData.role,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Failed to create employee");
      return;
    }

    setEmployees((prev) => [data, ...prev]);
    closeModal();
  } catch {
    setError("Failed to create employee");
  } finally {
    setIsLoading(false);
  }
}, [formData, closeModal]);
```

**Step 6: Add "Add Employee" button in header**

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
      Employees
    </h1>
    <p className="text-[var(--text-muted)] text-[13px] mt-0.5">
      {readOnly
        ? "View team members and their roles"
        : "Manage your team members and their permissions"}
    </p>
  </div>
  {!readOnly && (
    <button
      onClick={openCreateModal}
      className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--accent-pink)] text-[var(--bg-deep)] text-[13px] font-medium hover:bg-[var(--accent-pink-dim)] transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Employee
    </button>
  )}
</div>
```

**Step 7: Update modal rendering**

```tsx
{!readOnly && modalMode && (
  <EmployeeModal
    mode={modalMode}
    formData={formData}
    selectedEmployeeName={selectedEmployee?.name || selectedEmployee?.email}
    isLoading={isLoading}
    error={error}
    onFormChange={handleFormChange}
    onSubmit={modalMode === "create" ? handleCreate : handleUpdate}
    onClose={closeModal}
  />
)}
```

**Step 8: Commit**

```bash
git add app/src/components/employees/EmployeesContent.tsx
git commit -m "feat(ui): add 'Add Employee' button and create flow"
```

---

## Task 14: Add Deactivate/Reactivate Actions

**Files:**
- Modify: `app/src/components/employees/EmployeesContent.tsx`

**Step 1: Add currentUserId prop**

Update EmployeesContentProps:
```typescript
interface EmployeesContentProps {
  initialEmployees: Employee[];
  currentUserId: string;
  readOnly?: boolean;
}
```

**Step 2: Add deactivate and reactivate handlers**

```typescript
const handleDeactivate = useCallback(async (employee: Employee) => {
  if (!confirm(`Deactivate ${employee.name || employee.email}? They will no longer be able to log in.`)) {
    return;
  }

  try {
    const response = await fetch("/api/employees", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employee.id }),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.error || "Failed to deactivate employee");
      return;
    }

    const updated = await response.json();
    setEmployees((prev) =>
      prev.map((e) => (e.id === employee.id ? updated : e))
    );
  } catch {
    alert("Failed to deactivate employee");
  }
}, []);

const handleReactivate = useCallback(async (employee: Employee) => {
  try {
    const response = await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: employee.id, status: "ACTIVE" }),
    });

    if (!response.ok) {
      const data = await response.json();
      alert(data.error || "Failed to reactivate employee");
      return;
    }

    const updated = await response.json();
    setEmployees((prev) =>
      prev.map((e) => (e.id === employee.id ? updated : e))
    );
  } catch {
    alert("Failed to reactivate employee");
  }
}, []);
```

**Step 3: Update actions column**

```tsx
cell: (employee) => {
  const isSelf = employee.id === currentUserId;
  const isInactive = employee.status === "INACTIVE";

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => openEditModal(employee)}
        className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        title="Edit employee"
      >
        {/* Edit icon */}
      </button>
      {isInactive ? (
        <button
          onClick={() => handleReactivate(employee)}
          className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-green-500 hover:bg-[var(--bg-surface)] transition-colors"
          title="Reactivate employee"
        >
          {/* Reactivate icon - checkmark or similar */}
        </button>
      ) : (
        <button
          onClick={() => handleDeactivate(employee)}
          disabled={isSelf}
          className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={isSelf ? "You cannot deactivate yourself" : "Deactivate employee"}
        >
          {/* Deactivate icon - X or ban */}
        </button>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add app/src/components/employees/EmployeesContent.tsx
git commit -m "feat(ui): add deactivate/reactivate actions"
```

---

## Task 15: Update Employees Page to Pass currentUserId

**Files:**
- Modify: `app/src/app/(authenticated)/employees/page.tsx`

**Step 1: Update to pass currentUserId and status**

```typescript
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { EmployeesContent } from "@/components/employees/EmployeesContent";

export default async function EmployeesPage() {
  const user = await getCurrentUser();

  const employees = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLogin: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedEmployees = employees.map((employee) => ({
    ...employee,
    createdAt: employee.createdAt.toISOString(),
    lastLogin: employee.lastLogin?.toISOString() ?? null,
  }));

  return (
    <EmployeesContent
      initialEmployees={serializedEmployees}
      currentUserId={user.id}
      readOnly={user.role !== "ADMIN"}
    />
  );
}
```

**Step 2: Commit**

```bash
git add app/src/app/\(authenticated\)/employees/page.tsx
git commit -m "feat(page): pass currentUserId and status to EmployeesContent"
```

---

## Task 16: Verify Build and Tests

**Step 1: Run TypeScript check**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `cd app && npm run lint`
Expected: No errors (or only warnings)

**Step 3: Run build**

Run: `cd app && npm run build`
Expected: Build succeeds

**Step 4: Run tests**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 5: Manual testing checklist**

1. Start dev server: `npm run dev`
2. Log in as ADMIN
3. Verify employee list shows status column
4. Click "Add Employee" - create new employee
5. Verify new employee appears with "Invited" badge
6. Click deactivate on another employee
7. Toggle "Include Deactivated" filter - verify deactivated employee appears
8. Click reactivate on deactivated employee
9. Log out and try logging in with an email NOT in the system - should be blocked

**Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add UserStatus enum | schema.prisma |
| 2 | Create migration | migrations/ |
| 3 | Update auth whitelist | auth.ts |
| 4 | Login error messages | login/page.tsx |
| 5 | GET with status filter | api/employees/route.ts |
| 6 | POST create endpoint | api/employees/route.ts |
| 7 | DELETE deactivate endpoint | api/employees/route.ts |
| 8 | PATCH status updates | api/employees/route.ts |
| 9 | Employee type with status | EmployeesContent.tsx |
| 10 | Status column + badges | EmployeesContent.tsx |
| 11 | Status filter dropdown | EmployeesContent.tsx |
| 12 | EmployeeModal create mode | EmployeeModal.tsx |
| 13 | Add Employee button | EmployeesContent.tsx |
| 14 | Deactivate/Reactivate actions | EmployeesContent.tsx |
| 15 | Page updates | employees/page.tsx |
| 16 | Build verification | - |
