import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { LiveDashboard } from "@/components/LiveDashboard";

export default async function DashboardPage() {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  return <LiveDashboard />;
}
