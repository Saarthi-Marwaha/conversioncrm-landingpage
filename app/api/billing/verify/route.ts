/**
 * POST /api/billing/verify
 *
 * Called by the Razorpay Checkout.js success handler. Verifies the payment
 * signature, then activates the plan for the workspace. The webhook does the
 * same independently — whichever lands first wins, both are idempotent.
 *
 * Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId, updateWorkspacePlan } from "@/db/queries";
import {
  verifyPaymentSignature,
  getSubscription,
  planFromRazorpayPlanId,
} from "@/lib/razorpay";
import { planById, type PlanId } from "@/lib/plans";

const schema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
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
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }
  const {
    razorpay_payment_id: paymentId,
    razorpay_subscription_id: subId,
    razorpay_signature: signature,
  } = parsed.data;

  const workspace = await getWorkspaceByOwnerId(user.id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // The subscription must be the one we created for this workspace.
  if (workspace.razorpay_subscription_id !== subId) {
    return NextResponse.json({ error: "Subscription mismatch" }, { status: 403 });
  }

  if (!verifyPaymentSignature(paymentId, subId, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Resolve the plan from the subscription (plan_id authoritative; notes back-up).
  const sub = await getSubscription(subId);
  let plan: PlanId = (sub?.notes?.plan as PlanId) || (workspace.plan as PlanId) || "pro";
  let quota = Number(sub?.notes?.email_quota) || planById(plan).emailQuota;
  if (sub?.plan_id) {
    const mapped = planFromRazorpayPlanId(sub.plan_id);
    if (mapped) {
      plan = mapped.plan;
      quota = mapped.quota;
    }
  }

  await updateWorkspacePlan(workspace.id, {
    plan,
    email_quota: quota,
    plan_status: "active",
    plan_selected_at: new Date().toISOString(),
    plan_renews_at: sub?.current_end
      ? new Date(sub.current_end * 1000).toISOString()
      : null,
    pending_plan: null,
    pending_plan_starts_at: null,
  });

  // Land paying customers on the install guide so they can get the snippet
  // onto their site right away.
  return NextResponse.json({ ok: true, redirect: "/dashboard/guide?welcome=1" });
}
