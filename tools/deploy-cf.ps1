# =====================================================================
# دیپلوی ورکر روی Cloudflare با خواندن اعتبارنامه از فایل توکن
# ---------------------------------------------------------------------
# استفاده:
#   npm run deploy:cf          # دیپلوی واقعی
#   npm run deploy:cf:dry      # فقط باندل و بررسی، بدون آپلود
#   powershell -File tools/deploy-cf.ps1 -DryRun
#
# منبع اعتبارنامه: cloudflare/credentials.env (CLOUDFLARE_*)
# این اسکریپت هیچ متغیری را چاپ نمی‌کند.
# =====================================================================
param(
  [switch]$DryRun,
  [string]$OutDir = ".zwork/dryrun"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$credPath = Join-Path $root 'cloudflare/credentials.env'
if (-not (Test-Path $credPath)) { throw "فایل اعتبارنامه پیدا نشد: $credPath" }

$vars = @{}
foreach ($line in (Get-Content $credPath -Raw) -split "`r?`n") {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $k, $v = $line -split '=', 2
  $vars[$k.Trim()] = $v.Trim()
}

foreach ($need in 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID') {
  if (-not $vars[$need]) { throw "متغیر $need در credentials.env خالی است" }
}

$env:CLOUDFLARE_API_TOKEN = $vars['CLOUDFLARE_API_TOKEN']
$env:CLOUDFLARE_ACCOUNT_ID = $vars['CLOUDFLARE_ACCOUNT_ID']

if (-not (Test-Path (Join-Path $root 'node_modules/bcryptjs'))) {
  Write-Host '[deploy] node_modules ناقص است؛ npm install اجرا می‌شود…'
  npm install --no-audit --no-fund | Out-Null
}

if ($DryRun) {
  Write-Host '[deploy] حالت آزمایشی — بدون آپلود'
  npx wrangler deploy --dry-run --outdir $OutDir
} else {
  npx wrangler deploy
}
