/**
 * Razorpay billing — recurring subscriptions for the ConversionCRM workspace.
 *
 * REST API + Basic auth (no SDK dependency). Flow:
 *   1. /api/checkout creates a subscription → Razorpay Checkout.js collects the
 *      mandate + first payment in the browser.
 *   2. /api/billing/verify checks the payment signature and activates the plan.
 *   3. /api/webhooks/razorpay keeps state in sync (renewals, cancellations,
 *      scheduled plan changes) using the subscription's plan_id.
 *
 * Plan changes (upgrades) are scheduled at `cycle_end` so the new plan only
 * starts once the current paid month is over.
 *
 * Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
 *      RAZORPAY_PLAN_BASIC / _PRO / _SCALE.
 */
import crypto from "crypto";
import { planById, type PlanId } from "@/lib/plans";

const API_BASE = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function rzp(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error(`[Razorpay] ${method} ${path} →`, res.status, JSON.stringify(data).slice(0, 200));
  return { ok: res.ok, status: res.status, data };
}

// ── Plan ↔ Razorpay plan_id mapping ──────────────────────────────────
/** Razorpay plan_id for a purchasable plan. */
export function razorpayPlanId(plan: PlanId): string | undefined {
  if (plan === "basic") return process.env.RAZORPAY_PLAN_BASIC;
  if (plan === "pro") return process.env.RAZORPAY_PLAN_PRO;
  if (plan === "scale") return process.env.RAZORPAY_PLAN_SCALE;
  return undefined;
}

/** Reverse lookup: a Razorpay plan_id → our plan + monthly email quota. */
export function planFromRazorpayPlanId(
  planId: string
): { plan: PlanId; quota: number } | null {
  if (planId === process.env.RAZORPAY_PLAN_BASIC)
    return { plan: "basic", quota: planById("basic").emailQuota };
  if (planId === process.env.RAZORPAY_PLAN_PRO)
    return { plan: "pro", quota: planById("pro").emailQuota };
  if (planId === process.env.RAZORPAY_PLAN_SCALE)
    return { plan: "scale", quota: planById("scale").emailQuota };
  return null;
}

// ── Subscriptions ────────────────────────────────────────────────────
export interface CreatedSubscription {
  id: string;
  shortUrl: string | null;
  status: string;
}

export async function createSubscription(params: {
  planId: string;
  workspaceId: string;
  plan: string;
  quota: number;
  notifyEmail?: string;
  totalCount?: number;
}): Promise<CreatedSubscription | null> {
  const { ok, data } = await rzp("/subscriptions", "POST", {
    plan_id: params.planId,
    total_count: params.totalCount ?? 120,
    quantity: 1,
    customer_notify: 1,
    notes: {
      workspace_id: params.workspaceId,
      plan: params.plan,
      email_quota: String(params.quota),
    },
  });
  if (!ok || !data?.id) return null;
  return { id: data.id, shortUrl: data.short_url ?? null, status: data.status };
}

export interface SubscriptionInfo {
  id: string;
  status: string;
  plan_id: string;
  current_end: number | null;
  notes: Record<string, string>;
}

export async function getSubscription(id: string): Promise<SubscriptionInfo | null> {
  const { ok, data } = await rzp(`/subscriptions/${id}`);
  if (!ok || !data?.id) return null;
  return {
    id: data.id,
    status: data.status,
    plan_id: data.plan_id,
    current_end: data.current_end ?? null,
    notes: data.notes ?? {},
  };
}

/**
 * Schedules a plan change on an existing subscription. With
 * `schedule_change_at: "cycle_end"` the new plan only takes effect once the
 * current paid month ends. Returns the subscription's current cycle end.
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  planId: string,
  scheduleChangeAt: "now" | "cycle_end" = "cycle_end"
): Promise<{ currentEnd: number | null } | null> {
  const { ok, data } = await rzp(`/subscriptions/${subscriptionId}`, "POST", {
    plan_id: planId,
    schedule_change_at: scheduleChangeAt,
    customer_notify: 1,
  });
  if (!ok) return null;
  return { currentEnd: data?.current_end ?? null };
}

/** Cancels a subscription (at cycle end by default). */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<boolean> {
  const { ok } = await rzp(`/subscriptions/${subscriptionId}/cancel`, "POST", {
    cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
  });
  return ok;
}

// ── Signature verification ───────────────────────────────────────────
function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verifies the Checkout.js handler signature for a subscription payment:
 * HMAC-SHA256(razorpay_payment_id + "|" + subscription_id, key_secret).
 */
export function verifyPaymentSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string | null
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return timingSafeHexEqual(expected, signature);
}

/** Verifies a webhook body signature (HMAC-SHA256, webhook secret). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeHexEqual(expected, signature);
}
