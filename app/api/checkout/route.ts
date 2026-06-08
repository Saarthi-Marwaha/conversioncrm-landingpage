/**
 * POST /api/checkout
 *
 * Creates a Lemon Squeezy checkout session for a given end user.
 * Returns the checkout URL for redirect.
 * Requires the user to be authenticated (dashboard session).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { getWorkspaceByOwnerId } from "@/db/queries";

const schema = z.object({
  end_user_id: z.string().uuid(),
  variant_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  }

  const { end_user_id, variant_id } = parsed.data;
  const variantId =
    variant_id ??
    process.env.LEMONSQUEEZY_VARIANT_STARTER!;

  const workspace = await getWorkspaceByOwnerId(user.id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Fetch end user details to pre-fill the checkout
  const admin = createSupabaseAdminClient();
  const { data: endUser } = await admin
    .from("end_users")
    .select("email, name")
    .eq("id", end_user_id)
    .eq("workspace_id", workspace.id)
    .single();

  if (!endUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const checkoutUrl = await createCheckoutUrl({
    variantId,
    userEmail: endUser.email,
    userName: endUser.name ?? undefined,
    customData: {
      workspace_id: workspace.id,
      end_user_id,
    },
  });

  if (!checkoutUrl) {
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: checkoutUrl });
}
