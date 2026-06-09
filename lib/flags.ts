/**
 * TEMP flag — bypasses the login/signup gate so the dashboard is reachable
 * without auth (handy for grabbing the widget api_key while building the core
 * product). Set BYPASS_AUTH="false" to restore auth.
 *
 * - Local dev (NODE_ENV !== "production"): on by default.
 * - Production (e.g. Vercel): on only when BYPASS_AUTH="true" is set.
 *
 * Kept dependency-free so it can be imported from middleware (edge runtime).
 */
export const DEV_BYPASS_AUTH =
  process.env.BYPASS_AUTH === "true" ||
  (process.env.BYPASS_AUTH !== "false" && process.env.NODE_ENV !== "production");

/** The seeded test workspace used while auth is bypassed (db migration 003). */
export const TEST_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
