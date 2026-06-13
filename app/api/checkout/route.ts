/**
 * POST /api/checkout
 *
 * Starts a Razorpay subscription for the signed-in workspace owner and
 * returns the hosted checkout URL. The webhook (/api/webhooks/razorpay) is
 * what actually activates the plan once payment is authorised.
 *
 * Body: { plan: "basic" | "pro" | "premium" }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId, updateWorkspacePlan } from "@/db/queries";
import { createSubscription, razorpayConfigured } from "@/lib/razorpay";
import { PLANS, PURCHASABLE_PLANS, type PlanId } from "@/lib/plans";

const schema = z.object({
  plan: z.enum(["basic", "pro", "premium"]),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
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

  if (!razorpayConfigured()) {
    return NextResponse.json(
      {
        error:
          "Billing isn't configured yet. Add your Razorpay keys to .env.local (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_PLAN_*).",
      },
      { status: 503 }
    );
  }

  const planEnv = PLANS[plan].razorpayPlanEnv!;
  const planId = process.env[planEnv];
  if (!planId) {
    return NextResponse.json(
      { error: `Missing ${planEnv} in environment.` },
      { status: 503 }
    );
  }

  const subscription = await createSubscription({
    planId,
    workspaceId: workspace.id,
    plan,
    notifyEmail: user.email ?? undefined,
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }

  // Record the pending subscription id so the webhook can reconcile even if
  // its notes are stripped. Plan stays inactive until the webhook confirms.
  await updateWorkspacePlan(workspace.id, {
    razorpay_subscription_id: subscription.id,
    plan_status: "none",
  });

  return NextResponse.json({ url: subscription.shortUrl });
}
