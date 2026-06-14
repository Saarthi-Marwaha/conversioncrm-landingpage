/**
 * POST /api/billing/select-free
 *
 * Activates the Free plan for the signed-in workspace owner. This is how a
 * new user clears the mandatory plan gate without paying — they still have
 * to make an explicit choice, but Free needs no Razorpay round-trip.
 */
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceByOwnerId, updateWorkspacePlan } from "@/db/queries";
import { PLANS } from "@/lib/plans";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const workspace = await getWorkspaceByOwnerId(user.id);
  if (!workspace) {
    return NextResponse.json({ error: "Complete setup first" }, { status: 404 });
  }

  await updateWorkspacePlan(workspace.id, {
    plan: "free",
    email_quota: PLANS.free.emailQuota,
    plan_status: "active",
    plan_selected_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, redirect: "/dashboard/guide?welcome=1" });
}
