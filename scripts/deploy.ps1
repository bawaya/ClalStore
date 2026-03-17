# Deploy script for ClalMobile to Cloudflare Pages
# Usage: .\scripts\deploy.ps1

Write-Host "=== Building with OpenNext ===" -ForegroundColor Cyan
npx @opennextjs/cloudflare build --dangerouslyUseUnsupportedNextVersion
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Preparing for Pages deployment ===" -ForegroundColor Cyan

# Copy _worker.js
Copy-Item -Force ".open-next\worker.js" ".open-next\_worker.js"

# Copy static assets from assets/ to root (Pages serves them directly)
Copy-Item -Recurse -Force ".open-next\assets\_next" ".open-next\_next"
Copy-Item -Recurse -Force ".open-next\assets\icons" ".open-next\icons"
Copy-Item -Force ".open-next\assets\BUILD_ID" ".open-next\BUILD_ID"
Copy-Item -Force ".open-next\assets\manifest.json" ".open-next\manifest.json"
Copy-Item -Force ".open-next\assets\sw.js" ".open-next\sw.js"
Copy-Item -Force ".open-next\assets\pdf.worker.min.mjs" ".open-next\pdf.worker.min.mjs"

# Create _routes.json to exclude static assets from the worker
@'
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/_next/static/*",
    "/icons/*",
    "/manifest.json",
    "/sw.js",
    "/pdf.worker.min.mjs",
    "/BUILD_ID"
  ]
}
'@ | Set-Content ".open-next\_routes.json" -Encoding UTF8

Write-Host "`n=== Deploying to Cloudflare Pages ===" -ForegroundColor Cyan
npx wrangler pages deploy .open-next --project-name clalstore --branch main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { Write-Host "Deploy failed!" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Deployment complete! ===" -ForegroundColor Green
