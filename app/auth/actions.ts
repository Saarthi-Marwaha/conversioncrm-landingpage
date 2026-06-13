"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
// Google OAuth (works for both sign up and sign in)
// ─────────────────────────────────────────────

export async function signInWithGoogle() {
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    redirect(
      `/login?error=${encodeURIComponent(
        error?.message ?? "Google sign-in is not available right now"
      )}`
    );
  }

  redirect(data.url);
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
      .select("id, plan")
      .eq("owner_id", user.id)
      .single();

    // Mandatory funnel: set up → choose a plan → dashboard. No bypass.
    if (!workspace) {
      redirect("/onboarding");
    }
    if (!workspace.plan) {
      redirect("/pricing");
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string): never {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
}

export async function createWorkspace(formData: FormData) {
  const get = (k: string) => ((formData.get(k) as string) ?? "").trim();

  const companyName = get("company_name");
  const productName = get("product_name");
  const emailSenderName = get("email_sender_name") || productName;
  const provider = get("email_provider") === "smtp" ? "smtp" : "resend";
  const replyToEmail = get("reply_to_email");
  const keyFeatureName = get("key_feature_name");
  const keyFeatureUrl = get("key_feature_url");
  const rawEvent = get("key_feature_event");
  let websiteUrl = get("website_url").replace(/\/+$/, "");

  if (!companyName || !productName) fail("Company and product name are required");
  if (!keyFeatureName) fail("Name your aha-moment feature");
  if (!keyFeatureUrl) fail("The feature button link is required");
  if (!keyFeatureUrl.startsWith("/") && !/^https?:\/\/\S+$/i.test(keyFeatureUrl)) {
    fail("Feature link must be a full URL or a path starting with /");
  }
  if (!websiteUrl) fail("Your website URL is required");
  if (!websiteUrl.startsWith("http")) websiteUrl = `https://${websiteUrl}`;

  // ── Email delivery (Gmail/any inbox via built-in sender, or own SMTP) ──
  const smtp: Record<string, unknown> = {};
  if (provider === "smtp") {
    const host = get("smtp_host");
    const port = Number(get("smtp_port"));
    const user = get("smtp_user");
    const pass = (formData.get("smtp_pass") as string) ?? "";
    const fromEmail = get("smtp_from_email");
    if (!host || host.length > 255) fail("Enter a valid SMTP host");
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      fail("Enter a valid SMTP port (465 or 587)");
    }
    if (!user) fail("SMTP username is required");
    if (!pass) fail("SMTP password is required");
    if (fromEmail && !EMAIL_RE.test(fromEmail)) {
      fail("SMTP from address must be a valid email");
    }
    smtp.smtp_host = host;
    smtp.smtp_port = port;
    smtp.smtp_user = user;
    smtp.smtp_pass = pass;
    smtp.smtp_secure = get("smtp_secure") !== "starttls";
    smtp.smtp_from_email = fromEmail || null;
    // Replies default to the SMTP identity when not set explicitly.
    if (replyToEmail && !EMAIL_RE.test(replyToEmail)) {
      fail("Enter a valid reply-to email");
    }
  } else {
    if (!replyToEmail) fail("Enter the inbox that should receive replies");
    if (!EMAIL_RE.test(replyToEmail)) fail("Enter a valid reply-to email");
  }

  const resolvedReplyTo =
    replyToEmail ||
    (smtp.smtp_from_email as string | null) ||
    (smtp.smtp_user as string | undefined) ||
    null;

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
    // Already onboarded — let the dashboard's plan gate route them.
    redirect("/dashboard");
  }

  // Production API key for this workspace's widget
  const apiKey = `ccrm_${crypto.randomUUID().replace(/-/g, "")}`;

  const event = rawEvent
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);

  const { error } = await admin.from("workspaces").insert({
    name: companyName,
    product_name: productName,
    owner_id: user.id,
    api_key: apiKey,
    website_url: websiteUrl,
    key_feature_name: keyFeatureName,
    key_feature_url: keyFeatureUrl,
    key_feature_event: event || null,
    reply_to_email: resolvedReplyTo,
    email_sender_name: emailSenderName,
    email_provider: provider,
    ...smtp,
    trial_length_days: 14,
  });

  if (error) {
    console.error("[createWorkspace]", error);
    fail("Failed to create workspace. Please try again.");
  }

  // Fresh workspace has no plan yet — force the pricing choice (no bypass).
  redirect("/pricing");
}
