/**
 * ConversionCRM — plan catalogue (single source of truth).
 *
 * Dependency-free so it can be imported from the edge middleware, server
 * routes, and client components alike.
 *
 * ── VALUE MODEL ───────────────────────────────────────────────────────
 * Tiers scale on VALUE (depth of automation + tracked-user scale + team /
 * scaling features), not on email volume. Every tier — including Free —
 * sends the full set of behaviour-triggered emails and ships the tracking
 * snippet + REST API. Email is a generous *included* allowance; overage is
 * $0.90 / 1,000 (≈ Resend cost) so heavy senders never feel gouged.
 *
 *     tier        price     tracked users/mo   emails/mo   workspaces
 *     ──────────────────────────────────────────────────────────────────
 *     Free        $0          1,000             2,000        1
 *     Basic       $49         5,000             20,000       1
 *     Pro         $199        25,000            100,000      3   (recommended)
 *     Scale       $699        150,000           350,000      10
 *     Enterprise  custom      custom            custom       unlimited
 *
 * Email margin clears ≥55% at full usage on every paid tier (Resend cost
 * ≈ $90/100k, $0.90/1k overage).
 */

export type PlanId = "free" | "basic" | "pro" | "scale" | "enterprise";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in USD. `null` = custom / contact sales. */
  priceUsd: number | null;
  /** Monthly tracked-users allowance (the headline value metric). */
  trackedUsers: number | null;
  /** Included monthly email-send allowance. */
  emailQuota: number;
  /** Workspaces allowed. `null` = unlimited. */
  workspaces: number | null;
  /** Short marketing line. */
  blurb: string;
  recommended?: boolean;
  /** Delta feature bullets ("Everything in X" + what this tier adds). */
  features: string[];
  /** Bullets shown crossed-out (not in this plan). */
  notIncluded?: string[];
  /** Enforced capability keys this plan unlocks (see lib/entitlements). */
  entitlements: Entitlement[];
  /** Env var holding the matching Razorpay plan_id (paid plans only). */
  razorpayPlanEnv?: string;
}

/**
 * Only capabilities that are actually ENFORCED in code. (Marketing features
 * like A/B testing / attribution live in `features[]` until they ship.)
 */
export type Entitlement =
  | "automated_emails"
  | "custom_composer"
  | "custom_smtp"
  | "api_access"
  | "priority_access";

export const SALES_EMAIL =
  process.env.NEXT_PUBLIC_SALES_EMAIL || "ceo.conversioncrm@gmail.com";

// In EVERY plan, Free included: the tracking snippet + REST API, and the full
// set of behaviour-triggered (lifecycle) emails.
const ALWAYS_ON: Entitlement[] = ["api_access", "automated_emails"];

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    trackedUsers: 1_000,
    emailQuota: 2_000,
    workspaces: 1,
    blurb: "See the whole loop work — for real.",
    features: [
      "All 8 behaviour-triggered emails",
      "6-layer engagement scoring + lifecycle stages",
      "Auto-tracking + identify() / track()",
      "Tracking snippet + REST API key",
      "Live dashboard, user profiles & intent detection",
      "Guardrails: cooldowns, never email paying users",
    ],
    notIncluded: [
      "Send from your own domain (SMTP)",
      "Manual email composer",
      "A/B testing & revenue attribution",
    ],
    entitlements: [...ALWAYS_ON],
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceUsd: 49,
    trackedUsers: 5_000,
    emailQuota: 20_000,
    workspaces: 1,
    blurb: "Run conversion on autopilot, from your own brand.",
    features: [
      "Everything in Free",
      "Send from your own domain (SMTP)",
      "Custom sender name + reply-to",
      "Manual email composer (one-off & broadcasts)",
      "30-day event history",
      "2 seats",
    ],
    notIncluded: ["A/B testing", "Revenue attribution", "Upgrade-intent alerts"],
    entitlements: [...ALWAYS_ON, "custom_smtp", "custom_composer"],
    razorpayPlanEnv: "RAZORPAY_PLAN_BASIC",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 199,
    trackedUsers: 25_000,
    emailQuota: 100_000,
    workspaces: 3,
    blurb: "The full engine: optimise, attribute, and get alerted.",
    recommended: true,
    features: [
      "Everything in Basic",
      "A/B testing (subject + content)",
      "Revenue attribution",
      "Upgrade-intent alerts + team notifications",
      "In-app nudges + webhooks",
      "Behavioural segments · 90-day history",
      "3 workspaces · 5 seats",
    ],
    entitlements: [...ALWAYS_ON, "custom_smtp", "custom_composer"],
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceUsd: 699,
    trackedUsers: 150_000,
    emailQuota: 350_000,
    workspaces: 10,
    blurb: "Run it across products and teams.",
    features: [
      "Everything in Pro",
      "Multi-product + up to 10 sender brands",
      "Role-based access (RBAC)",
      "Activation + ROI dashboards",
      "Priority support + onboarding",
      "12-month history",
      "10 workspaces · 15 seats",
    ],
    entitlements: [...ALWAYS_ON, "custom_smtp", "custom_composer", "priority_access"],
    razorpayPlanEnv: "RAZORPAY_PLAN_SCALE",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceUsd: null,
    trackedUsers: null,
    emailQuota: 5_000_000,
    workspaces: null,
    blurb: "Security, control, and a team behind you.",
    features: [
      "Everything in Scale",
      "Custom tracked-users + email volume",
      "Unlimited workspaces + sender brands",
      "SSO / SAML + audit log",
      "SLA + security review + DPA",
      "Dedicated CSM + onboarding",
    ],
    entitlements: [...ALWAYS_ON, "custom_smtp", "custom_composer", "priority_access"],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "basic", "pro", "scale", "enterprise"];

export function planById(id: string | null | undefined): PlanDef {
  return (id && PLANS[id as PlanId]) || PLANS.free;
}

/** True when `a` is the same or a higher tier than `b`. */
export function planAtLeast(a: PlanId, b: PlanId): boolean {
  return PLAN_ORDER.indexOf(a) >= PLAN_ORDER.indexOf(b);
}

/** The plans the customer can buy directly (Razorpay). */
export const PURCHASABLE_PLANS: PlanId[] = ["basic", "pro", "scale"];

export function formatEmails(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
}

export function formatCount(n: number | null): string {
  if (n === null) return "Custom";
  return n.toLocaleString("en-US");
}

export function formatPrice(p: number | null): string {
  if (p === null) return "Custom";
  return `$${p.toLocaleString("en-US")}`;
}
