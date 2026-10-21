# تست مسیرهای فرم‌های کد روی نسخهٔ Node
$ErrorActionPreference = 'Continue'
$base = 'http://127.0.0.1:3000'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Show($label, $r) {
  $c = $r.Content
  if ($c.Length -gt 220) { $c = $c.Substring(0, 220) + '…' }
  "{0,-34} {1}  {2}" -f $label, $r.StatusCode, $c
}

Start-Sleep -Seconds 3
$ok = $true
try { $h = Invoke-WebRequest "$base/healthz" -UseBasicParsing -TimeoutSec 15; Show 'healthz' $h } catch { "healthz ERR: $($_.Exception.Message)"; $ok = $false }

# ورود مدیر پرستاری (کاربر نمونهٔ مستند)
$body = @{ user_id = '4ee9de45-dca3-4c1d-921a-e1c631c2967c'; password = '0000' } | ConvertTo-Json
try {
  $login = Invoke-WebRequest "$base/api/entry/role-login" -Method POST -Body $body -ContentType 'application/json' -WebSession $session -UseBasicParsing -TimeoutSec 20
  $u = ($login.Content | ConvertFrom-Json).user
  "login: $($login.StatusCode)  user=$($u.full_name)  is_manager=$($u.is_manager)"
} catch { "login ERR: $($_.Exception.Message)"; $ok = $false }

# خواندن فرم کد ۹۹
try {
  $g = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $session -UseBasicParsing -TimeoutSec 20
  $d = $g.Content | ConvertFrom-Json
  "codes GET: $($g.StatusCode)  entries=$($d.entries.Count)  people=$($d.people.Count)  can_edit=$($d.can_edit)"
} catch { "codes GET ERR: $($_.Exception.Message)" }

# نوشتن یک خانه
$cell = @{ type = '99'; year = 1405; month = 8; day = 3; shift = 'M'; role = 2; name = 'تست — سوپروایزر' } | ConvertTo-Json
try {
  $p = Invoke-WebRequest "$base/api/shift/codes/entry" -Method PUT -Body $cell -ContentType 'application/json' -WebSession $session -UseBasicParsing -TimeoutSec 20
  Show 'codes PUT' $p
} catch { "codes PUT ERR: $($_.Exception.Message)" }

# بازخوانی و پاک کردن
try {
  $g2 = Invoke-WebRequest "$base/api/shift/codes?type=99&year=1405&month=8" -WebSession $session -UseBasicParsing -TimeoutSec 20
  $stored = ($g2.Content | ConvertFrom-Json).entries | Where-Object { $_.day -eq 3 -and $_.shift -eq 'M' -and $_.role_no -eq 2 }
  "stored after PUT: '$($stored.person_name)'"
} catch { "reload ERR: $($_.Exception.Message)" }
$clear = @{ type = '99'; year = 1405; month = 8; day = 3; shift = 'M'; role = 2; name = '' } | ConvertTo-Json
try {
  $c = Invoke-WebRequest "$base/api/shift/codes/entry" -Method PUT -Body $clear -ContentType 'application/json' -WebSession $session -UseBasicParsing -TimeoutSec 20
  Show 'codes PUT (clear)' $c
} catch { "clear ERR: $($_.Exception.Message)" }

# اعتبارسنجی ورودی
$bad = @{ type = '77'; year = 1405; month = 8; day = 1; shift = 'M'; role = 1; name = 'x' } | ConvertTo-Json
try {
  $b = Invoke-WebRequest "$base/api/shift/codes/entry" -Method PUT -Body $bad -ContentType 'application/json' -WebSession $session -UseBasicParsing -TimeoutSec 20
  Show 'bad type (expect 400)' $b
} catch { "bad type: $($_.Exception.Response.StatusCode.value__) (expect 400)" }
