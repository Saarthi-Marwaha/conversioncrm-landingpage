import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 * Handles Supabase email confirmation and OAuth (Google) redirects.
 * First-time users (no workspace yet) go straight into the setup wizard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const admin = createSupabaseAdminClient();
        const { data: workspace } = await admin
          .from("workspaces")
          .select("id, plan")
          .eq("owner_id", user.id)
          .maybeSingle();
        // Mandatory funnel: set up → choose a plan → dashboard.
        if (!workspace) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
        if (!workspace.plan) {
          return NextResponse.redirect(`${origin}/pricing`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
