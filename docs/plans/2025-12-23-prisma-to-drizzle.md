# Prisma to Drizzle Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Prisma ORM with Drizzle ORM to eliminate migration drift and client regeneration issues.

**Architecture:** Baseline migration approach - introspect existing database to generate Drizzle schema, swap out database client, migrate each file's queries from Prisma to Drizzle syntax. Zero data loss, zero downtime.

**Tech Stack:** Drizzle ORM, drizzle-kit, PostgreSQL, pg driver (already installed)

---

## Phase 1: Setup

### Task 1: Install Drizzle Dependencies

**Files:**
- Modify: `app/package.json`

**Step 1: Install drizzle packages**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npm install drizzle-orm drizzle-kit
```

Expected: Packages install successfully

**Step 2: Verify installation**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npx drizzle-kit --version
```

Expected: Version number displayed (0.30.x or similar)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add drizzle-orm and drizzle-kit dependencies"
```

---

### Task 2: Create Drizzle Configuration

**Files:**
- Create: `app/drizzle.config.ts`

**Step 1: Create drizzle config file**

Create `app/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 2: Commit**

```bash
git add drizzle.config.ts
git commit -m "chore: add drizzle-kit configuration"
```

---

### Task 3: Introspect Database and Generate Schema

**Files:**
- Create: `app/src/lib/schema.ts`

**Step 1: Run drizzle-kit introspect**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npx drizzle-kit introspect
```

Expected: Creates `drizzle/schema.ts` with tables matching your Prisma schema

**Step 2: Move schema to lib directory**

Run:
```bash
mv drizzle/schema.ts src/lib/schema.ts
```

**Step 3: Review and clean up generated schema**

Open `src/lib/schema.ts` and verify:
- All 10 tables present (users, clients, topics, subtopics, time_entries, service_descriptions, service_description_topics, service_description_line_items)
- All 6 enums present (Position, UserStatus, ClientStatus, TopicStatus, SubtopicStatus, PracticeArea, ServiceDescriptionStatus, PricingMode)
- Foreign keys correct

**Step 4: Commit**

```bash
git add src/lib/schema.ts drizzle/
git commit -m "feat: add drizzle schema from database introspection"
```

---

### Task 4: Add Relations to Schema

**Files:**
- Modify: `app/src/lib/schema.ts`

**Step 1: Add relation imports and definitions**

Add at the top of `src/lib/schema.ts` after existing imports:
```typescript
import { relations } from 'drizzle-orm';
```

Add at the bottom of the file:
```typescript
// Relations
export const usersRelations = relations(users, ({ many }) => ({
  timeEntries: many(timeEntries),
  finalizedServiceDescriptions: many(serviceDescriptions),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  timeEntries: many(timeEntries),
  serviceDescriptions: many(serviceDescriptions),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
  subtopics: many(subtopics),
}));

export const subtopicsRelations = relations(subtopics, ({ one, many }) => ({
  topic: one(topics, {
    fields: [subtopics.topicId],
    references: [topics.id],
  }),
  timeEntries: many(timeEntries),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [timeEntries.clientId],
    references: [clients.id],
  }),
  subtopic: one(subtopics, {
    fields: [timeEntries.subtopicId],
    references: [subtopics.id],
  }),
  billingLineItems: many(serviceDescriptionLineItems),
}));

export const serviceDescriptionsRelations = relations(serviceDescriptions, ({ one, many }) => ({
  client: one(clients, {
    fields: [serviceDescriptions.clientId],
    references: [clients.id],
  }),
  finalizedBy: one(users, {
    fields: [serviceDescriptions.finalizedById],
    references: [users.id],
  }),
  topics: many(serviceDescriptionTopics),
}));

export const serviceDescriptionTopicsRelations = relations(serviceDescriptionTopics, ({ one, many }) => ({
  serviceDescription: one(serviceDescriptions, {
    fields: [serviceDescriptionTopics.serviceDescriptionId],
    references: [serviceDescriptions.id],
  }),
  lineItems: many(serviceDescriptionLineItems),
}));

