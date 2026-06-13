/**
 * Auth/plan bypass — OFF everywhere by default. The dashboard is gated behind
 * login AND an explicit plan choice (see /pricing); there is no way past that
 * gate in production. Set BYPASS_AUTH="true" only for throwaway local poking
 * (it falls back to the seeded test workspace, which is pinned to Free).
 *
 * Kept dependency-free so it can be imported from middleware (edge runtime).
 */
export const DEV_BYPASS_AUTH = process.env.BYPASS_AUTH === "true";

/** The seeded test workspace used while auth is bypassed (db migration 003). */
export const TEST_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
