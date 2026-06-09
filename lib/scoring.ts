import type { EndUser } from "@/types";

/** Event fields needed for weekly engagement scoring. */
export type ScoringEvent = {
  event_type: string;
  page: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

export type WeeklyScoreBreakdown = {
  seen_this_week: number;
  key_feature_used: number;
  time_spent: number;
  pricing_page: number;
  total_seconds: number;
  total: number;
};

const SEEN_EVENT_TYPES = new Set([
  "page_view",
  "signup",
  "sign_up",
  "register",
  "login",
  "sign_in",
]);

const TIME_EVENT_TYPES = new Set(["time_spent", "page_time"]);

const FULL_TIME_SECONDS = 600;

function matchesKeyFeature(
  properties: Record<string, unknown> | null,
  keyFeature: string | null
): boolean {
  if (!keyFeature) return false;
  const feature = properties?.feature;
  if (typeof feature !== "string" || !feature) return false;
  return feature.toLowerCase() === keyFeature.toLowerCase();
}

function durationSeconds(properties: Record<string, unknown> | null): number {
  const raw = properties?.duration_seconds;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Computes a 0–100 weekly engagement score from the last 7 days of events.
 *
 * Signals (max 100):
 *   • Seen this week (page_view / signup / login)     → 30 pts
 *   • Key feature used (feature_used + matching feature) → 30 pts
 *   • Time spent (time_spent / page_time events)      → 20 pts (600s = full)
 *   • Pricing page visited (page_view + "pricing")    → 20 pts
 */
export function computeWeeklyEngagementScore(
  events: ScoringEvent[],
  keyFeatureName: string | null
): { score: number; breakdown: WeeklyScoreBreakdown } {
  let seenThisWeek = false;
  let keyFeatureUsed = false;
  let totalSeconds = 0;
  let pricingVisited = false;

  for (const ev of events) {
    const type = ev.event_type.toLowerCase();

    if (SEEN_EVENT_TYPES.has(type)) {
      seenThisWeek = true;
    }

    if (type === "feature_used" && matchesKeyFeature(ev.properties, keyFeatureName)) {
      keyFeatureUsed = true;
    }

    if (TIME_EVENT_TYPES.has(type)) {
      totalSeconds += durationSeconds(ev.properties);
    }

    if (type === "page_view" && ev.page && /pricing/i.test(ev.page)) {
      pricingVisited = true;
    }
  }

  const seenPoints = seenThisWeek ? 30 : 0;
  const keyFeaturePoints = keyFeatureUsed ? 30 : 0;
  const timePoints = Math.min(20, (totalSeconds / FULL_TIME_SECONDS) * 20);
  const pricingPoints = pricingVisited ? 20 : 0;

  const rawTotal = seenPoints + keyFeaturePoints + timePoints + pricingPoints;
  const score = Math.min(100, Math.round(rawTotal));

  return {
    score,
    breakdown: {
      seen_this_week: seenPoints,
      key_feature_used: keyFeaturePoints,
      time_spent: Math.round(timePoints * 10) / 10,
      pricing_page: pricingPoints,
      total_seconds: totalSeconds,
      total: score,
    },
  };
}

/**
 * Determines the lifecycle stage based on the user's score and activity.
 * (Used by future email / lifecycle features.)
 */
export function determineStage(
  user: Pick<
    EndUser,
    "stage" | "engagement_score" | "trial_ends_at" | "converted_at" | "last_seen_at"
  >,
  score: number,
  events: Pick<ScoringEvent, "event_type" | "occurred_at">[]
): EndUser["stage"] {
  if (user.converted_at) return "paid";

  const now = new Date();
  const trialEnded =
    user.trial_ends_at && new Date(user.trial_ends_at) < now;

  if (trialEnded && !user.converted_at) return "churned";

  const daysSinceLastSeen = user.last_seen_at
    ? (now.getTime() - new Date(user.last_seen_at).getTime()) /
      (1000 * 60 * 60 * 24)
    : Infinity;

  if (score >= 70) return "conversion_ready";
  if (daysSinceLastSeen > 10) return "going_quiet";

  const recentLogins = events.filter(
    (e) =>
      /login|sign[_-]?in/i.test(e.event_type) &&
      new Date(e.occurred_at).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
  ).length;

  if (recentLogins >= 2) return "active";

  const hasKeyFeature = events.some((e) => e.event_type === "feature_used");
  if (!hasKeyFeature) return "onboarding";

  return "active";
}
