"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/active-workspace";

export async function saveWebsiteUrl(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const raw = (formData.get("website_url") as string | null) ?? "";
  // Normalise: strip trailing slash, ensure https:// prefix if a bare domain given
  let url = raw.trim().replace(/\/+$/, "");
  if (url && !url.startsWith("http")) {
    url = `https://${url}`;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ website_url: url || null })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveAhaMoment(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const name = ((formData.get("key_feature_name") as string) ?? "").trim();
  const rawEvent = ((formData.get("key_feature_event") as string) ?? "").trim();

  // Event names are snake_case identifiers like the widget sends.
  const event = rawEvent
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);

  if (name.length > 120) return { error: "Feature name is too long" };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      key_feature_name: name || null,
      key_feature_event: event || null,
    })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true, event };
}

export async function saveEmailDelivery(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const provider = formData.get("email_provider") === "smtp" ? "smtp" : "resend";
  const update: Record<string, unknown> = { email_provider: provider };

  if (provider === "smtp") {
    const host = ((formData.get("smtp_host") as string) ?? "").trim();
    const portRaw = ((formData.get("smtp_port") as string) ?? "").trim();
    const user = ((formData.get("smtp_user") as string) ?? "").trim();
    const pass = (formData.get("smtp_pass") as string) ?? "";
    const fromEmail = ((formData.get("smtp_from_email") as string) ?? "").trim();
    const secure = formData.get("smtp_secure") === "ssl";

    const port = Number(portRaw);
    if (!host || host.length > 255) return { error: "Enter a valid SMTP host" };
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { error: "Enter a valid SMTP port (e.g. 465 or 587)" };
    }
    if (!user) return { error: "SMTP username is required" };
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return { error: "From address must be a valid email" };
    }

    update.smtp_host = host;
    update.smtp_port = port;
    update.smtp_user = user;
    update.smtp_secure = secure;
    update.smtp_from_email = fromEmail || null;
    // Blank password = keep the stored one (never echoed to the client).
    if (pass) {
      if (pass.length > 512) return { error: "Password is too long" };
      update.smtp_pass = pass;
    } else if (!workspace.smtp_pass) {
      return { error: "SMTP password is required" };
    }
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update(update)
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveReplyToEmail(formData: FormData) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return { error: "No workspace" };

  const email = ((formData.get("reply_to_email") as string) ?? "").trim();
  const senderName = ((formData.get("email_sender_name") as string) ?? "").trim();
  if (!email) return { error: "Email is required" };
  if (!senderName) return { error: "Sender name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ reply_to_email: email, email_sender_name: senderName })
    .eq("id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
