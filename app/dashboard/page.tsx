import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStageCounts, getConversionRate7d } from "@/db/queries";
import { StageBreakdownCard } from "@/components/StageBreakdownCard";
import { MetricCard } from "@/components/MetricCard";
import type { LifecycleStage } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) redirect("/onboarding");

  const [stageCounts, conversionRate] = await Promise.all([
    getStageCounts(workspace.id),
    getConversionRate7d(workspace.id),
  ]);

  const totalUsers = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const paidUsers = stageCounts["paid"] ?? 0;
  const readyToConvert = stageCounts["conversion_ready"] ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-500 text-sm mt-1">{workspace.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total users" value={totalUsers} />
        <MetricCard label="Paid users" value={paidUsers} highlight />
        <MetricCard label="Ready to convert" value={readyToConvert} />
        <MetricCard label="7-day conversion" value={`${conversionRate}%`} highlight />
      </div>

      <StageBreakdownCard
        stageCounts={stageCounts as Record<LifecycleStage, number>}
        totalUsers={totalUsers}
      />

      {/* Embed snippet reminder */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Tracking widget
          </h2>
          <a
            href="/dashboard/settings"
            className="text-sm text-indigo-600 hover:underline font-medium"
          >
            View setup →
          </a>
        </div>
        <p className="text-sm text-gray-500">
          API key:{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-700">
            {workspace.api_key}
          </code>
        </p>
      </div>
    </div>
  );
}
