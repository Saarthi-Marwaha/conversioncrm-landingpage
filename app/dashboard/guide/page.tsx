import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { CopyButton } from "@/components/CopyButton";
import {
  Code2,
  Activity,
  Gauge,
  GitBranch,
  Mail,
  ArrowDown,
  Sparkles,
  PartyPopper,
} from "lucide-react";

const NAVY = "text-[#0b3a5e]";

const PIPELINE = [
  {
    icon: Code2,
    title: "1 · Install the widget",
    text: "One script tag on your product. Page views, time on page, and clicks are tracked automatically; identify() ties events to a real user and email.",
  },
  {
    icon: Activity,
    title: "2 · Events stream in",
    text: "Every visit, click, and tracked action lands in your workspace within seconds and shows up live on the Overview.",
  },
  {
    icon: Gauge,
    title: "3 · Scoring runs",
    text: "A 6-layer engagement score (0–100) is computed from the last 7 days — live on the dashboard and nightly for automation.",
  },
  {
    icon: GitBranch,
    title: "4 · Stages assign",
    text: "Scores and inactivity rules sort every user into a lifecycle stage: Signup → Onboarding → Active → Ready → Paid (or Going Quiet / Churned).",
  },
  {
    icon: Mail,
    title: "5 · Emails convert",
    text: "Each stage has one matching automated email, sent at most once per day per user with per-email cooldowns. You can also compose one-off emails by hand.",
  },
];

const LAYERS: { name: string; max: number; how: string }[] = [
  {
    name: "Recency",
    max: 20,
    how: "Active today = 20 · within 1 day = 16 · within 3 days = 12 · within 7 days = 6.",
  },
  {
    name: "Frequency",
    max: 15,
    how: "Distinct active days this week: 1 day = 5 · 2 = 9 · 3 = 12 · 4+ = 15.",
  },
  {
    name: "Depth",
    max: 15,
    how: "Distinct pages (up to 6 pts), clicks (up to 5), overall event volume (up to 4).",
  },
  {
    name: "Key feature",
    max: 20,
    how: "Your aha moment: used once = 14 · three times = 20 · any feature_used = 8. Set it in Settings.",
  },
  {
    name: "Time spent",
    max: 15,
    how: "Tracked time on site with diminishing returns — 10 minutes earns full credit.",
  },
  {
    name: "Buying intent",
    max: 15,
    how: "Pricing visit = 7 (+3 if repeated) · upgrade click = +5 · usage limit hit = +3.",
  },
];

const BANDS: { range: string; label: string; chip: string; meaning: string }[] = [
  {
    range: "0",
    label: "Signup",
    chip: "bg-sky-100 text-sky-900",
    meaning: "Tracked but no scored activity yet — the welcome email goes out.",
  },
  {
    range: "1–30",
    label: "Onboarding",
    chip: "bg-sky-50 text-sky-700",
    meaning:
      "Poking around but hasn't hit the aha moment. Gets the feature nudge if 5 days pass without it.",
  },
  {
    range: "31–70",
    label: "Active",
    chip: "bg-sky-500 text-white",
    meaning:
      "Using the product regularly. Gets a value-demo email once they've explored enough (3+ page views in a week).",
  },
  {
    range: "71–100",
    label: "Conversion Ready",
    chip: "bg-[#0b3a5e] text-white",
    meaning:
      "Highly engaged — the best moment to ask. Gets the upgrade offer, or the urgency email if they visited pricing.",
  },
];

const RULES: { label: string; chip: string; meaning: string }[] = [
  {
    label: "Going Quiet",
    chip: "bg-white text-gray-600 shadow-soft",
    meaning:
      "Previously scored, but no events for 14+ days. Gets a friendly check-in.",
  },
  {
    label: "Churned",
    chip: "bg-gray-100 text-gray-500",
    meaning: "No events for 30+ days. Gets one win-back email every ~25 days.",
  },
  {
    label: "Paid",
    chip: "bg-gray-900 text-white",
    meaning:
      'Any "paid" event ever — sticky forever, and automated emails stop.',
  },
];

