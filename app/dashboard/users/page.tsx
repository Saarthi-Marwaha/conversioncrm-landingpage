import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { LiveUsersPanel } from "@/components/LiveDashboard";

export default async function UsersPage() {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  return <LiveUsersPanel />;
}
