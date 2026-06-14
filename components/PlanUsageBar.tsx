import Link from "next/link";
import { AlertTriangle, Zap } from "lucide-react";
import { planById, type PlanId } from "@/lib/plans";

/**
 * Compact plan + monthly-email-usage strip shown at the top of every
 * dashboard page. Turns red and warns (without hiding any data) once the
 * workspace has exhausted its send quota for the month.
 */
export function PlanUsageBar({
  plan,
  used,
  quota,
  percent,
  rollover = 0,
}: {
  plan: PlanId;
  used: number;
  quota: number;
  percent: number;
  rollover?: number;
}) {
  const def = planById(plan);
  const overLimit = used >= quota;
  const nearLimit = !overLimit && percent >= 80;

  return (
    <div
      className={[
        "mb-6 rounded-lg border px-4 py-3 shadow-soft",
        overLimit
          ? "border-red-200 bg-red-50"
          : nearLimit
          ? "border-amber-200 bg-amber-50"
          : "border-sky-100 bg-white",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white">
            <Zap className="h-3.5 w-3.5" />
            {def.name}
          </span>
          <span className="text-[#0b3a5e] font-medium tabular-nums">
            {used.toLocaleString()} / {quota.toLocaleString()}
          </span>
          <span className="text-gray-400">emails this month</span>
          {rollover > 0 && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              +{rollover.toLocaleString()} rolled over
            </span>
          )}
        </div>

        <Link
          href="/pricing"
          className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 transition-colors"
        >
          {plan === "scale" || plan === "enterprise"
            ? "Manage plan"
            : "Upgrade"}
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
        <div
          className={[
            "h-full rounded-full transition-all",
            overLimit ? "bg-red-500" : nearLimit ? "bg-amber-500" : "bg-sky-500",
          ].join(" ")}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>

      {overLimit && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Email sending is paused for this month — you&apos;ve hit your plan
          limit. Your user data is still being collected. Upgrade to resume
          sending.
        </p>
      )}
      {nearLimit && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          You&apos;ve used {percent}% of this month&apos;s email allowance.
        </p>
      )}
    </div>
  );
}
