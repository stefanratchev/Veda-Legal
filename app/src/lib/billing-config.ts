/**
 * Billing configuration constants.
 */

/**
 * The earliest date for time entries to be included in billing.
 * Entries before this date are excluded from:
 * - "Clients Ready to Bill" summary
 * - Auto-populated line items when creating service descriptions
 *
 * Format: YYYY-MM-DD (string comparison works with Drizzle ORM)
 */
export const BILLING_START_DATE = "2026-02-01";
