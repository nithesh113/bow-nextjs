# scripts/migrate.ps1
# Run with: powershell -ExecutionPolicy Bypass -File scripts\migrate.ps1
# You'll be prompted for OLD and NEW URLs interactively (input is masked).
#
# Flags:
#   -DryRun    show what would be copied, exit without writing
#   -Yes       skip the final "press enter to confirm" prompt
#   -SkipPush  don't run prisma db push (assume schema already exists)

param(
    [switch]$DryRun,
    [switch]$Yes,
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

# Move to project root
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot
$ProjectRoot = (Get-Location).Path
Write-Host ""
Write-Host "============================================================"
Write-Host " BOW Neon Region Migration"
Write-Host "============================================================"
Write-Host " Project: $ProjectRoot"
Write-Host ""

function Read-Secret([string]$Prompt) {
    # Read a secret from the console while hiding the input
    $secure = Read-Host -AsSecureString $Prompt
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# Read the URLs (both user and password parts). We do this by reading the
# username:password segments as one secret each so nothing is echoed.
function Read-ConnString([string]$Label) {
    Write-Host ""
    Write-Host "Paste the full $Label pooled connection string below."
    Write-Host "Format:  postgresql://neondb_owner:<password>@ep-.../neondb?sslmode=require"
    Write-Host ""
    $raw = Read-Host "$Label connection URL"
    if (-not $raw.StartsWith("postgres")) {
        throw "$Label URL must start with 'postgres'"
    }
    return $raw
}

$Old = Read-ConnString "OLD (us-east-1)"
$New = Read-ConnString "NEW (ap-southeast-1)"

Write-Host ""
Write-Host "From: $($Old.Substring(0, 30))..."
Write-Host "To:   $($New.Substring(0, 30))..."

if (-not $Yes) {
    Write-Host ""
    Read-Host "Press Enter to continue, Ctrl+C to abort"
}

# Set the env vars in-process and invoke the migration script
$env:OLD_DATABASE_URL = $Old
$env:NEW_DATABASE_URL = $New

$flags = @()
if ($DryRun)  { $flags += "--dry-run" }
if ($SkipPush){ $flags += "--data-only" }
if ($Yes)     { $flags += "--yes" }

node --require ./scripts/node-realpath-patch.cjs scripts\migrate-neon-region.mjs @flags

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host "  Migration FAILED (exit $LASTEXITCODE)"
    Write-Host "============================================================"
} else {
    Write-Host ""
    Write-Host "============================================================"
    Write-Host "  Migration complete."
    Write-Host "  Update .env to the NEW URL and rebuild."
    Write-Host "============================================================"
}
