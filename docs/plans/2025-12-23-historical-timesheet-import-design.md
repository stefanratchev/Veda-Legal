# Historical Timesheet Import Design

One-time import of ~9,700 historical time entries from CSV into the Veda Legal Timesheets database.

## Source Data

- **File:** `all_timesheets.csv`
- **Entries:** ~9,707
- **Date range:** January 2023 - December 2025
- **Columns:** Date, Client, Service description, Lawyer, Hours

## Decisions

| Aspect | Decision |
|--------|----------|
| Client matching | Use `client_mapping.csv` reviewed by user |
| User matching | Match by email, create if missing |
| New user status | INACTIVE |
| Topic/Subtopic | Leave blank (empty strings) |
| Import order | Dev first, then prod |
| Rollback strategy | Transaction-based (all or nothing) |

## Data Transformation

### Date Parsing
- CSV format: `M/D/YY` (e.g., "12/23/25")
- Output: PostgreSQL DATE

### Hours Parsing
- CSV format: `H:MM` (e.g., "1:30" = 1.5 hours)
- Output: Decimal(4,2)
- Formula: `hours + (minutes / 60)`, rounded to 2 decimals

### Client Resolution
1. Exact match in database → use directly
2. Lookup in `client_mapping.csv`:
   - `action=MAP` → find client by `db_name`
   - `action=CREATE` → create new client
   - `action=SKIP` → skip entry, log it
3. Not found → skip entry, log it

### User Resolution
1. Lookup by email (case-insensitive)
2. If exists → use existing user ID
3. If missing → create with:
   - `name`: derived from email (e.g., "yulita.yankova" → "Yulita Yankova")
   - `role`: EMPLOYEE
   - `status`: INACTIVE

## Validation & Error Handling

### Pre-flight Checks
- Mapping file exists and is valid CSV
- All `MAP` entries have valid `db_name` in database
- All emails are valid `@veda.legal` addresses
- Report entries that will be skipped

### During Import
- Any error → entire transaction rolls back
- Skip duplicates (same date, user, client, description, hours)

### Post-import Report
```
=== IMPORT COMPLETE ===
Users created:     X (all INACTIVE)
Clients created:   X
Entries imported:  X
Entries skipped:   X (no client mapping)
```

## Script

**Location:** `app/scripts/import-historical-timesheets.ts`

**Usage:**
```bash
# Dry-run (preview only)
npx tsx scripts/import-historical-timesheets.ts --dry-run

# Actual import (dev - uses DATABASE_URL from .env)
npx tsx scripts/import-historical-timesheets.ts

# Actual import (prod)
DATABASE_URL="postgresql://vedalegaladmin:***@veda-legal-db.postgres.database.azure.com:5432/vedalegal?sslmode=require" npx tsx scripts/import-historical-timesheets.ts
```

## Workflow

1. User reviews and completes `client_mapping.csv`
2. Create import script
3. Run dry-run on dev
4. Run actual import on dev, verify in app
5. Run dry-run on prod
6. Run actual import on prod
7. Delete script (one-time use)

## Files

- `all_timesheets.csv` - source data (do not commit)
- `client_mapping.csv` - client name mapping (do not commit)
- `app/scripts/import-historical-timesheets.ts` - import script (delete after use)
