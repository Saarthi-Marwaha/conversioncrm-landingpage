/**
 * POST /api/webhooks/razorpay
 *
 * Source of truth for a workspace's subscription state. Signature verified
 * via HMAC-SHA256 against RAZORPAY_WEBHOOK_SECRET.
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks with these events:
 *   subscription.activated  subscription.charged    subscription.completed
 *   subscription.cancelled  subscription.halted     subscription.pending
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
  getWorkspaceByRazorpaySubscription,
  updateWorkspacePlan,
} from "@/db/queries";
import { planById, type PlanId } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[Razorpay webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: RazorpayEvent;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event;
  const sub = payload.payload?.subscription?.entity;
  if (!event || !sub) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  console.log(`[Razorpay webhook] ${event} sub=${sub.id} status=${sub.status}`);

  // Resolve the workspace: prefer notes, fall back to the stored sub id.
  const workspaceId =
    sub.notes?.workspace_id ||
    (await getWorkspaceByRazorpaySubscription(sub.id))?.id;
  if (!workspaceId) {
    console.warn("[Razorpay webhook] could not map subscription to workspace");
    return NextResponse.json({ ok: true, unmapped: true });
  }

  const plan = (sub.notes?.plan as PlanId) || "pro";
  const quota = planById(plan).emailQuota;
  const renewsAt = sub.current_end
    ? new Date(sub.current_end * 1000).toISOString()
    : null;

  try {
    switch (event) {
      case "subscription.activated":
      case "subscription.charged":
      case "subscription.resumed":
      case "subscription.updated": {
        await updateWorkspacePlan(workspaceId, {
          plan,
          email_quota: quota,
          plan_status: "active",
          plan_selected_at: new Date().toISOString(),
          razorpay_subscription_id: sub.id,
          plan_renews_at: renewsAt,
        });
        break;
      }
      case "subscription.pending":
      case "subscription.halted": {
        await updateWorkspacePlan(workspaceId, {
          plan_status: "past_due",
          plan_renews_at: renewsAt,
        });
        break;
      }
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.expired": {
        // Keep access until the paid period ends; lib/usage downgrades to
        // Free once plan_renews_at has passed.
        await updateWorkspacePlan(workspaceId, {
          plan_status: "cancelled",
          plan_renews_at: renewsAt,
        });
        break;
      }
      default:
        // Unhandled event — acknowledge so Razorpay stops retrying.
        break;
    }
  } catch (err) {
    console.error(`[Razorpay webhook] error handling ${event}:`, err);
    // 200 to avoid noisy retries on transient DB errors.
    return NextResponse.json({ ok: false, error: String(err) });
  }

  return NextResponse.json({ ok: true });
}

// ── Minimal typing for the bits of the payload we read ──
interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  current_end?: number;
  notes?: { workspace_id?: string; plan?: string };
}
interface RazorpayEvent {
  event: string;
  payload?: {
    subscription?: { entity: RazorpaySubscriptionEntity };
  };
}
