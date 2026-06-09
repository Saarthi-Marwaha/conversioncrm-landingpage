"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { LifecycleStage } from "@/types";
import {
  Users,
  Activity,
  UserPlus,
  LogIn,
  Eye,
  MousePointerClick,
  RefreshCw,
  ChevronRight,
  Mail,
  FileText,
  Clock,
} from "lucide-react";

type ClickTarget = { label: string; count: number };

type PageStats = {
  page: string;
  title: string | null;
  views: number;
  time_seconds: number;
  clicks: number;
  click_targets: ClickTarget[];
};

type UserActivity = {
  event_type: string;
  page: string | null;
  occurred_at: string;
  detail: string | null;
};

type WeeklyScoreBreakdown = {
  seen_this_week: number;
  key_feature_used: number;
  time_spent: number;
  pricing_page: number;
  total_seconds: number;
  total: number;
};

export type DashboardDateRange = "today" | "7d" | "30d";

const RANGE_STORAGE_KEY = "ccrm-dashboard-range";

const STAGE_BADGE: Record<LifecycleStage, { label: string; class: string }> = {
  signup: { label: "Signup", class: "bg-blue-100 text-blue-700" },
  onboarding: { label: "Onboarding", class: "bg-yellow-100 text-yellow-700" },
  active: { label: "Active", class: "bg-green-100 text-green-700" },
  going_quiet: { label: "Going Quiet", class: "bg-orange-100 text-orange-700" },
  conversion_ready: { label: "Ready", class: "bg-indigo-100 text-indigo-700" },
  paid: { label: "Paid", class: "bg-emerald-100 text-emerald-700" },
  churned: { label: "Churned", class: "bg-red-100 text-red-700" },
};

function rangeLabel(range: DashboardDateRange): string {
  switch (range) {
    case "today":
      return "Today";
    case "30d":
      return "Last 30 days";
    default:
      return "Last 7 days";
  }
}

function scorePeriodLabel(range: DashboardDateRange): string {
  switch (range) {
    case "today":
      return "Today's score";
    case "30d":
      return "30-day score";
    default:
      return "7-day score";
  }
}

type LiveUser = {
  user_id: string;
  email: string | null;
  stage: LifecycleStage;
  engagement_score: number;
  score_breakdown: WeeklyScoreBreakdown;
  events: number;
  first_seen: string;
  last_seen: string;
  last_event: string;
  last_page: string | null;
  signed_up: boolean;
  logged_in: boolean;
  is_anonymous: boolean;
  total_time_seconds: number;
  total_clicks: number;
  pages: PageStats[];
  page_count: number;
  activity: UserActivity[];
};

type LiveData = {
  workspace: { id: string; name: string; website_url: string | null };
  range: DashboardDateRange;
  filtered: boolean;
  users: LiveUser[];
  totals: {
    users: number;
    events: number;
    anonymousEvents: number;
    pageViews: number;
    totalClicks: number;
    identified: number;
    totalTimeSeconds: number;
  };
  serverTime: string;
};

function ScoreBadge({
  score,
  periodLabel = "7-day score",
}: {
  score: number;
  periodLabel?: string;
}) {
  const tier =
    score >= 70
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : score >= 40
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums border",
        tier
      )}
      title={`Engagement score (${periodLabel}): ${score}/100`}
    >
      {score}
    </span>
  );
}

function StageBadge({ stage }: { stage: LifecycleStage }) {
  const badge = STAGE_BADGE[stage];
  return (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
        badge.class
      )}
    >
      {badge.label}
    </span>
  );
}

