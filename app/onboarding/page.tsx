import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { BrandLogo } from "@/components/BrandLogo";

interface Props {
  searchParams: { error?: string };
}

export default async function OnboardingPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Already onboarded — route by plan: chosen → dashboard, not yet → pricing.
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("workspaces")
    .select("id, plan")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) redirect(existing.plan ? "/dashboard" : "/pricing");

  return (
    <main className="min-h-screen bg-[#f4f8fc] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-xl mb-6 flex items-center justify-between">
        <BrandLogo />
        <span className="text-xs text-gray-400 truncate ml-4">
          {user.email}
        </span>
      </div>
      <OnboardingWizard
        userEmail={user.email ?? ""}
        serverError={searchParams.error}
      />
    </main>
  );
}
