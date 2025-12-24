# Run Database Migrations on Production

Run Drizzle migrations against the production database.

**IMPORTANT:** This will modify the production database schema. Only run this when you have schema changes that need to be applied.

## Steps

1. First, show what migrations exist in `app/drizzle/` folder
2. Ask for confirmation before running
3. Run the migration command using the PROD_DATABASE_URL environment variable:

```bash
cd app && DATABASE_URL="$PROD_DATABASE_URL" npx drizzle-kit migrate
```

4. Report the results

## Setup

The user needs to have `PROD_DATABASE_URL` set in their environment. Add to `~/.zshrc`:
```bash
export PROD_DATABASE_URL="postgresql://vedalegaladmin:***@veda-legal-db.postgres.database.azure.com:5432/vedalegal?sslmode=require"
```