function DateRangeToggle({
  range,
  onChange,
}: {
  range: DashboardDateRange;
  onChange: (range: DashboardDateRange) => void;
}) {
  const options: { value: DashboardDateRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last month" },
  ];

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            range === opt.value
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function useDateRange() {
  const [range, setRange] = useState<DashboardDateRange>("7d");

  useEffect(() => {
    const stored = localStorage.getItem(RANGE_STORAGE_KEY);
    if (stored === "today" || stored === "7d" || stored === "30d") {
      setRange(stored);
    }
  }, []);

  const setAndStore = useCallback((next: DashboardDateRange) => {
    setRange(next);
    localStorage.setItem(RANGE_STORAGE_KEY, next);
  }, []);

  return [range, setAndStore] as const;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

const POLL_MS = 3000;

function useLiveData(range: DashboardDateRange) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/live?range=${range}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as LiveData;
      setData(json);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [range]);

  useEffect(() => {
    fetchData();
    timer.current = setInterval(fetchData, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [fetchData]);

  return { data, error, updatedAt };
}

function LiveBadge({ updatedAt }: { updatedAt: Date | null }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      Live
      {updatedAt && (
        <span className="text-emerald-600/70 font-normal">
          · updated {updatedAt.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

function eventIcon(type: string) {
  if (/sign[_-]?up|register/i.test(type)) return UserPlus;
  if (/login|sign[_-]?in/i.test(type)) return LogIn;
  if (type === "page_time") return Clock;
  if (type === "click") return MousePointerClick;
  if (/page[_-]?view/i.test(type)) return Eye;
  return Activity;
}

function eventColor(type: string) {
  if (/sign[_-]?up|register/i.test(type)) return "text-emerald-600 bg-emerald-50";
  if (/login|sign[_-]?in/i.test(type)) return "text-blue-600 bg-blue-50";
  if (type === "page_time") return "text-amber-600 bg-amber-50";
  if (type === "click") return "text-violet-600 bg-violet-50";
  if (/page[_-]?view/i.test(type)) return "text-gray-500 bg-gray-100";
  return "text-indigo-600 bg-indigo-50";
}

function Metric({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        highlight
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-white border-gray-100"
      )}
    >
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            highlight ? "text-indigo-100" : "text-gray-400"
          )}
        >
          {label}
        </p>
        <Icon
          className={cn("h-4 w-4", highlight ? "text-indigo-200" : "text-gray-300")}
        />
      </div>
      <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
    </div>
  );
}

function FilterBanner({ data }: { data: LiveData | null }) {
  if (!data) return null;
  if (data.filtered && data.workspace.website_url) {
    return (
      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2.5 text-xs text-indigo-700">
        <span className="h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" />
        <span>
          Showing events from <strong>{data.workspace.website_url}</strong> only.{" "}
          <a href="/dashboard/settings" className="underline hover:text-indigo-900">
            Change in Settings →
          </a>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 text-xs text-amber-700">
      <span>
        No website configured — showing all events.{" "}
        <a href="/dashboard/settings" className="underline hover:text-amber-900">
          Set your website URL in Settings
        </a>{" "}
        to filter to your production site only.
      </span>
    </div>
  );
}

/** Side panel: shows the selected user's recent activity, or an empty prompt. */
function UserActivityPanel({ user }: { user: LiveUser | null }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">
          {user ? "Recent activity" : "Activity"}
        </h2>
        {user && (
          <span className="text-xs text-gray-400 truncate ml-auto max-w-[10rem]">
            {user.email || user.user_id}
          </span>
        )}
      </div>

      {!user && (
        <div className="px-4 py-12 text-center">
          <MousePointerClick className="h-6 w-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            Select a user to see recent activity
          </p>
        </div>
      )}

      {user && (
        <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
          {user.activity.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              No activity recorded.
            </p>
          )}
          {user.activity.map((ev, i) => {
            const Icon = eventIcon(ev.event_type);
            return (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={cn(
                    "flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center",
                    eventColor(ev.event_type)
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 font-medium truncate">
                    {ev.detail || ev.event_type}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {ev.page ?? "—"}
                    {ev.detail && ev.event_type !== ev.detail ? (
                      <span className="text-gray-300"> · {ev.event_type}</span>
                    ) : null}
                  </p>
                </div>
                <time className="text-[11px] text-gray-400 whitespace-nowrap">
                  {formatDistanceToNow(new Date(ev.occurred_at), {
                    addSuffix: true,
                  })}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LiveDashboard() {
  const [range, setRange] = useDateRange();
  const { data, error, updatedAt } = useLiveData(range);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const selectedUser =
    data?.users.find((u) => u.user_id === selectedUserId) ?? null;
  const periodLabel = scorePeriodLabel(data?.range ?? range);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Overview</h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time activity · {rangeLabel(data?.range ?? range)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeToggle range={range} onChange={setRange} />
          <LiveBadge updatedAt={updatedAt} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">
          Couldn&apos;t reach the live feed: {error}
        </div>
      )}

      <FilterBanner data={data} />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric
          label="Tracked users"
          value={data?.totals.users ?? "—"}
          icon={Users}
          highlight
        />
        <Metric
          label="Page views"
          value={data?.totals.pageViews ?? "—"}
          icon={Eye}
        />
        <Metric
          label="Total clicks"
          value={data?.totals.totalClicks ?? "—"}
          icon={MousePointerClick}
        />
        <Metric
          label="Time on site"
          value={
            data?.totals.totalTimeSeconds
              ? formatDuration(data.totals.totalTimeSeconds)
              : "—"
          }
          icon={Clock}
        />
        <Metric
          label="Identified"
          value={data?.totals.identified ?? "—"}
          icon={UserPlus}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveUsersTable
            users={data?.users ?? null}
            selectedUserId={selectedUserId}
            onSelectUser={(id) =>
              setSelectedUserId((cur) => (cur === id ? null : id))
            }
            scorePeriodLabel={periodLabel}
          />
        </div>

        <UserActivityPanel user={selectedUser} />
      </div>
    </div>
  );
}

export function LiveUsersPanel() {
  const [range, setRange] = useDateRange();
  const { data, error, updatedAt } = useLiveData(range);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const periodLabel = scorePeriodLabel(data?.range ?? range);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data
              ? `${data.totals.users} tracked · ${rangeLabel(data.range)}`
              : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeToggle range={range} onChange={setRange} />
          <LiveBadge updatedAt={updatedAt} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">
          Couldn&apos;t reach the live feed: {error}
        </div>
      )}

      <FilterBanner data={data} />

      <LiveUsersTable
        users={data?.users ?? null}
        selectedUserId={selectedUserId}
        onSelectUser={(id) =>
          setSelectedUserId((cur) => (cur === id ? null : id))
        }
        showActivityInline
        scorePeriodLabel={periodLabel}
      />
    </div>
  );
}

function StatusBadges({ user }: { user: LiveUser }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {user.signed_up && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          Signed up
        </span>
      )}
      {user.logged_in && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          Logged in
        </span>
      )}
      {!user.signed_up && !user.logged_in && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          Visitor
        </span>
      )}
    </div>
  );
}

export function LiveUsersTable({
  users,
  selectedUserId,
  onSelectUser,
  showActivityInline,
  scorePeriodLabel = "7-day score",
}: {
  users: LiveUser[] | null;
  selectedUserId?: string | null;
  onSelectUser?: (id: string) => void;
  showActivityInline?: boolean;
  scorePeriodLabel?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Tracked users</h2>
        {users && (
          <span className="text-xs text-gray-400">{users.length} total</span>
        )}
      </div>

      {!users && (
        <p className="px-4 py-12 text-center text-sm text-gray-400">Loading…</p>
      )}

      {users && users.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-gray-400">
            No users tracked yet. Trigger an event from the widget and it will
            appear here within a few seconds.
          </p>
        </div>
      )}

      {users && users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2.5 font-medium w-8"></th>
                <th className="px-3 py-2.5 font-medium">User ID</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">Events</th>
                <th className="px-3 py-2.5 font-medium">Pages</th>
                <th className="px-3 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">Clicks</th>
                <th className="px-3 py-2.5 font-medium">Last activity</th>
                <th className="px-3 py-2.5 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const isSelected = selectedUserId === u.user_id;
                return (
                  <UserRow
                    key={u.user_id}
                    user={u}
                    isSelected={isSelected}
                    onSelect={() => onSelectUser?.(u.user_id)}
                    showActivityInline={showActivityInline}
                    scorePeriodLabel={scorePeriodLabel}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PageAnalyticsPanel({
  user,
  showActivityInline,
  scorePeriodLabel = "7-day score",
}: {
  user: LiveUser;
  showActivityInline?: boolean;
  scorePeriodLabel?: string;
}) {
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
        {user.email && (
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            {user.email}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          {formatDuration(user.total_time_seconds)} total on site
        </span>
        <span className="flex items-center gap-1.5">
          <MousePointerClick className="h-3.5 w-3.5 text-gray-400" />
          {user.total_clicks} clicks
        </span>
        <span className="flex items-center gap-1.5">
          <StageBadge stage={user.stage} />
        </span>
        <span className="flex items-center gap-1.5">
          <ScoreBadge
            score={user.engagement_score}
            periodLabel={scorePeriodLabel}
          />
          <span className="text-gray-500">{scorePeriodLabel}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {(
          [
            ["Seen", user.score_breakdown.seen_this_week, 30],
            ["Key feature", user.score_breakdown.key_feature_used, 30],
            ["Time", user.score_breakdown.time_spent, 20],
            ["Pricing", user.score_breakdown.pricing_page, 20],
          ] as const
        ).map(([label, pts, max]) => (
          <div
            key={label}
            className="bg-white rounded-md border border-gray-100 px-2.5 py-2"
          >
            <p className="text-gray-400">{label}</p>
            <p className="font-semibold text-gray-800 tabular-nums">
              {pts}/{max}
            </p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
          <FileText className="h-3.5 w-3.5 text-indigo-500" />
          Page analytics ({user.page_count} pages)
        </div>

        {user.pages.length === 0 ? (
          <p className="text-xs text-gray-400">No page data yet.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-3 py-2 font-medium w-6"></th>
                  <th className="text-left px-3 py-2 font-medium">Page</th>
                  <th className="text-right px-3 py-2 font-medium">Views</th>
                  <th className="text-right px-3 py-2 font-medium">Time</th>
                  <th className="text-right px-3 py-2 font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {user.pages.map((p) => {
                  const pageOpen = expandedPage === p.page;
                  return (
                    <Fragment key={p.page}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedPage(pageOpen ? null : p.page);
                        }}
                      >
                        <td className="px-3 py-2">
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 text-gray-400 transition-transform",
                              pageOpen && "rotate-90 text-indigo-500"
                            )}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-mono text-gray-800 truncate max-w-[16rem]">
                            {p.page}
                          </p>
                          {p.title && (
                            <p className="text-gray-400 truncate max-w-[16rem]">
                              {p.title}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {p.views || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 whitespace-nowrap">
                          {p.time_seconds > 0
                            ? formatDuration(p.time_seconds)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                          {p.clicks || "—"}
                        </td>
                      </tr>
                      {pageOpen && p.click_targets.length > 0 && (
                        <tr key={`${p.page}-clicks`} className="bg-gray-50/80">
                          <td colSpan={5} className="px-6 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                              Clicks on this page
                            </p>
                            <ul className="flex flex-wrap gap-1.5">
                              {p.click_targets.map((c) => (
                                <li
                                  key={c.label}
                                  className="text-xs bg-white border border-gray-100 rounded px-2 py-0.5 text-gray-700"
                                >
                                  {c.label}
                                  <span className="text-gray-400 ml-1">
                                    ×{c.count}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showActivityInline && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
            <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
            Recent activity
          </div>
          {user.activity.length === 0 ? (
            <p className="text-xs text-gray-400">No activity recorded.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {user.activity.slice(0, 15).map((ev, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-xs bg-white rounded-md border border-gray-100 px-2.5 py-1.5"
                >
                  <span className="font-medium text-gray-700 truncate">
                    {ev.detail || ev.event_type}
                    {ev.page ? (
                      <span className="text-gray-400 font-normal">
                        {" "}
                        · {ev.page}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-gray-400 whitespace-nowrap ml-2">
                    {formatDistanceToNow(new Date(ev.occurred_at), {
                      addSuffix: true,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  isSelected,
  onSelect,
  showActivityInline,
  scorePeriodLabel = "7-day score",
}: {
  user: LiveUser;
  isSelected: boolean;
  onSelect: () => void;
  showActivityInline?: boolean;
  scorePeriodLabel?: string;
}) {
  // The row is expanded when selected (single-click does select + expand)
  const expanded = isSelected;

  return (
    <>
      <tr
        onClick={onSelect}
        className={cn(
          "cursor-pointer transition-colors",
          isSelected ? "bg-indigo-50/70" : "hover:bg-gray-50"
        )}
      >
        <td className="px-3 py-3 align-top">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              expanded && "rotate-90 text-indigo-500"
            )}
          />
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate max-w-[10rem] font-mono text-xs">
              {user.user_id}
            </span>
            {user.is_anonymous && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                anon
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 text-gray-700">
          {user.email ? (
            <span className="truncate max-w-[12rem] inline-block align-bottom">
              {user.email}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
        <td className="px-3 py-3">
          <StageBadge stage={user.stage} />
        </td>
        <td className="px-3 py-3">
          <StatusBadges user={user} />
        </td>
        <td className="px-3 py-3">
          <ScoreBadge
            score={user.engagement_score}
            periodLabel={scorePeriodLabel}
          />
        </td>
        <td className="px-3 py-3 text-gray-700 tabular-nums">{user.events}</td>
        <td className="px-3 py-3 text-gray-700 tabular-nums">{user.page_count}</td>
        <td className="px-3 py-3 text-gray-700 text-xs tabular-nums whitespace-nowrap">
          {user.total_time_seconds > 0
            ? formatDuration(user.total_time_seconds)
            : "—"}
        </td>
        <td className="px-3 py-3 text-gray-700 tabular-nums">
          {user.total_clicks > 0 ? user.total_clicks : "—"}
        </td>
        <td className="px-3 py-3 text-gray-500 text-xs truncate max-w-[12rem]">
          <span className="font-medium text-gray-700">{user.last_event}</span>
          {user.last_page ? ` · ${user.last_page}` : ""}
        </td>
        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
          {formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-indigo-50/40">
          <td colSpan={12} className="px-4 py-4">
            <PageAnalyticsPanel
              user={user}
              showActivityInline={showActivityInline}
              scorePeriodLabel={scorePeriodLabel}
            />
          </td>
        </tr>
      )}
    </>
  );
}