export const serviceDescriptionLineItemsRelations = relations(serviceDescriptionLineItems, ({ one }) => ({
  topic: one(serviceDescriptionTopics, {
    fields: [serviceDescriptionLineItems.topicId],
    references: [serviceDescriptionTopics.id],
  }),
  timeEntry: one(timeEntries, {
    fields: [serviceDescriptionLineItems.timeEntryId],
    references: [timeEntries.id],
  }),
}));
```

**Step 2: Commit**

```bash
git add src/lib/schema.ts
git commit -m "feat: add drizzle relation definitions"
```

---

### Task 5: Create Drizzle Database Client

**Files:**
- Create: `app/src/lib/drizzle.ts`

**Step 1: Create new drizzle client file**

Create `app/src/lib/drizzle.ts`:
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDrizzle = globalThis as unknown as {
  pool: Pool | undefined;
};

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

const pool = globalForDrizzle.pool ?? createPool();
globalForDrizzle.pool = pool;

export const db = drizzle(pool, { schema });
```

**Step 2: Commit**

```bash
git add src/lib/drizzle.ts
git commit -m "feat: add drizzle database client"
```

---

### Task 6: Create Baseline Migration

**Files:**
- Modify: `app/drizzle.config.ts`

**Step 1: Generate baseline migration**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npx drizzle-kit generate --name baseline
```

Expected: Creates migration file in `drizzle/` folder

**Step 2: Mark baseline as applied**

The baseline represents existing tables, so we mark it as already applied. Create/edit `drizzle/meta/_journal.json` to mark the migration as applied:

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && cat drizzle/meta/_journal.json
```

Note the migration entry, then verify the tables already exist (they do from Prisma).

**Step 3: Commit**

```bash
git add drizzle/
git commit -m "feat: add drizzle baseline migration"
```

---

### Task 7: Update Package Scripts

**Files:**
- Modify: `app/package.json`

**Step 1: Update scripts section**

In `package.json`, update the scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed-topics": "npx tsx prisma/seed-topics.ts"
  }
}
```

Remove the `postinstall` script entirely.

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: update npm scripts for drizzle"
```

---

## Phase 2: Core Infrastructure

### Task 8: Replace db.ts Export

**Files:**
- Modify: `app/src/lib/db.ts`

**Step 1: Replace db.ts contents**

Replace entire contents of `app/src/lib/db.ts` with:
```typescript
// Re-export drizzle client as db for compatibility
export { db } from './drizzle';
export * from './schema';
```

**Step 2: Run tests**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npm test -- --run
```

Expected: Tests pass (they don't use real DB)

**Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "refactor: switch db export to drizzle client"
```

---

### Task 9: Create Type Helpers

**Files:**
- Create: `app/src/lib/db-types.ts`

**Step 1: Create type helpers file**

Create `app/src/lib/db-types.ts`:
```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  users,
  clients,
  topics,
  subtopics,
  timeEntries,
  serviceDescriptions,
  serviceDescriptionTopics,
  serviceDescriptionLineItems,
} from './schema';

// Select types (for reading from DB)
export type User = InferSelectModel<typeof users>;
export type Client = InferSelectModel<typeof clients>;
export type Topic = InferSelectModel<typeof topics>;
export type Subtopic = InferSelectModel<typeof subtopics>;
export type TimeEntry = InferSelectModel<typeof timeEntries>;
export type ServiceDescription = InferSelectModel<typeof serviceDescriptions>;
export type ServiceDescriptionTopic = InferSelectModel<typeof serviceDescriptionTopics>;
export type ServiceDescriptionLineItem = InferSelectModel<typeof serviceDescriptionLineItems>;

// Insert types (for writing to DB)
export type NewUser = InferInsertModel<typeof users>;
export type NewClient = InferInsertModel<typeof clients>;
export type NewTopic = InferInsertModel<typeof topics>;
export type NewSubtopic = InferInsertModel<typeof subtopics>;
export type NewTimeEntry = InferInsertModel<typeof timeEntries>;
export type NewServiceDescription = InferInsertModel<typeof serviceDescriptions>;
export type NewServiceDescriptionTopic = InferInsertModel<typeof serviceDescriptionTopics>;
export type NewServiceDescriptionLineItem = InferInsertModel<typeof serviceDescriptionLineItems>;
```

