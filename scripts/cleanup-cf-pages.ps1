# cleanup-cf-pages.ps1 — PowerShell counterpart to cleanup-cf-pages.mjs.
# Uses your active `wrangler login` session (no API token needed).
#
# Run from the repo root:
#   .\scripts\cleanup-cf-pages.ps1               # dry-run
#   .\scripts\cleanup-cf-pages.ps1 -Execute      # real deletion

param(
    [string]$Project = "clalstore",
    [switch]$Execute = $false
)

$ErrorActionPreference = "Stop"

Write-Host "[cleanup] project=$Project dry-run=$(-not $Execute)" -ForegroundColor Cyan

# Probe: list deployments via wrangler (JSON output)
Write-Host "[cleanup] fetching deployments..." -ForegroundColor Gray
$raw = npx --yes wrangler@latest pages deployment list --project-name=$Project 2>&1 | Out-String

# Parse the Id column — every row starts with a UUID
$deploymentIds = [regex]::Matches($raw, '([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})') |
    ForEach-Object { $_.Groups[1].Value } |
    Select-Object -Unique

$total = $deploymentIds.Count
Write-Host "[cleanup] found $total deployments" -ForegroundColor Cyan

if ($total -eq 0) {
    Write-Host "[cleanup] nothing to delete — trying project delete" -ForegroundColor Yellow
    if ($Execute) {
        npx --yes wrangler@latest pages project delete $Project --yes
    } else {
        Write-Host "[dry] would: wrangler pages project delete $Project --yes"
    }
    exit 0
}

$deleted = 0
$failed = 0

foreach ($id in $deploymentIds) {
    if (-not $Execute) {
        Write-Host "  [dry] would delete $id"
        continue
    }
    try {
        npx --yes wrangler@latest pages deployment delete $id --project-name=$Project --yes 2>&1 | Out-Null
        $deleted++
        Write-Host "." -NoNewline -ForegroundColor Green
    } catch {
        $failed++
        Write-Host "`n  ✗ $id`: $_" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "[cleanup] deleted=$deleted failed=$failed" -ForegroundColor Cyan

if (-not $Execute) {
    Write-Host "[cleanup] dry-run; re-run with -Execute to actually delete" -ForegroundColor Yellow
    exit 0
}

if ($failed -gt 0) {
    Write-Host "[cleanup] some deployments failed — not deleting project yet" -ForegroundColor Red
    exit 1
}

Write-Host "[cleanup] deleting project..." -ForegroundColor Cyan
npx --yes wrangler@latest pages project delete $Project --yes
Write-Host "[cleanup] ✓ project $Project deleted" -ForegroundColor Green
