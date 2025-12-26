# Run Database Migrations on Production

Run Drizzle migrations against the production database.

**IMPORTANT:** This will modify the production database schema. Only run this when you have schema changes that need to be applied.

## Steps

1. First, show what migrations exist in `app/drizzle/` folder
2. Ask for confirmation before running
3. Run the migration command using credentials from `.env.prod`:

```bash
cd app && source .env.prod && npx drizzle-kit migrate
```

4. Report the results