**Step 2: Commit**

```bash
git add src/lib/db-types.ts
git commit -m "feat: add drizzle type helpers"
```

---

### Task 10: Update api-utils.ts

**Files:**
- Modify: `app/src/lib/api-utils.ts`

**Step 1: Update imports**

In `app/src/lib/api-utils.ts`, change Prisma imports to Drizzle:

Replace:
```typescript
import { Position } from "@prisma/client";
```

With:
```typescript
import type { User } from './db-types';
```

And update any type references from `Position` to use the string union type or import from schema.

**Step 2: Run tests**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npm test -- --run
```

Expected: Tests pass

**Step 3: Commit**

```bash
git add src/lib/api-utils.ts
git commit -m "refactor: update api-utils to use drizzle types"
```

---

### Task 11: Update auth.ts

**Files:**
- Modify: `app/src/lib/auth.ts`

**Step 1: Remove Prisma adapter, use direct queries**

Update `app/src/lib/auth.ts` to remove `@auth/prisma-adapter` and use direct Drizzle queries for user lookup/creation.

Replace Prisma adapter with custom callbacks that query users table directly:
```typescript
import { db } from './drizzle';
import { users } from './schema';
import { eq } from 'drizzle-orm';

// In NextAuth config, replace adapter with callbacks:
callbacks: {
  async signIn({ user, account }) {
    if (!user.email) return false;

    // Find or create user
    const existing = await db.query.users.findFirst({
      where: eq(users.email, user.email),
    });

    if (!existing) {
      await db.insert(users).values({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      });
    } else {
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, existing.id));
    }

    return true;
  },
  // ... rest of callbacks
}
```

**Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "refactor: replace prisma adapter with direct drizzle queries"
```

---

## Phase 3: API Routes

### Task 12: Migrate clients API route

**Files:**
- Modify: `app/src/app/api/clients/route.ts`

**Step 1: Update imports and queries**

Replace Prisma queries with Drizzle. Example pattern:

```typescript
import { db } from '@/lib/db';
import { clients } from '@/lib/schema';
import { eq, desc, asc } from 'drizzle-orm';

// GET - find all
const allClients = await db.query.clients.findMany({
  orderBy: [asc(clients.name)],
});

// POST - create
const [newClient] = await db.insert(clients).values({
  name: data.name,
  email: data.email,
  // ...
}).returning();
```

**Step 2: Test manually**

Run dev server and test client list loads.

**Step 3: Commit**

```bash
git add src/app/api/clients/route.ts
git commit -m "refactor: migrate clients API to drizzle"
```

---

### Task 13: Migrate employees API route

**Files:**
- Modify: `app/src/app/api/employees/route.ts`

**Step 1: Update imports and queries**

Same pattern as Task 12, using `users` table:
```typescript
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';

// GET
const employees = await db.query.users.findMany({
  orderBy: [asc(users.name)],
});

// PATCH
await db.update(users)
  .set({ position: data.position, status: data.status })
  .where(eq(users.id, id));
```

**Step 2: Commit**

```bash
git add src/app/api/employees/route.ts
git commit -m "refactor: migrate employees API to drizzle"
```

---

### Task 14: Migrate timesheets API route

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Update imports and queries**

```typescript
import { db } from '@/lib/db';
import { timeEntries, clients, subtopics } from '@/lib/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// GET with relations
const entries = await db.query.timeEntries.findMany({
  where: and(
    eq(timeEntries.userId, userId),
    gte(timeEntries.date, startDate),
    lte(timeEntries.date, endDate),
  ),
  with: {
    client: true,
    subtopic: true,
  },
});

// POST
const [entry] = await db.insert(timeEntries).values({
  userId,
  clientId,
  date: new Date(data.date),
  hours: data.hours,
  description: data.description,
  subtopicId: data.subtopicId,
  topicName: data.topicName,
  subtopicName: data.subtopicName,
}).returning();

// DELETE
await db.delete(timeEntries).where(eq(timeEntries.id, id));
```

