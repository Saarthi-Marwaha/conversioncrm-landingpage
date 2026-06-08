import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createWorkspace } from "@/app/auth/actions";

interface Props {
  searchParams: { error?: string };
}

export default async function OnboardingPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Already onboarded — skip to settings
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (existing) redirect("/dashboard/settings");

  const error = searchParams.error;

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-lg p-8 rounded-2xl border border-gray-100 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900">ConversionCRM</span>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              Step 1 of 1
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Set up your workspace
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Tell us about your product. This takes 30 seconds and you&apos;re done.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action={createWorkspace} className="space-y-5">
          {/* Company name */}
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Company name
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              placeholder="Acme Inc."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Product name */}
          <div>
            <label htmlFor="product_name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Product name
            </label>
            <input
              id="product_name"
              name="product_name"
              type="text"
              required
              placeholder="Acme Dashboard"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Key feature (aha moment) */}
          <div>
            <label htmlFor="key_feature_name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Key feature — your &ldquo;aha moment&rdquo;
            </label>
            <input
              id="key_feature_name"
              name="key_feature_name"
              type="text"
              required
              placeholder='e.g. "Create first report" or "Connect integration"'
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
              The one feature that, when used, signals a user will convert.
              ConversionCRM will track this and use it to score + trigger emails.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors text-sm mt-2"
          >
            Create workspace →
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Signed in as {user.email}
        </p>
      </div>
    </main>
  );
}
