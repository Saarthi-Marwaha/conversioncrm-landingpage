"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import type { LifecycleStage } from "@/types";
import { SCORE_LAYER_MAX, type WeeklyScoreBreakdown } from "@/lib/scoring";
import {
  ArrowLeft,
  Activity,
  Clock,
  Eye,
  FileText,
  LogIn,
  Mail,
  MousePointerClick,
  Send,
  TrendingUp,
  Trophy,
  UserPlus,
  CalendarDays,
  ChevronDown,
} from "lucide-react";

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

const TRIGGER_LABELS: Record<string, string> = {
  welcome: "Welcome",
  feature_nudge: "Feature nudge",
  value_demo: "Value demo",
  check_in: "Check-in",
  upgrade_offer: "Upgrade offer",
  urgency: "Urgency",
  churn_prevention: "Win-back",
  limit_upgrade: "Limit upgrade",
  daily_summary: "Daily summary",
  custom: "Composed",
};

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  welcome: "Automated welcome sent right after signup.",
  feature_nudge: "Automated nudge to try the key feature.",
  value_demo: "Automated email showing the value they unlocked.",
  check_in: "Automated check-in after the user went quiet.",
  upgrade_offer: "Automated upgrade offer for a conversion-ready user.",
  urgency: "Automated urgency follow-up after a pricing visit.",
  churn_prevention: "Automated win-back after churn.",
  limit_upgrade: "Automated upgrade email after a usage limit was hit.",
  daily_summary: "Workspace daily summary.",
  custom: "Hand-written email sent from the composer.",
};

type ClickTarget = { label: string; count: number };

type PageStats = {
  page: string;
  title: string | null;
  views: number;
  time_seconds: number;
  clicks: number;
  click_targets: ClickTarget[];
};

type SentEmail = {
  trigger: string;
  subject: string;
  status: string;
  sent_at: string;
  html: string | null;
  body_text: string | null;
};

type DetailUser = {
  user_id: string;
  email: string | null;
  stage: LifecycleStage;
  is_anonymous: boolean;
  signed_up: boolean;
  logged_in: boolean;
  engagement_score: number;
  score_breakdown: WeeklyScoreBreakdown;
  first_seen: string | null;
  last_seen: string | null;
  totals: {
    events: number;
    page_views: number;
    clicks: number;
    time_seconds: number;
    pages: number;
    active_days: number;
  };
  pages: PageStats[];
  activity: {
    event_type: string;
    page: string | null;
    occurred_at: string;
    detail: string | null;
  }[];
  emails: SentEmail[];
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
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
  if (/login|sign[_-]?in/i.test(type)) return "text-sky-600 bg-sky-50";
  if (type === "page_time") return "text-amber-600 bg-amber-50";
  if (type === "click") return "text-blue-700 bg-blue-50";
  if (/page[_-]?view/i.test(type)) return "text-gray-500 bg-gray-100";
  return "text-sky-700 bg-sky-50";
}

