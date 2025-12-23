# Prisma to Drizzle Migration Design

## Overview

Replace Prisma ORM with Drizzle ORM to eliminate migration drift and client regeneration issues.

## Decisions

| Decision | Choice |
|----------|--------|
| Migration strategy | Migration files everywhere (dev and prod) |
| Transition approach | Baseline - introspect existing DB, no data changes |
| Schema organization | Single file (`src/lib/schema.ts`) |
| NextAuth | JWT sessions only, no adapter needed |

## File Structure

**New files:**
```
app/src/lib/
├── db.ts              (replace - Drizzle client)
├── schema.ts          (new - all table definitions)
app/drizzle/
├── migrations/        (new - migration SQL files)
├── meta/              (new - Drizzle metadata)
app/drizzle.config.ts  (new - Drizzle Kit config)
```

## Dependencies

**Remove:**
- `@auth/prisma-adapter`
- `@prisma/adapter-pg`
- `@prisma/client`
- `prisma`

**Add:**
- `drizzle-orm`
- `drizzle-kit`

**Keep:**
- `pg` (already installed)

## Package Scripts

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```

No `postinstall` needed - Drizzle doesn't require client generation.

## Schema Translation

### Enums
```typescript
export const positionEnum = pgEnum('Position', [
  'ADMIN', 'PARTNER', 'SENIOR_ASSOCIATE', 'ASSOCIATE', 'CONSULTANT'
]);
```

### Tables
```typescript
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name'),
  position: positionEnum('position').default('ASSOCIATE'),
  // ...
});
```

### Relations
```typescript
export const usersRelations = relations(users, ({ many }) => ({
  timeEntries: many(timeEntries),
}));
```

## Query Pattern Changes

| Operation | Prisma | Drizzle |
|-----------|--------|---------|
| Find one | `db.client.findUnique({ where: { id } })` | `db.query.clients.findFirst({ where: eq(clients.id, id) })` |
| Find many | `db.client.findMany({ include: { ... } })` | `db.query.clients.findMany({ with: { ... } })` |
| Create | `db.client.create({ data })` | `db.insert(clients).values(data)` |
| Update | `db.client.update({ where, data })` | `db.update(clients).set(data).where(...)` |
| Delete | `db.client.delete({ where })` | `db.delete(clients).where(...)` |

## Migration Strategy (Zero Data Loss)

1. **Introspect:** `drizzle-kit introspect` generates schema from existing DB
2. **Baseline:** Create migration representing current state, mark as applied
3. **Test on dev:** Verify all queries work, data intact
4. **Deploy:** No schema changes needed, just code swap
5. **Rollback plan:** Revert git commit, reinstall Prisma deps

## Files to Modify

**Total: ~35 files**

- Core infrastructure: 3 files (`lib/db.ts`, `lib/api-utils.ts`, `lib/auth.ts`)
- API routes: 17 files
- Server components: 6 files
- Client components: 2 files (type imports only)
- Config/docs: 4 files

## Implementation Order

### Phase 1: Setup
1. Install Drizzle dependencies
2. Run `drizzle-kit introspect`
3. Review generated schema
4. Configure `drizzle.config.ts`
5. Create baseline migration

### Phase 2: Core Swap
6. Replace `lib/db.ts`
7. Update `lib/auth.ts`
8. Update `lib/api-utils.ts`

### Phase 3: API Routes
9. Migrate routes one by one
10. Start with simpler routes (clients, employees)
11. Then timesheets, topics/subtopics
12. Finally billing routes

### Phase 4: Server Components
13. Update page components

### Phase 5: Cleanup
14. Remove Prisma dependencies
15. Delete `prisma/` folder
16. Update `CLAUDE.md`
17. Test full application
18. Deploy to production
