// ─────────────────────────────────────────────
// Core domain types for ConversionCRM
// ─────────────────────────────────────────────

export type LifecycleStage =
  | "signup"
  | "onboarding"
  | "active"
  | "going_quiet"
  | "conversion_ready"
  | "paid"
  | "churned";

export type EventType =
  | "login"
  | "feature_click"
  | "page_view"
  | "pricing_page_visit"
  | "key_feature_used"
  | "file_uploaded"
  | "task_completed"
  | "upgrade_clicked"
  | "custom";

export type EmailTrigger =
  | "welcome"
  | "feature_nudge"
  | "value_demo"
  | "check_in"
  | "upgrade_offer"
  | "urgency"
  | "churn_prevention"
  | "daily_summary";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

// ─────────────────────────────────────────────
// Database row shapes (mirrors Supabase schema)
// ─────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  owner_id: string | null;
  api_key: string;
  product_name: string | null;
  website_url: string | null;
  key_feature_name: string | null;
  key_feature_event: string | null;
  trial_length_days: number;
  created_at: string;
  updated_at: string;
}

export interface EndUser {
  id: string;
  workspace_id: string;
  external_id: string;
  email: string;
  name: string | null;
  stage: LifecycleStage;
  engagement_score: number;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  converted_at: string | null;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  workspace_id: string;
  end_user_id: string;
  event_type: EventType;
  event_name: string;
  properties: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface EngagementScore {
  id: string;
  workspace_id: string;
  end_user_id: string | null;
  user_id: string | null;
  score: number;
  score_breakdown: Record<string, number>;
  computed_at: string;
}

export interface UserStage {
  workspace_id: string;
  user_id: string;
  stage: LifecycleStage;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  workspace_id: string;
  end_user_id: string;
  trigger: EmailTrigger;
  resend_message_id: string | null;
  subject: string;
  status: "sent" | "failed" | "skipped";
  sent_at: string;
  metadata: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  workspace_id: string;
  end_user_id: string;
  lemonsqueezy_subscription_id: string | null;
  lemonsqueezy_order_id: string | null;
  status: SubscriptionStatus;
  plan_name: string | null;
  variant_id: string | null;
  renews_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────
// API payloads
// ─────────────────────────────────────────────

export interface IngestEventPayload {
  api_key: string;
  user_id: string;
  email?: string;
  name?: string;
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

export interface DailySummaryData {
  workspace: Workspace;
  emails_sent_today: number;
  conversion_rate_7d: number;
  revenue_this_week: number;
  stage_breakdown: Record<LifecycleStage, number>;
  new_signups_today: number;
}
