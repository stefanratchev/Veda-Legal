import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/schema";
import { createId } from "@paralleldrive/cuid2";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  const now = new Date().toISOString();
  const email = "stefan@veda.legal";

  // Check if user exists
  const existingUsers = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  let adminUser;

  if (existingUsers.length > 0) {
    // Update existing user
    const result = await db
      .update(schema.users)
      .set({
        position: "ADMIN",
        status: "ACTIVE",
        updatedAt: now,
      })
      .where(eq(schema.users.email, email))
      .returning();
    adminUser = result[0];
  } else {
    // Create new user
    const result = await db
      .insert(schema.users)
      .values({
        id: createId(),
        email: email,
        name: "Stefan Ratchev",
        position: "ADMIN",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    adminUser = result[0];
  }

  console.log("Admin user created/updated:", adminUser);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
