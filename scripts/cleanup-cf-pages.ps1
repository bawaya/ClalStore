# cleanup-cf-pages.ps1 - PowerShell counterpart to cleanup-cf-pages.mjs.
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

function Get-DeploymentIds {
    param([string]$ProjectName)
    $raw = npx --yes wrangler@latest pages deployment list --project-name=$ProjectName 2>&1 | Out-String
    $ms = [regex]::Matches($raw, '([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})')
    $ids = @()
    foreach ($m in $ms) {
        $uuid = $m.Groups[1].Value
        if ($ids -notcontains $uuid) { $ids += $uuid }
    }
    return ,$ids
}

$totalDeleted = 0
$totalFailed  = 0
$round        = 0

while ($true) {
    $round++
    Write-Host "[cleanup] round $round - fetching deployments..." -ForegroundColor Gray
    $deploymentIds = Get-DeploymentIds -ProjectName $Project
    $batch = $deploymentIds.Count
    Write-Host "[cleanup] round $round - found $batch deployments" -ForegroundColor Cyan

    if ($batch -eq 0) { break }

    foreach ($id in $deploymentIds) {
        if (-not $Execute) {
            Write-Host "  [dry] would delete $id"
            continue
        }
        try {
            npx --yes wrangler@latest pages deployment delete $id --project-name=$Project --force 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "wrangler exited with $LASTEXITCODE" }
            $totalDeleted++
            Write-Host "  [OK]   $id" -ForegroundColor Green
        } catch {
            $totalFailed++
            Write-Host "  [FAIL] ${id}: $_" -ForegroundColor Red
        }
    }

    # Dry-run exits after one round (no deletions = list would never shrink)
    if (-not $Execute) { break }

    # Safety: bail if all 25 errored (otherwise infinite loop)
    if ($totalFailed -ge ($round * $batch)) {
        Write-Host "[cleanup] all deletions failing - bailing out" -ForegroundColor Red
        exit 1
    }

    if ($round -ge 200) {
        Write-Host "[cleanup] too many rounds - something is wrong" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "[cleanup] totalDeleted=$totalDeleted totalFailed=$totalFailed" -ForegroundColor Cyan

if (-not $Execute) {
    Write-Host "[cleanup] dry-run complete. Re-run with -Execute to actually delete." -ForegroundColor Yellow
    exit 0
}

if ($totalFailed -gt 0) {
    Write-Host "[cleanup] some deletions failed - not deleting project yet" -ForegroundColor Red
    exit 1
}

Write-Host "[cleanup] deleting project..." -ForegroundColor Cyan
npx --yes wrangler@latest pages project delete $Project --yes
if ($LASTEXITCODE -eq 0) {
    Write-Host "[cleanup] OK - project $Project deleted" -ForegroundColor Green
} else {
    Write-Host "[cleanup] project delete failed (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}
