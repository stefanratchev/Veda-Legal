/**
 * Historical Timesheet Import Script
 *
 * One-time import of historical time entries from CSV into the database.
 *
 * Usage:
 *   npx tsx scripts/import-historical-timesheets.ts [options]
 *
 * Options:
 *   --dry-run              Preview what would be imported without writing to database
 *   --mapping <path>       Path to client mapping CSV (default: ../client_mapping.csv)
 *   --data <path>          Path to timesheets CSV (default: ../all_timesheets.csv)
 *
 * Examples:
 *   # Dry-run with default files
 *   npx tsx scripts/import-historical-timesheets.ts --dry-run
 *
 *   # Import to dev (uses DATABASE_URL from .env)
 *   npx tsx scripts/import-historical-timesheets.ts
 *
 *   # Import to prod
 *   DATABASE_URL="postgresql://..." npx tsx scripts/import-historical-timesheets.ts
 */

import { config } from "dotenv";
import * as path from "path";

// Load .env from app directory
config({ path: path.join(__dirname, "..", ".env") });

import { PrismaClient, UserRole, UserStatus, ClientStatus } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import { parse } from "csv-parse/sync";

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// ============================================================================
// Types
// ============================================================================

interface ClientMapping {
  csv_name: string;
  db_name: string;
  entries: number;
  status: string;
  action: "MAP" | "SKIP" | "CREATE" | "";
}

interface TimesheetRow {
  date: string;
  client: string;
  description: string;
  lawyer: string;
  hours: string;
}

interface ImportStats {
  usersCreated: number;
  clientsCreated: number;
  entriesImported: number;
  entriesSkipped: number;
  skippedReasons: Map<string, number>;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(): { dryRun: boolean; mappingPath: string; dataPath: string } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let mappingPath = path.join(__dirname, "..", "..", "client_mapping.csv");
  let dataPath = path.join(__dirname, "..", "..", "all_timesheets.csv");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--mapping" && args[i + 1]) {
      mappingPath = args[++i];
    } else if (args[i] === "--data" && args[i + 1]) {
      dataPath = args[++i];
    }
  }

  return { dryRun, mappingPath, dataPath };
}

// ============================================================================
// CSV Parsing
// ============================================================================

function loadMappingFile(filePath: string): Map<string, ClientMapping> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Mapping file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as ClientMapping[];

  const mapping = new Map<string, ClientMapping>();
  for (const record of records) {
    mapping.set(record.csv_name, {
      ...record,
      action: (record.action?.toUpperCase() || "") as ClientMapping["action"],
    });
  }

  return mapping;
}

function loadTimesheetData(filePath: string): TimesheetRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Timesheet data file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const records = parse(content, {
    columns: ["date", "client", "description", "lawyer", "hours"],
    skip_empty_lines: true,
    from_line: 2, // Skip header
    bom: true,
    relax_column_count: true,
  }) as TimesheetRow[];

  return records;
}

// ============================================================================
// Data Transformation
// ============================================================================

function parseDate(dateStr: string): Date {
  // Format: M/D/YY (e.g., "12/23/25" → December 23, 2025)
  const parts = dateStr.split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  // Convert 2-digit year to 4-digit
  if (year < 100) {
    year += year < 50 ? 2000 : 1900;
  }

  return new Date(year, month - 1, day);
}

