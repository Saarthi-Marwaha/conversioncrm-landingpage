#!/usr/bin/env node
/**
 * scripts/tunnel.js
 *
 * Opens a FREE, reliable public tunnel to localhost:3000 via Cloudflare Tunnel
 * (cloudflared) — no account, no interstitial page, no rate limits.
 *
 * It captures the generated *.trycloudflare.com URL, writes it to
 * NEXT_PUBLIC_APP_URL in .env.local, and prints next steps.
 *
 * Usage:
 *   npm run tunnel
 *
 * Keep this terminal open while testing. Closing it stops the tunnel and
 * resets NEXT_PUBLIC_APP_URL back to http://localhost:3000.
 *
 * Requires cloudflared on PATH:
 *   winget install --id Cloudflare.cloudflared
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ENV_PATH = path.join(__dirname, "..", ".env.local");

/** Resolve the cloudflared executable from PATH or known install locations. */
function resolveCloudflared() {
  // 1. On PATH?
  const onPath = spawnSync(
    process.platform === "win32" ? "where" : "which",
    ["cloudflared"],
    { encoding: "utf8" }
  );
  if (onPath.status === 0 && onPath.stdout) {
    const first = onPath.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.trim();
  }
  // 2. Common Windows install locations
  const candidates = [
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "cloudflared"; // last resort; will error clearly if missing
}

const CLOUDFLARED = resolveCloudflared();

function patchEnv(key, value) {
  let content = fs.readFileSync(ENV_PATH, "utf8");
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  fs.writeFileSync(ENV_PATH, content, "utf8");
}

console.log(`\n🔌  Opening Cloudflare tunnel to http://localhost:${PORT} …\n`);

const proc = spawn(
  CLOUDFLARED,
  ["tunnel", "--url", `http://localhost:${PORT}`],
  { windowsHide: true }
);

let urlFound = false;
const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

function handleOutput(buf) {
  const text = buf.toString();
  // cloudflared prints the URL to stderr
  if (!urlFound) {
    const match = text.match(URL_RE);
    if (match) {
      urlFound = true;
      const url = match[0];
      patchEnv("NEXT_PUBLIC_APP_URL", url);

      console.log("✅  Tunnel open!\n");
      console.log(`   Public URL  →  ${url}\n`);
      console.log(`📝  Updated .env.local  →  NEXT_PUBLIC_APP_URL=${url}\n`);
      console.log("─────────────────────────────────────────────────────");
      console.log("  Next steps:");
      console.log("  1. RESTART your dev server (Ctrl+C in its terminal, then");
      console.log("     npm run dev) so the widget snippet uses the new URL.");
      console.log(`  2. Open ${url}/dashboard/settings and copy the fresh snippet.`);
      console.log("  3. Replace the old snippet on your live site with it.");
      console.log("  4. Keep THIS terminal open — closing it stops the tunnel.");
      console.log("─────────────────────────────────────────────────────\n");
    }
  }
}

proc.stdout.on("data", handleOutput);
proc.stderr.on("data", handleOutput);

proc.on("close", (code) => {
  console.log(`\n⚠️   Tunnel closed (exit ${code}).`);
  patchEnv("NEXT_PUBLIC_APP_URL", `http://localhost:${PORT}`);
  console.log("📝  Reset NEXT_PUBLIC_APP_URL back to http://localhost:3000");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n🛑  Shutting down tunnel…");
  proc.kill();
});
