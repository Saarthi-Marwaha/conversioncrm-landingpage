import Link from "next/link";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { planAllows } from "@/lib/entitlements";
import { CopyButton } from "@/components/CopyButton";
import { WebsiteUrlForm } from "@/components/WebsiteUrlForm";
import { ReplyToEmailForm } from "@/components/ReplyToEmailForm";
import { EmailDeliveryForm } from "@/components/EmailDeliveryForm";
import { AhaMomentForm } from "@/components/AhaMomentForm";
import { BillingSection } from "@/components/BillingSection";
import type { PlanId } from "@/lib/plans";

export default async function SettingsPage() {
  const { workspace, userEmail } = await getActiveWorkspace();

  if (!workspace) redirect("/login");

  // Build the public base URL for the embed snippet. Prefer the host this page
  // is actually served from (so the deployed dashboard shows its own domain),
  // and fall back to the configured public URL when running locally so the
  // snippet still points at the live deployment customers can reach.
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto =
    hdrs.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const requestUrl = host ? `${proto}://${host}` : "";
  const isLocal = host.includes("localhost") || host.startsWith("127.");
  const configuredUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

  const appUrl =
    isLocal && configuredUrl && !configuredUrl.includes("localhost")
      ? configuredUrl
      : requestUrl || configuredUrl || "http://localhost:3000";

  const embedSnippet = `<script src="${appUrl}/widget.js?api_key=${workspace.api_key}"></script>`;

  const authSnippet = `// Add this where login or signup completes (auth callback, form handler, etc.)
ConversionCRM.identify(user.id, { email: user.email });
ConversionCRM.track("sign_up");  // use "login" for returning sign-ins`;

  const agentPrompt = `Add the ConversionCRM tracking widget to this codebase. Follow every step below exactly.

─── STEP 1 — Add the script tag ────────────────────────────────────────
Find the root HTML layout file. Common locations (check in this order):
  • app/layout.tsx  (Next.js App Router)
  • pages/_document.tsx  (Next.js Pages Router)
  • index.html  (Vite / CRA / plain HTML)
  • public/index.html

Add the following script tag just before </body> (or inside <head> if no body tag exists):

<script src="${appUrl}/widget.js?api_key=${workspace.api_key}"></script>

Do NOT install any npm packages. This is a plain <script> tag — no import needed.

─── STEP 2 — Identify the logged-in user ───────────────────────────────
Find where a successful login or signup completes in the codebase
(an auth callback, a login/signup submit handler, a session hook, or a
page that only renders when the user is authenticated).

Immediately after you have the user's unique ID, add:

  ConversionCRM.identify(user.id, { email: user.email });

identify(userId, traits) takes the user's unique ID as the first argument and
an optional traits object as the second. ALWAYS pass the user's email in the
traits object when you have it — it is shown in the dashboard so the customer
can see exactly who signed up. If no email is available, call
ConversionCRM.identify(user.id) with just the ID.

Then fire an explicit signup or login event right at that spot so the
dashboard can tell new signups apart from returning logins:

  ConversionCRM.track("sign_up");    // on first-time registration
  ConversionCRM.track("login");      // on a returning sign-in

─── STEP 3 — Track key events (optional but recommended) ───────────────
Find 2-3 important user actions in the codebase — things like:
  • Clicking "Export", "Publish", "Share", "Invite", "Create", "Upgrade"
  • Completing a core workflow (e.g. finishing onboarding, submitting a form)
  • Visiting the pricing page

For each one, add a track call right where the action happens:

  ConversionCRM.track("feature_used", { feature: "export" });
  ConversionCRM.track("upgrade_clicked");
  ConversionCRM.track("pricing_page_visit");

When a user exhausts a free allowance (trial ended, weekly/monthly quota used up),
fire this once at the moment the limit is hit — NOT on every locked-feature click:

  ConversionCRM.track("usage_limit_hit", {
    limit_type: "monthly",  // trial | weekly | monthly | quota
    exhausted: true,
  });

Use a short snake_case string that describes the action as the first argument.
The second argument (properties object) is optional.

─── DONE ────────────────────────────────────────────────────────────────
After adding the snippet, verify by opening the app, performing an action,
and checking the ConversionCRM dashboard at ${appUrl}/dashboard — the
user and event should appear within 3 seconds.`;


  return (
    <div className="space-y-6 sm:space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          {workspace.name} · {userEmail}
        </p>
      </div>

      {/* ── Billing ─────────────────────────────────────── */}
      <BillingSection
        plan={(workspace.plan as PlanId) ?? "free"}
        planStatus={workspace.plan_status}
        renewsAt={workspace.plan_renews_at}
        pendingPlan={(workspace.pending_plan as PlanId) ?? null}
        pendingStartsAt={workspace.pending_plan_starts_at}
      />

      {/* ── Embed Snippet ─────────────────────────────── */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Add tracking to your app
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Paste this into the{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">&lt;head&gt;</code>{" "}
              or just before{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">&lt;/body&gt;</code>{" "}
              of your product.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CopyButton text={embedSnippet} label="Copy snippet" />
            <CopyButton
              text={agentPrompt}
              label="Copy agent prompt"
              variant="agent"
            />
          </div>
        </div>

        <pre className="bg-gray-950 text-green-400 text-xs leading-relaxed rounded-md p-4 overflow-x-auto whitespace-pre-wrap font-mono">
          {embedSnippet}
        </pre>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                After login / signup
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Paste this separately where your user authenticates — not in the
                layout. Copy the snippet above and this block independently.
              </p>
            </div>
            <CopyButton text={authSnippet} label="Copy auth code" />
          </div>
          <pre className="bg-gray-950 text-amber-300 text-xs leading-relaxed rounded-md p-4 overflow-x-auto whitespace-pre-wrap font-mono">
            {authSnippet}
          </pre>
        </div>

        <div className="flex items-start gap-2 bg-sky-50 rounded-md px-4 py-3 text-xs text-sky-700">
          <span className="text-base leading-none mt-0.5">🤖</span>
          <span>
            <strong>Using Cursor or another AI agent?</strong> Click{" "}
            <strong>Copy agent prompt</strong> above, open a new chat in your
            product&apos;s codebase, and paste — the agent will find the right
            files and add the snippet, identify call, and event tracking
            automatically.
          </span>
        </div>

        <div className="bg-sky-50 rounded-md px-4 py-3 text-xs text-sky-700 leading-relaxed">
          <strong>Auto-tracked:</strong> every page visit (including SPA routes),
          time on each page, and button/link clicks — no extra code beyond the
          script tag. The auth block above links events to a real user and email.
        </div>
      </section>

      {/* ── Reply-to email ─────────────────────────────── */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Email replies</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Required for automated emails. When users reply, the message goes to
            your inbox.
          </p>
        </div>
        {!workspace.reply_to_email && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
            Set your Gmail to enable welcome, nudge, and lifecycle emails.
          </div>
        )}
        <ReplyToEmailForm
          currentEmail={workspace.reply_to_email}
          currentSenderName={workspace.email_sender_name}
        />
      </section>

      {/* ── Email delivery (SMTP / Resend) ─────────────── */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Email delivery
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Choose how automated and composed emails are sent. Use your own
            SMTP server to send from your domain.
          </p>
        </div>
        {planAllows(workspace.plan, "custom_smtp") ? (
          <EmailDeliveryForm
            currentProvider={workspace.email_provider === "smtp" ? "smtp" : "resend"}
            smtpHost={workspace.smtp_host}
            smtpPort={workspace.smtp_port}
            smtpUser={workspace.smtp_user}
            smtpSecure={workspace.smtp_secure ?? true}
            smtpFromEmail={workspace.smtp_from_email}
            hasPassword={!!workspace.smtp_pass}
          />
        ) : (
          <div className="flex items-start gap-2 rounded-md bg-sky-50 px-4 py-3 text-sm text-sky-700">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Sending from your own domain (SMTP) is available on{" "}
              <strong>Basic</strong> and above. Your emails currently send
              through ConversionCRM&apos;s shared infrastructure.{" "}
              <Link href="/pricing" className="font-semibold underline">
                Upgrade
              </Link>
            </span>
          </div>
        )}
      </section>

      {/* ── Aha moment ─────────────────────────────────── */}
      <section id="aha" className="card p-5 sm:p-6 space-y-4 scroll-mt-24">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Aha moment (key feature)
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            The action that proves a user got value. It powers 20 points of the
            engagement score and decides who still needs the onboarding nudge.
          </p>
        </div>
        <AhaMomentForm
          currentName={workspace.key_feature_name}
          currentEvent={workspace.key_feature_event}
          currentUrl={workspace.key_feature_url}
        />
      </section>

      {/* ── Website URL ────────────────────────────────── */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Your website</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter the URL of the site where you installed the widget. The dashboard
            will then show only events from that site (filtering out localhost
            test events and noise from other origins).
          </p>
        </div>

        {workspace.website_url && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">
            <span>●</span>
            <span>
              Currently tracking: <strong>{workspace.website_url}</strong>
            </span>
          </div>
        )}

        <WebsiteUrlForm
          currentUrl={workspace.website_url}
          apiKey={workspace.api_key}
          eventsEndpoint={`${appUrl}/api/events`}
        />
      </section>

      {/* ── API Key ────────────────────────────────────── */}
      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">API Key</h2>
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Your widget is authenticated by this key. Keep it secret.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-sky-700 bg-sky-50 px-3 py-2.5 rounded-md font-mono break-all">
              {workspace.api_key}
            </code>
            <CopyButton text={workspace.api_key} label="Copy" compact />
          </div>
        </div>
      </section>

      {/* ── Workspace Info ─────────────────────────────── */}
      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Workspace</h2>
        <dl className="space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Company name</dt>
            <dd className="font-medium text-gray-900">{workspace.name}</dd>
          </div>
          {workspace.product_name && (
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Product name</dt>
              <dd className="font-medium text-gray-900">{workspace.product_name}</dd>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Key feature (aha moment)</dt>
            <dd className="font-medium text-gray-900">
              {workspace.key_feature_name ?? (
                <span className="text-gray-400 italic">Not set</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Trial length</dt>
            <dd className="font-medium text-gray-900">{workspace.trial_length_days} days</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