const EMAILS: {
  name: string;
  trigger: string;
  when: string;
  cooldown: string;
}[] = [
  {
    name: "Welcome",
    trigger: "Signup stage",
    when: "Right after a sign_up event with an email, or at the nightly run.",
    cooldown: "Once ever",
  },
  {
    name: "Feature nudge",
    trigger: "Onboarding stage",
    when: "User hasn't used the key feature in the last 5 days.",
    cooldown: "Every 5 days",
  },
  {
    name: "Value demo",
    trigger: "Active stage",
    when: "3+ page views in the last 7 days.",
    cooldown: "Every 7 days",
  },
  {
    name: "Check-in",
    trigger: "Going Quiet stage",
    when: "User stopped showing up for 14+ days.",
    cooldown: "Every 10 days",
  },
  {
    name: "Upgrade offer",
    trigger: "Conversion Ready stage",
    when: "Score 71+ and they haven't seen pricing yet.",
    cooldown: "Every 7 days",
  },
  {
    name: "Urgency",
    trigger: "Conversion Ready stage",
    when: "Score 71+ and they visited the pricing page.",
    cooldown: "Every 24 hours",
  },
  {
    name: "Win-back",
    trigger: "Churned stage",
    when: "No events for 30+ days.",
    cooldown: "Every 25 days",
  },
  {
    name: "Limit upgrade",
    trigger: "usage_limit_hit event",
    when: "User exhausted a trial / weekly / monthly quota.",
    cooldown: "Every 7 days per limit type",
  },
];

const EVENTS: { code: string; note: string }[] = [
  { code: 'ConversionCRM.identify(user.id, { email })', note: "Link events to a real user — do this right after login/signup." },
  { code: 'ConversionCRM.track("sign_up")', note: "First registration. Triggers the welcome email." },
  { code: 'ConversionCRM.track("login")', note: "Returning sign-in. Counts toward recency and frequency." },
  { code: 'ConversionCRM.track("feature_used", { feature: "export" })', note: "Key actions. Matching your aha moment earns up to 20 score points." },
  { code: 'ConversionCRM.track("pricing_page_visit")', note: "Buying intent. Also detected automatically from /pricing page views." },
  { code: 'ConversionCRM.track("upgrade_clicked")', note: "Strong intent signal (+5 score)." },
  { code: 'ConversionCRM.track("usage_limit_hit", { limit_type: "monthly" })', note: "Queues the limit-upgrade email — the best converting moment." },
  { code: 'ConversionCRM.track("paid")', note: "Marks the user Paid forever and stops automated emails." },
];

