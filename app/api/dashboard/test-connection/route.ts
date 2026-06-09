/**
 * POST /api/dashboard/test-connection
 *
 * Fires a test event server-side on behalf of the dashboard so the
 * browser's own origin (conversion-crm.vercel.app) doesn't get attached to
 * the event. This ensures the test event passes the website_url origin filter
 * and appears on the dashboard.
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-workspace";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
};

export async function POST() {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "No workspace" }, { status: 401, headers: CORS_HEADERS });
  }

  const admin = createSupabaseAdminClient();

  // Insert a test event attributed to this workspace's configured website_url
  // (or null origin so it passes the "show null-origin events" filter).
  const { error } = await admin.from("events").insert({
    workspace_id: workspace.id,
    user_id: "connection-test",
    event_type: "connection_test",
    event_name: "connection_test",
    page: "/settings-test",
    origin: workspace.website_url
      ? (() => {
          try {
            const u = new URL(
              workspace.website_url.startsWith("http")
                ? workspace.website_url
                : `https://${workspace.website_url}`
            );
            return u.origin;
          } catch {
            return null;
          }
        })()
      : null,
    properties: { source: "settings_test_button" },
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
