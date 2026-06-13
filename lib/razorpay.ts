/**
 * Razorpay billing — subscriptions for the ConversionCRM workspace itself.
 *
 * Implemented against Razorpay's REST API with `fetch` + Basic auth, so it
 * needs no extra npm dependency. The workspace owner subscribes to a plan
 * (Basic / Pro / Premium); Razorpay hosts the checkout (subscription
 * `short_url`); our webhook (/api/webhooks/razorpay) is the source of truth
 * that activates the plan.
 *
 * Required env (see .env.local / .env.example):
 *   RAZORPAY_KEY_ID          - API key id          (dashboard → API Keys)
 *   RAZORPAY_KEY_SECRET      - API key secret
 *   RAZORPAY_WEBHOOK_SECRET  - webhook signing secret (dashboard → Webhooks)
 *   RAZORPAY_PLAN_BASIC      - plan_id for the $20 / 20k plan
 *   RAZORPAY_PLAN_PRO        - plan_id for the $99 / 100k plan
 *   RAZORPAY_PLAN_PREMIUM    - plan_id for the $399 / 200k plan
 */
import crypto from "crypto";

const API_BASE = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export interface CreatedSubscription {
  id: string;
  shortUrl: string;
  status: string;
}

/**
 * Creates a Razorpay subscription for a workspace and returns the hosted
 * checkout URL. `workspaceId` + `plan` are stamped into the subscription
 * `notes` so the webhook can map the payment back to the workspace.
 */
export async function createSubscription(params: {
  planId: string;
  workspaceId: string;
  plan: string;
  notifyEmail?: string;
  /** Number of billing cycles to authorise (months). Defaults to 120 (10y). */
  totalCount?: number;
}): Promise<CreatedSubscription | null> {
  const res = await fetch(`${API_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: params.planId,
      total_count: params.totalCount ?? 120,
      quantity: 1,
      customer_notify: 1,
      notes: {
        workspace_id: params.workspaceId,
        plan: params.plan,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Razorpay] createSubscription failed:", res.status, body);
    return null;
  }

  const data = (await res.json()) as {
    id: string;
    short_url: string;
    status: string;
  };
  return { id: data.id, shortUrl: data.short_url, status: data.status };
}

/** Cancels a subscription (used when a customer downgrades). */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
    }
  );
  if (!res.ok) {
    console.error("[Razorpay] cancelSubscription failed:", res.status);
    return false;
  }
  return true;
}

/**
 * Verifies a Razorpay webhook signature (HMAC-SHA256 of the raw body using
 * the webhook secret). Returns true only on an exact, timing-safe match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}