function parseHours(hoursStr: string): number {
  // Format: H:MM (e.g., "1:30" → 1.5 hours)
  const parts = hoursStr.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid hours format: ${hoursStr}`);
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  // Convert to decimal, rounded to 2 places
  return Math.round((hours + minutes / 60) * 100) / 100;
}

function emailToName(email: string): string {
  // "yulita.yankova@veda.legal" → "Yulita Yankova"
  const localPart = email.split("@")[0];
  return localPart
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

// ============================================================================
// Validation
// ============================================================================

function validateMapping(mapping: Map<string, ClientMapping>): string[] {
  const errors: string[] = [];

  for (const [csvName, record] of mapping) {
    if (record.action === "MAP" && !record.db_name) {
      errors.push(`Missing db_name for MAP action: "${csvName}"`);
    }
    if (!record.action) {
      errors.push(`Missing action for: "${csvName}" (${record.entries} entries)`);
    }
  }

  return errors;
}

function validateEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@veda.legal");
}

// ============================================================================
// Main Import Logic
// ============================================================================

async function runImport(
  prisma: PrismaClient,
  timesheets: TimesheetRow[],
  clientMapping: Map<string, ClientMapping>,
  dryRun: boolean
): Promise<ImportStats> {
  const stats: ImportStats = {
    usersCreated: 0,
    clientsCreated: 0,
    entriesImported: 0,
    entriesSkipped: 0,
    skippedReasons: new Map(),
  };

  const skipReason = (reason: string) => {
    stats.entriesSkipped++;
    stats.skippedReasons.set(reason, (stats.skippedReasons.get(reason) || 0) + 1);
  };

  // Cache for resolved users and clients
  const userCache = new Map<string, string>(); // email → userId
  const clientCache = new Map<string, string>(); // name → clientId
  const createdUsers = new Set<string>();
  const createdClients = new Set<string>();

  // Pre-load existing users and clients
  const existingUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  for (const user of existingUsers) {
    userCache.set(user.email.toLowerCase(), user.id);
  }

  const existingClients = await prisma.client.findMany({ select: { id: true, name: true } });
  for (const client of existingClients) {
    clientCache.set(client.name, client.id);
  }

  // Build a case-insensitive client lookup
  const clientNameLower = new Map<string, string>();
  for (const client of existingClients) {
    clientNameLower.set(client.name.toLowerCase(), client.name);
  }

  console.log(`\nPre-loaded ${existingUsers.length} users and ${existingClients.length} clients from database\n`);

  // Process each timesheet entry
  const entriesToCreate: Array<{
    date: Date;
    hours: number;
    description: string;
    userId: string;
    clientId: string;
  }> = [];

  for (const row of timesheets) {
    // Validate email
    const email = row.lawyer.trim().toLowerCase();
    if (!validateEmail(email)) {
      skipReason(`Invalid email: ${row.lawyer}`);
      continue;
    }

    // Resolve user
    let userId = userCache.get(email);
    if (!userId) {
      if (dryRun) {
        // In dry-run, track but don't actually create
        if (!createdUsers.has(email)) {
          createdUsers.add(email);
          stats.usersCreated++;
        }
        userId = `dry-run-user-${email}`;
        userCache.set(email, userId);
      } else {
        // Create user
        const newUser = await prisma.user.create({
          data: {
            email: email,
            name: emailToName(email),
            role: UserRole.EMPLOYEE,
            status: UserStatus.INACTIVE,
          },
        });
        userId = newUser.id;
        userCache.set(email, userId);
        stats.usersCreated++;
        console.log(`  Created user: ${email} (INACTIVE)`);
      }
    }

    // Resolve client
    const csvClientName = row.client.trim();
    let clientId = clientCache.get(csvClientName);

    if (!clientId) {
      // Check case-insensitive match
      const normalizedName = clientNameLower.get(csvClientName.toLowerCase());
      if (normalizedName) {
        clientId = clientCache.get(normalizedName);
      }
    }

    if (!clientId) {
      // Check mapping file
      const mapping = clientMapping.get(csvClientName);

      if (!mapping) {
        skipReason(`No mapping for client: ${csvClientName}`);
        continue;
      }

      if (mapping.action === "SKIP" || mapping.action === "") {
        skipReason(`Skipped by mapping: ${csvClientName}`);
        continue;
      }

      if (mapping.action === "MAP") {
        if (!mapping.db_name) {
          skipReason(`MAP without db_name: ${csvClientName}`);
          continue;
        }
        clientId = clientCache.get(mapping.db_name);
        if (!clientId) {
          skipReason(`Mapped client not found: ${mapping.db_name}`);
          continue;
        }
      }

      if (mapping.action === "CREATE") {
        if (dryRun) {
          if (!createdClients.has(csvClientName)) {
            createdClients.add(csvClientName);
            stats.clientsCreated++;
          }
          clientId = `dry-run-client-${csvClientName}`;
          clientCache.set(csvClientName, clientId);
        } else {
          // Create client
          const newClient = await prisma.client.create({
            data: {
              name: csvClientName,
              timesheetCode: csvClientName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
              status: ClientStatus.ACTIVE,
            },
          });
          clientId = newClient.id;
          clientCache.set(csvClientName, clientId);
          stats.clientsCreated++;
          console.log(`  Created client: ${csvClientName}`);
        }
      }
    }

    if (!clientId) {
      skipReason(`Could not resolve client: ${csvClientName}`);
      continue;
    }

    // Parse date and hours
    let date: Date;
    let hours: number;
    try {
      date = parseDate(row.date);
      hours = parseHours(row.hours);
    } catch (e) {
      skipReason(`Parse error: ${(e as Error).message}`);
      continue;
    }

    // Validate hours
    if (hours <= 0 || hours > 24) {
      skipReason(`Invalid hours: ${row.hours}`);
      continue;
    }

    entriesToCreate.push({
      date,
      hours,
      description: row.description.trim(),
      userId,
      clientId,
    });
  }

  // Create entries (in batches for performance)
  if (!dryRun && entriesToCreate.length > 0) {
    console.log(`\nCreating ${entriesToCreate.length} time entries...`);

    const BATCH_SIZE = 500;
    for (let i = 0; i < entriesToCreate.length; i += BATCH_SIZE) {
      const batch = entriesToCreate.slice(i, i + BATCH_SIZE);
      await prisma.timeEntry.createMany({
        data: batch.map((e) => ({
          date: e.date,
          hours: e.hours,
          description: e.description,
          userId: e.userId,
          clientId: e.clientId,
          topicName: "",
          subtopicName: "",
        })),
      });
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} entries`);
    }
  }

  stats.entriesImported = entriesToCreate.length;

  return stats;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { dryRun, mappingPath, dataPath } = parseArgs();

  console.log("=".repeat(60));
  console.log("HISTORICAL TIMESHEET IMPORT");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE IMPORT"}`);
  console.log(`Mapping file: ${mappingPath}`);
  console.log(`Data file: ${dataPath}`);
  console.log(`Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") || "(not set)"}`);
  console.log("=".repeat(60));

  // Load files
  console.log("\nLoading files...");
  const clientMapping = loadMappingFile(mappingPath);
  console.log(`  Loaded ${clientMapping.size} client mappings`);

  const timesheets = loadTimesheetData(dataPath);
  console.log(`  Loaded ${timesheets.length} timesheet entries`);

  // Validate mapping
  console.log("\nValidating mapping file...");
  const mappingErrors = validateMapping(clientMapping);
  if (mappingErrors.length > 0) {
    console.log("\n*** MAPPING FILE ERRORS ***");
    for (const error of mappingErrors) {
      console.log(`  - ${error}`);
    }
    console.log("\nPlease fix the mapping file and try again.");
    process.exit(1);
  }
  console.log("  Mapping file is valid");

  // Initialize Prisma
  const prisma = createPrismaClient();

  try {
    if (dryRun) {
      // Dry run - no transaction needed
      console.log("\n--- DRY RUN ---");
      const stats = await runImport(prisma, timesheets, clientMapping, true);
      printStats(stats, true);
    } else {
      // Live import - wrap in transaction
      console.log("\n--- IMPORTING ---");
      const stats = await prisma.$transaction(
        async (tx) => {
          return runImport(tx as unknown as PrismaClient, timesheets, clientMapping, false);
        },
        { timeout: 300000 } // 5 minute timeout
      );
      printStats(stats, false);
    }
  } catch (error) {
    console.error("\n*** IMPORT FAILED ***");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function printStats(stats: ImportStats, dryRun: boolean) {
  console.log("\n" + "=".repeat(60));
  console.log(dryRun ? "DRY RUN COMPLETE" : "IMPORT COMPLETE");
  console.log("=".repeat(60));
  console.log(`Users ${dryRun ? "to be " : ""}created:     ${stats.usersCreated} (all INACTIVE)`);
  console.log(`Clients ${dryRun ? "to be " : ""}created:   ${stats.clientsCreated}`);
  console.log(`Entries ${dryRun ? "to be " : ""}imported:  ${stats.entriesImported}`);
  console.log(`Entries skipped:    ${stats.entriesSkipped}`);

  if (stats.skippedReasons.size > 0) {
    console.log("\nSkip reasons:");
    for (const [reason, count] of stats.skippedReasons) {
      console.log(`  ${count.toString().padStart(5)} - ${reason}`);
    }
  }

  console.log("=".repeat(60));
}

main();