**Step 2: Commit**

```bash
git add src/app/api/timesheets/route.ts
git commit -m "refactor: migrate timesheets API to drizzle"
```

---

### Task 15: Migrate timesheets/dates API route

**Files:**
- Modify: `app/src/app/api/timesheets/dates/route.ts`

**Step 1: Update queries**

Same pattern as Task 14.

**Step 2: Commit**

```bash
git add src/app/api/timesheets/dates/route.ts
git commit -m "refactor: migrate timesheets dates API to drizzle"
```

---

### Task 16: Migrate topics API routes

**Files:**
- Modify: `app/src/app/api/topics/route.ts`
- Modify: `app/src/app/api/topics/[id]/route.ts`
- Modify: `app/src/app/api/topics/[id]/subtopics/route.ts`
- Modify: `app/src/app/api/topics/reorder/route.ts`

**Step 1: Update all topic routes**

Pattern:
```typescript
import { db } from '@/lib/db';
import { topics, subtopics } from '@/lib/schema';
import { eq, asc } from 'drizzle-orm';

// GET with subtopics
const allTopics = await db.query.topics.findMany({
  with: { subtopics: true },
  orderBy: [asc(topics.displayOrder)],
});

// Reorder
await db.update(topics)
  .set({ displayOrder: newOrder })
  .where(eq(topics.id, id));
```

**Step 2: Commit**

```bash
git add src/app/api/topics/
git commit -m "refactor: migrate topics API routes to drizzle"
```

---

### Task 17: Migrate subtopics API routes

**Files:**
- Modify: `app/src/app/api/subtopics/[id]/route.ts`
- Modify: `app/src/app/api/subtopics/reorder/route.ts`

**Step 1: Update subtopic routes**

Same patterns as previous tasks.

**Step 2: Commit**

```bash
git add src/app/api/subtopics/
git commit -m "refactor: migrate subtopics API routes to drizzle"
```

---

### Task 18: Migrate reports API route

**Files:**
- Modify: `app/src/app/api/reports/route.ts`

**Step 1: Update aggregation queries**

Drizzle supports SQL aggregations:
```typescript
import { db } from '@/lib/db';
import { timeEntries, clients } from '@/lib/schema';
import { eq, and, gte, lte, sql, sum } from 'drizzle-orm';

// Aggregation example
const totals = await db
  .select({
    clientId: timeEntries.clientId,
    totalHours: sum(timeEntries.hours),
  })
  .from(timeEntries)
  .where(and(
    gte(timeEntries.date, startDate),
    lte(timeEntries.date, endDate),
  ))
  .groupBy(timeEntries.clientId);
```

**Step 2: Commit**

```bash
git add src/app/api/reports/route.ts
git commit -m "refactor: migrate reports API to drizzle"
```

---

### Task 19: Migrate billing API routes

**Files:**
- Modify: `app/src/app/api/billing/route.ts`
- Modify: `app/src/app/api/billing/[id]/route.ts`
- Modify: `app/src/app/api/billing/[id]/pdf/route.tsx`
- Modify: `app/src/app/api/billing/[id]/topics/route.ts`
- Modify: `app/src/app/api/billing/[id]/topics/[topicId]/route.ts`
- Modify: `app/src/app/api/billing/[id]/topics/[topicId]/items/route.ts`
- Modify: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts`

**Step 1: Update billing routes one by one**

These are the most complex with nested relations. Pattern:
```typescript
import { db } from '@/lib/db';
import { serviceDescriptions, serviceDescriptionTopics, serviceDescriptionLineItems } from '@/lib/schema';

