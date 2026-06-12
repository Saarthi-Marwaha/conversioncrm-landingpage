import type { EndUser } from "@/types";

/** Event fields needed for engagement scoring. */
export type ScoringEvent = {
  event_type: string;
  page: string | null;
  properties: Record<string, unknown> | null;
  occurred_at: string;
};

/**
 * Multi-layer engagement score breakdown (0–100 total).
 *
 * Six independent layers, each capped, so one noisy signal (e.g. a runaway
 * page_time event) can never max the score on its own:
 *
 *   recency       → 20  how recently the user was active
 *   frequency     → 15  how many distinct days they showed up
 *   depth         → 15  pages explored, clicks, event volume
 *   key_feature   → 20  reached the product's aha-moment
 *   time_spent    → 15  active time on site (diminishing returns)
 *   buying_intent → 15  pricing visits, upgrade clicks, limit hits
 */
export type WeeklyScoreBreakdown = {
  recency: number;
  frequency: number;
  depth: number;
  key_feature: number;
  time_spent: number;
  buying_intent: number;
  /** Raw helper stats surfaced in the UI. */
  total_seconds: number;
  active_days: number;
  distinct_pages: number;
  total: number;
};

export const SCORE_LAYER_MAX = {
  recency: 20,
  frequency: 15,
  depth: 15,
  key_feature: 20,
  time_spent: 15,
  buying_intent: 15,
} as const;

export function emptyScoreBreakdown(): WeeklyScoreBreakdown {
  return {
    recency: 0,
    frequency: 0,
    depth: 0,
    key_feature: 0,
    time_spent: 0,
    buying_intent: 0,
    total_seconds: 0,
    active_days: 0,
    distinct_pages: 0,
    total: 0,
  };
}

const TIME_EVENT_TYPES = new Set(["time_spent", "page_time"]);

/** Seconds of tracked time that earn the full time-spent layer. */
const FULL_TIME_SECONDS = 600;

/** A single page_time ping longer than this is treated as bogus client data. */
const MAX_SECONDS_PER_EVENT = 1800;

function isPageView(type: string): boolean {
  return /page[_-]?view/i.test(type);
}

function isSignupOrLogin(type: string): boolean {
  return /sign[_-]?up|register|login|sign[_-]?in/i.test(type);
}

function isFeatureUsed(type: string): boolean {
  return type === "feature_used" || type === "key_feature_used";
}

function matchesKeyFeature(
  properties: Record<string, unknown> | null,
  keyFeature: string | null
): boolean {
  if (!keyFeature) return false;
  const feature = properties?.feature;
  if (typeof feature !== "string" || !feature) return false;
  return feature.toLowerCase() === keyFeature.toLowerCase();
}

/** Clamped, validated duration from event properties — never negative or huge. */
function durationSeconds(properties: Record<string, unknown> | null): number {
  const raw = properties?.duration_seconds;
  let n = 0;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string") n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_SECONDS_PER_EVENT);
}

function isPricingHit(ev: ScoringEvent): boolean {
  if (ev.event_type === "pricing_page_visit") return true;
  return isPageView(ev.event_type) && !!ev.page && /pricing/i.test(ev.page);
}

/**
 * Computes the layered 0–100 engagement score from the window's events.
 *
 * Layer details:
 *   • Recency (20): active today 20 · ≤1d 16 · ≤3d 12 · ≤7d 6 · older 0
 *   • Frequency (15): distinct active days — 1→5, 2→9, 3→12, 4+→15
 *   • Depth (15): distinct pages (≤6), clicks (≤5), event volume (≤4)
 *   • Key feature (20): any feature_used 8 · matching key feature 14 · 3+ matches 20
 *   • Time (15): sqrt curve, 600s of tracked time = full credit
 *   • Intent (15): pricing visit 7 (+3 repeat) · upgrade_clicked +5 · usage_limit_hit +3
 */
