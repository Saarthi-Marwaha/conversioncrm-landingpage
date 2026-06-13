"use client";

import { useMemo, useState } from "react";
import { Check, X, Zap, Loader2 } from "lucide-react";
import {
  PLANS,
  PLAN_ORDER,
  VOLUME_STOPS,
  SALES_EMAIL,
  formatEmails,
  formatPrice,
  type PlanId,
} from "@/lib/plans";

const NAVY = "text-[#0b3a5e]";

interface Props {
  loggedIn: boolean;
  currentPlan: PlanId | null;
  /** Logged in but no plan yet — must choose before reaching the dashboard. */
  mustChoose: boolean;
}

const CARD_PLANS: PlanId[] = ["free", "basic", "pro", "premium"];

// Default the slider to the Pro stop (100k) — our recommended plan.
const DEFAULT_STOP = VOLUME_STOPS.findIndex((s) => s.plan === "pro");

export function PricingTable({ loggedIn, currentPlan, mustChoose }: Props) {
  const [stopIdx, setStopIdx] = useState(
    DEFAULT_STOP >= 0 ? DEFAULT_STOP : 2
  );
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = VOLUME_STOPS[stopIdx];

  // Premium scales with the slider above its 200k base.
  const premium = useMemo(() => {
    if (stop.plan === "premium" && stop.contactSales) {
      return { emails: stop.emails, price: stop.priceUsd, contactSales: true };
    }
    return { emails: 200_000, price: 399, contactSales: false };
  }, [stop]);

  async function selectFree() {
    setError(null);
    setBusy("free");
    try {
      const res = await fetch("/api/billing/select-free", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.assign(data.redirect ?? "/dashboard");
      } else {
        setError(data.error ?? "Could not activate the Free plan.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function checkout(plan: PlanId) {
    setError(null);
    setBusy(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.assign(data.url);
      } else {
        setError(data.error ?? "Could not start checkout.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function mailtoSales(subject: string) {
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(
      subject
    )}`;
  }

  /** What the button for a given plan should do + say. */
  function action(plan: PlanId) {
    if (currentPlan === plan) {
      return { label: "Current plan", disabled: true, onClick: () => {} };
    }
    if (!loggedIn) {
      return {
        label: plan === "free" ? "Start free" : "Get started",
        onClick: () => window.location.assign("/signup"),
      };
    }
    if (plan === "free") {
      return { label: "Choose Free", onClick: selectFree };
    }
    if (plan === "premium" && premium.contactSales) {
      return {
        label: "Contact sales",
        onClick: () => mailtoSales(`Premium plan — ${formatEmails(premium.emails)} emails/mo`),
      };
    }
    return { label: `Choose ${PLANS[plan].name}`, onClick: () => checkout(plan) };
  }

  return (
    <div>
      {mustChoose && (
        <div className="mb-8 rounded-lg border border-sky-200 bg-sky-50 px-5 py-4 text-center text-sm font-medium text-[#0b3a5e]">
          Choose a plan to continue to your dashboard. Start on Free (1,000
          emails / month) — you can upgrade anytime.
        </div>
      )}

      {/* ── Volume toggle ──────────────────────────────── */}
      <div className="mx-auto mb-12 max-w-3xl rounded-xl bg-white p-6 shadow-card">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-500">
            How many emails do you send per month?
          </span>
          <span className={`text-lg font-bold tabular-nums ${NAVY}`}>
            {formatEmails(stop.emails)}
            {stop.emails >= 3_000_000 ? "+" : ""}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={VOLUME_STOPS.length - 1}
          step={1}
          value={stopIdx}
          onChange={(e) => setStopIdx(Number(e.target.value))}
          aria-label="Monthly email volume"
          className="mt-4 w-full cursor-pointer accent-sky-500"
        />

        <div className="mt-2 flex justify-between text-[10px] text-gray-400">
          {VOLUME_STOPS.map((s, i) => (
            <button
              key={s.emails}
              type="button"
              onClick={() => setStopIdx(i)}
              className={`tabular-nums transition-colors hover:text-sky-600 ${
                i === stopIdx ? "font-bold text-sky-600" : ""
              }`}
            >
              {formatEmails(s.emails)}
              {s.emails >= 3_000_000 ? "+" : ""}
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          {stop.priceUsd === null ? (
            <>
              Above 2.5M emails we tailor a plan to you —{" "}
              <span className="font-semibold text-[#0b3a5e]">Contact us</span>.
            </>
          ) : (
            <>
              Recommended:{" "}
              <span className="font-semibold text-[#0b3a5e]">
                {PLANS[stop.plan].name}
              </span>{" "}
              · {formatPrice(stop.priceUsd)} / mo for{" "}
              {formatEmails(stop.emails)} emails
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="mx-auto mb-6 max-w-2xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Plan cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {CARD_PLANS.map((id) => {
          const plan = PLANS[id];
          const isPremium = id === "premium";
          const price = isPremium ? premium.price : plan.priceUsd;
          const quota = isPremium ? premium.emails : plan.emailQuota;
          const highlight = stop.plan === id;
          const a = action(id);
          const isBusy = busy === id;

          return (
            <div
              key={id}
              className={[
                "relative flex flex-col rounded-xl p-6",
                highlight
                  ? "ring-2 ring-sky-400 bg-sky-50/60 shadow-card-lg"
                  : "bg-white shadow-card",
              ].join(" ")}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Recommended
                </span>
              )}
              <h3 className={`text-sm font-bold uppercase tracking-wide ${NAVY}`}>
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-3xl font-bold tabular-nums ${NAVY}`}>
                  {formatPrice(price)}
                </span>
                {price !== null && price > 0 && (
                  <span className="text-sm text-gray-400">/ mo</span>
                )}
              </div>
              <p className="mt-1 text-xs font-medium text-sky-700">
                {quota.toLocaleString()} emails / month
              </p>
              <p className="mt-2 text-sm text-gray-500">{plan.blurb}</p>

              <button
                type="button"
                disabled={a.disabled || isBusy}
                onClick={a.onClick}
                className={[
                  "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
                  a.disabled
                    ? "cursor-default bg-gray-100 text-gray-400"
                    : highlight || plan.recommended
                    ? "bg-sky-500 text-white hover:bg-sky-600"
                    : "bg-white text-gray-800 shadow-soft hover:text-sky-800",
                ].join(" ")}
              >
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {a.label}
              </button>

              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-gray-600">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
                    {f}
                  </li>
                ))}
                {plan.notIncluded?.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-gray-300">
                    <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── Enterprise / Custom ────────────────────────── */}
      <div
        className={[
          "mt-6 flex flex-col items-start justify-between gap-4 rounded-xl p-6 sm:flex-row sm:items-center",
          stop.plan === "enterprise"
            ? "ring-2 ring-sky-400 bg-sky-50/60"
            : "bg-[#0b3a5e] text-white",
        ].join(" ")}
      >
        <div>
          <h3
            className={`flex items-center gap-2 text-lg font-bold ${
              stop.plan === "enterprise" ? NAVY : "text-white"
            }`}
          >
            <Zap className="h-5 w-5" /> Enterprise
          </h3>
          <p
            className={`mt-1 text-sm ${
              stop.plan === "enterprise" ? "text-gray-600" : "text-sky-100"
            }`}
          >
            2.5M+ emails / month, custom volume, pricing & dedicated
            infrastructure.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mailtoSales("Enterprise plan enquiry — ConversionCRM")}
          className={[
            "shrink-0 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors",
            stop.plan === "enterprise"
              ? "bg-sky-500 text-white hover:bg-sky-600"
              : "bg-white text-[#0b3a5e] hover:bg-sky-50",
          ].join(" ")}
        >
          Contact us
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Prices in USD. All paid plans include automated lifecycle emails and the
        composer. Cancel anytime — your data stays put.
      </p>
    </div>
  );
}
