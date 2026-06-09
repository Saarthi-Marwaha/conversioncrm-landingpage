import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { DEV_BYPASS_AUTH, TEST_WORKSPACE_ID } from "@/lib/flags";
import type { Workspace } from "@/types";

/**
 * Resolves the workspace to render in the dashboard.
 *
 * 1. If a user is logged in and owns a workspace → use it.
 * 2. Otherwise, when DEV_BYPASS_AUTH is on → fall back to the seeded
 *    test workspace so the dashboard works without signing in.
 * 3. Else → returns a null workspace (caller redirects to /login).
 */
export async function getActiveWorkspace(): Promise<{
  workspace: Workspace | null;
  userEmail: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createSupabaseAdminClient();

  if (user) {
    const { data } = await admin
      .from("workspaces")
      .select("*")
      .eq("owner_id", user.id)
      .single();
    if (data) {
      return { workspace: data as Workspace, userEmail: user.email ?? "" };
    }
  }

  if (DEV_BYPASS_AUTH) {
    const { data } = await admin
      .from("workspaces")
      .select("*")
      .eq("id", TEST_WORKSPACE_ID)
      .single();
    return {
      workspace: (data as Workspace) ?? null,
      userEmail: user?.email ?? "dev@localhost",
    };
  }

  return { workspace: null, userEmail: user?.email ?? "" };
}
