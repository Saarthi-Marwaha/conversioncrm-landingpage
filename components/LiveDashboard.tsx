"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { EmailTrigger, LifecycleStage } from "@/types";
import type { WeeklyScoreBreakdown } from "@/lib/scoring";
import { SCORE_LAYER_MAX } from "@/lib/scoring";
import {
  STAGE_EMAIL_COLUMNS,
  type UserEmailsSent,
} from "@/lib/emails/stage-email-columns";
import {
  Users,
  Eye,
  MousePointerClick,
  ChevronRight,
  Mail,
  FileText,
  Clock,
  Check,
  Search,
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

export type DashboardDateRange = "today" | "7d" | "30d";

const RANGE_STORAGE_KEY = "ccrm-dashboard-range";
const NAVY = "text-[#0b3a5e]";

const STAGE_BADGE: Record<LifecycleStage, { label: string; class: string }> = {
  signup: { label: "Signup", class: "bg-sky-100 text-sky-800" },
  onboarding: { label: "Onboarding", class: "bg-amber-100 text-amber-700" },
  active: { label: "Active", class: "bg-emerald-100 text-emerald-700" },
  going_quiet: { label: "Going Quiet", class: "bg-orange-100 text-orange-700" },
  conversion_ready: { label: "Ready", class: "bg-blue-100 text-blue-800" },
  paid: { label: "Paid", class: "bg-emerald-100 text-emerald-800" },
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
  emails_sent: UserEmailsSent;
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
  workspace: {
    id: string;
    name: string;
    website_url: string | null;
    reply_to_configured?: boolean;
  };
  range: DashboardDateRange;
  filtered: boolean;
  emailBatch?: { sent: number; errors: string[] };
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

export function userDetailHref(userId: string): string {
  return `/dashboard/users/${encodeURIComponent(userId)}`;
}

function ScoreBadge({
  score,
  periodLabel = "7-day score",
}: {
  score: number;
  periodLabel?: string;
}) {
  const tier =
    score >= 70
      ? "bg-emerald-100 text-emerald-800"
      : score >= 40
        ? "bg-amber-100 text-amber-800"
        : "bg-gray-100 text-gray-600";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[2.25rem] px-2 py-0.5 rounded-full text-xs font-bold tabular-nums",
        tier
      )}
      title={`Engagement score (${periodLabel}): ${score}/100`}
    >
      {score}
    </span>
  );
}

function EmailSentTick({ sent, label }: { sent: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1",
        sent ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-300"
      )}
      title={sent ? "Email sent" : "Not sent yet"}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
      {label && <span className="text-[10px] font-medium">{label}</span>}
    </span>
  );
}

