import Link from "next/link";
import { Zap } from "lucide-react";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { PricingTable } from "@/components/PricingTable";
import type { PlanId } from "@/lib/plans";

export const metadata = {
  title: "Pricing — ConversionCRM",
  description:
    "Simple, volume-based pricing for turning sign-ups into paid users. Start free, upgrade when it works.",
};

export const dynamic = "force-dynamic";

const NAVY = "text-[#0b3a5e]";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What happens when I hit my monthly email limit?",
    a: "Sending pauses for the rest of the calendar month — no emails go out past your plan's cap. Your user tracking, scoring and profiles keep collecting data the whole time. Upgrade (or wait for the month to roll over) to resume sending.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Free plan gives you 1,000 emails a month and the full live dashboard. Add a card only when you upgrade to Basic, Pro or Premium.",
  },
  {
    q: "How does the volume slider work?",
    a: "Drag it to roughly how many emails you send each month and we'll point you at the right plan. Free covers 1k, Basic 20k, Pro 100k and Premium 200k. Above 200k we quote a price on the slider and our team sets you up.",
  },
  {
    q: "Can I cancel or change plans anytime?",
    a: "Yes. Plans are month-to-month. When you cancel you keep your paid features until the end of the period, then drop to Free — your data always stays put.",
  },
  {
    q: "What counts toward the email limit?",
    a: "Every email we actually send on your behalf — automated lifecycle emails and anything from the composer. Internal tracking events never count.",
  },
];

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: PlanId | null = null;
  let hasWorkspace = false;
  if (user) {
    const admin = createSupabaseAdminClient();
    const { data: ws } = await admin
      .from("workspaces")
      .select("plan")
      .eq("owner_id", user.id)
      .maybeSingle();
    hasWorkspace = !!ws;
    currentPlan = (ws?.plan as PlanId) ?? null;
  }

  const loggedIn = !!user;
  const mustChoose = loggedIn && hasWorkspace && !currentPlan;

  return (
    <div className="min-h-screen bg-[#f4f8fc] text-gray-900">
      {/* ── Header ── */}
      <header className="bg-white shadow-soft">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="rounded-md bg-sky-500 p-1.5 text-white">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold">ConversionCRM</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="text-gray-500 transition-colors hover:text-gray-900"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-gray-500 transition-colors hover:text-gray-900"
              >
                Sign in
              </Link>
            )}
            {!loggedIn && (
              <Link
                href="/signup"
                className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
              >
                Start free
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-16 text-center">
        <span className="mb-5 inline-block rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          Pricing
        </span>
        <h1 className={`text-4xl font-bold tracking-tight sm:text-5xl ${NAVY}`}>
          Pricing that scales with your sends
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-gray-500">
          Pay for the email volume you actually use. Start free with 1,000
          emails a month, upgrade when the emails start converting.
        </p>
      </section>

      {/* ── Toggle + plans ── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <PricingTable
          loggedIn={loggedIn}
          currentPlan={currentPlan}
          mustChoose={mustChoose}
        />
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className={`text-center text-2xl font-bold ${NAVY}`}>
            Questions, answered
          </h2>
          <div className="mt-8 divide-y divide-sky-50 rounded-lg bg-[#f4f8fc] px-6 shadow-card">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-gray-900 transition-colors hover:text-sky-800">
                  {faq.q}
                  <span className="ml-4 text-lg leading-none text-gray-300 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 pr-8 text-sm leading-relaxed text-gray-500">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} ConversionCRM
      </footer>
    </div>
  );
}
