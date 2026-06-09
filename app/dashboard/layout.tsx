import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { DashboardSidebar } from "@/components/DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, userEmail } = await getActiveWorkspace();

  // No workspace (and auth not bypassed) — send to login
  if (!workspace) redirect("/login");

  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar workspace={workspace} userEmail={userEmail} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
