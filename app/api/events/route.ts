/**
 * POST /api/events
 *
 * Public event-ingestion endpoint hit by the embeddable widget.
 * Authenticated by `api_key` in the request body (no login session needed).
 *
 * Body: { api_key, event_type, page?, user_id?, properties?, timestamp? }
 *
 *  200 — event stored
 *  400 — api_key missing / invalid JSON
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Seeded by db/migrations/003_widget_testing.sql.
const TEST_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

// CORS so the widget can POST from any customer domain
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  // Parse body: the widget sends Content-Type text/plain with a JSON body
  // (text/plain is a CORS-safelisted type — no preflight needed). We read
  // the raw text first and JSON.parse manually so the content-type header
  // never causes a body-parser rejection.
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const apiKey = typeof body.api_key === "string" ? body.api_key.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "api_key is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Capture the origin of the request so we can filter by website on the
  // dashboard. Prefer the Origin header; fall back to the Referer host.
  const rawOrigin =
    request.headers.get("origin") ||
    (() => {
      const ref = request.headers.get("referer") ?? "";
      try {
        return ref ? new URL(ref).origin : "";
      } catch {
        return "";
      }
    })();
  const origin = rawOrigin || null;

  const supabase = createSupabaseAdminClient();

  // Look up the workspace this api_key belongs to
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("api_key", apiKey)
    .maybeSingle();

  // Fallback to the seeded test workspace so we can build/test without auth.
  const workspaceId = workspace?.id ?? TEST_WORKSPACE_ID;

  const eventType =
    typeof body.event_type === "string" && body.event_type
      ? body.event_type
      : "page_view";

  // Email can come top-level or nested in properties.email
  const props =
    body.properties && typeof body.properties === "object"
      ? (body.properties as Record<string, unknown>)
      : {};
  const email =
    typeof body.email === "string" && body.email
      ? body.email
      : typeof props.email === "string" && props.email
        ? (props.email as string)
        : null;

  const { error } = await supabase.from("events").insert({
    workspace_id: workspaceId,
    user_id: typeof body.user_id === "string" ? body.user_id : null,
    event_type: eventType,
    event_name: eventType,
    email,
    page: typeof body.page === "string" ? body.page : null,
    origin,
    properties:
      body.properties && typeof body.properties === "object"
        ? body.properties
        : {},
    occurred_at:
      typeof body.timestamp === "string" ? body.timestamp : new Date().toISOString(),
  });

  if (error) {
    console.error("[/api/events] insert failed:", error.message, error.code);
    return NextResponse.json(
      { error: "Failed to store event" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
}