export default async function GuidePage({
  searchParams,
}: {
  searchParams: { welcome?: string };
}) {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  const welcome = searchParams?.welcome === "1";

  // Build the install snippet for the welcome card (prefer the live domain).
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto =
    hdrs.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const requestUrl = host ? `${proto}://${host}` : "";
  const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const appUrl =
    configuredUrl && !configuredUrl.includes("localhost")
      ? configuredUrl
      : requestUrl || "http://localhost:3000";
  const embedSnippet = `<script src="${appUrl}/widget.js?api_key=${workspace.api_key}"></script>`;
  const authSnippet = `ConversionCRM.identify(user.id, { email: user.email });
ConversionCRM.track("sign_up");  // "login" for returning users`;

  return (
    <div className="space-y-6 max-w-3xl">
      {welcome && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <PartyPopper className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-emerald-900">
              You&apos;re in — now put ConversionCRM on your site
            </h2>
          </div>
          <p className="mt-1 text-sm text-emerald-800">
            Two steps and you&apos;ll see users, scores, and the first behaviour
            emails fire within minutes.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  1 · Paste this before <code className="rounded bg-white px-1">&lt;/body&gt;</code>
                </p>
                <CopyButton text={embedSnippet} label="Copy snippet" />
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-gray-950 p-4 font-mono text-xs leading-relaxed text-green-400">
                {embedSnippet}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  2 · After login / signup, identify the user
                </p>
                <CopyButton text={authSnippet} label="Copy code" />
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-gray-950 p-4 font-mono text-xs leading-relaxed text-amber-300">
                {authSnippet}
              </pre>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              href="/dashboard/settings"
              className="rounded-md bg-emerald-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Full install + AI-agent prompt
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md bg-white px-4 py-2 font-semibold text-emerald-700 shadow-soft transition-colors hover:bg-emerald-50"
            >
              Go to dashboard
            </Link>
          </div>
        </section>
      )}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          How it all works
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          The full journey from script tag to paid user — scoring, stages, and
          every email we send on your behalf.
        </p>
      </div>

      {/* ── Pipeline ──────────────────────────────────── */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          The workflow
        </h2>
        <ol className="space-y-1">
          {PIPELINE.map((step, i) => (
            <li key={step.title}>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                  <step.icon className="h-4 w-4" />
                </div>
                <div className="pb-1">
                  <p className={`text-sm font-semibold ${NAVY}`}>{step.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                    {step.text}
                  </p>
                </div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className="ml-[1.05rem] my-1 text-sky-200">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ── Scoring ───────────────────────────────────── */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          The scoring pattern — 6 layers, 100 points
        </h2>
        <p className="text-xs text-gray-500 mt-1 mb-4 leading-relaxed">
          Each layer is capped, so no single signal can fake a high score. The
          score covers the last 7 days and updates live.
        </p>
        <div className="space-y-3">
          {LAYERS.map((l) => (
            <div key={l.name} className="flex items-start gap-3">
              <span
                className={`min-w-[3.5rem] text-center text-xs font-bold tabular-nums rounded-md bg-sky-50 px-2 py-1.5 ${NAVY}`}
              >
                {l.max} pts
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{l.name}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{l.how}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-sky-50 px-4 py-3 text-xs text-sky-900 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Tip: setting your{" "}
            <Link href="/dashboard/settings" className="underline font-semibold">
              aha moment
            </Link>{" "}
            is the single biggest accuracy upgrade — it&apos;s worth 20 points
            and drives the onboarding nudge.
          </span>
        </div>
      </section>

      {/* ── Score bands / stages ──────────────────────── */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          What each score means
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Scores map to lifecycle stages; activity rules override them when a
          user disappears.
        </p>
        <div className="space-y-2.5">
          {BANDS.map((b) => (
            <div
              key={b.label}
              className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 rounded-lg bg-gray-50/80 px-3.5 py-2.5"
            >
              <span
                className={`font-bold tabular-nums text-sm sm:min-w-[4.5rem] ${NAVY}`}
              >
                {b.range}
              </span>
              <span
                className={`self-start text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${b.chip}`}
              >
                {b.label}
              </span>
              <span className="text-xs text-gray-500 leading-relaxed">
                {b.meaning}
              </span>
            </div>
          ))}
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-2">
            Activity overrides
          </p>
          {RULES.map((b) => (
            <div
              key={b.label}
              className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 rounded-lg bg-gray-50/80 px-3.5 py-2.5"
            >
              <span
                className={`self-start text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap sm:ml-[5.25rem] ${b.chip}`}
              >
                {b.label}
              </span>
              <span className="text-xs text-gray-500 leading-relaxed">
                {b.meaning}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Emails ────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="p-5 sm:p-6 pb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            The emails we send
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            One email per user per day, maximum. Every send is logged on the
            user&apos;s profile, and nothing sends until your reply-to email is
            set.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-sky-500 text-left text-xs font-semibold text-white">
                <th className="px-4 sm:px-6 py-2.5">Email</th>
                <th className="px-4 py-2.5">Sent when</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Repeats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {EMAILS.map((e) => (
                <tr key={e.name}>
                  <td className="px-4 sm:px-6 py-3 align-top">
                    <p className="font-semibold text-gray-900 whitespace-nowrap">
                      {e.name}
                    </p>
                    <p className="text-[11px] text-gray-400">{e.trigger}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 align-top leading-relaxed">
                    {e.when}
                  </td>
                  <td className="px-4 py-3 text-gray-500 align-top whitespace-nowrap">
                    {e.cooldown}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Event reference ───────────────────────────── */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Event reference
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Everything the widget understands. Page views, time on page, and
          clicks are tracked automatically — these calls add the high-signal
          moments.
        </p>
        <ul className="space-y-2.5">
          {EVENTS.map((ev) => (
            <li key={ev.code}>
              <code className="block bg-gray-50 rounded-md px-3 py-2 text-[11px] sm:text-xs text-sky-800 font-mono overflow-x-auto whitespace-nowrap">
                {ev.code}
              </code>
              <p className="text-[11px] text-gray-400 mt-1 ml-1">{ev.note}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500 mt-4">
          Install snippets live in{" "}
          <Link
            href="/dashboard/settings"
            className="text-sky-600 font-semibold hover:underline"
          >
            Settings
          </Link>
          , including a ready-made prompt for AI coding agents.
        </p>
      </section>
    </div>
  );
}
