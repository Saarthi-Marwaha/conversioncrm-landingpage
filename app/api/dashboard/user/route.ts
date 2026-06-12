/**
 * GET /api/dashboard/user?id=<tracked user id>
 *
 * Full 30-day profile for a single tracked user in the active workspace:
 * score layers, page analytics, click breakdowns, the complete activity
 * timeline, and every email that was sent to them (including the rendered
 * HTML for hand-composed emails).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-workspace";
import {
  computeWeeklyEngagementScore,
  emptyScoreBreakdown,
  type ScoringEvent,
} from "@/lib/scoring";
import { daysAgo } from "@/lib/utils";
import type { LifecycleStage } from "@/types";

export const dynamic = "force-dynamic";

type EventRow = {
  event_type: string;
  page: string | null;
  origin: string | null;
  email: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

function toOrigin(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.origin;
  } catch {
    return url;
  }
}

function activityDetail(
  eventType: string,
  props: Record<string, unknown>
): string | null {
  if (eventType === "page_time") {
    const sec = Number(props.duration_seconds) || 0;
    if (sec < 60) return `${sec}s on page`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m}m ${s}s on page` : `${m}m on page`;
  }
  if (eventType === "click") {
    const label = props.text || props.id || props.tag || "element";
    return `Clicked: ${String(label)}`;
  }
  if (/page[_-]?view/i.test(eventType) && props.title) {
    return String(props.title);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }

  const userId = request.nextUrl.searchParams.get("id")?.trim();
  if (!userId || userId.length > 256) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const since = daysAgo(30);

  let query = admin
    .from("events")
    .select("event_type, page, origin, email, properties, occurred_at")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(2000);

  const siteOrigin = toOrigin(workspace.website_url);
  const safeOrigin =
    siteOrigin && /^[a-zA-Z0-9.\-:/]+$/.test(siteOrigin) ? siteOrigin : null;
  if (safeOrigin) {
    query = query.or(`origin.eq.${safeOrigin},origin.is.null`);
  }

  const [{ data, error }, { data: stageRow }, { data: emailRows }] =
    await Promise.all([
      query,
      admin
        .from("stages")
        .select("stage")
        .eq("workspace_id", workspace.id)
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("email_logs")
        .select("trigger, subject, status, sent_at, metadata")
        .eq("workspace_id", workspace.id)
        .eq("user_id", userId)
        .order("sent_at", { ascending: false })
        .limit(100),
    ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as EventRow[];
  if (events.length === 0 && !stageRow && (emailRows ?? []).length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── Aggregate (events arrive newest → oldest) ─────────────────────
  let email: string | null = null;
  let signedUp = false;
  let loggedIn = false;
  let totalTime = 0;
  let totalClicks = 0;
  let pageViews = 0;
  let firstSeen: string | null = null;
  let lastSeen: string | null = null;

  const pageMap = new Map<
    string,
    {
      page: string;
      title: string | null;
      views: number;
      time_seconds: number;
      clicks: number;
      click_targets: Map<string, number>;
    }
  >();
  const activity: {
    event_type: string;
    page: string | null;
    occurred_at: string;
    detail: string | null;
  }[] = [];
  const scoringEvents: ScoringEvent[] = [];
  const weekCutoff = new Date(daysAgo(7)).getTime();

  for (const ev of events) {
    const props = (ev.properties ?? {}) as Record<string, unknown>;
    if (!email && ev.email) email = ev.email;
    if (/sign[_-]?up|register/i.test(ev.event_type)) signedUp = true;
    if (/login|sign[_-]?in/i.test(ev.event_type)) loggedIn = true;
    if (!lastSeen) lastSeen = ev.occurred_at;
    firstSeen = ev.occurred_at;

    if (new Date(ev.occurred_at).getTime() >= weekCutoff) {
      scoringEvents.push({
        event_type: ev.event_type,
        page: ev.page,
        properties: ev.properties,
        occurred_at: ev.occurred_at,
      });
    }

    if (activity.length < 150) {
      activity.push({
        event_type: ev.event_type,
        page: ev.page,
        occurred_at: ev.occurred_at,
        detail: activityDetail(ev.event_type, props),
      });
    }

    if (/page[_-]?view/i.test(ev.event_type)) pageViews++;

    if (!ev.page) continue;
    let stats = pageMap.get(ev.page);
    if (!stats) {
      stats = {
        page: ev.page,
        title: null,
        views: 0,
        time_seconds: 0,
        clicks: 0,
        click_targets: new Map(),
      };
      pageMap.set(ev.page, stats);
    }

    if (/page[_-]?view/i.test(ev.event_type)) {
      stats.views++;
      const title = props.title ?? props.page_title;
      if (title && !stats.title) stats.title = String(title);
    } else if (ev.event_type === "page_time") {
      const dur = Math.max(0, Math.min(Number(props.duration_seconds) || 0, 1800));
      stats.time_seconds += dur;
      totalTime += dur;
    } else if (ev.event_type === "click") {
      stats.clicks++;
      totalClicks++;
      const label = String(props.text || props.id || props.tag || "element");
      stats.click_targets.set(label, (stats.click_targets.get(label) ?? 0) + 1);
    }
  }

  const pages = Array.from(pageMap.values())
    .map((s) => ({
      page: s.page,
      title: s.title,
      views: s.views,
      time_seconds: s.time_seconds,
      clicks: s.clicks,
      click_targets: Array.from(s.click_targets.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15),
    }))
    .sort(
      (a, b) =>
        b.views * 10 + b.time_seconds + b.clicks -
        (a.views * 10 + a.time_seconds + a.clicks)
    );

  const { score, breakdown } =
    scoringEvents.length > 0
      ? computeWeeklyEngagementScore(
          scoringEvents,
          workspace.key_feature_name,
          workspace.key_feature_event
        )
      : { score: 0, breakdown: emptyScoreBreakdown() };

  const emails = (emailRows ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      trigger: row.trigger as string,
      subject: row.subject as string,
      status: row.status as string,
      sent_at: row.sent_at as string,
      // Rendered HTML is stored for composer emails so "what was sent"
      // can be previewed verbatim.
      html: typeof meta.html === "string" ? meta.html : null,
      body_text: typeof meta.body_text === "string" ? meta.body_text : null,
    };
  });

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      website_url: workspace.website_url ?? null,
      reply_to_configured: !!workspace.reply_to_email,
    },
    user: {
      user_id: userId,
      email,
      stage: ((stageRow?.stage as LifecycleStage) ?? "signup") as LifecycleStage,
      is_anonymous: userId.startsWith("anon_"),
      signed_up: signedUp,
      logged_in: loggedIn,
      engagement_score: score,
      score_breakdown: breakdown,
      first_seen: firstSeen,
      last_seen: lastSeen,
      totals: {
        events: events.length,
        page_views: pageViews,
        clicks: totalClicks,
        time_seconds: totalTime,
        pages: pages.length,
        active_days: breakdown.active_days,
      },
      pages,
      activity,
      emails,
    },
    serverTime: new Date().toISOString(),
  });
}
