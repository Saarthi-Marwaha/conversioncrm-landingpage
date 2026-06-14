/**
 * POST /api/checkout  — body: { plan, emails? }
 *
 * Two paths:
 *  • No active subscription (Free / new)  → create a Razorpay subscription and
 *    return { subscriptionId, keyId } for Razorpay Checkout.js. The plan is
 *    activated by /api/billing/verify once payment succeeds.
 *  • Already subscribed (active paid plan) → schedule the plan change at the
 *    END of the current cycle (Razorpay schedule_change_at=cycle_end), so the
 *    new plan only starts once the current paid month is over.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId, updateWorkspacePlan } from "@/db/queries";
import {
  createSubscription,
  razorpayConfigured,
  razorpayPlanId,
  updateSubscriptionPlan,
} from "@/lib/razorpay";
import { PLANS, PURCHASABLE_PLANS, type PlanId } from "@/lib/plans";

const schema = z.object({
  plan: z.enum(["basic", "pro", "scale"]),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 422 });
  }
  const plan = parsed.data.plan as PlanId;

  if (!PURCHASABLE_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Plan not purchasable" }, { status: 422 });
  }

  const workspace = await getWorkspaceByOwnerId(user.id);
  if (!workspace) {
    return NextResponse.json({ error: "Complete setup first" }, { status: 404 });
  }

  const quota = PLANS[plan].emailQuota;

  // Pre-launch fallback: no gateway configured → activate immediately.
  if (!razorpayConfigured()) {
    await updateWorkspacePlan(workspace.id, {
      plan,
      email_quota: quota,
      plan_status: "active",
      plan_selected_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, redirect: "/dashboard" });
  }

  const planId = razorpayPlanId(plan);
  if (!planId) {
    return NextResponse.json(
      { error: "This plan isn't configured for billing yet." },
      { status: 503 }
    );
  }

  const hasActiveSub =
    !!workspace.razorpay_subscription_id &&
    workspace.plan_status === "active" &&
    !!workspace.plan &&
    workspace.plan !== "free";

  // ── Already subscribed → schedule the change for the next cycle ──
  if (hasActiveSub) {
    const result = await updateSubscriptionPlan(
      workspace.razorpay_subscription_id!,
      planId,
      "cycle_end"
    );
    if (!result) {
      return NextResponse.json(
        { error: "Could not schedule the plan change. Please try again." },
        { status: 502 }
      );
    }
    const startsAt = result.currentEnd
      ? new Date(result.currentEnd * 1000).toISOString()
      : null;
    await updateWorkspacePlan(workspace.id, {
      pending_plan: plan,
      pending_plan_starts_at: startsAt,
    });
    return NextResponse.json({ scheduled: true, plan, startsAt });
  }

  // ── New subscription → Razorpay Checkout.js in the browser ──
  const subscription = await createSubscription({
    planId,
    workspaceId: workspace.id,
    plan,
    quota,
    notifyEmail: user.email ?? undefined,
  });
  if (!subscription) {
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }

  // Remember the (pending) subscription so the webhook can reconcile too.
  await updateWorkspacePlan(workspace.id, {
    razorpay_subscription_id: subscription.id,
    plan_status: "none",
  });

  return NextResponse.json({
    subscriptionId: subscription.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    plan,
  });
}
