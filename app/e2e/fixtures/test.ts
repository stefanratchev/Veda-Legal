// Composed test export for all e2e spec files.
// Import { test, expect } from this file in every spec.
//
// - `test` includes the db fixture (TRUNCATE cleanup before each test)
// - Auth is handled at project config level via storageState, not as a runtime fixture

export { test } from "./db";
export { expect } from "@playwright/test";
