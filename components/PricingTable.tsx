"use client";

import { useState } from "react";
import { Check, X, Loader2, Zap } from "lucide-react";
import {
  PLANS,
  SALES_EMAIL,
  formatPrice,
  formatEmails,
  formatCount,
  type PlanId,
} from "@/lib/plans";

const NAVY = "text-[#0b3a5e]";

interface Props {
  loggedIn: boolean;
  currentPlan: PlanId | null;
  /** Logged in but no plan yet — must choose before reaching the dashboard. */
  mustChoose: boolean;
}

const CARD_PLANS: PlanId[] = ["free", "basic", "pro", "scale"];

// Marketing CTA copy (logged-out visitors); logged-in uses "Choose …".
const CTA: Record<PlanId, string> = {
  free: "Start free — no card",
  basic: "Send from your brand",
  pro: "Get the full engine",
  scale: "Scale across your org",
  enterprise: "Talk to sales",
};

export function PricingTable({ loggedIn, currentPlan, mustChoose }: Props) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function selectFree() {
    setError(null);
    setNotice(null);
    setBusy("free");
    try {
      const res = await fetch("/api/billing/select-free", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) window.location.assign(data.redirect ?? "/dashboard");
      else setError(data.error ?? "Could not activate the Free plan.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function checkout(plan: PlanId) {
    setError(null);
    setNotice(null);
    setBusy(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.subscriptionId && data.keyId) {
        await openRazorpayCheckout(data.subscriptionId, data.keyId, plan);
        return;
      }
      if (res.ok && data.scheduled) {
        const when = data.startsAt
          ? new Date(data.startsAt).toLocaleDateString()
          : "the end of your current cycle";
        setNotice(
          `Upgrade scheduled — your ${PLANS[plan].name} plan starts on ${when}, once your current month ends. You keep your current plan until then.`
        );
      } else if (res.ok && data.redirect) {
        window.location.assign(data.redirect);
      } else {
        setError(data.error ?? "Could not start checkout.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function loadRazorpay(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window !== "undefined" && (window as Window & { Razorpay?: unknown }).Razorpay) {
        return resolve();
      }
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("sdk"));
      document.body.appendChild(s);
    });
  }

  async function openRazorpayCheckout(subscriptionId: string, keyId: string, plan: PlanId) {
    try {
      await loadRazorpay();
    } catch {
      setError("Could not load the payment window. Check your connection.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Razorpay = (window as any).Razorpay;
    const rzp = new Razorpay({
      key: keyId,
      subscription_id: subscriptionId,
      name: "ConversionCRM",
      description: `${PLANS[plan].name} plan`,
      theme: { color: "#0ea5e9" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: async (resp: any) => {
        try {
          const v = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_subscription_id: resp.razorpay_subscription_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          const vd = await v.json().catch(() => ({}));
          if (v.ok) window.location.assign(vd.redirect ?? "/dashboard/guide?welcome=1");
          else setError(vd.error ?? "Payment verification failed.");
        } catch {
          setError("Payment verification failed. Please contact support.");
        }
      },
      modal: { ondismiss: () => setBusy(null) },
    });
    rzp.open();
  }

  function mailtoSales(subject: string) {
    window.location.href = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}`;
  }

  /** What the button for a plan should do + say. */
  function action(plan: PlanId): { label: string; disabled?: boolean; onClick: () => void } {
    if (currentPlan === plan) return { label: "Current plan", disabled: true, onClick: () => {} };
    if (!loggedIn) return { label: CTA[plan], onClick: () => window.location.assign("/signup") };
    if (plan === "free") return { label: "Choose Free", onClick: selectFree };
    if (plan === "enterprise")
      return { label: "Talk to sales", onClick: () => mailtoSales("Enterprise plan enquiry — ConversionCRM") };
    return { label: `Choose ${PLANS[plan].name}`, onClick: () => checkout(plan) };
  }

  return (
    <div>
      {mustChoose && (
        <div className="mb-8 rounded-lg border border-sky-200 bg-sky-50 px-5 py-4 text-center text-sm font-medium text-[#0b3a5e]">
          Choose a plan to continue to your dashboard. Start on Free — real
          tracking and live behaviour emails, no card.
        </div>
      )}

      {/* Shared-across-all-plans band */}
      <div className="mx-auto mb-8 max-w-4xl rounded-xl bg-white px-6 py-4 text-center text-sm text-gray-600 shadow-card">
        <span className="font-semibold text-[#0b3a5e]">Every plan, including Free, includes:</span>{" "}
        the tracking snippet + REST API · all 8 behaviour-triggered emails ·
        6-layer scoring · lifecycle stages · guardrails (cooldowns, never email
        paying users).
      </div>

      {error && (
        <div className="mx-auto mb-6 max-w-2xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mx-auto mb-6 max-w-2xl rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {/* ── Plan cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {CARD_PLANS.map((id) => {
          const plan = PLANS[id];
          const highlight = !!plan.recommended;
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
              {highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <h3 className={`text-sm font-bold uppercase tracking-wide ${NAVY}`}>
                {plan.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-3xl font-bold tabular-nums ${NAVY}`}>
                  {formatPrice(plan.priceUsd)}
                </span>
                {plan.priceUsd !== null && plan.priceUsd > 0 && (
                  <span className="text-sm text-gray-400">/ mo</span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">{plan.blurb}</p>

              {/* Scale mini-row */}
              <dl className="mt-4 space-y-1 rounded-lg bg-white/70 p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-400">Tracked users</dt>
                  <dd className="font-semibold text-[#0b3a5e]">{formatCount(plan.trackedUsers)}/mo</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Emails</dt>
                  <dd className="font-semibold text-[#0b3a5e]">{formatEmails(plan.emailQuota)}/mo</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Workspaces</dt>
                  <dd className="font-semibold text-[#0b3a5e]">{plan.workspaces ?? "Unlimited"}</dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={a.disabled || isBusy}
                onClick={a.onClick}
                className={[
                  "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
                  a.disabled
                    ? "cursor-default bg-gray-100 text-gray-400"
                    : highlight
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

      {/* ── Enterprise ─────────────────────────────────── */}
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl bg-[#0b3a5e] p-6 text-white sm:flex-row sm:items-center">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Zap className="h-5 w-5" /> Enterprise
          </h3>
          <p className="mt-1 text-sm text-sky-100">
            Custom volume, unlimited workspaces &amp; brands, SSO/SAML, SLA,
            security review, and a dedicated team.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mailtoSales("Enterprise plan enquiry — ConversionCRM")}
          className="shrink-0 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[#0b3a5e] transition-colors hover:bg-sky-50"
        >
          Talk to sales
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        Prices in USD. Extra emails $0.90 / 1,000. Cancel anytime — your data
        stays put.
      </p>
    </div>
  );
}
