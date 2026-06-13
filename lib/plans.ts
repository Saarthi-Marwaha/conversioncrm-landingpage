/**
 * ConversionCRM — plan catalogue (single source of truth).
 *
 * Dependency-free so it can be imported from the edge middleware, server
 * routes, and client components alike.
 *
 * ── PRICING & MARGIN ──────────────────────────────────────────────────
 * Our only variable cost is outbound email (Resend). Resend's monthly cost
 * to us, by volume (the figures the founder supplied):
 *
 *     volume      Resend cost      our price     gross margin
 *     ─────────────────────────────────────────────────────────
 *       1,000        $0              $0           — (free tier)
 *      20,000        ~$4 (pooled)    $20          ~80%
 *     100,000        $20             $99          ~80%
 *     200,000        $160            $399         ~60%
 *     500,000        $360            $850         ~58%
 *   1,000,000        $650            $1,500       ~57%
 *   1,500,000        $825            $1,950       ~58%
 *   2,500,000        $1,150          $2,700       ~57%
 *   2,500,000+       custom          Contact us   —
 *
 * Every paid step clears the 50–60% gross-margin target. Email cost is
 * pooled across all customers on one Resend account, so the marginal cost
 * of the small tiers is well under the tier list price (hence the high
 * margin on Basic/Pro). Higher volumes are priced at ~2.3× Resend cost.
 */

export type PlanId = "free" | "basic" | "pro" | "premium" | "enterprise";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in USD. `null` = custom / contact sales. */
  priceUsd: number | null;
  /** Hard monthly email-send cap. */
  emailQuota: number;
  /** Short marketing line. */
  blurb: string;
  recommended?: boolean;
  /** Feature bullets shown with a check. */
  features: string[];
  /** Bullets shown crossed-out (not in this plan). */
  notIncluded?: string[];
  /** Capability keys this plan unlocks (see lib/entitlements). */
  entitlements: Entitlement[];
  /** Env var holding the matching Razorpay plan_id (paid plans only). */
  razorpayPlanEnv?: string;
}

export type Entitlement =
  | "automated_emails"
  | "custom_composer"
  | "custom_smtp"
  | "api_access"
  | "unlimited_sites"
  | "priority_support";

export const SALES_EMAIL =
  process.env.NEXT_PUBLIC_SALES_EMAIL || "ceo.conversioncrm@gmail.com";

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    emailQuota: 1_000,
    blurb: "See who's using your product, live.",
    features: [
      "1,000 emails / month",
      "Live overview dashboard",
      "6-layer engagement scoring",
      "Lifecycle stages",
      "7-day event history",
      "Email & ticket support",
    ],
    notIncluded: [
      "Automated lifecycle emails",
      "Hand-written email composer",
      "Custom sending domain (SMTP)",
    ],
    entitlements: [],
  },
  basic: {
    id: "basic",
    name: "Basic",
    priceUsd: 20,
    emailQuota: 20_000,
    blurb: "Convert sign-ups with automated lifecycle emails.",
    features: [
      "20,000 emails / month",
      "Everything in Free",
      "Automated lifecycle emails",
      "Hand-written email composer",
      "Full user profiles & activity",
      "30-day event history",
    ],
    notIncluded: ["Custom sending domain (SMTP)", "REST API access"],
    entitlements: ["automated_emails", "custom_composer"],
    razorpayPlanEnv: "RAZORPAY_PLAN_BASIC",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 99,
    emailQuota: 100_000,
    blurb: "For products with real volume and their own domain.",
    recommended: true,
    features: [
      "100,000 emails / month",
      "Everything in Basic",
      "Custom sending domain (your SMTP)",
      "REST API & widget access",
      "90-day event history",
      "Priority support",
    ],
    notIncluded: ["Dedicated success manager"],
    entitlements: [
      "automated_emails",
      "custom_composer",
      "custom_smtp",
      "api_access",
    ],
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
  },
  premium: {
    id: "premium",
    name: "Premium",
    priceUsd: 399,
    emailQuota: 200_000,
    blurb: "Serious scale with a dedicated team behind you.",
    features: [
      "200,000 emails / month",
      "Everything in Pro",
      "Unlimited websites / workspaces",
      "1-year event history",
      "Dedicated success manager",
      "Priority SLA",
    ],
    entitlements: [
      "automated_emails",
      "custom_composer",
      "custom_smtp",
      "api_access",
      "unlimited_sites",
      "priority_support",
    ],
    razorpayPlanEnv: "RAZORPAY_PLAN_PREMIUM",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceUsd: null,
    emailQuota: 5_000_000,
    blurb: "Custom volume, infrastructure and pricing.",
    features: [
      "2.5M+ emails / month",
      "Everything in Premium",
      "Custom volume & pricing",
      "Dedicated infrastructure",
      "Custom contracts & invoicing",
    ],
    entitlements: [
      "automated_emails",
      "custom_composer",
      "custom_smtp",
      "api_access",
      "unlimited_sites",
      "priority_support",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = [
  "free",
  "basic",
  "pro",
  "premium",
  "enterprise",
];

export function planById(id: string | null | undefined): PlanDef {
  return (id && PLANS[id as PlanId]) || PLANS.free;
}

/** True when `a` is the same or a higher tier than `b`. */
export function planAtLeast(a: PlanId, b: PlanId): boolean {
  return PLAN_ORDER.indexOf(a) >= PLAN_ORDER.indexOf(b);
}

/** The plans the customer can buy directly (Razorpay). */
export const PURCHASABLE_PLANS: PlanId[] = ["basic", "pro", "premium"];

/**
 * The volume slider used on the pricing page.
 * Each stop maps a monthly email volume to its price and the plan it implies.
 * Volumes above Premium's 200k are quoted but routed to sales (Contact us).
 */
export interface VolumeStop {
  emails: number;
  /** Indicative monthly price (USD). `null` = custom. */
  priceUsd: number | null;
  plan: PlanId;
  /** Whether this stop is bought self-serve or routed to sales. */
  contactSales?: boolean;
}

export const VOLUME_STOPS: VolumeStop[] = [
  { emails: 1_000, priceUsd: 0, plan: "free" },
  { emails: 20_000, priceUsd: 20, plan: "basic" },
  { emails: 100_000, priceUsd: 99, plan: "pro" },
  { emails: 200_000, priceUsd: 399, plan: "premium" },
  { emails: 500_000, priceUsd: 850, plan: "premium", contactSales: true },
  { emails: 1_000_000, priceUsd: 1_500, plan: "premium", contactSales: true },
  { emails: 1_500_000, priceUsd: 1_950, plan: "premium", contactSales: true },
  { emails: 2_500_000, priceUsd: 2_700, plan: "premium", contactSales: true },
  { emails: 3_000_000, priceUsd: null, plan: "enterprise", contactSales: true },
];

export function formatEmails(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}k`;
  return String(n);
}

export function formatPrice(p: number | null): string {
  if (p === null) return "Custom";
  return `$${p.toLocaleString("en-US")}`;
}