function StageBadge({ stage }: { stage: LifecycleStage }) {
  const badge = STAGE_BADGE[stage] ?? STAGE_BADGE.signup;
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
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
  ];

  return (
    <div className="inline-flex items-center rounded-xl bg-white shadow-soft p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
            range === opt.value
              ? "bg-sky-500 text-white"
              : "text-gray-500 hover:text-gray-800"
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

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

const POLL_MS = 5000;

function useLiveData(range: DashboardDateRange) {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoaded = useRef(false);

  const fetchData = useCallback(async () => {
    // Always load once; after that, don't burn requests while the tab is
    // in the background (visibilitychange refreshes on return).
    if (
      hasLoaded.current &&
      typeof document !== "undefined" &&
      document.hidden
    ) {
      return;
    }
    hasLoaded.current = true;
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
    const onVisible = () => {
      if (!document.hidden) fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  return { data, error, updatedAt };
}

function LiveBadge({ updatedAt }: { updatedAt: Date | null }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      Live
      {updatedAt && (
        <span className="text-emerald-600/70 font-normal hidden sm:inline">
          · {updatedAt.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
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
        "rounded-2xl p-4 sm:p-5 shadow-soft",
        highlight ? "bg-sky-100" : "bg-sky-50"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-sky-900">{label}</p>
        <Icon className="h-4 w-4 text-sky-400" />
      </div>
      <p
        className={cn(
          "text-xl sm:text-2xl font-bold mt-1.5 tabular-nums",
          NAVY
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Banners({ data }: { data: LiveData | null }) {
  if (!data) return null;
  return (
    <>
      {!data.filtered && (
        <div className="bg-amber-50 rounded-xl px-4 py-2.5 text-xs text-amber-700 shadow-soft">
          No website configured — showing all events.{" "}
          <a href="/dashboard/settings" className="underline hover:text-amber-900">
            Set your website URL in Settings
          </a>
        </div>
      )}
      {data.emailBatch && data.emailBatch.sent > 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-2.5 text-xs text-emerald-800 shadow-soft">
          <Check className="h-3.5 w-3.5" />
          Sent {data.emailBatch.sent} automated email
          {data.emailBatch.sent === 1 ? "" : "s"} this session.
        </div>
      )}
      {data.workspace.reply_to_configured === false && (
        <div className="bg-amber-50 rounded-xl px-4 py-2.5 text-xs text-amber-800 shadow-soft">
          Add your reply-to email in{" "}
          <a href="/dashboard/settings" className="underline">
            Settings
          </a>{" "}
          to enable automated emails.
        </div>
      )}
    </>
  );
}

/* ── Mobile card list (shared) ───────────────────────────── */
function UserCardList({ users }: { users: LiveUser[] }) {
  const router = useRouter();
  return (
    <ul className="divide-y divide-gray-50 sm:hidden">
      {users.map((u) => (
        <li key={u.user_id}>
          <button
            type="button"
            onClick={() => router.push(userDetailHref(u.user_id))}
            className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-sky-50 transition-colors"
          >
            <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {(u.email ?? u.user_id).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {u.email ?? u.user_id}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {u.total_clicks} clicks ·{" "}
                {u.total_time_seconds > 0
                  ? formatDuration(u.total_time_seconds)
                  : "0s"}{" "}
                · {formatDistanceToNow(new Date(u.last_seen), { addSuffix: true })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <ScoreBadge score={u.engagement_score} />
              <StageBadge stage={u.stage} />
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── Overview ────────────────────────────────────────────── */
export function LiveDashboard() {
  const [range, setRange] = useDateRange();
  const { data, error, updatedAt } = useLiveData(range);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Live Overview
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time activity · {rangeLabel(data?.range ?? range)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DateRangeToggle range={range} onChange={setRange} />
          <LiveBadge updatedAt={updatedAt} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 shadow-soft">
          Couldn&apos;t reach the live feed: {error}
        </div>
      )}

      <Banners data={data} />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Metric
          label="Tracked Users"
          value={data?.totals.users ?? "—"}
          icon={Users}
          highlight
        />
        <Metric
          label="Page Views"
          value={data ? formatCompact(data.totals.pageViews) : "—"}
          icon={Eye}
        />
        <Metric
          label="Total Clicks"
          value={data ? formatCompact(data.totals.totalClicks) : "—"}
          icon={MousePointerClick}
        />
        <Metric
          label="Time On Site"
          value={
            data?.totals.totalTimeSeconds
              ? formatDuration(data.totals.totalTimeSeconds)
              : "—"
          }
          icon={Clock}
        />
      </div>

      <OverviewUsersTable
        users={data?.users ?? null}
        scorePeriodLabel={scorePeriodLabel(data?.range ?? range)}
      />
    </div>
  );
}

/**
 * Overview table — the six glanceable columns. Tap or click a row to open
 * the user's full profile.
 */
function OverviewUsersTable({
  users,
  scorePeriodLabel = "7-day score",
}: {
  users: LiveUser[] | null;
  scorePeriodLabel?: string;
}) {
  const router = useRouter();

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Tracked users</h2>
        <span className="text-xs text-gray-400 truncate">
          {users ? `${users.length} total · ` : ""}tap a user for the full
          profile
        </span>
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
        <>
          <UserCardList users={users} />

          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-500 text-left text-xs font-semibold text-white">
                  <th className="px-4 py-3 font-semibold">Tracked User Id</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Total Clicks
                  </th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Time Spent
                  </th>
                  <th className="px-4 py-3 font-semibold text-center">
                    Score / 100
                  </th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => router.push(userDetailHref(u.user_id))}
                    title="Open full profile"
                    className="cursor-pointer transition-colors hover:bg-sky-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate max-w-[11rem] font-mono text-xs">
                          {u.user_id}
                        </span>
                        {u.is_anonymous && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            anon
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {u.email ? (
                        <span className="truncate max-w-[13rem] inline-block align-bottom">
                          {u.email}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {u.total_clicks > 0 ? u.total_clicks : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 text-xs tabular-nums whitespace-nowrap">
                      {u.total_time_seconds > 0
                        ? formatDuration(u.total_time_seconds)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge
                        score={u.engagement_score}
                        periodLabel={scorePeriodLabel}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={u.stage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Users page ──────────────────────────────────────────── */
type SortKey = "last_seen" | "score" | "clicks" | "time";

export function LiveUsersPanel() {
  const [range, setRange] = useDateRange();
  const { data, error, updatedAt } = useLiveData(range);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("last_seen");
  const periodLabel = scorePeriodLabel(data?.range ?? range);

  const filtered = useMemo(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    let list = data.users;
    if (q) {
      list = list.filter(
        (u) =>
          u.user_id.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case "score":
        sorted.sort((a, b) => b.engagement_score - a.engagement_score);
        break;
      case "clicks":
        sorted.sort((a, b) => b.total_clicks - a.total_clicks);
        break;
      case "time":
        sorted.sort((a, b) => b.total_time_seconds - a.total_time_seconds);
        break;
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        );
    }
    return sorted;
  }, [data, query, sortKey]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data
              ? `${data.totals.users} tracked · ${rangeLabel(data.range)}`
              : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DateRangeToggle range={range} onChange={setRange} />
          <LiveBadge updatedAt={updatedAt} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 shadow-soft">
          Couldn&apos;t reach the live feed: {error}
        </div>
      )}

      <Banners data={data} />

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or user id…"
            className="w-full bg-white rounded-xl shadow-soft pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-white rounded-xl shadow-soft px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          <option value="last_seen">Sort: Last seen</option>
          <option value="score">Sort: Score</option>
          <option value="clicks">Sort: Clicks</option>
          <option value="time">Sort: Time spent</option>
        </select>
      </div>

      <LiveUsersTable
        users={filtered}
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
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
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
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Tracked users</h2>
        <span className="text-xs text-gray-400 truncate">
          {users ? `${users.length} shown · ` : ""}click to expand ·
          double-click for the profile
        </span>
      </div>

      {!users && (
        <p className="px-4 py-12 text-center text-sm text-gray-400">Loading…</p>
      )}

      {users && users.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm text-gray-400">
            Nothing here — adjust the search, or trigger an event from the
            widget.
          </p>
        </div>
      )}

      {users && users.length > 0 && (
        <>
          <UserCardList users={users} />

          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sky-500 text-left text-xs font-semibold text-white">
                  <th className="px-3 py-3 font-semibold w-8"></th>
                  <th className="px-3 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold text-center">Score</th>
                  <th className="px-3 py-3 font-semibold text-right">Events</th>
                  <th className="px-3 py-3 font-semibold text-right">Time</th>
                  <th className="px-3 py-3 font-semibold text-right">Clicks</th>
                  <th className="px-3 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <UserRow
                    key={u.user_id}
                    user={u}
                    isSelected={selectedUserId === u.user_id}
                    onSelect={() => onSelectUser?.(u.user_id)}
                    showActivityInline={showActivityInline}
                    scorePeriodLabel={scorePeriodLabel}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function ScoreBreakdownTiles({
  breakdown,
}: {
  breakdown: WeeklyScoreBreakdown;
}) {
  const layers: [string, number, number][] = [
    ["Recency", breakdown.recency ?? 0, SCORE_LAYER_MAX.recency],
    ["Frequency", breakdown.frequency ?? 0, SCORE_LAYER_MAX.frequency],
    ["Depth", breakdown.depth ?? 0, SCORE_LAYER_MAX.depth],
    ["Key feature", breakdown.key_feature ?? 0, SCORE_LAYER_MAX.key_feature],
    ["Time", breakdown.time_spent ?? 0, SCORE_LAYER_MAX.time_spent],
    ["Intent", breakdown.buying_intent ?? 0, SCORE_LAYER_MAX.buying_intent],
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
      {layers.map(([label, pts, max]) => (
        <div key={label} className="bg-white rounded-lg shadow-soft px-2.5 py-2">
          <p className="text-gray-400">{label}</p>
          <p className={cn("font-semibold tabular-nums", NAVY)}>
            {pts}/{max}
          </p>
          <div className="mt-1 h-1 rounded-full bg-sky-50 overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-400"
              style={{ width: `${Math.min(100, (pts / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
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
        <a
          href={userDetailHref(user.user_id)}
          className="ml-auto text-sky-700 font-semibold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Full profile →
        </a>
      </div>

      <ScoreBreakdownTiles breakdown={user.score_breakdown} />

      {/* Automated email status (moved out of the main table) */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
          <Mail className="h-3.5 w-3.5 text-sky-500" />
          Automated emails
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STAGE_EMAIL_COLUMNS.map((col) => (
            <EmailSentTick
              key={`${col.stage}-${col.trigger}`}
              sent={user.emails_sent?.[col.trigger as EmailTrigger] ?? false}
              label={col.emailLabel}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
          <FileText className="h-3.5 w-3.5 text-sky-500" />
          Page analytics ({user.page_count} pages)
        </div>

        {user.pages.length === 0 ? (
          <p className="text-xs text-gray-400">No page data yet.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-sky-50 text-sky-900">
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
                              pageOpen && "rotate-90 text-sky-500"
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
                                  className="text-xs bg-white shadow-soft rounded px-2 py-0.5 text-gray-700"
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
            <Clock className="h-3.5 w-3.5 text-sky-500" />
            Recent activity
          </div>
          {user.activity.length === 0 ? (
            <p className="text-xs text-gray-400">No activity recorded.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {user.activity.slice(0, 15).map((ev, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-xs bg-white rounded-lg shadow-soft px-2.5 py-1.5"
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
  const router = useRouter();
  const expanded = isSelected;

  return (
    <>
      <tr
        onClick={onSelect}
        onDoubleClick={() => router.push(userDetailHref(user.user_id))}
        title="Click to expand · double-click for the full profile"
        className={cn(
          "cursor-pointer transition-colors select-none",
          isSelected ? "bg-sky-50/70" : "hover:bg-gray-50"
        )}
      >
        <td className="px-3 py-3 align-top">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              expanded && "rotate-90 text-sky-500"
            )}
          />
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <p className="text-sm text-gray-900 font-medium truncate max-w-[14rem]">
                {user.email ?? user.user_id}
              </p>
              <p className="text-[11px] text-gray-400 font-mono truncate max-w-[14rem]">
                {user.user_id}
              </p>
            </div>
            {user.is_anonymous && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                anon
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          <StageBadge stage={user.stage} />
        </td>
        <td className="px-3 py-3">
          <StatusBadges user={user} />
        </td>
        <td className="px-3 py-3 text-center">
          <ScoreBadge
            score={user.engagement_score}
            periodLabel={scorePeriodLabel}
          />
        </td>
        <td className="px-3 py-3 text-right text-gray-700 tabular-nums">
          {user.events}
        </td>
        <td className="px-3 py-3 text-right text-gray-700 text-xs tabular-nums whitespace-nowrap">
          {user.total_time_seconds > 0
            ? formatDuration(user.total_time_seconds)
            : "—"}
        </td>
        <td className="px-3 py-3 text-right text-gray-700 tabular-nums">
          {user.total_clicks > 0 ? user.total_clicks : "—"}
        </td>
        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">
          {formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-sky-50/40">
          <td colSpan={9} className="px-4 py-4">
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
