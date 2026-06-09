/**
 * GET /api/dashboard/live
 *
 * Returns live tracking data for the active workspace with rich per-user
 * page analytics: views, time spent, and clicks — for product usage insights
 * and personalised email targeting.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { assignStagesForWorkspace } from "@/lib/cron/assign-stages";
import { runAutomatedEmailsForWorkspace } from "@/lib/cron/run-automated-emails";
import {
  AUTOMATED_TRIGGERS,
  emptyEmailsSent,
  type UserEmailsSent,
} from "@/lib/emails/stage-email-columns";
import type { EmailTrigger } from "@/types";
import {
  computeWeeklyEngagementScore,
  type ScoringEvent,
  type WeeklyScoreBreakdown,
} from "@/lib/scoring";
import { daysAgo, todayUTCStart } from "@/lib/utils";
import type { LifecycleStage } from "@/types";

export const dynamic = "force-dynamic";

export type DashboardDateRange = "today" | "7d" | "30d";

function parseRange(value: string | null): DashboardDateRange {
  if (value === "today" || value === "7d" || value === "30d") return value;
  return "7d";
}

function rangeSince(range: DashboardDateRange): string {
  switch (range) {
    case "today":
      return todayUTCStart();
    case "30d":
      return daysAgo(30);
    default:
      return daysAgo(7);
  }
}

type EventRow = {
  user_id: string | null;
  event_type: string;
  page: string | null;
  origin: string | null;
  email: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

type ClickTarget = { label: string; count: number };

type PageStats = {
  page: string;
  title: string | null;
  views: number;
  time_seconds: number;
  clicks: number;
  click_targets: ClickTarget[];
};

type UserActivity = {
  event_type: string;
  page: string | null;
  occurred_at: string;
  detail: string | null;
};

type LiveUser = {
  user_id: string;
  email: string | null;
  stage: LifecycleStage;
  emails_sent: UserEmailsSent;
  engagement_score: number;
  score_breakdown: WeeklyScoreBreakdown;
  events: number;
  first_seen: string;
  last_seen: string;
  last_event: string;
  last_page: string | null;
  signed_up: boolean;
  logged_in: boolean;
  is_anonymous: boolean;
  total_time_seconds: number;
  total_clicks: number;
  pages: PageStats[];
  page_count: number;
  activity: UserActivity[];
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

function emptyPageStats(page: string): PageStats {
  return {
    page,
    title: null,
    views: 0,
    time_seconds: 0,
    clicks: 0,
    click_targets: [],
  };
}

export async function GET(request: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) {
    return NextResponse.json({ error: "No workspace" }, { status: 401 });
  }

  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const since = rangeSince(range);

  const admin = createSupabaseAdminClient();

  let query = admin
    .from("events")
    .select("user_id, event_type, page, origin, email, properties, occurred_at")
    .eq("workspace_id", workspace.id)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(3000);

  const siteOrigin = toOrigin(workspace.website_url);
  if (siteOrigin) {
    query = query.or(`origin.eq.${siteOrigin},origin.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []) as EventRow[];
  const scoreSinceMs = new Date(since).getTime();

  const byUser = new Map<string, LiveUser>();
  const pageStatsByUser = new Map<string, Map<string, PageStats>>();
  const clickMapsByUser = new Map<string, Map<string, Map<string, number>>>();
  const scoringEventsByUser = new Map<string, ScoringEvent[]>();
  let anonymousEvents = 0;
  let pageViews = 0;
  let totalClicks = 0;

  for (const ev of events) {
    if (/page[_-]?view/i.test(ev.event_type)) pageViews++;
    if (ev.event_type === "click") totalClicks++;

    if (!ev.user_id) {
      anonymousEvents++;
      continue;
    }

    const props = (ev.properties ?? {}) as Record<string, unknown>;
    const isSignup = /sign[_-]?up|register/i.test(ev.event_type);
    const isLogin = /login|sign[_-]?in/i.test(ev.event_type);
    const isAnon = ev.user_id.startsWith("anon_");

    let user = byUser.get(ev.user_id);
    if (!user) {
      user = {
        user_id: ev.user_id,
        email: ev.email ?? null,
        stage: "signup",
        emails_sent: emptyEmailsSent(),
        engagement_score: 0,
        score_breakdown: {
          seen_this_week: 0,
          key_feature_used: 0,
          time_spent: 0,
          pricing_page: 0,
          total_seconds: 0,
          total: 0,
        },
        events: 0,
        first_seen: ev.occurred_at,
        last_seen: ev.occurred_at,
        last_event: ev.event_type,
        last_page: ev.page,
        signed_up: false,
        logged_in: false,
        is_anonymous: isAnon,
        total_time_seconds: 0,
        total_clicks: 0,
        pages: [],
        page_count: 0,
        activity: [],
      };
      byUser.set(ev.user_id, user);
      pageStatsByUser.set(ev.user_id, new Map());
      clickMapsByUser.set(ev.user_id, new Map());
    }

    user.events++;
    user.first_seen = ev.occurred_at;
    user.signed_up = user.signed_up || isSignup;
    user.logged_in = user.logged_in || isLogin;
    if (!user.email && ev.email) user.email = ev.email;

    if (new Date(ev.occurred_at).getTime() >= scoreSinceMs) {
      const scoringList = scoringEventsByUser.get(ev.user_id) ?? [];
      scoringList.push({
        event_type: ev.event_type,
        page: ev.page,
        properties: ev.properties,
        occurred_at: ev.occurred_at,
      });
      scoringEventsByUser.set(ev.user_id, scoringList);
    }

    if (user.activity.length < 80) {
      user.activity.push({
        event_type: ev.event_type,
        page: ev.page,
        occurred_at: ev.occurred_at,
        detail: activityDetail(ev.event_type, props),
      });
    }

    if (!ev.page) continue;

    const userPages = pageStatsByUser.get(ev.user_id)!;
    let stats = userPages.get(ev.page);
    if (!stats) {
      stats = emptyPageStats(ev.page);
      userPages.set(ev.page, stats);
    }

    if (/page[_-]?view/i.test(ev.event_type)) {
      stats.views++;
      const title = props.title ?? props.page_title;
      if (title && !stats.title) stats.title = String(title);
    } else if (ev.event_type === "page_time") {
      const dur = Number(props.duration_seconds) || 0;
      stats.time_seconds += dur;
      user.total_time_seconds += dur;
      const title = props.page_title ?? props.title;
      if (title && !stats.title) stats.title = String(title);
    } else if (ev.event_type === "click") {
      stats.clicks++;
      user.total_clicks++;
      const label = String(props.text || props.id || props.tag || "element");
      const userClicks = clickMapsByUser.get(ev.user_id)!;
      let pageClicks = userClicks.get(ev.page);
      if (!pageClicks) {
        pageClicks = new Map();
        userClicks.set(ev.page, pageClicks);
      }
      pageClicks.set(label, (pageClicks.get(label) ?? 0) + 1);
    }
  }

  // Materialise page lists with click breakdowns
  Array.from(byUser.entries()).forEach(([uid, user]) => {
    const userPages = pageStatsByUser.get(uid)!;
    const userClicks = clickMapsByUser.get(uid)!;

    const pages = Array.from(userPages.values()).map((stats) => {
      const clickMap = userClicks.get(stats.page);
      const click_targets = clickMap
        ? Array.from(clickMap.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
        : [];
      return { ...stats, click_targets };
    });

    pages.sort((a, b) => {
      const scoreA = a.views * 10 + a.time_seconds + a.clicks;
      const scoreB = b.views * 10 + b.time_seconds + b.clicks;
      return scoreB - scoreA;
    });

    user.pages = pages;
    user.page_count = pages.length;

    const scoringEvts = scoringEventsByUser.get(uid) ?? [];
    const { score, breakdown } = computeWeeklyEngagementScore(
      scoringEvts,
      workspace.key_feature_name
    );
    user.engagement_score = score;
    user.score_breakdown = breakdown;
  });

  const users = Array.from(byUser.values()).sort(
    (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
  );

  const { data: stageRows } = await admin
    .from("stages")
    .select("user_id, stage")
    .eq("workspace_id", workspace.id);

  const persistedStages = new Map<string, LifecycleStage>();
  for (const row of stageRows ?? []) {
    if (row.user_id && row.stage) {
      persistedStages.set(row.user_id, row.stage as LifecycleStage);
    }
  }

  for (const u of users) {
    u.stage = persistedStages.get(u.user_id) ?? "signup";
  }

  // Persist scores + stages so Supabase stays in sync with the dashboard.
  if (users.length > 0) {
    const computedAt = new Date().toISOString();
    const { error: syncError } = await admin.from("engagement_scores").upsert(
      users.map((u) => ({
        workspace_id: workspace.id,
        user_id: u.user_id,
        end_user_id: null,
        score: u.engagement_score,
        score_breakdown: u.score_breakdown,
        computed_at: computedAt,
      })),
      { onConflict: "workspace_id,user_id" }
    );
    if (syncError) {
      console.error("[/api/dashboard/live] score sync:", syncError.message);
    }

    const stageResult = await assignStagesForWorkspace(
      workspace.id,
      users.map((u) => ({
        workspace_id: workspace.id,
        user_id: u.user_id,
        score: u.engagement_score,
      }))
    );
    if (stageResult.error) {
      console.error("[/api/dashboard/live] stage sync:", stageResult.error);
    }
    for (const u of users) {
      u.stage = stageResult.stages.get(u.user_id) ?? "signup";
    }
  }

  const { data: emailLogRows } = await admin
    .from("email_logs")
    .select("user_id, trigger")
    .eq("workspace_id", workspace.id)
    .eq("status", "sent")
    .not("user_id", "is", null);

  const sentTriggersByUser = new Map<string, Set<EmailTrigger>>();
  for (const row of emailLogRows ?? []) {
    if (!row.user_id || !row.trigger) continue;
    let set = sentTriggersByUser.get(row.user_id);
    if (!set) {
      set = new Set();
      sentTriggersByUser.set(row.user_id, set);
    }
    set.add(row.trigger as EmailTrigger);
  }

  for (const u of users) {
    const sent = sentTriggersByUser.get(u.user_id);
    const emailsSent = emptyEmailsSent();
    for (const trigger of AUTOMATED_TRIGGERS) {
      emailsSent[trigger] = sent?.has(trigger) ?? false;
    }
    u.emails_sent = emailsSent;
  }

  let emailBatch = { sent: 0, errors: [] as string[] };
  if (workspace.reply_to_email?.trim()) {
    emailBatch = await runAutomatedEmailsForWorkspace(workspace.id);
    if (emailBatch.sent > 0) {
      const { data: freshLogs } = await admin
        .from("email_logs")
        .select("user_id, trigger")
        .eq("workspace_id", workspace.id)
        .eq("status", "sent")
        .not("user_id", "is", null);

      const freshByUser = new Map<string, Set<EmailTrigger>>();
      for (const row of freshLogs ?? []) {
        if (!row.user_id || !row.trigger) continue;
        let set = freshByUser.get(row.user_id);
        if (!set) {
          set = new Set();
          freshByUser.set(row.user_id, set);
        }
        set.add(row.trigger as EmailTrigger);
      }

      for (const u of users) {
        const sentSet = freshByUser.get(u.user_id);
        for (const trigger of AUTOMATED_TRIGGERS) {
          u.emails_sent[trigger] = sentSet?.has(trigger) ?? false;
        }
      }
    }
  }

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      website_url: workspace.website_url ?? null,
      reply_to_configured: !!workspace.reply_to_email,
    },
    range,
    filtered: !!siteOrigin,
    emailBatch,
    users,
    totals: {
      users: users.length,
      events: events.length,
      anonymousEvents,
      pageViews,
      totalClicks,
      identified: users.filter((u) => !u.is_anonymous).length,
      totalTimeSeconds: users.reduce((s, u) => s + u.total_time_seconds, 0),
    },
    serverTime: new Date().toISOString(),
  });
}
