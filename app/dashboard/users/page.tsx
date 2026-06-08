import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getEndUsersByWorkspace } from "@/db/queries";
import { UserTable } from "@/components/UserTable";

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) redirect("/onboarding");

  const endUsers = await getEndUsersByWorkspace(workspace.id, 200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">
          {endUsers.length} user{endUsers.length !== 1 ? "s" : ""} tracked
        </p>
      </div>
      <UserTable users={endUsers} />
    </div>
  );
}
