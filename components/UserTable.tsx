import type { EndUser, LifecycleStage } from "@/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const STAGE_BADGE: Record<LifecycleStage, { label: string; class: string }> = {
  signup: { label: "Signup", class: "bg-blue-100 text-blue-700" },
  onboarding: { label: "Onboarding", class: "bg-yellow-100 text-yellow-700" },
  active: { label: "Active", class: "bg-green-100 text-green-700" },
  going_quiet: { label: "Going Quiet", class: "bg-orange-100 text-orange-700" },
  conversion_ready: { label: "Ready", class: "bg-sky-100 text-sky-700" },
  paid: { label: "Paid", class: "bg-emerald-100 text-emerald-700" },
  churned: { label: "Churned", class: "bg-red-100 text-red-700" },
};

interface Props {
  users: EndUser[];
}

export function UserTable({ users }: Props) {
  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <p className="text-gray-400 text-sm">
          No users yet. Add the tracking widget to your app to start seeing users here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                User
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Stage
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Score
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Last seen
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                Trial ends
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => {
              const badge = STAGE_BADGE[user.stage as LifecycleStage];
              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.name ?? user.email}
                      </p>
                      {user.name && (
                        <p className="text-xs text-gray-400">{user.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        badge.class
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-sky-500 h-1.5 rounded-full"
                          style={{ width: `${user.engagement_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {user.engagement_score}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {user.last_seen_at
                      ? formatDistanceToNow(new Date(user.last_seen_at), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {user.trial_ends_at
                      ? formatDistanceToNow(new Date(user.trial_ends_at), {
                          addSuffix: true,
                        })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
