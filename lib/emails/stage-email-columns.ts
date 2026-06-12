import type { EmailTrigger, LifecycleStage } from "@/types";

/** Dashboard columns: lifecycle stage label + linked automated email type. */
export const STAGE_EMAIL_COLUMNS: {
  stage: LifecycleStage;
  stageLabel: string;
  trigger: EmailTrigger;
  emailLabel: string;
}[] = [
  { stage: "signup", stageLabel: "Signup", trigger: "welcome", emailLabel: "Welcome" },
  {
    stage: "onboarding",
    stageLabel: "Onboarding",
    trigger: "feature_nudge",
    emailLabel: "Nudge",
  },
  { stage: "active", stageLabel: "Active", trigger: "value_demo", emailLabel: "Value" },
  {
    stage: "going_quiet",
    stageLabel: "Going Quiet",
    trigger: "check_in",
    emailLabel: "Check-in",
  },
  {
    stage: "conversion_ready",
    stageLabel: "Ready",
    trigger: "upgrade_offer",
    emailLabel: "Upgrade",
  },
  {
    stage: "conversion_ready",
    stageLabel: "Ready",
    trigger: "urgency",
    emailLabel: "Urgency",
  },
  {
    stage: "churned",
    stageLabel: "Churned",
    trigger: "churn_prevention",
    emailLabel: "Win-back",
  },
  {
    stage: "active",
    stageLabel: "Limit",
    trigger: "limit_upgrade",
    emailLabel: "Limit",
  },
];

export type UserEmailsSent = Record<EmailTrigger, boolean>;

export const AUTOMATED_TRIGGERS: EmailTrigger[] = [
  "welcome",
  "feature_nudge",
  "value_demo",
  "check_in",
  "upgrade_offer",
  "urgency",
  "churn_prevention",
  "limit_upgrade",
];

export function emptyEmailsSent(): UserEmailsSent {
  return {
    welcome: false,
    feature_nudge: false,
    value_demo: false,
    check_in: false,
    upgrade_offer: false,
    urgency: false,
    churn_prevention: false,
    limit_upgrade: false,
    daily_summary: false,
    custom: false,
  };
}
