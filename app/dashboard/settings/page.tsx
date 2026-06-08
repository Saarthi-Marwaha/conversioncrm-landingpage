import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { CopyButton } from "@/components/CopyButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createSupabaseAdminClient();
  const { data: workspace } = await admin
    .from("workspaces")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  if (!workspace) redirect("/onboarding");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io";

  const embedSnippet = `<script src="${appUrl}/api/widget?api_key=${workspace.api_key}"></script>
<script>
  // Call after login — identifies the current user
  ccrm.identify("USER_ID", {
    email: "user@example.com",
    name: "Jane Smith",
  });

  // Track key events manually (optional)
  ccrm.track("pricing_page_visit");
  ccrm.track("feature_click", { feature: "export" });
</script>`;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          {workspace.name} · {user.email}
        </p>
      </div>

      {/* ── Embed Snippet ─────────────────────────────── */}
      <section className="bg-white rounded-xl border border-indigo-100 p-6 space-y-4">
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
          <CopyButton text={embedSnippet} label="Copy snippet" />
        </div>

        <pre className="bg-gray-950 text-green-400 text-xs leading-relaxed rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono">
          {embedSnippet}
        </pre>

        <div className="bg-indigo-50 rounded-lg px-4 py-3 text-xs text-indigo-700 leading-relaxed">
          <strong>That&apos;s it.</strong> Login events, page views, and feature clicks
          are tracked automatically. Call{" "}
          <code className="bg-indigo-100 px-1 rounded">ccrm.identify()</code> after
          login and{" "}
          <code className="bg-indigo-100 px-1 rounded">ccrm.track()</code> for custom
          events.
        </div>
      </section>

      {/* ── API Key ────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">API Key</h2>
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Your widget is authenticated by this key. Keep it secret.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-indigo-700 bg-indigo-50 px-3 py-2.5 rounded-lg border border-indigo-100 font-mono break-all">
              {workspace.api_key}
            </code>
            <CopyButton text={workspace.api_key} label="Copy" compact />
          </div>
        </div>
      </section>

      {/* ── Workspace Info ─────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
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
