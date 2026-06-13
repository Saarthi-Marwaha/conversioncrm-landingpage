import { redirect } from "next/navigation";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { TestimonialWidget } from "@/components/TestimonialWidget";
import { PlanUsageBar } from "@/components/PlanUsageBar";
import { getQuotaState } from "@/lib/usage";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, userEmail } = await getActiveWorkspace();

  // No workspace (and auth not bypassed) — send to login
  if (!workspace) redirect("/login");

  // Hard plan gate — no plan chosen yet means no dashboard. There is no way
  // past /pricing for a logged-in workspace until a plan is selected.
  if (!workspace.plan) redirect("/pricing");

  const quota = await getQuotaState(workspace);

  return (
    <div className="min-h-screen lg:flex lg:h-screen bg-[#f4f8fc]">
      <DashboardSidebar workspace={workspace} userEmail={userEmail} />
      <main className="flex-1 lg:overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PlanUsageBar
            plan={quota.plan}
            used={quota.used}
            quota={quota.quota}
            percent={quota.percent}
          />
          {children}
        </div>
      </main>
      <TestimonialWidget />
    </div>
  );
}
