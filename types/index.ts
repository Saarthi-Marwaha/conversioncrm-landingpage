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
  | "usage_limit_hit"
  | "custom";

export type EmailTrigger =
  | "welcome"
  | "feature_nudge"
  | "value_demo"
  | "check_in"
  | "upgrade_offer"
  | "urgency"
  | "churn_prevention"
  | "limit_upgrade"
  | "daily_summary"
  | "custom";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

// ─────────────────────────────────────────────
// Database row shapes (mirrors Supabase schema)
// ─────────────────────────────────────────────

export type EmailProvider = "resend" | "smtp";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string | null;
  api_key: string;
  product_name: string | null;
  website_url: string | null;
  reply_to_email: string | null;
  email_sender_name: string | null;
  emails_last_run_at: string | null;
  key_feature_name: string | null;
  key_feature_event: string | null;
  key_feature_url: string | null;
  trial_length_days: number;
  email_provider: EmailProvider | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  smtp_secure: boolean | null;
  smtp_from_email: string | null;
  // ── Billing (Razorpay) ──
  /** null = the owner hasn't chosen a plan yet (gated to /pricing). */
  plan: "free" | "basic" | "pro" | "scale" | "enterprise" | null;
  /** Monthly email cap; null falls back to the plan default. */
  email_quota: number | null;
  plan_status: "active" | "past_due" | "cancelled" | "none" | null;
  plan_selected_at: string | null;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  plan_renews_at: string | null;
  /** Unused emails carried into the current period from the previous one. */
  rollover_emails: number | null;
  /** First day (UTC) of the period rollover was last reconciled for. */
  usage_period: string | null;
  /** A scheduled upgrade that starts when the current paid month ends. */
  pending_plan: "free" | "basic" | "pro" | "scale" | "enterprise" | null;
  pending_plan_starts_at: string | null;
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
  user_id: string | null;
  end_user_id: string | null;
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