export function computeWeeklyEngagementScore(
  events: ScoringEvent[],
  keyFeatureName: string | null,
  keyFeatureEvent: string | null = null,
  now: Date = new Date()
): { score: number; breakdown: WeeklyScoreBreakdown } {
  if (events.length === 0) {
    return { score: 0, breakdown: emptyScoreBreakdown() };
  }

  const ahaEvent = keyFeatureEvent?.trim().toLowerCase() || null;

  let lastSeenMs = 0;
  const activeDays = new Set<string>();
  const distinctPages = new Set<string>();
  let clicks = 0;
  let meaningfulEvents = 0;
  let anyFeatureUsed = false;
  let keyFeatureMatches = 0;
  let totalSeconds = 0;
  let pricingVisits = 0;
  let upgradeClicked = false;
  let limitHit = false;

  for (const ev of events) {
    const type = ev.event_type.toLowerCase();
    const ts = new Date(ev.occurred_at).getTime();

    if (Number.isFinite(ts)) {
      if (ts > lastSeenMs) lastSeenMs = ts;
      activeDays.add(new Date(ts).toISOString().slice(0, 10));
    }

    if (ev.page) distinctPages.add(ev.page);
    if (type === "click") clicks++;
    if (isPageView(type) || isSignupOrLogin(type) || isFeatureUsed(type)) {
      meaningfulEvents++;
    }

    // Aha-moment catcher: a custom event name set in Settings counts
    // directly; otherwise feature_used events matching the configured
    // feature name count. Generic feature_used grants partial credit.
    if (ahaEvent && type === ahaEvent) {
      anyFeatureUsed = true;
      keyFeatureMatches++;
    } else if (isFeatureUsed(type)) {
      anyFeatureUsed = true;
      if (matchesKeyFeature(ev.properties, keyFeatureName)) keyFeatureMatches++;
    }

    if (TIME_EVENT_TYPES.has(type)) {
      totalSeconds += durationSeconds(ev.properties);
    }

    if (isPricingHit(ev)) pricingVisits++;
    if (type === "upgrade_clicked") upgradeClicked = true;
    if (type === "usage_limit_hit") limitHit = true;
  }

  // Layer 1 — recency
  const daysSinceSeen =
    lastSeenMs > 0 ? (now.getTime() - lastSeenMs) / 86_400_000 : Infinity;
  const recency =
    daysSinceSeen < 1 ? 20 : daysSinceSeen <= 1.5 ? 16 : daysSinceSeen <= 3 ? 12 : daysSinceSeen <= 7 ? 6 : 0;

  // Layer 2 — frequency
  const days = activeDays.size;
  const frequency = days >= 4 ? 15 : days === 3 ? 12 : days === 2 ? 9 : days === 1 ? 5 : 0;

  // Layer 3 — depth (pages ≤6 + clicks ≤5 + volume ≤4)
  const pagePts = Math.min(6, distinctPages.size * 1.5);
  const clickPts = Math.min(5, clicks / 3);
  const volumePts = Math.min(4, meaningfulEvents / 7.5);
  const depth = Math.min(15, pagePts + clickPts + volumePts);

  // Layer 4 — key feature (aha moment)
  const keyFeature =
    keyFeatureMatches >= 3 ? 20 : keyFeatureMatches >= 1 ? 14 : anyFeatureUsed ? 8 : 0;

  // Layer 5 — time spent, diminishing returns
  const timeSpent =
    15 * Math.sqrt(Math.min(totalSeconds, FULL_TIME_SECONDS) / FULL_TIME_SECONDS);

  // Layer 6 — buying intent
  let buyingIntent = 0;
  if (pricingVisits >= 1) buyingIntent += 7;
  if (pricingVisits >= 2) buyingIntent += 3;
  if (upgradeClicked) buyingIntent += 5;
  if (limitHit) buyingIntent += 3;
  buyingIntent = Math.min(15, buyingIntent);

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const rawTotal = recency + frequency + depth + keyFeature + timeSpent + buyingIntent;
  const score = Math.max(0, Math.min(100, Math.round(rawTotal)));

  return {
    score,
    breakdown: {
      recency,
      frequency,
      depth: round1(depth),
      key_feature: keyFeature,
      time_spent: round1(timeSpent),
      buying_intent: buyingIntent,
      total_seconds: Math.round(totalSeconds),
      active_days: days,
      distinct_pages: distinctPages.size,
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
