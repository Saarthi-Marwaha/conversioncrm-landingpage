#!/usr/bin/env node
/**
 * Sync selected keys from .env.local → Vercel Production.
 * node scripts/sync-vercel-env.js
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const envPath = path.join(__dirname, "..", ".env.local");
const content = fs.readFileSync(envPath, "utf8");
const env = {};

for (const line of content.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i === -1) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_FROM_NAME",
];

const defaults = {
  RESEND_FROM_EMAIL: "noreply@mail.conversioncrm.com",
  RESEND_FROM_NAME: "ConversionCRM",
  BYPASS_AUTH: "true",
};

if (!env.BYPASS_AUTH) keys.push("BYPASS_AUTH");

function runVercel(args) {
  const r = spawnSync("npx", ["vercel", ...args], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    shell: true,
  });
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || "").trim();
    throw new Error(msg || `vercel ${args.join(" ")} failed`);
  }
}

for (const key of keys) {
  const value = env[key] || defaults[key];
  if (!value) {
    console.log(`skip ${key} (empty)`);
    continue;
  }
  console.log(`set ${key} → production`);
  runVercel([
    "env",
    "add",
    key,
    "production",
    "--value",
    value,
    "--yes",
    "--force",
  ]);
}

console.log("done");
