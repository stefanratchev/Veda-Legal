import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";

// Load environment variables
config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface CSVRow {
  "Timesheet Code": string;
  "Invoice Name": string;
  "Invoice Attn": string;
  "Hourly Rate": string;
  "Rate Currency": string;
  "New Houry Rate": string;
  Status: string;
  email: string;
}

function normalizeStatus(status: string): "ACTIVE" | "INACTIVE" {
  const lower = status.toLowerCase().trim();
  if (
    lower.includes("inactive") ||
    lower.includes("inacrtive") ||
    lower.includes("liquidation") ||
    lower === ""
  ) {
    return "INACTIVE";
  }
  return "ACTIVE";
}

function cleanEmail(email: string): string | null {
  if (!email || email === "n/a" || email.trim() === "") {
    return null;
  }
  // Take first email if multiple are present
  const firstEmail = email.split(/[\s,\n]+/)[0].trim();
  return firstEmail || null;
}

function cleanString(value: string): string | null {
  if (!value || value === "n/a" || value === "-" || value.trim() === "") {
    return null;
  }
  return value.trim();
}

function parseHourlyRate(rate: string): number | null {
  const parsed = parseFloat(rate);
  return isNaN(parsed) || parsed === 0 ? null : parsed;
}

async function main() {
  const csvPath = "../vedalegal_db.csv";
  const csvContent = readFileSync(csvPath, "utf-8");

  const records: CSVRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Found ${records.length} records to import\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of records) {
    const timesheetCode = row["Timesheet Code"]?.trim();

    if (!timesheetCode) {
      console.log("Skipping row with empty timesheet code");
      skipped++;
      continue;
    }

    const clientData = {
      name: timesheetCode,
      timesheetCode: timesheetCode,
      invoicedName: cleanString(row["Invoice Name"]),
      invoiceAttn: cleanString(row["Invoice Attn"]),
      hourlyRate: parseHourlyRate(row["Hourly Rate"]),
      email: cleanEmail(row.email),
      status: normalizeStatus(row.Status),
    };

    try {
      await prisma.client.upsert({
        where: { timesheetCode: clientData.timesheetCode },
        update: clientData,
        create: clientData,
      });
      console.log(`✓ Imported: ${clientData.name}`);
      imported++;
    } catch (error) {
      console.error(`✗ Error importing ${clientData.name}:`, error);
      errors++;
    }
  }

  console.log(`\n--- Import Summary ---`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
