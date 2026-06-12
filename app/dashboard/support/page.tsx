import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveWorkspace } from "@/lib/active-workspace";
import {
  LifeBuoy,
  Mail,
  BookOpen,
  Code2,
  CheckCircle2,
} from "lucide-react";

const SUPPORT_EMAIL = "support@conversioncrm.co";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Why don't I see any users in the dashboard?",
    a: "Make sure the widget script tag is installed on your site (Settings → Add tracking), then open your site and click around — events appear within a few seconds. If you set a website URL in Settings, only events from that exact domain are shown.",
  },
  {
    q: "How is the engagement score calculated?",
    a: "It's a 0–100 score built from six independent layers over the last 7 days: recency (20), frequency of active days (15), depth of usage (15), key-feature usage (20), time spent (15), and buying intent like pricing visits or upgrade clicks (15). Each layer is capped so a single noisy signal can't inflate the score.",
  },
  {
    q: "When are automated emails sent?",
    a: "Once per day per workspace, and only when a reply-to email is configured in Settings. Each user gets at most one lifecycle email per day, with per-email cooldowns (e.g. the welcome email is only ever sent once).",
  },
  {
    q: "What do the lifecycle stages mean?",
    a: "Signup → just arrived. Onboarding → score 1–30. Active → score 31–70. Conversion Ready → score 71+. Going Quiet → no events for 14+ days. Churned → no events for 30+ days. Paid is sticky and never downgraded.",
  },
  {
    q: "How do I email a specific user by hand?",
    a: "Double-click the user in the Overview table to open their profile, then hit Compose email. The composer builds branded HTML in your colors, shows a live preview, and logs the send on the user's profile.",
  },
  {
    q: "Is my users' data shared anywhere?",
    a: "No. Events are stored in your workspace only and are used exclusively to compute scores, stages, and the emails you configure. You can stop tracking at any time by removing the script tag.",
  },
];

const CHECKLIST: string[] = [
  "Install the widget script tag on your product (Settings)",
  "Call ConversionCRM.identify(user.id, { email }) after login/signup",
  "Track 2–3 key actions with ConversionCRM.track(...)",
  "Set your website URL so the dashboard filters noise",
  "Add your reply-to email to enable automated lifecycle emails",
];

export default async function SupportPage() {
  const { workspace } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support</h1>
        <p className="text-gray-500 text-sm mt-1">
          Answers to common questions — and a human when you need one.
        </p>
      </div>

      {/* ── Contact cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            `[${workspace.name}] Support request`
          )}`}
          className="group bg-sky-50 rounded-2xl p-5 shadow-soft hover:shadow-card transition-shadow"
        >
          <div className="flex items-center gap-2 text-sky-900">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-semibold">Email support</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            A real person answers every message — usually within one business
            day.
          </p>
          <p className="text-sm font-semibold text-[#0b3a5e] mt-3 group-hover:underline">
            {SUPPORT_EMAIL} →
          </p>
        </a>

        <Link
          href="/dashboard/settings"
          className="group card p-5 hover:shadow-card-lg transition-shadow"
        >
          <div className="flex items-center gap-2 text-sky-900">
            <Code2 className="h-4 w-4" />
            <span className="text-sm font-semibold">Setup & install</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            The embed snippet, the auth identify call, and a ready-made AI
            agent prompt live in Settings.
          </p>
          <p className="text-sm font-semibold text-[#0b3a5e] mt-3 group-hover:underline">
            Open Settings →
          </p>
        </Link>
      </div>

      {/* ── Getting set up checklist ──────────────────── */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-sky-500" />
          <h2 className="text-base font-semibold text-gray-900">
            Five steps to your first conversion email
          </h2>
        </div>
        <ol className="space-y-2.5">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
              <CheckCircle2 className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-semibold text-[#0b3a5e] mr-1.5">
                  {i + 1}.
                </span>
                {item}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <LifeBuoy className="h-4 w-4 text-sky-500" />
          <h2 className="text-base font-semibold text-gray-900">
            Frequently asked questions
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-3">
              <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-medium text-gray-900 hover:text-sky-800 transition-colors">
                {faq.q}
                <span className="ml-4 text-gray-300 group-open:rotate-45 transition-transform text-lg leading-none">
                  +
                </span>
              </summary>
              <p className="text-sm text-gray-500 leading-relaxed mt-2 pr-8">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-xs text-gray-400 text-center pb-4">
        Still stuck? Email{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-sky-600 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>{" "}
        — include your workspace name (<strong>{workspace.name}</strong>) for a
        faster answer.
      </p>
    </div>
  );
}