function ScoreRing({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c;
  const color =
    score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#64748b";

  return (
    <div className="relative h-24 w-24 flex-shrink-0">
      <svg viewBox="0 0 84 84" className="h-24 w-24 -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#e2effa" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold tabular-nums", NAVY)}>
          {score}
        </span>
        <span className="text-[10px] text-gray-400 font-medium">/ 100</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl bg-sky-50 p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-sky-900">{label}</p>
        <Icon className="h-4 w-4 text-sky-400" />
      </div>
      <p className={cn("text-2xl font-bold mt-1.5 tabular-nums", NAVY)}>
        {value}
      </p>
    </div>
  );
}

const LAYER_INFO: {
  key: keyof typeof SCORE_LAYER_MAX;
  label: string;
  hint: string;
}[] = [
  { key: "recency", label: "Recency", hint: "How recently they were active" },
  { key: "frequency", label: "Frequency", hint: "Distinct active days this week" },
  { key: "depth", label: "Depth", hint: "Pages explored, clicks, event volume" },
  { key: "key_feature", label: "Key feature", hint: "Reached your aha-moment" },
  { key: "time_spent", label: "Time spent", hint: "Active time on site" },
  { key: "buying_intent", label: "Buying intent", hint: "Pricing visits, upgrade clicks, limits hit" },
];

function ScoreLayers({ breakdown }: { breakdown: WeeklyScoreBreakdown }) {
  return (
    <div className="space-y-3">
      {LAYER_INFO.map(({ key, label, hint }) => {
        const max = SCORE_LAYER_MAX[key];
        const raw = (breakdown as Record<string, number>)[key] ?? 0;
        const pct = Math.min(100, (raw / max) * 100);
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-semibold text-gray-800">
                {label}
                <span className="text-gray-400 font-normal ml-2">{hint}</span>
              </span>
              <span className={cn("font-bold tabular-nums", NAVY)}>
                {raw}/{max}
              </span>
            </div>
            <div className="h-2 rounded-full bg-sky-50 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmailHistory({ emails }: { emails: SentEmail[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (emails.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">
        No emails sent to this user yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {emails.map((em, i) => {
        const open = openIdx === i;
        const expandable = !!em.html || !!em.body_text;
        return (
          <div key={i} className="py-3">
            <button
              type="button"
              onClick={() => expandable && setOpenIdx(open ? null : i)}
              className={cn(
                "w-full text-left flex items-start gap-3",
                expandable && "cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center",
                  em.status === "sent"
                    ? "bg-sky-50 text-sky-600"
                    : "bg-red-50 text-red-500"
                )}
              >
                <Mail className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                    {TRIGGER_LABELS[em.trigger] ?? em.trigger}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      em.status === "sent"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                    )}
                  >
                    {em.status}
                  </span>
                  <time className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
                    {format(new Date(em.sent_at), "d MMM yyyy, HH:mm")}
                  </time>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                  {em.subject}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {TRIGGER_DESCRIPTIONS[em.trigger] ?? "Automated email."}
                  {expandable && (
                    <span className="text-sky-600 font-medium ml-1 inline-flex items-center gap-0.5">
                      {open ? "Hide content" : "View what was sent"}
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </span>
                  )}
                </p>
              </div>
            </button>
            {open && em.html && (
              <iframe
                title={`email-${i}`}
                sandbox=""
                srcDoc={em.html}
                className="mt-3 w-full h-80 rounded-lg shadow-soft bg-white"
              />
            )}
            {open && !em.html && em.body_text && (
              <pre className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                {em.body_text}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function UserDetail({ userId }: { userId: string }) {
  const [user, setUser] = useState<DetailUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchUser = useCallback(async () => {
    if (
      hasLoadedRef.current &&
      typeof document !== "undefined" &&
      document.hidden
    ) {
      return;
    }
    hasLoadedRef.current = true;
    try {
      const res = await fetch(
        `/api/dashboard/user?id=${encodeURIComponent(userId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setUser(json.user as DetailUser);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
    const t = setInterval(fetchUser, 15000);
    return () => clearInterval(t);
  }, [fetchUser]);

  const stageBadge = user ? STAGE_BADGE[user.stage] ?? STAGE_BADGE.signup : null;
  const mostVisited = user?.pages[0] ?? null;

  return (
    <div className="bg-dotted -mx-4 sm:-mx-6 -my-6 sm:-my-8 px-4 sm:px-6 py-6 sm:py-8 min-h-full">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Link>
          {user?.email && (
            <Link
              href={`/dashboard/composer?to=${encodeURIComponent(user.email)}&uid=${encodeURIComponent(user.user_id)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition-colors shadow-sm"
            >
              <Send className="h-4 w-4" />
              Compose email
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3">
            Couldn&apos;t load this user: {error}
          </div>
        )}

        {!user && !error && (
          <div className="card p-12 text-center text-sm text-gray-400">
            Loading profile…
          </div>
        )}

        {user && (
          <>
            {/* ── Identity card ─────────────────────────── */}
            <div className="card p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="h-14 w-14 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {(user.email ?? user.user_id).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-bold text-gray-900 truncate">
                        {user.email ?? user.user_id}
                      </h1>
                      {stageBadge && (
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            stageBadge.class
                          )}
                        >
                          {stageBadge.label}
                        </span>
                      )}
                      {user.is_anonymous && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          anon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-1 truncate">
                      {user.user_id}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                      {user.first_seen && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-gray-400" />
                          First seen{" "}
                          {format(new Date(user.first_seen), "d MMM yyyy")}
                        </span>
                      )}
                      {user.last_seen && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          Last seen{" "}
                          {formatDistanceToNow(new Date(user.last_seen), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                      <span>
                        {user.signed_up
                          ? "Signed up"
                          : user.logged_in
                            ? "Logged in"
                            : "Visitor"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5 sm:pl-6 sm:border-l sm:border-sky-100">
                  <ScoreRing score={user.engagement_score} />
                  <div className="text-xs text-gray-500 max-w-[10rem]">
                    <p className={cn("font-semibold", NAVY)}>Engagement score</p>
                    <p className="mt-1">
                      Six-layer score from the last 7 days of activity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Stat cards ────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Total Clicks"
                value={user.totals.clicks}
                icon={MousePointerClick}
              />
              <StatCard
                label="Time Spent"
                value={
                  user.totals.time_seconds > 0
                    ? formatDuration(user.totals.time_seconds)
                    : "—"
                }
                icon={Clock}
              />
              <StatCard
                label="Page Views"
                value={user.totals.page_views}
                icon={Eye}
              />
              <StatCard label="Events" value={user.totals.events} icon={Activity} />
              <StatCard
                label="Pages Visited"
                value={user.totals.pages}
                icon={FileText}
              />
              <StatCard
                label="Active Days"
                value={user.totals.active_days}
                icon={TrendingUp}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                {/* ── Score layers ──────────────────────── */}
                <div className="card p-5 sm:p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">
                    Score breakdown — 6 layers
                  </h2>
                  <ScoreLayers breakdown={user.score_breakdown} />
                  <p className="text-[11px] text-gray-400 mt-4">
                    {user.score_breakdown.total_seconds > 0 &&
                      `${formatDuration(user.score_breakdown.total_seconds)} tracked this week · `}
                    {user.score_breakdown.distinct_pages} distinct pages ·{" "}
                    {user.score_breakdown.active_days} active days
                  </p>
                </div>

                {/* ── Pages ─────────────────────────────── */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <h2 className="text-sm font-semibold text-gray-900">
                      Most visited pages
                    </h2>
                    {mostVisited && (
                      <span className="text-xs text-gray-400 truncate ml-auto max-w-[14rem]">
                        Top: <span className="font-mono">{mostVisited.page}</span>
                      </span>
                    )}
                  </div>
                  {user.pages.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-gray-400 text-center">
                      No page data in the last 30 days.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[28rem]">
                      <thead>
                        <tr className="bg-sky-500 text-white text-xs">
                          <th className="text-left px-4 py-2.5 font-semibold w-10">#</th>
                          <th className="text-left px-4 py-2.5 font-semibold">Page</th>
                          <th className="text-right px-4 py-2.5 font-semibold">Views</th>
                          <th className="text-right px-4 py-2.5 font-semibold">Time</th>
                          <th className="text-right px-4 py-2.5 font-semibold">Clicks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {user.pages.slice(0, 12).map((p, i) => (
                          <tr key={p.page} className={i === 0 ? "bg-sky-50/60" : ""}>
                            <td className="px-4 py-2.5">
                              <span
                                className={cn(
                                  "inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold",
                                  i === 0
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-gray-100 text-gray-500"
                                )}
                              >
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-mono text-xs text-gray-800 truncate max-w-[18rem]">
                                {p.page}
                              </p>
                              {p.title && (
                                <p className="text-xs text-gray-400 truncate max-w-[18rem]">
                                  {p.title}
                                </p>
                              )}
                              {p.click_targets.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {p.click_targets.slice(0, 4).map((c) => (
                                    <span
                                      key={c.label}
                                      className="text-[10px] bg-gray-50 rounded px-1.5 py-0.5 text-gray-500"
                                    >
                                      {c.label} ×{c.count}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                              {p.views || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 text-xs whitespace-nowrap">
                              {p.time_seconds > 0
                                ? formatDuration(p.time_seconds)
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                              {p.clicks || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {/* ── Emails sent ───────────────────────── */}
                <div className="card p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Emails sent
                    </h2>
                    <span className="text-xs text-gray-400">
                      {user.emails.length} total
                    </span>
                  </div>
                  <EmailHistory emails={user.emails} />
                </div>

                {/* ── Activity timeline ─────────────────── */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Full activity
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
                    {user.activity.length === 0 && (
                      <p className="px-6 py-8 text-center text-sm text-gray-400">
                        No activity recorded.
                      </p>
                    )}
                    {user.activity.map((ev, i) => {
                      const Icon = eventIcon(ev.event_type);
                      return (
                        <div key={i} className="px-5 py-2.5 flex items-start gap-3">
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
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
