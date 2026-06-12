import Link from "next/link";
import { Zap, Check } from "lucide-react";

export const metadata = {
  title: "Pricing — ConversionCRM",
  description:
    "Simple pricing for turning sign-ups into paid users. Start free, upgrade when it works.",
};

const NAVY = "text-[#0b3a5e]";

type Tier = {
  name: string;
  price: string;
  period: string;
  tagline: string;
  cta: string;
  highlight?: boolean;
  features: string[];
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    tagline: "See who's using your product, live.",
    cta: "Get started",
    features: [
      "1 website",
      "500 tracked users / month",
      "Live overview dashboard",
      "6-layer engagement scoring",
      "Lifecycle stages",
      "7-day event history",
    ],
  },
  {
    name: "Growth",
    price: "$29",
    period: "per month",
    tagline: "Convert sign-ups on autopilot.",
    cta: "Get started",
    highlight: true,
    features: [
      "Everything in Starter",
      "5,000 tracked users / month",
      "Automated lifecycle emails",
      "Hand-written email composer",
      "Full user profiles & activity",
      "30-day event history",
      "Priority email support",
    ],
  },
  {
    name: "Scale",
    price: "$79",
    period: "per month",
    tagline: "For teams with serious volume.",
    cta: "Get started",
    features: [
      "Everything in Growth",
      "Unlimited websites",
      "50,000 tracked users / month",
      "Custom email sending domain",
      "API access",
      "90-day event history",
      "Dedicated support",
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need a credit card to start?",
    a: "No. The Starter plan is free forever — install the widget, watch users arrive, and upgrade only when the emails start converting.",
  },
  {
    q: "What counts as a tracked user?",
    a: "A unique visitor or identified user who triggers at least one event in a calendar month. Anonymous visitors who later sign in are counted once.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month-to-month with no contracts. Downgrading keeps your data — you just lose access to paid features.",
  },
  {
    q: "Do automated emails come from my domain?",
    a: "On Growth, emails are sent with your product's name and your reply-to address. Scale adds a fully custom sending domain.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Header ─────────────────────────────────── */}
      <header className="shadow-soft bg-white">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-sky-500 text-white p-1.5 rounded-lg">
              <Zap className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm">ConversionCRM</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/login"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 transition-colors"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <span className="inline-block text-xs font-semibold text-sky-700 bg-sky-50 rounded-full px-3 py-1 mb-5">
          Pricing
        </span>
        <h1 className={`text-4xl sm:text-5xl font-bold tracking-tight ${NAVY}`}>
          Simple pricing that pays for itself
        </h1>
        <p className="text-gray-500 mt-4 max-w-xl mx-auto leading-relaxed">
          One converted user usually covers a month of ConversionCRM. Start
          free, upgrade when the emails start working.
        </p>
      </section>

      {/* ── Tiers ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={
                tier.highlight
                  ? "relative rounded-2xl ring-2 ring-sky-400 bg-sky-50/60 p-7 flex flex-col shadow-card-lg"
                  : "rounded-2xl bg-white p-7 flex flex-col shadow-card"
              }
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold uppercase tracking-wide bg-sky-500 text-white rounded-full px-3 py-1">
                  Most popular
                </span>
              )}
              <h2 className={`text-sm font-bold uppercase tracking-wide ${NAVY}`}>
                {tier.name}
              </h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className={`text-4xl font-bold tabular-nums ${NAVY}`}>
                  {tier.price}
                </span>
                <span className="text-sm text-gray-400">{tier.period}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">{tier.tagline}</p>

              {/* Visual only — billing isn't wired up yet */}
              <button
                type="button"
                aria-disabled="true"
                title="Billing launches soon"
                className={
                  tier.highlight
                    ? "mt-6 w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 transition-colors cursor-default"
                    : "mt-6 w-full rounded-lg bg-white shadow-soft px-4 py-2.5 text-sm font-semibold text-gray-800 hover:text-sky-800 transition-colors cursor-default"
                }
              >
                {tier.cta}
              </button>

              <ul className="mt-6 space-y-2.5 text-sm text-gray-600 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-sky-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Prices shown are a preview — self-serve billing launches soon. No
          card required for Starter.
        </p>
      </section>

      {/* ── FAQ ────────────────────────────────────── */}
      <section className="bg-sky-50/50">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className={`text-2xl font-bold text-center ${NAVY}`}>
            Questions, answered
          </h2>
          <div className="mt-8 divide-y divide-sky-50 bg-white rounded-2xl shadow-card px-6">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-semibold text-gray-900 hover:text-sky-800 transition-colors">
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
        </div>
      </section>

      {/* ── Footer CTA ─────────────────────────────── */}
      <footer className="max-w-5xl mx-auto px-6 py-16 text-center">
        <h2 className={`text-2xl font-bold ${NAVY}`}>
          Watch your first user convert this week
        </h2>
        <p className="text-gray-500 text-sm mt-2">
          Two-minute install. The dashboard fills up in seconds.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-6 rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-600 transition-colors"
        >
          Start free
        </Link>
        <p className="text-xs text-gray-300 mt-10">
          © {new Date().getFullYear()} ConversionCRM
        </p>
      </footer>
    </div>
  );
}