// GET with nested relations
const sd = await db.query.serviceDescriptions.findFirst({
  where: eq(serviceDescriptions.id, id),
  with: {
    client: true,
    topics: {
      with: {
        lineItems: true,
      },
    },
  },
});
```

**Step 2: Commit each file or batch**

```bash
git add src/app/api/billing/
git commit -m "refactor: migrate billing API routes to drizzle"
```

---

## Phase 4: Server Components

### Task 20: Migrate page server components

**Files:**
- Modify: `app/src/app/(authenticated)/clients/page.tsx`
- Modify: `app/src/app/(authenticated)/timesheets/page.tsx`
- Modify: `app/src/app/(authenticated)/team/page.tsx`
- Modify: `app/src/app/(authenticated)/reports/page.tsx`
- Modify: `app/src/app/(authenticated)/topics/page.tsx`
- Modify: `app/src/app/(authenticated)/billing/page.tsx`
- Modify: `app/src/app/(authenticated)/billing/[id]/page.tsx`

**Step 1: Update server component queries**

Same patterns as API routes. These use direct DB queries.

**Step 2: Commit**

```bash
git add src/app/\(authenticated\)/
git commit -m "refactor: migrate server components to drizzle"
```

---

### Task 21: Update client component type imports

**Files:**
- Modify: `app/src/components/clients/ClientsContent.tsx`
- Modify: `app/src/components/clients/ClientModal.tsx`
- Modify: `app/src/components/employees/EmployeesContent.tsx`
- Modify: `app/src/components/employees/EmployeeModal.tsx`

**Step 1: Update Prisma type imports**

Replace:
```typescript
import { Client, Position } from '@prisma/client';
```

With:
```typescript
import type { Client } from '@/lib/db-types';
// Or import the enum values from schema
```

**Step 2: Commit**

```bash
git add src/components/
git commit -m "refactor: update component type imports for drizzle"
```

---

## Phase 5: Cleanup

### Task 22: Update seed scripts

**Files:**
- Modify: `app/prisma/seed-topics.ts`
- Modify: `app/prisma/seed-admin.ts`
- Modify: `app/prisma/seed-clients.ts`

**Step 1: Update seed scripts to use Drizzle**

Move to `app/scripts/` and update:
```typescript
import { db } from '../src/lib/drizzle';
import { topics, subtopics } from '../src/lib/schema';

// Insert with drizzle
await db.insert(topics).values({ name: 'Topic Name' });
```

**Step 2: Update package.json script path**

**Step 3: Commit**

```bash
git add scripts/ package.json
git commit -m "refactor: migrate seed scripts to drizzle"
```

---

### Task 23: Remove Prisma dependencies

**Files:**
- Modify: `app/package.json`

**Step 1: Uninstall Prisma packages**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npm uninstall @auth/prisma-adapter @prisma/adapter-pg @prisma/client prisma
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove prisma dependencies"
```

---

### Task 24: Archive Prisma folder

**Files:**
- Delete: `app/prisma/` (keep in git history)

**Step 1: Remove prisma directory**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && rm -rf prisma/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove prisma directory (archived in git history)"
```

---

### Task 25: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update documentation**

Update tech stack, commands, and database sections to reference Drizzle instead of Prisma:

- Change "Prisma ORM v7" to "Drizzle ORM"
- Update db commands
- Update troubleshooting section
- Remove Prisma-specific notes

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for drizzle migration"
```

---

### Task 26: Full Application Test

**Step 1: Run all tests**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npm test -- --run
```

Expected: All tests pass

**Step 2: Run lint**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npm run lint
```

Expected: No errors

**Step 3: Run build**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/drizzle-migration/app && npm run build
```

Expected: Build succeeds

**Step 4: Manual testing**

Start dev server and verify:
- Login works
- Client list loads
- Timesheet entries work
- Billing pages load
- Reports work

---

### Task 27: Final Commit and PR Ready

**Step 1: Verify all changes committed**

Run:
```bash
git status
```

Expected: Clean working tree

**Step 2: Ready for PR**

Branch `feature/drizzle-migration` is ready to merge to main.
