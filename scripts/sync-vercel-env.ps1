# Syncs selected keys from .env.local to Vercel Production.
# Usage: powershell -File scripts/sync-vercel-env.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

function Read-EnvVar([string]$name) {
  foreach ($line in Get-Content ".env.local") {
    if ($line -match "^$name=(.*)$") {
      return $Matches[1].Trim()
    }
  }
  return $null
}

$keys = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_FROM_NAME",
  "BYPASS_AUTH"
)

$defaults = @{
  "BYPASS_AUTH" = "true"
  "RESEND_FROM_EMAIL" = "noreply@mail.conversioncrm.co"
  "RESEND_FROM_NAME" = "ConversionCRM"
}

foreach ($key in $keys) {
  $value = Read-EnvVar $key
  if (-not $value -and $defaults.ContainsKey($key)) {
    $value = $defaults[$key]
  }
  if (-not $value) {
    Write-Host "Skip $key (empty)"
    continue
  }

  Write-Host "Setting $key on Vercel Production..."
  $existing = npx vercel env ls 2>$null | Select-String $key
  if ($existing) {
    npx vercel env rm $key production --yes 2>$null | Out-Null
  }
  $value | npx vercel env add $key production 2>&1 | Out-Null
  Write-Host "  OK"
}

Write-Host "Done. Redeploy for changes to take effect."
