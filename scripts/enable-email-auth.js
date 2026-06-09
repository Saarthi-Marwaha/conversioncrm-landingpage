#!/usr/bin/env node
// Read token directly from .env.local, bypassing any pre-injected env
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");

function readEnvVar(name) {
  for (const line of envContent.split(/\r?\n/)) {
    if (line.startsWith(name + "=")) {
      return line.slice(name.length + 1).trim();
    }
  }
  return "";
}

const supabaseUrl = readEnvVar("NEXT_PUBLIC_SUPABASE_URL");
const token = readEnvVar("SUPABASE_ACCESS_TOKEN");

if (!supabaseUrl || !token) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const projectRef = supabaseUrl.replace("https://", "").split(".")[0];

async function main() {
  console.log(`🔌 Project: ${projectRef}`);
  console.log("📤 Enabling email auth...\n");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_email_enabled: true,
        disable_signup: false,
        mailer_autoconfirm: true,
        password_min_length: 8,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error("❌ Failed:", res.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("✅ Email auth enabled successfully!");
  console.log("  • Signup enabled   :", !data.disable_signup);
  console.log("  • Auto-confirm     :", data.mailer_autoconfirm ? "ON (no email confirmation needed)" : "OFF");
  console.log("  • Min password len :", data.password_min_length);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
