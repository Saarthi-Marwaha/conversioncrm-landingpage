import type { LifecycleStage } from "@/types";
import { cn } from "@/lib/utils";

const STAGE_CONFIG: Record<
  LifecycleStage,
  { label: string; color: string; bg: string }
> = {
  signup: { label: "New Signups", color: "text-blue-700", bg: "bg-blue-100" },
  onboarding: { label: "Onboarding", color: "text-yellow-700", bg: "bg-yellow-100" },
  active: { label: "Active", color: "text-green-700", bg: "bg-green-100" },
  going_quiet: { label: "Going Quiet", color: "text-orange-700", bg: "bg-orange-100" },
  conversion_ready: { label: "Conversion Ready", color: "text-sky-700", bg: "bg-sky-100" },
  paid: { label: "Paid", color: "text-emerald-700", bg: "bg-emerald-100" },
  churned: { label: "Churned", color: "text-red-700", bg: "bg-red-100" },
};

interface Props {
  stageCounts: Partial<Record<LifecycleStage, number>>;
  totalUsers: number;
}

export function StageBreakdownCard({ stageCounts, totalUsers }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Lifecycle Stage Breakdown
      </h2>

      <div className="space-y-3">
        {(Object.keys(STAGE_CONFIG) as LifecycleStage[]).map((stage) => {
          const count = stageCounts[stage] ?? 0;
          const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
          const cfg = STAGE_CONFIG[stage];

          return (
            <div key={stage} className="flex items-center gap-3">
              <div className="w-36 flex-shrink-0">
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    cfg.bg,
                    cfg.color
                  )}
                >
                  {cfg.label}
                </span>
              </div>

              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className={cn("h-2 rounded-full transition-all", cfg.bg.replace("bg-", "bg-").replace("-100", "-400"))}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="w-16 text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {count}
                </span>
                <span className="text-xs text-gray-400 ml-1">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
