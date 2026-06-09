#!/usr/bin/env node
/**
 * scripts/run-migrations.js
 *
 * Runs all SQL migration files against Supabase via the Management API.
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (a Personal Access Token).
 *
 * Get one at: https://supabase.com/dashboard/account/tokens
 * Add it to .env.local:  SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx
 *
 * Usage:
 *   node scripts/run-migrations.js
 *   node scripts/run-migrations.js db/migrations/combined_migration.sql  (run one file)
 */

const fs = require("fs");
const path = require("path");

// Read .env.local directly (avoids stale/empty injected env overriding real values)
const envPath = path.join(__dirname, "..", ".env.local");
function readEnvVar(name) {
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (line.startsWith(name + "=")) return line.slice(name.length + 1).trim();
    }
  } catch {}
  return "";
}

// Token priority: --token=xxx CLI arg > .env.local file > process.env
const tokenArg = process.argv.find((a) => a.startsWith("--token="));
const cliToken = tokenArg ? tokenArg.split("=")[1] : "";

const supabaseUrl =
  readEnvVar("NEXT_PUBLIC_SUPABASE_URL") || process.env.NEXT_PUBLIC_SUPABASE_URL;
const accessToken =
  cliToken || readEnvVar("SUPABASE_ACCESS_TOKEN") || process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!accessToken) {
  console.error(`
❌  Missing SUPABASE_ACCESS_TOKEN in .env.local

To fix this:
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token", give it a name like "ConversionCRM dev"
3. Copy the token (starts with sbp_...)
4. Add to .env.local:
   SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx

Once added, re-run: node scripts/run-migrations.js
`);
  process.exit(1);
}

// Extract project ref from URL: https://PROJECTREF.supabase.co
const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

/**
 * Executes a SQL string via the Supabase Management API.
 */
async function runSql(sql) {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text)?.message ?? text; } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return text;
}

async function main() {
  // Allow running a specific file: node scripts/run-migrations.js path/to/file.sql
  const specificFile = process.argv
    .slice(2)
    .find((a) => !a.startsWith("--"));

  let files;
  if (specificFile) {
    files = [path.resolve(process.cwd(), specificFile)];
  } else {
    const migrationsDir = path.join(__dirname, "..", "db", "migrations");
    files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => path.join(migrationsDir, f));
  }

  console.log(`\n🔌  Connected to project: ${projectRef}`);
  console.log(`📂  Running ${files.length} migration file(s):\n`);

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const sql = fs.readFileSync(filePath, "utf8");

    process.stdout.write(`  ▶  ${fileName} ... `);
    try {
      const result = await runSql(sql);
      console.log("✅  Done");
      // Echo rows for SELECT/verification queries
      try {
        const rows = JSON.parse(result);
        if (Array.isArray(rows) && rows.length) {
          console.log(JSON.stringify(rows, null, 2));
        }
      } catch {}
    } catch (err) {
      const msg = err.message;
      if (msg.includes("already exists") || msg.includes("duplicate")) {
        console.log("⚠️   Already applied (skipped)");
      } else {
        console.log(`❌  Failed\n     ${msg}`);
        process.exit(1);
      }
    }
  }

  console.log("\n✅  All migrations complete!\n");
}

main().catch((err) => {
  console.error("❌  Unexpected error:", err.message);
  process.exit(1);
});
