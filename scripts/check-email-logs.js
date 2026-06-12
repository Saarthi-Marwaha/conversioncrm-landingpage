#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
function read(name) {
  const m = env.match(new RegExp(`^${name}=(.+)$`, "m"));
  return m ? m[1].trim() : "";
}

const url = read("NEXT_PUBLIC_SUPABASE_URL");
const token = read("SUPABASE_ACCESS_TOKEN");
const ref = url.replace("https://", "").split(".")[0];
const api = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function q(sql) {
  const r = await fetch(api, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  return r.json();
}

(async () => {
  const logs = await q(
    `SELECT user_id, trigger, status, subject, sent_at, metadata
     FROM email_logs ORDER BY sent_at DESC LIMIT 20`
  );
  console.log("EMAIL_LOGS:", JSON.stringify(logs, null, 2));

  const ws = await q(
    `SELECT id, name, reply_to_email, emails_last_run_at FROM workspaces`
  );
  console.log("WORKSPACES:", JSON.stringify(ws, null, 2));
})();
