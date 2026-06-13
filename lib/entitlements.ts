/**
 * Feature gating — "what's in the plan, nothing more, nothing less."
 *
 * The hard email-send quota lives in lib/usage.ts. This module covers the
 * non-quota capabilities each plan unlocks. Keep these checks at the few
 * real chokepoints (automated-email cron, custom composer, SMTP delivery)
 * rather than sprinkling them everywhere.
 */
import { planById, type Entitlement, type PlanId } from "@/lib/plans";

export function planEntitlements(plan: PlanId | string | null | undefined): Set<Entitlement> {
  return new Set(planById(plan).entitlements);
}

export function planAllows(
  plan: PlanId | string | null | undefined,
  feature: Entitlement
): boolean {
  return planEntitlements(plan).has(feature);
}

/** Human-readable reason used in upgrade prompts / skipped-email logs. */
export function upgradeMessage(feature: Entitlement): string {
  switch (feature) {
    case "automated_emails":
      return "Automated lifecycle emails are available on Basic and above.";
    case "custom_composer":
      return "The email composer is available on Basic and above.";
    case "custom_smtp":
      return "Sending from your own domain (SMTP) is available on Pro and above.";
    case "api_access":
      return "REST API access is available on Pro and above.";
    case "unlimited_sites":
      return "Multiple workspaces are available on Premium.";
    case "priority_support":
      return "Priority support is available on Premium.";
    default:
      return "Upgrade your plan to unlock this feature.";
  }
}
