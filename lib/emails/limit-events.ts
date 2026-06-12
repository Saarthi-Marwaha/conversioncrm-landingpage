/**
 * Detects widget events that mean a free allowance was exhausted — not a
 * one-off "premium feature locked" click.
 *
 * Customers should fire e.g.:
 *   ConversionCRM.track("usage_limit_hit", { limit_type: "monthly", exhausted: true });
 * when a quota/trial/period limit is actually reached.
 */
export type UsageLimitType = "trial" | "weekly" | "monthly" | "quota";

export type ParsedLimitSignal = {
  limit_type: UsageLimitType;
  event_type: string;
};

const EXCLUDED_EVENT_TYPES = new Set([
  "upgrade_clicked",
  "premium_feature_blocked",
  "feature_locked",
  "paid_feature_blocked",
  "upgrade_prompt_shown",
  "feature_gate_shown",
  "pricing_page_visit",
]);

const EXHAUSTION_EVENT_TYPES: Record<string, UsageLimitType> = {
  usage_limit_hit: "quota",
  quota_exhausted: "quota",
  quota_reached: "quota",
  free_limit_reached: "quota",
  free_tier_exhausted: "quota",
  trial_expired: "trial",
  trial_ended: "trial",
  trial_over: "trial",
  weekly_limit_reached: "weekly",
  monthly_limit_reached: "monthly",
};

function normalizeLimitType(raw: unknown): UsageLimitType | null {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase();
  if (v === "trial" || v === "weekly" || v === "monthly" || v === "quota") {
    return v;
  }
  if (v === "week") return "weekly";
  if (v === "month") return "monthly";
  return null;
}

function inferLimitTypeFromEventName(eventType: string): UsageLimitType | null {
  const t = eventType.toLowerCase();
  if (t.includes("trial")) return "trial";
  if (t.includes("weekly") || t.includes("week_limit")) return "weekly";
  if (t.includes("monthly") || t.includes("month_limit")) return "monthly";
  return null;
}

function isFeatureGateOnly(properties: Record<string, unknown>): boolean {
  const reason = properties.reason;
  if (typeof reason === "string") {
    const r = reason.toLowerCase();
    if (
      r === "feature_gated" ||
      r === "upgrade_required" ||
      r === "paid_plan_required" ||
      r === "premium_only"
    ) {
      return true;
    }
  }
  if (properties.blocked_only === true) return true;
  if (properties.exhausted === false) return true;
  return false;
}

/**
 * Returns limit metadata when the event represents an exhausted allowance.
 * Returns null for premium-feature gates, upgrade clicks, or unknown events.
 */
export function parseLimitExhaustedEvent(
  eventType: string,
  properties: Record<string, unknown> | null | undefined
): ParsedLimitSignal | null {
  const type = eventType.trim().toLowerCase();
  if (!type || EXCLUDED_EVENT_TYPES.has(type)) return null;

  const props = properties ?? {};
  if (isFeatureGateOnly(props)) return null;

  const fromProps = normalizeLimitType(props.limit_type ?? props.limitType);
  const fromMap = EXHAUSTION_EVENT_TYPES[type];
  const inferred = fromProps ?? fromMap ?? inferLimitTypeFromEventName(type);

  if (props.exhausted === true && fromProps) {
    return { limit_type: fromProps, event_type: eventType };
  }

  if (fromMap) {
    return { limit_type: fromMap, event_type: eventType };
  }

  if (type === "usage_limit_hit" && inferred) {
    return { limit_type: inferred, event_type: eventType };
  }

  if (inferred && (props.exhausted === true || props.limit_exhausted === true)) {
    return { limit_type: inferred, event_type: eventType };
  }

  return null;
}

export function limitUpgradeCooldownHours(
  limitType: UsageLimitType
): number | null {
  switch (limitType) {
    case "trial":
      return null;
    case "monthly":
      return 30 * 24;
    case "weekly":
      return 7 * 24;
    default:
      return 7 * 24;
  }
}

export function limitTypeLabel(limitType: UsageLimitType): string {
  switch (limitType) {
    case "trial":
      return "free trial";
    case "weekly":
      return "weekly free allowance";
    case "monthly":
      return "monthly free allowance";
    default:
      return "free usage allowance";
  }
}
