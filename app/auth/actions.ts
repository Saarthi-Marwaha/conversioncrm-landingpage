"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────
// Sign Up
// ─────────────────────────────────────────────

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/signup?error=Email+and+password+are+required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Redirect to onboarding — workspace will be created there
  redirect("/onboarding");
}

// ─────────────────────────────────────────────
// Sign In
// ─────────────────────────────────────────────

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/dashboard";

  if (!email || !password) {
    redirect("/login?error=Email+and+password+are+required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // After login, check if workspace already exists — if not, send to onboarding
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createSupabaseAdminClient();
    const { data: workspace } = await admin
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!workspace) {
      redirect("/onboarding");
    }
  }

  redirect(next);
}

// ─────────────────────────────────────────────
// Sign Out
// ─────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ─────────────────────────────────────────────
// Create Workspace (called from /onboarding)
// ─────────────────────────────────────────────

export async function createWorkspace(formData: FormData) {
  const companyName = (formData.get("company_name") as string)?.trim();
  const productName = (formData.get("product_name") as string)?.trim();
  const keyFeatureName = (formData.get("key_feature_name") as string)?.trim();

  if (!companyName || !productName || !keyFeatureName) {
    redirect("/onboarding?error=All+fields+are+required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if workspace already exists (prevent double-submit)
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (existing) {
    redirect("/dashboard/settings");
  }

  // Generate a unique API key
  const apiKey = `ccrm_${crypto.randomUUID().replace(/-/g, "")}`;

  const { error } = await admin.from("workspaces").insert({
    name: companyName,
    product_name: productName,
    owner_id: user.id,
    api_key: apiKey,
    key_feature_name: keyFeatureName,
    trial_length_days: 14,
  });

  if (error) {
    console.error("[createWorkspace]", error);
    redirect(`/onboarding?error=${encodeURIComponent("Failed to create workspace. Please try again.")}`);
  }

  redirect("/dashboard/settings");
}
