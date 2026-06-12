#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
function get(name) {
  const m = env.match(new RegExp(`^${name}=(.+)$`, "m"));
  return m ? m[1].trim() : "";
}

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const token = get("SUPABASE_ACCESS_TOKEN");
const ref = url.replace("https://", "").split(".")[0];
const api = `https://api.supabase.com/v1/projects/${ref}/database/query`;

const sql = `
select 'workspaces.' || column_name as name
from information_schema.columns
where table_schema = 'public' and table_name = 'workspaces'
  and column_name in ('reply_to_email', 'emails_last_run_at', 'email_sender_name')
union all
select 'table:' || table_name
from information_schema.tables
where table_schema = 'public' and table_name in ('usage_limit_signals', 'stages')
union all
select 'email_logs.' || column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'email_logs' and column_name = 'user_id';
`;

fetch(api, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
})
  .then((r) => r.text())
  .then((t) => console.log(t))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
